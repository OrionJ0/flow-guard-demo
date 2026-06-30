import { useEffect, useMemo, useRef, useState } from "react";
import {
  Button,
  Card,
  Divider,
  Empty,
  Input,
  InputNumber,
  List,
  Segmented,
  Select,
  Space,
  Tabs,
  Tag,
  Tree,
  Typography,
  App as AntApp,
} from "antd";
import {
  ArrowLeft,
  CheckCircle2,
  Diamond,
  DiamondPlus,
  Download,
  GitBranchPlus,
  LayoutGrid,
  Minus,
  PowerOff,
  Plus,
  Redo2,
  Save,
  Scan,
  Send,
  ShieldCheck,
  SlidersHorizontal,
  Trash2,
  TriangleAlert,
  Undo2,
  Upload,
  UserCheck,
  Workflow as WorkflowIcon,
} from "lucide-react";
import {
  Background,
  Controls,
  MarkerType,
  MiniMap,
  ReactFlow,
  type Connection,
  type Edge,
  type Node,
  type ReactFlowInstance,
  useEdgesState,
  useNodesState,
} from "@xyflow/react";
import WorkflowNode from "../components/WorkflowNode";
import { createEdge, createElement } from "../data/workflowFactory";
import {
  composeConditionExpression,
  CONDITION_FIELDS,
  CONDITION_OPERATORS,
  DEFAULT_CONDITION_PARTS,
  getConditionFieldMeta,
  parseConditionExpression,
  type ConditionFieldKey,
  type ConditionOperatorKey,
  type ConditionParts,
} from "../domain/conditionExpression";
import {
  deleteBranchEdge,
  deleteConditionGateway,
  getBranchDeletionImpact,
  getConditionDeletionImpact,
} from "../domain/workflowDeletion";
import { buildWorkflowExport, workflowExportFileName } from "../domain/workflowExport";
import { formatWorkflowEdgeLabel, getPropertyPanelTabKeys } from "../domain/workflowEditor";
import { parseWorkflowImport } from "../domain/workflowImport";
import { layoutWorkflow, shiftReachableElements, spreadGatewayBranches } from "../domain/workflowLayout";
import {
  canRedoWorkflow,
  canUndoWorkflow,
  createWorkflowHistory,
  pushWorkflowHistory,
  redoWorkflowHistory,
  undoWorkflowHistory,
  type WorkflowHistory,
} from "../domain/workflowHistory";
import {
  buildWorkflowValidation,
  hasBlockingValidationErrors,
} from "../domain/workflowValidation";
import {
  markWorkflowChanged,
  publishWorkflow,
  stopWorkflow,
  workflowStatusColor,
} from "../domain/workflowStatus";
import type {
  ApprovalScene,
  Selection,
  ValidationItem,
  Workflow,
  WorkflowEdge,
  WorkflowElement,
  WorkflowElementType,
} from "../types";

const { Text } = Typography;

const nodeTypes = { workflow: WorkflowNode };

const typeLabel: Record<WorkflowElementType, string> = {
  start: "开始事件",
  end: "结束事件",
  approval: "审批任务",
  condition: "条件网关",
  cc: "抄送任务",
  system: "安全动作",
};

const nodeSize: Record<WorkflowElementType, { width: number; height: number }> = {
  start: { width: 86, height: 82 },
  end: { width: 86, height: 82 },
  approval: { width: 188, height: 92 },
  condition: { width: 120, height: 100 },
  cc: { width: 188, height: 86 },
  system: { width: 188, height: 86 },
};

const approvalAssigneeOptions = [
  "业务负责人",
  "安全管理员",
  "合规管理员",
  "数据管理员",
  "部门负责人",
  "直属上级",
  "审计员",
  "法务负责人",
  "发起人自选",
];

const ccRangeOptions = [
  "审计员",
  "数据安全专员",
  "业务负责人",
  "合规管理员",
  "安全管理员",
  "数据管理员",
  "直属上级",
  "发起人",
];

const systemTargetOptions = [
  "当前审批实例",
  "访问记录",
  "导出文件摘要",
  "主数据",
  "缓存",
  "临时文件",
  "备案报表",
  "水印文件",
  "操作日志",
];

interface WorkflowConfigPageProps {
  scene: ApprovalScene;
  onBack: () => void;
  onSaveWorkflow: (workflow: Workflow) => Promise<void>;
}

function cloneWorkflow(workflow: Workflow): Workflow {
  return JSON.parse(JSON.stringify(workflow)) as Workflow;
}

function outgoing(workflow: Workflow, id: string) {
  return workflow.edges
    .filter((edge) => edge.source === id)
    .sort((a, b) => a.priority - b.priority);
}

function incoming(workflow: Workflow, id: string) {
  return workflow.edges.filter((edge) => edge.target === id);
}

function branchEdges(workflow: Workflow, gatewayId: string) {
  return outgoing(workflow, gatewayId).filter((edge) => edge.kind === "branch");
}

function toSelectOptions(values: string[]) {
  return values.map((value) => ({ value, label: value }));
}

function toMultiSelectValue(value: string) {
  if (!value || value === "待配置" || value === "请选择审批人") return [];
  return value
    .split(/[、,，]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function fromMultiSelectValue(values: string[]) {
  return values.length ? values.join("、") : "待配置";
}

function toSingleCustomValue(value: string) {
  if (!value || value === "待配置" || value === "请选择审批人") return [];
  return [value];
}

function fromSingleCustomValue(values: string[]) {
  const value = values[values.length - 1]?.trim();
  return value || "待配置";
}

function firstEditableElement(workflow: Workflow) {
  return (
    workflow.elements.find((element) => !["start", "end"].includes(element.type)) ||
    workflow.elements[0]
  );
}

function toFlowNodes(
  workflow: Workflow,
  selection: Selection,
  onQuickAdd: (sourceId: string, type: WorkflowElementType) => void,
  onQuickDelete: (nodeId: string) => void,
  errorElementIds: Set<string>,
  warningElementIds: Set<string>,
): Node[] {
  return workflow.elements.map((element) => ({
    id: element.id,
    type: "workflow",
    position: { x: element.x, y: element.y },
    data: { element, onQuickAdd, onQuickDelete } as unknown as Record<string, unknown>,
    selected: selection.kind === "node" && selection.id === element.id,
    className: errorElementIds.has(element.id)
      ? "has-validation-error"
      : warningElementIds.has(element.id)
        ? "has-validation-warning"
        : "",
    width: nodeSize[element.type].width,
    height: nodeSize[element.type].height,
  }));
}

function toFlowEdges(
  workflow: Workflow,
  selection: Selection,
  errorEdgeIds: Set<string>,
  warningEdgeIds: Set<string>,
): Edge[] {
  return workflow.edges.map((edge) => ({
    id: edge.id,
    source: edge.source,
    target: edge.target,
    type: "smoothstep",
    className: `${edge.kind === "branch" ? "edge-branch" : "edge-sequence"} ${
      errorEdgeIds.has(edge.id) ? "edge-invalid" : warningEdgeIds.has(edge.id) ? "edge-warning" : ""
    }`,
    label: formatWorkflowEdgeLabel(edge),
    labelShowBg: true,
    labelBgPadding: [8, 4],
    labelBgBorderRadius: 12,
    labelStyle: {
      fill: errorEdgeIds.has(edge.id)
        ? "#c9362e"
        : warningEdgeIds.has(edge.id)
          ? "#bd6b13"
          : edge.kind === "branch"
            ? "#5a43b4"
            : "#3c4a5d",
      fontWeight: edge.kind === "branch" ? 700 : 500,
      fontSize: 12,
    },
    labelBgStyle: {
      fill: "#ffffff",
      fillOpacity: 0.96,
      stroke: errorEdgeIds.has(edge.id)
        ? "#f3b0aa"
        : warningEdgeIds.has(edge.id)
          ? "#f2c98a"
          : edge.kind === "branch"
            ? "#d6ccfa"
            : "#d9e2ec",
      strokeWidth: 1,
    },
    markerEnd: {
      type: MarkerType.ArrowClosed,
      color: errorEdgeIds.has(edge.id)
        ? "#c9362e"
        : warningEdgeIds.has(edge.id)
          ? "#bd6b13"
          : edge.kind === "branch"
            ? "#6952c7"
            : "#7f8fa4",
    },
    style: {
      stroke:
        selection.kind === "edge" && selection.id === edge.id
          ? "#176bdc"
          : errorEdgeIds.has(edge.id)
            ? "#c9362e"
            : warningEdgeIds.has(edge.id)
              ? "#bd6b13"
              : edge.kind === "branch"
                ? "#6952c7"
                : "#7f8fa4",
      strokeWidth: selection.kind === "edge" && selection.id === edge.id ? 3 : edge.kind === "branch" ? 2.4 : 2,
    },
    selected: selection.kind === "edge" && selection.id === edge.id,
    interactionWidth: 20,
    pathOptions: { borderRadius: 18, offset: 32 },
    data: edge as unknown as Record<string, unknown>,
  }));
}

export default function WorkflowConfigPage({
  scene,
  onBack,
  onSaveWorkflow,
}: WorkflowConfigPageProps) {
  const { message, modal } = AntApp.useApp();
  const [workflow, setWorkflow] = useState<Workflow>(() => cloneWorkflow(scene.workflow));
  const [selection, setSelection] = useState<Selection>(() => ({
    kind: "node",
    id: firstEditableElement(scene.workflow).id,
  }));
  const [activePanel, setActivePanel] = useState("element");
  const [zoom, setZoom] = useState(0.65);
  const [history, setHistory] = useState<WorkflowHistory>(() => createWorkflowHistory());
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const flowInstanceRef = useRef<ReactFlowInstance | null>(null);
  const importInputRef = useRef<HTMLInputElement | null>(null);

  const selectedElement = useMemo(() => {
    if (selection.kind !== "node") return undefined;
    return workflow.elements.find((element) => element.id === selection.id);
  }, [selection, workflow.elements]);

  const selectedEdge = useMemo(() => {
    if (selection.kind !== "edge") return undefined;
    return workflow.edges.find((edge) => edge.id === selection.id);
  }, [selection, workflow.edges]);

  const selectedType = selectedEdge
    ? "分支连线"
    : selectedElement
      ? typeLabel[selectedElement.type]
      : "未选择";

  const validations = useMemo(() => buildWorkflowValidation(workflow), [workflow]);
  const errorElementIds = useMemo(
    () =>
      new Set(
        validations.flatMap((item) =>
          !item.ok && item.severity !== "warning" ? item.elementIds || [] : [],
        ),
      ),
    [validations],
  );
  const warningElementIds = useMemo(
    () =>
      new Set(
        validations.flatMap((item) =>
          !item.ok && item.severity === "warning" ? item.elementIds || [] : [],
        ),
      ),
    [validations],
  );
  const errorEdgeIds = useMemo(
    () =>
      new Set(
        validations.flatMap((item) =>
          !item.ok && item.severity !== "warning" ? item.edgeIds || [] : [],
        ),
      ),
    [validations],
  );
  const warningEdgeIds = useMemo(
    () =>
      new Set(
        validations.flatMap((item) =>
          !item.ok && item.severity === "warning" ? item.edgeIds || [] : [],
        ),
      ),
    [validations],
  );
  const branchCount = workflow.edges.filter((edge) => edge.kind === "branch").length;

  const syncSelectionForWorkflow = (nextWorkflow: Workflow) => {
    const exists =
      selection.kind === "node"
        ? nextWorkflow.elements.some((element) => element.id === selection.id)
        : nextWorkflow.edges.some((edge) => edge.id === selection.id);
    if (!exists) {
      setSelection({ kind: "node", id: firstEditableElement(nextWorkflow).id });
      setActivePanel("element");
    }
  };

  const replaceWorkflowFromHistory = (nextHistory: WorkflowHistory, nextWorkflow: Workflow) => {
    setHistory(nextHistory);
    setWorkflow(nextWorkflow);
    syncSelectionForWorkflow(nextWorkflow);
  };

  const undoWorkflowChange = () => {
    if (!canUndoWorkflow(history)) return;
    const result = undoWorkflowHistory(history, workflow);
    replaceWorkflowFromHistory(result.history, result.workflow);
  };

  const redoWorkflowChange = () => {
    if (!canRedoWorkflow(history)) return;
    const result = redoWorkflowHistory(history, workflow);
    replaceWorkflowFromHistory(result.history, result.workflow);
  };

  const updateWorkflow = (updater: (draft: Workflow) => void, recordHistory = true) => {
    const draft = cloneWorkflow(workflow);
    updater(draft);
    const next = markWorkflowChanged(draft);
    if (recordHistory) {
      setHistory((currentHistory) => pushWorkflowHistory(currentHistory, workflow));
    }
    setWorkflow(next);
  };

  const updateElement = (id: string, patch: Partial<WorkflowElement>) => {
    updateWorkflow((draft) => {
      const element = draft.elements.find((item) => item.id === id);
      if (element) Object.assign(element, patch);
    });
  };

  const updateEdge = (id: string, patch: Partial<WorkflowEdge>) => {
    updateWorkflow((draft) => {
      const edge = draft.edges.find((item) => item.id === id);
      if (edge) Object.assign(edge, patch);
    });
  };

  const addTaskAfter = (source: WorkflowElement, type: Exclude<WorkflowElementType, "start" | "end" | "condition">) => {
    updateWorkflow((draft) => {
      const out = outgoing(draft, source.id)[0];
      const target = out ? draft.elements.find((element) => element.id === out.target) : undefined;
      if (target) {
        const shifted = shiftReachableElements(draft, target.id, 260);
        draft.elements = shifted.elements;
      }
      const next = createElement(type, typeLabel[type], source.x + 260, source.y + 4);
      draft.elements.push(next);
      if (out) draft.edges = draft.edges.filter((edge) => edge.id !== out.id);
      draft.edges.push(createEdge(source.id, next.id));
      if (target) draft.edges.push(createEdge(next.id, target.id));
      setSelection({ kind: "node", id: next.id });
      setActivePanel("element");
    });
    message.success("已添加节点");
  };

  const insertGatewayAfter = (source: WorkflowElement) => {
    updateWorkflow((draft) => {
      const out = outgoing(draft, source.id)[0];
      const target = out ? draft.elements.find((element) => element.id === out.target) : undefined;
      if (target) {
        const shifted = shiftReachableElements(draft, target.id, 520);
        draft.elements = shifted.elements;
      }
      const gateway = createElement("condition", "条件判断", source.x + 260, source.y + 8);
      const yes = createElement("approval", "条件审批", gateway.x + 260, gateway.y - 120, {
        assignee: "待配置",
      });
      const no = createElement("cc", "否则抄送", gateway.x + 260, gateway.y + 122, {
        ccRange: "待配置",
      });
      draft.elements.push(gateway, yes, no);
      if (out) draft.edges = draft.edges.filter((edge) => edge.id !== out.id);
      draft.edges.push(createEdge(source.id, gateway.id));
      draft.edges.push(
        createEdge(gateway.id, yes.id, "条件1", "请配置条件表达", 1, "如果", "branch"),
      );
      draft.edges.push(createEdge(gateway.id, no.id, "否则", "其他情况", 2, "否则", "branch"));
      if (target) {
        draft.edges.push(createEdge(yes.id, target.id));
        draft.edges.push(createEdge(no.id, target.id));
      }
      const arranged = spreadGatewayBranches(draft, gateway.id);
      draft.elements = arranged.elements;
      draft.edges = arranged.edges;
      setSelection({ kind: "node", id: gateway.id });
      setActivePanel("branch");
    });
    message.success("已添加条件网关");
  };

  const addBranchTarget = (gatewayId: string, type: WorkflowElementType) => {
    updateWorkflow((draft) => {
      const gateway = draft.elements.find((element) => element.id === gatewayId);
      if (!gateway) return;
      if (type === "condition") {
        const branchTotal = branchEdges(draft, gatewayId).length;
        const nested = createElement("condition", "嵌套条件", gateway.x + 260, gateway.y + (branchTotal - 0.5) * 140);
        const yes = createElement("approval", "二级审批", nested.x + 250, nested.y - 92, {
          assignee: "待配置",
        });
        const no = createElement("cc", "否则抄送", nested.x + 250, nested.y + 92, {
          ccRange: "待配置",
        });
        draft.elements.push(nested, yes, no);
        draft.edges.push(
          createEdge(gateway.id, nested.id, `条件${branchTotal + 1}`, "请配置条件表达", branchTotal + 1, "如果", "branch"),
        );
        draft.edges.push(createEdge(nested.id, yes.id, "条件1", "请配置条件表达", 1, "如果", "branch"));
        draft.edges.push(createEdge(nested.id, no.id, "否则", "其他情况", 2, "否则", "branch"));
        let arranged = spreadGatewayBranches(draft, gateway.id);
        arranged = spreadGatewayBranches(arranged, nested.id);
        draft.elements = arranged.elements;
        draft.edges = arranged.edges;
        setSelection({ kind: "node", id: nested.id });
        setActivePanel("branch");
        return;
      }
      const branchTotal = branchEdges(draft, gatewayId).length;
      const next = createElement(type, typeLabel[type], gateway.x + 260, gateway.y + (branchTotal - 0.5) * 132);
      draft.elements.push(next);
      draft.edges.push(
        createEdge(gateway.id, next.id, `条件${branchTotal + 1}`, "请配置条件表达", branchTotal + 1, "如果", "branch"),
      );
      const arranged = spreadGatewayBranches(draft, gateway.id);
      draft.elements = arranged.elements;
      draft.edges = arranged.edges;
      setSelection({ kind: "node", id: next.id });
      setActivePanel("element");
    });
    message.success(type === "condition" ? "已添加嵌套条件" : "已新增条件分支");
  };

  const appendElement = (type: WorkflowElementType, sourceId?: string) => {
    const source =
      (sourceId ? workflow.elements.find((element) => element.id === sourceId) : undefined) ||
      selectedElement ||
      workflow.elements.find((element) => element.id === firstEditableElement(workflow).id);
    if (!source) return;
    if (source.type === "end") {
      message.warning("结束事件后不能继续添加节点");
      return;
    }
    if (source.type === "condition") {
      addBranchTarget(source.id, type === "start" || type === "end" ? "approval" : type);
      return;
    }
    if (type === "condition") {
      insertGatewayAfter(source);
      return;
    }
    if (type === "start" || type === "end") return;
    addTaskAfter(source, type);
  };

  const appendElementFrom = (sourceId: string, type: WorkflowElementType) => {
    setSelection({ kind: "node", id: sourceId });
    appendElement(type, sourceId);
  };

  const gatewayForBranchAction = () => {
    if (selectedElement?.type === "condition") return selectedElement;
    if (selectedEdge?.kind === "branch") {
      return workflow.elements.find((element) => element.id === selectedEdge.source);
    }
    return undefined;
  };

  const deleteElementById = (nodeId: string) => {
    const element = workflow.elements.find((item) => item.id === nodeId);
    if (!element) return;
    if (element.type === "start" || element.type === "end") {
      message.warning("开始和结束事件不能删除");
      return;
    }
    if (element.type === "condition") {
      const impact = getConditionDeletionImpact(workflow, element.id);
      modal.confirm({
        title: "删除条件网关",
        content: `该网关包含 ${impact.branchCount} 条分支，预计影响 ${impact.removableNodeIds.length} 个分支下游节点。确认后将删除网关、相关分支连线和仅属于这些分支的下游节点。`,
        okText: "删除网关及分支节点",
        cancelText: "取消",
        okButtonProps: { danger: true },
        onOk: () => {
          updateWorkflow((draft) => {
            const next = deleteConditionGateway(draft, element.id);
            draft.elements = next.elements;
            draft.edges = next.edges;
            const fallback = incoming(workflow, element.id)[0]?.source || firstEditableElement(next).id;
            setSelection({ kind: "node", id: fallback });
            setActivePanel("element");
          });
          message.success("条件网关已删除");
        },
      });
      return;
    }
    updateWorkflow((draft) => {
      const inEdges = incoming(draft, element.id);
      const outEdges = outgoing(draft, element.id);
      draft.elements = draft.elements.filter((item) => item.id !== element.id);
      draft.edges = draft.edges.filter((edge) => edge.source !== element.id && edge.target !== element.id);
      if (element.type !== "condition" && inEdges.length === 1 && outEdges.length === 1) {
        draft.edges.push(
          createEdge(
            inEdges[0].source,
            outEdges[0].target,
            inEdges[0].label,
            inEdges[0].expression,
            inEdges[0].priority,
            inEdges[0].mode,
            inEdges[0].kind,
          ),
        );
      }
      const fallback = inEdges[0]?.source || firstEditableElement(draft).id;
      setSelection({ kind: "node", id: fallback });
      setActivePanel("element");
    });
    message.success("节点已删除");
  };

  const deleteSelected = () => {
    if (selection.kind === "edge") {
      const edge = workflow.edges.find((item) => item.id === selection.id);
      if (!edge) return;
      if (edge.kind === "branch") {
        const impact = getBranchDeletionImpact(workflow, edge.id);
        modal.confirm({
          title: "删除条件分支",
          content: `仅删除连线会保留下游节点；删除分支及后续节点将同时删除 ${impact.removableNodeIds.length} 个仅属于该分支的节点。`,
          okText: "删除分支及后续节点",
          cancelText: "仅删除连线",
          okButtonProps: { danger: true },
          onOk: () => {
            updateWorkflow((draft) => {
              const next = deleteBranchEdge(draft, edge.id, "branch-subtree");
              draft.elements = next.elements;
              draft.edges = next.edges;
              setSelection({ kind: "node", id: edge.source });
              setActivePanel("element");
            });
            message.success("分支及后续节点已删除");
          },
          onCancel: () => {
            updateWorkflow((draft) => {
              const next = deleteBranchEdge(draft, edge.id, "edge-only");
              draft.elements = next.elements;
              draft.edges = next.edges;
              setSelection({ kind: "node", id: edge.source });
              setActivePanel("element");
            });
            message.success("分支连线已删除");
          },
        });
        return;
      }
      updateWorkflow((draft) => {
        draft.edges = draft.edges.filter((item) => item.id !== selection.id);
      });
      message.success("连线已删除");
      return;
    }
    if (selectedElement) deleteElementById(selectedElement.id);
  };

  const autoLayout = () => {
    updateWorkflow((draft) => {
      const next = layoutWorkflow(draft);
      draft.elements = next.elements;
      draft.edges = next.edges;
    });
    window.setTimeout(() => flowInstanceRef.current?.fitView({ padding: 0.18 }), 0);
    message.success("已整理布局");
  };

  const saveWorkflow = async () => {
    await onSaveWorkflow({ ...workflow, name: `${scene.name}审批` });
  };

  const exportWorkflowJson = () => {
    const sceneForExport: ApprovalScene = {
      ...scene,
      workflow: { ...workflow, name: `${scene.name}审批` },
    };
    const payload = buildWorkflowExport(sceneForExport);
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: "application/json;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = workflowExportFileName(scene.name, scene.id);
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    message.success("已导出当前流程 JSON");
  };

  const importWorkflowJson = async (file?: File) => {
    if (!file) return;
    try {
      const imported = parseWorkflowImport(await file.text()).scene.workflow;
      const next = markWorkflowChanged({
        ...imported,
        name: `${scene.name}审批`,
        status: workflow.status,
      });
      setHistory((currentHistory) => pushWorkflowHistory(currentHistory, workflow));
      setWorkflow(next);
      setActivePanel("check");
      await onSaveWorkflow(next);
      const importedValidations = buildWorkflowValidation(next);
      if (hasBlockingValidationErrors(importedValidations)) {
        message.warning("JSON 已导入，流程存在校验问题");
      } else {
        message.success("JSON 已导入当前场景");
      }
    } catch (error) {
      message.error(error instanceof Error ? error.message : "导入失败");
    }
  };

  const confirmPublishWorkflow = async () => {
    const failed = validations.find((item) => !item.ok);
    if (hasBlockingValidationErrors(validations)) {
      setActivePanel("check");
      message.warning(failed ? `${failed.title}未通过：${failed.detail}` : "存在未通过校验，处理后才能确认启用");
      return;
    }
    const next = publishWorkflow({ ...workflow, name: `${scene.name}审批` });
    setWorkflow(next);
    await onSaveWorkflow(next);
    message.success(workflow.status === "有未发布变更" ? "变更已发布" : "流程已确认启用");
  };

  const stopCurrentWorkflow = async () => {
    const next = stopWorkflow({ ...workflow, name: `${scene.name}审批` });
    setWorkflow(next);
    await onSaveWorkflow(next);
    message.success("流程已停用");
  };

  useEffect(() => {
    const handleHistoryShortcuts = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const tagName = target?.tagName.toLowerCase();
      if (target?.isContentEditable || tagName === "input" || tagName === "textarea") return;

      const isModifierPressed = event.metaKey || event.ctrlKey;
      if (!isModifierPressed) return;

      const key = event.key.toLowerCase();
      if (key === "z" && event.shiftKey) {
        event.preventDefault();
        redoWorkflowChange();
      } else if (key === "z") {
        event.preventDefault();
        undoWorkflowChange();
      } else if (key === "y") {
        event.preventDefault();
        redoWorkflowChange();
      }
    };

    window.addEventListener("keydown", handleHistoryShortcuts);
    return () => window.removeEventListener("keydown", handleHistoryShortcuts);
  }, [history, workflow, selection]);

  useEffect(() => {
    setNodes(
      toFlowNodes(
        workflow,
        selection,
        appendElementFrom,
        deleteElementById,
        errorElementIds,
        warningElementIds,
      ),
    );
    setEdges(toFlowEdges(workflow, selection, errorEdgeIds, warningEdgeIds));
  }, [errorEdgeIds, errorElementIds, selection, warningEdgeIds, warningElementIds, workflow, setEdges, setNodes]);

  const selectedGateway = gatewayForBranchAction();
  const currentBranch =
    selectedEdge?.kind === "branch"
      ? selectedEdge
      : selectedGateway
        ? branchEdges(workflow, selectedGateway.id)[0]
        : undefined;
  const gatewayBranches = selectedGateway ? branchEdges(workflow, selectedGateway.id) : [];
  const canPublish = workflow.status !== "已启用";
  const publishText =
    workflow.status === "有未发布变更"
      ? "发布变更"
      : workflow.status === "已停用"
        ? "重新启用"
        : "确认启用";
  const propertyPanelTabKeys = useMemo(
    () => getPropertyPanelTabKeys(workflow, selection),
    [selection, workflow],
  );
  const propertyPanelItems = [
    {
      key: "element",
      label: "节点",
      children: selectedElement ? (
        <ElementPanel element={selectedElement} updateElement={updateElement} />
      ) : (
        <Empty description="请选择节点" />
      ),
    },
    {
      key: "branch",
      label: "分支",
      children: (
        <BranchPanel
          edge={currentBranch}
          branches={gatewayBranches}
          elements={workflow.elements}
          edges={workflow.edges}
          gatewayId={selectedGateway?.id}
          updateEdge={updateEdge}
          selectEdge={(id) => {
            setSelection({ kind: "edge", id });
            setActivePanel("branch");
          }}
          addBranch={() => {
            const gateway = gatewayForBranchAction();
            if (!gateway) return message.warning("请选择条件网关");
            addBranchTarget(gateway.id, "approval");
          }}
          addNested={() => {
            const gateway = gatewayForBranchAction();
            if (!gateway) return message.warning("请选择条件网关");
            addBranchTarget(gateway.id, "condition");
          }}
        />
      ),
    },
    {
      key: "check",
      label: "校验",
      children: <CheckPanel validations={validations} />,
    },
  ].filter((item) => propertyPanelTabKeys.includes(item.key as (typeof propertyPanelTabKeys)[number]));

  useEffect(() => {
    if (!propertyPanelTabKeys.includes(activePanel as (typeof propertyPanelTabKeys)[number])) {
      setActivePanel(propertyPanelTabKeys[0]);
    }
  }, [activePanel, propertyPanelTabKeys]);

  return (
    <div className="app-shell flow-page">
      <header className="topbar">
        <div className="brand">
          <span className="brand-icon brand-icon-dark">
            <WorkflowIcon size={18} />
          </span>
          <span>
            <strong>流程配置</strong>
            <em>{scene.name}</em>
          </span>
        </div>
        <Space wrap>
          <Button icon={<ArrowLeft size={16} />} onClick={onBack}>
            返回场景
          </Button>
          <Button icon={<Save size={16} />} onClick={saveWorkflow}>
            保存
          </Button>
          <Button icon={<Download size={16} />} onClick={exportWorkflowJson}>
            导出 JSON
          </Button>
          <Button icon={<Upload size={16} />} onClick={() => importInputRef.current?.click()}>
            导入 JSON
          </Button>
          {(workflow.status === "已启用" || workflow.status === "有未发布变更") && (
            <Button danger icon={<PowerOff size={16} />} onClick={stopCurrentWorkflow}>
              停用
            </Button>
          )}
          <Button
            type="primary"
            disabled={!canPublish}
            icon={<CheckCircle2 size={16} />}
            onClick={confirmPublishWorkflow}
          >
            {publishText}
          </Button>
        </Space>
        <input
          ref={importInputRef}
          hidden
          type="file"
          accept="application/json,.json"
          onChange={(event) => {
            void importWorkflowJson(event.target.files?.[0]);
            event.target.value = "";
          }}
        />
      </header>

      <main className="flow-modeler">
        <section className="canvas-panel">
          <div className="canvas-toolbar">
            <div className="canvas-meta">
              <strong>{scene.name}</strong>
              <span>{scene.desc || "配置当前场景的审批流转节点、条件分支、抄送规则和安全动作。"}</span>
            </div>
            <div className="canvas-stats">
              <Tag color="blue">节点 {workflow.elements.length}</Tag>
              <Tag color="purple">分支 {branchCount}</Tag>
              <Tag color={workflowStatusColor(workflow.status)}>
                状态 {workflow.status}
              </Tag>
            </div>
            <Space wrap>
              <Button icon={<UserCheck size={15} />} onClick={() => appendElement("approval")}>
                审批任务
              </Button>
              <Button icon={<Diamond size={15} />} onClick={() => appendElement("condition")}>
                条件网关
              </Button>
              <Button icon={<Send size={15} />} onClick={() => appendElement("cc")}>
                抄送任务
              </Button>
              <Button icon={<ShieldCheck size={15} />} onClick={() => appendElement("system")}>
                安全动作
              </Button>
            </Space>
            <Space wrap>
              <Button
                aria-label="适配画布"
                icon={<Scan size={16} />}
                onClick={() => flowInstanceRef.current?.fitView({ padding: 0.18 })}
              />
              <Button aria-label="缩小" icon={<Minus size={16} />} onClick={() => flowInstanceRef.current?.zoomOut()} />
              <span className="zoom-value">{Math.round(zoom * 100)}%</span>
              <Button aria-label="放大" icon={<Plus size={16} />} onClick={() => flowInstanceRef.current?.zoomIn()} />
              <Button
                aria-label="撤销"
                disabled={!canUndoWorkflow(history)}
                icon={<Undo2 size={16} />}
                onClick={undoWorkflowChange}
              />
              <Button
                aria-label="重做"
                disabled={!canRedoWorkflow(history)}
                icon={<Redo2 size={16} />}
                onClick={redoWorkflowChange}
              />
              <Button icon={<LayoutGrid size={16} />} onClick={autoLayout}>
                整理布局
              </Button>
              <Button danger icon={<Trash2 size={16} />} onClick={deleteSelected}>
                删除
              </Button>
            </Space>
          </div>

          <div className="reactflow-shell">
            <ReactFlow
              nodes={nodes}
              edges={edges}
              nodeTypes={nodeTypes}
              fitView
              minZoom={0.35}
              maxZoom={1.5}
              defaultViewport={{ x: 0, y: 0, zoom }}
              onInit={(instance) => {
                flowInstanceRef.current = instance;
              }}
              onMove={(_, viewport) => setZoom(viewport.zoom)}
              onNodeClick={(_, node) => {
                setSelection({ kind: "node", id: node.id });
                setActivePanel("element");
              }}
              onNodesChange={onNodesChange}
              onEdgesChange={onEdgesChange}
              onEdgeClick={(_, edge) => {
                setSelection({ kind: "edge", id: edge.id });
                setActivePanel("branch");
              }}
              onNodeDragStop={(_, node) => {
                updateElement(node.id, { x: Math.round(node.position.x), y: Math.round(node.position.y) });
              }}
              onConnect={(connection: Connection) => {
                if (!connection.source || !connection.target) return;
                updateWorkflow((draft) => {
                  const source = draft.elements.find((element) => element.id === connection.source);
                  const edge = createEdge(
                    connection.source!,
                    connection.target!,
                    source?.type === "condition" ? "条件" : "",
                    source?.type === "condition" ? "请配置条件表达" : "",
                    outgoing(draft, connection.source!).length + 1,
                    "如果",
                    source?.type === "condition" ? "branch" : "sequence",
                  );
                  const exists = draft.edges.some(
                    (item) => item.source === edge.source && item.target === edge.target,
                  );
                  if (!exists) {
                    draft.edges.push(edge);
                    if (source?.type === "condition") {
                      const arranged = spreadGatewayBranches(draft, source.id);
                      draft.elements = arranged.elements;
                      draft.edges = arranged.edges;
                    }
                  }
                });
              }}
            >
              <Background gap={24} color="#ced9e6" />
              <Controls showInteractive={false} />
              <MiniMap pannable zoomable nodeStrokeWidth={3} />
            </ReactFlow>
          </div>
        </section>

        <aside className="props-panel">
          <Card
            title={
              <span className="panel-title">
                <SlidersHorizontal size={17} />
                属性
              </span>
            }
            extra={<Tag color="blue">{selectedType}</Tag>}
          >
            <Tabs
              activeKey={activePanel}
              onChange={setActivePanel}
              items={propertyPanelItems}
            />
          </Card>
        </aside>
      </main>
    </div>
  );
}

function ElementPanel({
  element,
  updateElement,
}: {
  element: WorkflowElement;
  updateElement: (id: string, patch: Partial<WorkflowElement>) => void;
}) {
  return (
    <div className="props-form">
      <label>
        <span>名称</span>
        <Input value={element.title} onChange={(event) => updateElement(element.id, { title: event.target.value })} />
      </label>
      <label>
        <span>说明</span>
        <Input.TextArea
          value={element.desc}
          rows={3}
          onChange={(event) => updateElement(element.id, { desc: event.target.value })}
        />
      </label>

      {element.type === "approval" && (
        <>
          <div className="split-fields">
            <label>
              <span>审批人类型</span>
              <Select
                value={element.approverType}
                onChange={(value) => updateElement(element.id, { approverType: value })}
                options={["指定角色", "指定成员", "直属上级", "发起人自选"].map((value) => ({ value, label: value }))}
              />
            </label>
            <label>
              <span>审批方式</span>
              <Select
                value={element.approvalMode}
                onChange={(value) => updateElement(element.id, { approvalMode: value })}
                options={["或签", "会签", "依次审批"].map((value) => ({ value, label: value }))}
              />
            </label>
          </div>
          <label>
            <span>审批对象</span>
            <Select
              mode="tags"
              showSearch
              allowClear
              maxTagCount={1}
              placeholder="选择或输入审批对象"
              value={toSingleCustomValue(element.assignee)}
              onChange={(values) => updateElement(element.id, { assignee: fromSingleCustomValue(values) })}
              options={toSelectOptions(approvalAssigneeOptions)}
            />
          </label>
          <div className="split-fields">
            <label>
              <span>超时小时</span>
              <InputNumber
                min={0}
                value={element.timeoutHours}
                onChange={(value) => updateElement(element.id, { timeoutHours: Number(value || 0) })}
              />
            </label>
            <label>
              <span>超时动作</span>
              <Select
                value={element.timeoutAction}
                onChange={(value) => updateElement(element.id, { timeoutAction: value })}
                options={["提醒", "自动通过", "自动驳回", "升级处理"].map((value) => ({ value, label: value }))}
              />
            </label>
          </div>
        </>
      )}

      {element.type === "cc" && (
        <>
          <label>
            <span>抄送范围</span>
            <Select
              mode="tags"
              showSearch
              allowClear
              maxTagCount="responsive"
              placeholder="选择或输入抄送对象"
              value={toMultiSelectValue(element.ccRange)}
              onChange={(values) => updateElement(element.id, { ccRange: fromMultiSelectValue(values) })}
              options={toSelectOptions(ccRangeOptions)}
            />
          </label>
          <label>
            <span>抄送时机</span>
            <Select
              value={element.ccTiming}
              onChange={(value) => updateElement(element.id, { ccTiming: value })}
              options={["流程结束后", "节点通过后", "流程发起时"].map((value) => ({ value, label: value }))}
            />
          </label>
        </>
      )}

      {element.type === "system" && (
        <>
          <label>
            <span>安全动作</span>
            <Select
              value={element.systemAction}
              onChange={(value) => updateElement(element.id, { systemAction: value })}
              options={["记录操作日志", "触发异常告警", "删除数据", "匿名化处理", "生成备案材料"].map((value) => ({
                value,
                label: value,
              }))}
            />
          </label>
          <label>
            <span>处理对象</span>
            <Select
              mode="tags"
              showSearch
              allowClear
              maxTagCount="responsive"
              placeholder="选择或输入处理对象"
              value={toMultiSelectValue(element.systemTarget)}
              onChange={(values) => updateElement(element.id, { systemTarget: fromMultiSelectValue(values) })}
              options={toSelectOptions(systemTargetOptions)}
            />
          </label>
        </>
      )}
    </div>
  );
}

function BranchPanel({
  edge,
  branches,
  elements,
  edges,
  gatewayId,
  updateEdge,
  selectEdge,
  addBranch,
  addNested,
}: {
  edge?: WorkflowEdge;
  branches: WorkflowEdge[];
  elements: WorkflowElement[];
  edges: WorkflowEdge[];
  gatewayId?: string;
  updateEdge: (id: string, patch: Partial<WorkflowEdge>) => void;
  selectEdge: (id: string) => void;
  addBranch: () => void;
  addNested: () => void;
}) {
  if (!edge) {
    return (
      <div className="branch-panel">
        <Empty description="请选择条件网关或分支连线" />
        <Space wrap>
          <Button icon={<GitBranchPlus size={16} />} onClick={addBranch}>
            新增分支
          </Button>
          <Button icon={<DiamondPlus size={16} />} onClick={addNested}>
            嵌套条件
          </Button>
        </Space>
      </div>
    );
  }

  return (
    <div className="branch-panel">
      <div className="props-form">
        <label>
          <span>分支名称</span>
          <Input value={edge.label} onChange={(event) => updateEdge(edge.id, { label: event.target.value })} />
        </label>
        <label>
          <span>条件表达</span>
          <ConditionExpressionBuilder edge={edge} updateEdge={updateEdge} />
        </label>
        <div className="split-fields">
          <label>
            <span>优先级</span>
            <InputNumber
              min={1}
              value={edge.priority}
              onChange={(value) => updateEdge(edge.id, { priority: Number(value || 1) })}
            />
          </label>
          <label>
            <span>判断方式</span>
            <Segmented
              block
              value={edge.mode}
              onChange={(value) => {
                const mode = value as WorkflowEdge["mode"];
                updateEdge(edge.id, {
                  mode,
                  expression:
                    mode === "否则"
                      ? "其他情况"
                      : edge.expression === "其他情况"
                        ? composeConditionExpression(DEFAULT_CONDITION_PARTS)
                        : edge.expression,
                });
              }}
              options={["如果", "否则"]}
            />
          </label>
        </div>
      </div>
      <Divider />
      <Space wrap>
        <Button icon={<GitBranchPlus size={16} />} onClick={addBranch}>
          新增分支
        </Button>
        <Button icon={<DiamondPlus size={16} />} onClick={addNested}>
          嵌套条件
        </Button>
      </Space>
      <BranchTree
        edge={edge}
        branches={branches}
        elements={elements}
        edges={edges}
        gatewayId={gatewayId || edge.source}
        selectEdge={selectEdge}
      />
    </div>
  );
}

function ConditionExpressionBuilder({
  edge,
  updateEdge,
}: {
  edge: WorkflowEdge;
  updateEdge: (id: string, patch: Partial<WorkflowEdge>) => void;
}) {
  const parts = parseConditionExpression(edge.expression);
  const field = getConditionFieldMeta(parts.field);
  const availableOperators = CONDITION_OPERATORS.filter((operator) =>
    field.valueKind === "number"
      ? ["gt", "gte", "eq"].includes(operator.value)
      : ["eq", "contains", "notContains"].includes(operator.value),
  );

  const updateParts = (patch: Partial<ConditionParts>) => {
    let next: ConditionParts = { ...parts, ...patch };
    const nextField = getConditionFieldMeta(next.field);

    if (patch.field) {
      next = {
        ...next,
        operator: nextField.valueKind === "number" ? "gt" : "contains",
        value: nextField.valueKind === "number" ? "500" : nextField.valueOptions?.[0] || "",
      };
    }

    if (nextField.valueKind === "number" && !["gt", "gte", "eq"].includes(next.operator)) {
      next.operator = "gt";
    }
    if (nextField.valueKind === "select" && ["gt", "gte"].includes(next.operator)) {
      next.operator = "contains";
    }

    updateEdge(edge.id, { expression: composeConditionExpression(next) });
  };

  if (edge.mode === "否则") {
    return (
      <div className="condition-fallback">
        <Tag>兜底</Tag>
        <Text type="secondary">匹配以上条件均不命中的申请</Text>
      </div>
    );
  }

  return (
    <div className="condition-builder">
      <Select
        aria-label="条件字段"
        value={parts.field}
        onChange={(value) => updateParts({ field: value as ConditionFieldKey })}
        options={CONDITION_FIELDS.map((item) => ({ value: item.value, label: item.label }))}
      />
      <Select
        aria-label="条件关系"
        value={
          availableOperators.some((operator) => operator.value === parts.operator)
            ? parts.operator
            : availableOperators[0]?.value
        }
        onChange={(value) => updateParts({ operator: value as ConditionOperatorKey })}
        options={availableOperators.map((item) => ({ value: item.value, label: item.label }))}
      />
      {field.valueKind === "number" ? (
        <InputNumber
          aria-label="条件值"
          min={0}
          precision={0}
          value={Number(parts.value) || 0}
          onChange={(value) => updateParts({ value: String(value ?? 0) })}
        />
      ) : (
        <Select
          mode="tags"
          aria-label="条件值"
          showSearch
          maxTagCount={1}
          placeholder="选择或输入条件值"
          value={parts.value ? [parts.value] : []}
          onChange={(values) => updateParts({ value: values[values.length - 1] || "" })}
          options={(field.valueOptions || []).map((value) => ({ value, label: value }))}
        />
      )}
      <div className="condition-preview">
        <span>表达</span>
        <strong>{composeConditionExpression(parts)}</strong>
      </div>
    </div>
  );
}

function BranchTree({
  edge,
  branches,
  elements,
  edges,
  gatewayId,
  selectEdge,
}: {
  edge: WorkflowEdge;
  branches: WorkflowEdge[];
  elements: WorkflowElement[];
  edges: WorkflowEdge[];
  gatewayId: string;
  selectEdge: (id: string) => void;
}) {
  const gateway = elements.find((element) => element.id === gatewayId);
  const branchEdgesFrom = (sourceId: string) =>
    edges
      .filter((item) => item.kind === "branch" && item.source === sourceId)
      .sort((a, b) => a.priority - b.priority);

  const titleForBranch = (branch: WorkflowEdge) => {
    const target = elements.find((element) => element.id === branch.target);
    const visibleExpression =
      branch.mode === "否则"
        ? "其他情况"
        : composeConditionExpression(parseConditionExpression(branch.expression));
    return (
      <span className="branch-tree-title">
        <Tag color={branch.mode === "否则" ? "default" : "purple"}>{branch.priority}</Tag>
        <span>
          <strong>
            {branch.mode} {branch.label || "条件"}
          </strong>
          <em>
            {visibleExpression || "未配置条件"}
            {target ? ` -> ${target.title}` : ""}
          </em>
        </span>
      </span>
    );
  };

  const buildBranchNodes = (sourceId: string): Array<Record<string, unknown>> =>
    branchEdgesFrom(sourceId).map((branch) => {
      const target = elements.find((element) => element.id === branch.target);
      return {
        key: branch.id,
        title: titleForBranch(branch),
        children: target?.type === "condition" ? buildBranchNodes(target.id) : undefined,
      };
    });

  const collectExpandedKeys = (sourceId: string): string[] =>
    branchEdgesFrom(sourceId).flatMap((branch) => {
      const target = elements.find((element) => element.id === branch.target);
      if (target?.type !== "condition") return [];
      return [branch.id, ...collectExpandedKeys(target.id)];
    });

  const treeData = [
    {
      key: `gateway-${gatewayId}`,
      selectable: false,
      title: (
        <span className="branch-tree-root">
          <Diamond size={15} />
          <span>
            <strong>{gateway?.title || "条件网关"}</strong>
            <em>{branches.length} 条直接分支</em>
          </span>
        </span>
      ),
      children: buildBranchNodes(gatewayId),
    },
  ];
  const expandedKeys = [`gateway-${gatewayId}`, ...collectExpandedKeys(gatewayId)];

  return (
    <div className="branch-tree">
      <Tree
        blockNode
        expandedKeys={expandedKeys}
        selectedKeys={[edge.id]}
        treeData={treeData}
        onSelect={(selectedKeys) => {
          const selectedId = String(selectedKeys[0] || "");
          if (edges.some((item) => item.id === selectedId)) selectEdge(selectedId);
        }}
      />
    </div>
  );
}

function CheckPanel({ validations }: { validations: ValidationItem[] }) {
  return (
    <List
      className="check-list"
      dataSource={validations}
      renderItem={(item) => (
        <List.Item className={`check-row ${item.ok ? "is-ok" : item.severity === "error" ? "is-error" : "is-warn"}`}>
          {item.ok ? <CheckCircle2 size={18} /> : <TriangleAlert size={18} />}
          <span>
            <strong>{item.title}</strong>
            <Text type="secondary">{item.detail}</Text>
          </span>
        </List.Item>
      )}
    />
  );
}
