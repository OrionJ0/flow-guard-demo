import assert from "node:assert/strict";
import test from "node:test";
import { baseWorkflow } from "../src/data/workflowFactory";
import {
  composeConditionExpression,
  parseConditionExpression,
} from "../src/domain/conditionExpression";
import {
  findGatewayMergeTarget,
  formatWorkflowEdgeLabel,
  getPropertyPanelTabKeys,
} from "../src/domain/workflowEditor";
import {
  markWorkflowChanged,
  publishWorkflow,
  stopWorkflow,
  workflowStatusColor,
} from "../src/domain/workflowStatus";
import { buildWorkflowExport, workflowExportFileName } from "../src/domain/workflowExport";
import { parseWorkflowImport } from "../src/domain/workflowImport";
import { neutralizeScene } from "../src/domain/sceneSanitizer";
import {
  canRedoWorkflow,
  canUndoWorkflow,
  createWorkflowHistory,
  pushWorkflowHistory,
  redoWorkflowHistory,
  undoWorkflowHistory,
} from "../src/domain/workflowHistory";
import {
  buildWorkflowValidation,
  hasBlockingValidationErrors,
} from "../src/domain/workflowValidation";
import {
  deleteBranchEdge,
  getBranchDeletionImpact,
} from "../src/domain/workflowDeletion";
import { layoutWorkflow, shiftReachableElements, spreadGatewayBranches } from "../src/domain/workflowLayout";
import type { Selection } from "../src/types";

test("property panel hides branch tab for non-branch context", () => {
  const workflow = baseWorkflow("测试流程");
  const approval = workflow.elements.find((element) => element.type === "approval");
  assert.ok(approval);

  const selection: Selection = { kind: "node", id: approval.id };

  assert.deepEqual(getPropertyPanelTabKeys(workflow, selection), ["element", "check"]);
});

test("property panel supports an empty selection state", () => {
  const workflow = baseWorkflow("空选择测试");

  assert.deepEqual(getPropertyPanelTabKeys(workflow, { kind: "none" }), ["element", "check"]);
});

test("property panel shows branch tab for condition gateway and branch edge", () => {
  const workflow = baseWorkflow("测试流程");
  const gateway = {
    ...workflow.elements[1],
    id: "gateway",
    type: "condition" as const,
  };
  workflow.elements.splice(1, 0, gateway);
  workflow.edges.push({
    id: "branch_edge",
    source: gateway.id,
    target: workflow.elements[2].id,
    kind: "branch",
    label: "条件一",
    expression: "amount > 500",
    priority: 1,
    mode: "如果",
  });

  assert.deepEqual(getPropertyPanelTabKeys(workflow, { kind: "node", id: gateway.id }), [
    "element",
    "branch",
    "check",
  ]);
  assert.deepEqual(getPropertyPanelTabKeys(workflow, { kind: "edge", id: "branch_edge" }), [
    "branch",
    "check",
  ]);
});

test("workflow status transitions are action-driven", () => {
  const draft = baseWorkflow("状态测试");

  const enabled = publishWorkflow(draft);
  assert.equal(enabled.status, "已启用");
  assert.equal(enabled.version, 1);

  const changed = markWorkflowChanged(enabled);
  assert.equal(changed.status, "有未发布变更");
  assert.equal(changed.version, 1);

  const republished = publishWorkflow(changed);
  assert.equal(republished.status, "已启用");
  assert.equal(republished.version, 2);

  const stopped = stopWorkflow(republished);
  assert.equal(stopped.status, "已停用");
});

test("workflow status colors distinguish lifecycle states", () => {
  assert.equal(workflowStatusColor("草稿"), "default");
  assert.equal(workflowStatusColor("已启用"), "green");
  assert.equal(workflowStatusColor("有未发布变更"), "gold");
  assert.equal(workflowStatusColor("已停用"), "default");
});

test("workflow export payload contains stable metadata and current workflow", () => {
  const workflow = baseWorkflow("导出测试");
  workflow.elements[1].title = "内存中的最新审批节点";
  const scene = {
    id: "scene_export",
    name: "通用/导出",
    tag: "通用" as const,
    desc: "导出当前内存数据",
    updatedAt: "2026-06-30T00:00:00.000Z",
    workflow,
  };

  const payload = buildWorkflowExport(scene, "2026-06-30T12:00:00.000Z");

  assert.equal(payload.schemaVersion, "approval-workflow-export/v1");
  assert.equal(payload.exportedAt, "2026-06-30T12:00:00.000Z");
  assert.equal(payload.scene.id, "scene_export");
  assert.equal(payload.scene.workflow.elements[1].title, "内存中的最新审批节点");
  assert.notEqual(payload.scene.workflow, workflow);
});

test("workflow export file name includes safe scene identity", () => {
  assert.equal(
    workflowExportFileName("通用/导出", "scene_export"),
    "approval-workflow-通用-导出-scene_export.json",
  );
});

test("scene sanitizer neutralizes legacy demo wording", () => {
  const workflow = baseWorkflow("旧场景");
  workflow.name = "高危数据访问审批";
  workflow.elements[1].title = "高风险审批";
  workflow.edges[0].label = "高风险";
  workflow.edges[0].expression = "导出数量 > 500 或包含未脱敏人脸图像";
  const scene = {
    id: "scene_legacy",
    name: "高危数据访问",
    tag: "高危" as const,
    desc: "查看原图、完整证件号、批量导出",
    updatedAt: "2026-06-30T00:00:00.000Z",
    workflow,
  };

  const neutral = neutralizeScene(scene);

  assert.equal(neutral.name, "通用资料申请");
  assert.equal(neutral.tag, "通用");
  assert.equal(neutral.workflow.name, "通用资料申请审批");
  assert.equal(neutral.workflow.elements[1].title, "条件一审批");
  assert.equal(neutral.workflow.edges[0].label, "条件一");
  assert.equal(neutral.workflow.edges[0].expression.includes("明细资料"), true);
});

test("workflow history supports undo, redo, redo clearing, and limit", () => {
  const initial = baseWorkflow("历史测试");
  const first = { ...initial, name: "第一次修改" };
  const second = { ...first, name: "第二次修改" };
  const third = { ...second, name: "第三次修改" };

  let history = createWorkflowHistory(2);
  history = pushWorkflowHistory(history, initial);
  history = pushWorkflowHistory(history, first);
  history = pushWorkflowHistory(history, second);

  assert.equal(history.past.length, 2);
  assert.equal(canUndoWorkflow(history), true);

  const undone = undoWorkflowHistory(history, third);
  assert.equal(undone.workflow.name, "第二次修改");
  assert.equal(canRedoWorkflow(undone.history), true);

  const redone = redoWorkflowHistory(undone.history, undone.workflow);
  assert.equal(redone.workflow.name, "第三次修改");

  const afterUndo = undoWorkflowHistory(redone.history, redone.workflow);
  const newBranch = pushWorkflowHistory(afterUndo.history, afterUndo.workflow);
  assert.equal(canRedoWorkflow(newBranch), false);
});

test("workflow validation detects orphan, unreachable, and dead-end nodes", () => {
  const workflow = baseWorkflow("校验测试");
  workflow.elements[1].assignee = "审批经理";
  workflow.elements.push({
    ...workflow.elements[1],
    id: "orphan_approval",
    title: "孤立审批",
    x: 900,
    y: 900,
  });

  const validations = buildWorkflowValidation(workflow);
  const failedKeys = validations.filter((item) => !item.ok).map((item) => item.key);

  assert.ok(failedKeys.includes("orphan-nodes"));
  assert.ok(failedKeys.includes("unreachable-nodes"));
  assert.ok(failedKeys.includes("dead-end-nodes"));
  assert.equal(hasBlockingValidationErrors(validations), true);
});

test("workflow validation treats missing approver as blocking warning", () => {
  const workflow = baseWorkflow("温和校验");
  const approverItem = buildWorkflowValidation(workflow).find((item) => item.key === "approvers");

  assert.ok(approverItem);
  assert.equal(approverItem.ok, false);
  assert.equal(approverItem.severity, "warning");
  assert.equal(hasBlockingValidationErrors([approverItem]), true);
});

test("workflow validation detects branch fallback, priority, and duplicate condition issues", () => {
  const workflow = baseWorkflow("路由校验");
  const [start, , end] = workflow.elements;
  const gateway = {
    ...workflow.elements[1],
    id: "gateway",
    type: "condition" as const,
    title: "条件分支",
    assignee: "审批经理",
  };
  const first = {
    ...workflow.elements[1],
    id: "first_approval",
    title: "第一审批",
    assignee: "审批经理",
  };
  const second = {
    ...workflow.elements[1],
    id: "second_approval",
    title: "第二审批",
    assignee: "审批经理",
  };
  workflow.elements = [start, gateway, first, second, end];
  workflow.edges = [
    { id: "start_gateway", source: start.id, target: gateway.id, kind: "sequence", label: "", expression: "", priority: 1, mode: "如果" },
    { id: "branch_first", source: gateway.id, target: first.id, kind: "branch", label: "条件一", expression: "申请数量 大于 100", priority: 1, mode: "如果" },
    { id: "branch_second", source: gateway.id, target: second.id, kind: "branch", label: "条件二", expression: "申请数量 大于 100", priority: 1, mode: "如果" },
    { id: "first_end", source: first.id, target: end.id, kind: "sequence", label: "", expression: "", priority: 1, mode: "如果" },
    { id: "second_end", source: second.id, target: end.id, kind: "sequence", label: "", expression: "", priority: 1, mode: "如果" },
  ];

  const failedKeys = buildWorkflowValidation(workflow)
    .filter((item) => !item.ok)
    .map((item) => item.key);

  assert.ok(failedKeys.includes("branch-fallback"));
  assert.ok(failedKeys.includes("branch-priority"));
  assert.ok(failedKeys.includes("branch-overlap"));
});

test("workflow validation detects invalid branch and event relations", () => {
  const workflow = baseWorkflow("分支校验");
  const start = workflow.elements.find((element) => element.type === "start")!;
  const end = workflow.elements.find((element) => element.type === "end")!;
  const approval = workflow.elements.find((element) => element.type === "approval")!;
  approval.assignee = "审批经理";
  workflow.edges.push({
    id: "invalid_branch",
    source: approval.id,
    target: "missing_target",
    kind: "branch",
    label: "错误分支",
    expression: "",
    priority: 2,
    mode: "如果",
  });
  workflow.edges.push({
    id: "end_out",
    source: end.id,
    target: approval.id,
    kind: "sequence",
    label: "",
    expression: "",
    priority: 1,
    mode: "如果",
  });
  workflow.edges.push({
    id: "start_in",
    source: approval.id,
    target: start.id,
    kind: "sequence",
    label: "",
    expression: "",
    priority: 1,
    mode: "如果",
  });

  const failedKeys = buildWorkflowValidation(workflow)
    .filter((item) => !item.ok)
    .map((item) => item.key);

  assert.ok(failedKeys.includes("invalid-branches"));
  assert.ok(failedKeys.includes("start-incoming"));
  assert.ok(failedKeys.includes("end-outgoing"));
});

test("workflow validation highlights only terminal dead-end nodes", () => {
  const workflow = baseWorkflow("无出口标记");
  const [start, , end] = workflow.elements;
  const gateway = { ...workflow.elements[1], id: "gateway", type: "condition" as const, title: "条件" };
  const configured = { ...workflow.elements[1], id: "configured", title: "已接回审批", assignee: "审批经理" };
  const approval = { ...workflow.elements[1], id: "approval", title: "新增审批", assignee: "审批经理" };
  const cc = { ...workflow.elements[1], id: "cc", type: "cc" as const, title: "新增抄送" };
  const system = { ...workflow.elements[1], id: "system", type: "system" as const, title: "新增系统动作" };
  workflow.elements = [start, gateway, configured, approval, cc, system, end];
  workflow.edges = [
    { id: "start_gateway", source: start.id, target: gateway.id, kind: "sequence", label: "", expression: "", priority: 1, mode: "如果" },
    { id: "configured_branch", source: gateway.id, target: configured.id, kind: "branch", label: "已配置", expression: "ok", priority: 1, mode: "如果" },
    { id: "new_branch", source: gateway.id, target: approval.id, kind: "branch", label: "新增", expression: "new", priority: 2, mode: "如果" },
    { id: "configured_end", source: configured.id, target: end.id, kind: "sequence", label: "", expression: "", priority: 1, mode: "如果" },
    { id: "approval_cc", source: approval.id, target: cc.id, kind: "sequence", label: "", expression: "", priority: 1, mode: "如果" },
    { id: "cc_system", source: cc.id, target: system.id, kind: "sequence", label: "", expression: "", priority: 1, mode: "如果" },
  ];

  const deadEndItem = buildWorkflowValidation(workflow).find((item) => item.key === "dead-end-nodes");

  assert.ok(deadEndItem);
  assert.equal(deadEndItem.ok, false);
  assert.deepEqual(deadEndItem.elementIds, ["system"]);
});

test("branch deletion impact excludes shared merge nodes and end events", () => {
  const workflow = baseWorkflow("删除策略");
  const [start, , end] = workflow.elements;
  const gateway = { ...workflow.elements[1], id: "gateway", type: "condition" as const, title: "条件" };
  const yes = { ...workflow.elements[1], id: "yes_approval", title: "条件一审批" };
  const no = { ...workflow.elements[1], id: "no_approval", title: "普通审批" };
  const merge = { ...workflow.elements[1], id: "merge_approval", title: "汇合审批" };
  workflow.elements = [start, gateway, yes, no, merge, end];
  workflow.edges = [
    { id: "start_gateway", source: start.id, target: gateway.id, kind: "sequence", label: "", expression: "", priority: 1, mode: "如果" },
    { id: "branch_yes", source: gateway.id, target: yes.id, kind: "branch", label: "条件一", expression: "level1", priority: 1, mode: "如果" },
    { id: "branch_no", source: gateway.id, target: no.id, kind: "branch", label: "普通", expression: "normal", priority: 2, mode: "如果" },
    { id: "yes_merge", source: yes.id, target: merge.id, kind: "sequence", label: "", expression: "", priority: 1, mode: "如果" },
    { id: "no_merge", source: no.id, target: merge.id, kind: "sequence", label: "", expression: "", priority: 1, mode: "如果" },
    { id: "merge_end", source: merge.id, target: end.id, kind: "sequence", label: "", expression: "", priority: 1, mode: "如果" },
  ];

  const impact = getBranchDeletionImpact(workflow, "branch_yes");
  assert.deepEqual(impact.removableNodeIds, ["yes_approval"]);

  const deleted = deleteBranchEdge(workflow, "branch_yes", "branch-subtree");
  assert.equal(deleted.elements.some((element) => element.id === "yes_approval"), false);
  assert.equal(deleted.elements.some((element) => element.id === "merge_approval"), true);
  assert.equal(deleted.elements.some((element) => element.type === "end"), true);
  assert.equal(deleted.edges.some((edge) => edge.id === "yes_merge"), false);
});

test("workflow layout creates readable levels and branch lanes", () => {
  const workflow = baseWorkflow("布局测试");
  const [start, , end] = workflow.elements;
  const gateway = { ...workflow.elements[1], id: "gateway", type: "condition" as const, title: "条件" };
  const high = { ...workflow.elements[1], id: "high", title: "条件一" };
  const low = { ...workflow.elements[1], id: "low", title: "条件二" };
  workflow.elements = [start, gateway, high, low, end];
  workflow.edges = [
    { id: "start_gateway", source: start.id, target: gateway.id, kind: "sequence", label: "", expression: "", priority: 1, mode: "如果" },
    { id: "high_branch", source: gateway.id, target: high.id, kind: "branch", label: "条件一", expression: "level1", priority: 1, mode: "如果" },
    { id: "low_branch", source: gateway.id, target: low.id, kind: "branch", label: "条件二", expression: "level2", priority: 2, mode: "如果" },
    { id: "high_end", source: high.id, target: end.id, kind: "sequence", label: "", expression: "", priority: 1, mode: "如果" },
    { id: "low_end", source: low.id, target: end.id, kind: "sequence", label: "", expression: "", priority: 1, mode: "如果" },
  ];

  const laidOut = layoutWorkflow(workflow, { originX: 80, centerY: 300, xGap: 260, yGap: 170 });
  const position = (id: string) => laidOut.elements.find((element) => element.id === id)!;

  assert.ok(position(start.id).x < position("gateway").x);
  assert.ok(position("gateway").x < position("high").x);
  assert.ok(position("high").x < position(end.id).x);
  assert.notEqual(position("high").y, position("low").y);
  assert.ok(position("high").y < position("low").y);
});

test("workflow layout reserves space for nested branch lanes", () => {
  const workflow = baseWorkflow("嵌套布局测试");
  const [start, , end] = workflow.elements;
  const gateway = { ...workflow.elements[1], id: "gateway", type: "condition" as const, title: "条件" };
  const nested = { ...workflow.elements[1], id: "nested", type: "condition" as const, title: "二级条件" };
  const direct = { ...workflow.elements[1], id: "direct", title: "直接审批" };
  const yes = { ...workflow.elements[1], id: "nested_yes", title: "二级审批一" };
  const no = { ...workflow.elements[1], id: "nested_no", title: "二级审批二" };
  const merge = { ...workflow.elements[1], id: "merge", title: "汇合审批" };
  workflow.elements = [start, gateway, nested, direct, yes, no, merge, end];
  workflow.edges = [
    { id: "start_gateway", source: start.id, target: gateway.id, kind: "sequence", label: "", expression: "", priority: 1, mode: "如果" },
    { id: "branch_nested", source: gateway.id, target: nested.id, kind: "branch", label: "条件一", expression: "level1", priority: 1, mode: "如果" },
    { id: "branch_direct", source: gateway.id, target: direct.id, kind: "branch", label: "条件二", expression: "level2", priority: 2, mode: "如果" },
    { id: "nested_yes_edge", source: nested.id, target: yes.id, kind: "branch", label: "条件一", expression: "level1", priority: 1, mode: "如果" },
    { id: "nested_no_edge", source: nested.id, target: no.id, kind: "branch", label: "否则", expression: "其他情况", priority: 2, mode: "否则" },
    { id: "yes_merge", source: yes.id, target: merge.id, kind: "sequence", label: "", expression: "", priority: 1, mode: "如果" },
    { id: "no_merge", source: no.id, target: merge.id, kind: "sequence", label: "", expression: "", priority: 1, mode: "如果" },
    { id: "direct_merge", source: direct.id, target: merge.id, kind: "sequence", label: "", expression: "", priority: 1, mode: "如果" },
    { id: "merge_end", source: merge.id, target: end.id, kind: "sequence", label: "", expression: "", priority: 1, mode: "如果" },
  ];

  const laidOut = layoutWorkflow(workflow, { originX: 80, centerY: 300, xGap: 260, yGap: 160 });
  const position = (id: string) => laidOut.elements.find((element) => element.id === id)!;

  assert.ok(Math.abs(position("direct").y - position("nested").y) >= 155);
  assert.ok(Math.abs(position("nested_yes").y - position("nested_no").y) >= 155);
  assert.ok(position("gateway").x < position("nested").x);
  assert.ok(position("nested").x < position("nested_yes").x);
});

test("gateway merge target prefers the first shared downstream node before end", () => {
  const workflow = baseWorkflow("汇合测试");
  const [start, , end] = workflow.elements;
  const gateway = { ...workflow.elements[1], id: "gateway", type: "condition" as const, title: "条件" };
  const high = { ...workflow.elements[1], id: "high", title: "条件一审批" };
  const low = { ...workflow.elements[1], id: "low", title: "普通审批" };
  const audit = { ...workflow.elements[1], id: "audit", title: "审计抄送", type: "cc" as const };
  const merge = { ...workflow.elements[1], id: "merge", title: "记录日志", type: "system" as const };
  workflow.elements = [start, gateway, high, low, audit, merge, end];
  workflow.edges = [
    { id: "start_gateway", source: start.id, target: gateway.id, kind: "sequence", label: "", expression: "", priority: 1, mode: "如果" },
    { id: "high_branch", source: gateway.id, target: high.id, kind: "branch", label: "条件一", expression: "level1", priority: 1, mode: "如果" },
    { id: "low_branch", source: gateway.id, target: low.id, kind: "branch", label: "条件二", expression: "level2", priority: 2, mode: "如果" },
    { id: "high_audit", source: high.id, target: audit.id, kind: "sequence", label: "", expression: "", priority: 1, mode: "如果" },
    { id: "audit_merge", source: audit.id, target: merge.id, kind: "sequence", label: "", expression: "", priority: 1, mode: "如果" },
    { id: "low_merge", source: low.id, target: merge.id, kind: "sequence", label: "", expression: "", priority: 1, mode: "如果" },
    { id: "merge_end", source: merge.id, target: end.id, kind: "sequence", label: "", expression: "", priority: 1, mode: "如果" },
  ];

  assert.equal(findGatewayMergeTarget(workflow, "gateway"), "merge");
});

test("gateway branch spreading keeps branch targets in separate lanes", () => {
  const workflow = baseWorkflow("分支铺开测试");
  const [start, , end] = workflow.elements;
  const gateway = { ...workflow.elements[1], id: "gateway", type: "condition" as const, title: "条件" };
  const first = { ...workflow.elements[1], id: "first", title: "第一分支", x: 580, y: 300 };
  const second = { ...workflow.elements[1], id: "second", title: "第二分支", x: 590, y: 306 };
  const third = { ...workflow.elements[1], id: "third", title: "第三分支", x: 600, y: 312 };
  workflow.elements = [start, gateway, first, second, third, end];
  workflow.edges = [
    { id: "start_gateway", source: start.id, target: gateway.id, kind: "sequence", label: "", expression: "", priority: 1, mode: "如果" },
    { id: "first_branch", source: gateway.id, target: first.id, kind: "branch", label: "第一", expression: "risk", priority: 1, mode: "如果" },
    { id: "second_branch", source: gateway.id, target: second.id, kind: "branch", label: "第二", expression: "risk", priority: 2, mode: "如果" },
    { id: "third_branch", source: gateway.id, target: third.id, kind: "branch", label: "第三", expression: "risk", priority: 3, mode: "如果" },
  ];

  const spread = spreadGatewayBranches(workflow, "gateway", { xGap: 300, yGap: 190 });
  const positions = ["first", "second", "third"].map((id) => spread.elements.find((item) => item.id === id)!);

  assert.deepEqual(positions.map((item) => item.x), [gateway.x + 300, gateway.x + 300, gateway.x + 300]);
  assert.ok(positions[1].y - positions[0].y >= 180);
  assert.ok(positions[2].y - positions[1].y >= 180);
});

test("inserting after a node shifts the existing downstream chain", () => {
  const workflow = baseWorkflow("插入测试");
  const approval = workflow.elements.find((element) => element.type === "approval")!;
  const end = workflow.elements.find((element) => element.type === "end")!;
  const shifted = shiftReachableElements(workflow, approval.id, 260);
  const shiftedApproval = shifted.elements.find((element) => element.id === approval.id)!;
  const shiftedEnd = shifted.elements.find((element) => element.id === end.id)!;

  assert.equal(shiftedApproval.x, approval.x + 260);
  assert.equal(shiftedEnd.x, end.x + 260);
});

test("condition expressions are built from structured parts", () => {
  const expression = composeConditionExpression({
    field: "requestCount",
    operator: "gt",
    value: "500",
  });

  assert.equal(expression, "申请数量 大于 500");
  assert.deepEqual(parseConditionExpression(expression), {
    field: "requestCount",
    operator: "gt",
    value: "500",
  });
});

test("legacy long branch expressions are normalized for the condition builder", () => {
  assert.deepEqual(parseConditionExpression("申请数量 > 500 或包含明细字段"), {
    field: "requestCount",
    operator: "gt",
    value: "500",
  });
});

test("branch edge labels stay short and do not include full expressions", () => {
  const label = formatWorkflowEdgeLabel({
    id: "branch",
    source: "gateway",
    target: "approval",
    kind: "branch",
    label: "条件一资料申请需要复核",
    expression: "申请数量 > 500 或包含明细字段",
    priority: 1,
    mode: "如果",
  });

  assert.equal(label, "1. 如果 条件一资料申请...");
  assert.equal(label.includes("申请数量"), false);
});

test("workflow import accepts exported schema and rejects invalid payloads", () => {
  const scene = {
    id: "scene_import",
    name: "导入测试",
    tag: "通用" as const,
    desc: "导入导出互通",
    updatedAt: "2026-06-30T00:00:00.000Z",
    workflow: baseWorkflow("导入测试"),
  };
  const payload = buildWorkflowExport(scene, "2026-06-30T12:00:00.000Z");

  const imported = parseWorkflowImport(JSON.stringify(payload));
  assert.equal(imported.scene.id, "scene_import");
  assert.equal(imported.scene.workflow.elements.length, scene.workflow.elements.length);

  assert.throws(
    () => parseWorkflowImport(JSON.stringify({ schemaVersion: "bad", scene: {} })),
    /不支持的 JSON 版本/,
  );
  assert.throws(
    () => parseWorkflowImport(JSON.stringify({ schemaVersion: "approval-workflow-export/v1", scene: {} })),
    /缺少 workflow/,
  );
});
