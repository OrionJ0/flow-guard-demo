export type WorkflowStatus = "草稿" | "已启用" | "有未发布变更" | "已停用";

export type SceneTag = "自定义" | "高危" | "强制" | "受控" | "通用" | "标准";

export type WorkflowElementType =
  | "start"
  | "end"
  | "approval"
  | "condition"
  | "cc"
  | "system";

export type BranchMode = "如果" | "否则";

export type WorkflowEdgeKind = "sequence" | "branch";

export interface WorkflowElement {
  id: string;
  type: WorkflowElementType;
  title: string;
  desc: string;
  x: number;
  y: number;
  approverType: "指定角色" | "指定成员" | "直属上级" | "发起人自选";
  approvalMode: "或签" | "会签" | "依次审批";
  assignee: string;
  timeoutHours: number;
  timeoutAction: "提醒" | "自动通过" | "自动驳回" | "升级处理";
  ccRange: string;
  ccTiming: "流程结束后" | "节点通过后" | "流程发起时";
  systemAction:
    | "记录操作日志"
    | "触发异常告警"
    | "删除数据"
    | "匿名化处理"
    | "生成备案材料"
    | "资料处理"
    | "生成业务材料"
    | "记录处理结果";
  systemTarget: string;
}

export interface WorkflowEdge {
  id: string;
  source: string;
  target: string;
  kind: WorkflowEdgeKind;
  label: string;
  expression: string;
  priority: number;
  mode: BranchMode;
}

export interface Workflow {
  name: string;
  status: WorkflowStatus;
  version: number;
  elements: WorkflowElement[];
  edges: WorkflowEdge[];
}

export interface ApprovalScene {
  id: string;
  name: string;
  tag: SceneTag;
  desc: string;
  updatedAt: string;
  workflow: Workflow;
}

export type Selection =
  | { kind: "node"; id: string }
  | { kind: "edge"; id: string };

export interface ValidationItem {
  key: string;
  ok: boolean;
  title: string;
  detail: string;
  severity?: "error" | "warning";
  blocking?: boolean;
  elementIds?: string[];
  edgeIds?: string[];
}
