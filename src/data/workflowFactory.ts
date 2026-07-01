import type {
  ApprovalScene,
  BranchMode,
  SceneTag,
  Workflow,
  WorkflowEdge,
  WorkflowEdgeKind,
  WorkflowElement,
  WorkflowElementType,
} from "../types";

export const STORAGE_KEY = "approval.workflow.scenes.v1";

const nowIso = () => new Date().toISOString();

export function uid(prefix: string) {
  return `${prefix}_${Math.random().toString(36).slice(2, 8)}_${Date.now()
    .toString(36)
    .slice(-4)}`;
}

export function createScene(
  name: string,
  tag: SceneTag,
  desc: string,
  workflow = baseWorkflow(name),
): ApprovalScene {
  return {
    id: uid("scene"),
    name,
    tag,
    desc,
    updatedAt: nowIso(),
    workflow,
  };
}

export function createElement(
  type: WorkflowElementType,
  title: string,
  x: number,
  y: number,
  overrides: Partial<WorkflowElement> = {},
): WorkflowElement {
  return {
    id: overrides.id || uid(type),
    type,
    title,
    desc: "",
    x,
    y,
    approverType: "指定角色",
    approvalMode: "或签",
    assignee: type === "approval" ? "待配置" : "",
    timeoutHours: type === "approval" ? 24 : 0,
    timeoutAction: "提醒",
    ccRange: type === "cc" ? "待配置" : "",
    ccTiming: "流程结束后",
    systemAction: "记录操作日志",
    systemTarget: type === "system" ? "当前审批实例" : "",
    ...overrides,
  };
}

export function createEdge(
  source: string,
  target: string,
  label = "",
  expression = "",
  priority = 1,
  mode: BranchMode = "如果",
  kind: WorkflowEdgeKind = "sequence",
): WorkflowEdge {
  return {
    id: uid("edge"),
    source,
    target,
    label,
    expression,
    priority,
    mode,
    kind,
  };
}

export function baseWorkflow(name: string): Workflow {
  const start = createElement("start", "提交申请", 80, 240, {
    id: uid("start"),
    desc: "填写申请内容",
  });
  const approval = createElement("approval", "审批人", 280, 222, {
    assignee: "请选择审批人",
    timeoutHours: 8,
    desc: "确认申请内容",
  });
  const end = createElement("end", "流程结束", 560, 240, {
    id: uid("end"),
    desc: "流程结束并归档",
  });

  return {
    name: `${name}审批`,
    status: "草稿",
    version: 1,
    elements: [start, approval, end],
    edges: [
      createEdge(start.id, approval.id),
      createEdge(approval.id, end.id),
    ],
  };
}

export function seedScenes(): ApprovalScene[] {
  return [
    createScene(
      "通用资料申请",
      "通用",
      "资料查看、批量处理等常规业务申请。",
      riskWorkflow(),
    ),
    createScene(
      "资料处理",
      "强制",
      "覆盖业务资料、附件、缓存、临时文件的处理任务。",
      disposalWorkflow(),
    ),
    createScene(
      "备案报表导出",
      "受控",
      "备案、备案变更、注销备案材料导出。",
      reportWorkflow(),
    ),
  ];
}

function riskWorkflow(): Workflow {
  const start = createElement("start", "提交资料申请", 80, 292, {
    id: "risk_start",
    desc: "填写申请范围、字段和用途",
  });
  const business = createElement("approval", "业务负责人审批", 250, 274, {
    id: "risk_business",
    desc: "确认业务必要性和处理规则",
    assignee: "业务负责人",
  });
  const gateway = createElement("condition", "条件判断", 520, 282, {
    id: "risk_gateway",
    desc: "按申请数量和字段类型判断",
  });
  const security = createElement("approval", "流程管理员复核", 760, 126, {
    id: "risk_security",
    desc: "核验处理规则、申请范围和通知配置",
    assignee: "流程管理员",
    timeoutHours: 12,
  });
  const auditor = createElement("cc", "抄送审计员", 1020, 132, {
    id: "risk_auditor",
    desc: "同步处理记录",
    ccRange: "审计员、流程专员",
  });
  const compliance = createElement("approval", "合规管理员审批", 760, 410, {
    id: "risk_compliance",
    desc: "确认常规申请材料和记录留存",
    assignee: "合规管理员",
  });
  const log = createElement("system", "记录访问日志", 1240, 264, {
    id: "risk_log",
    desc: "记录操作日志并生成文件摘要",
    systemAction: "记录操作日志",
    systemTarget: "申请记录、处理文件摘要",
  });
  const end = createElement("end", "完成归档", 1480, 292, {
    id: "risk_end",
    desc: "流程结束并归档",
  });

  return {
    name: "通用资料申请审批",
    status: "草稿",
    version: 1,
    elements: [start, business, gateway, security, auditor, compliance, log, end],
    edges: [
      createEdge(start.id, business.id),
      createEdge(business.id, gateway.id),
      createEdge(
        gateway.id,
        security.id,
        "条件一",
        "申请数量 > 500 或包含明细资料",
        1,
        "如果",
        "branch",
      ),
      createEdge(security.id, auditor.id),
      createEdge(auditor.id, log.id),
      createEdge(
        gateway.id,
        compliance.id,
        "条件二",
        "仅查询统计字段或汇总结果",
        2,
        "如果",
        "branch",
      ),
      createEdge(compliance.id, log.id),
      createEdge(log.id, end.id),
    ],
  };
}

function disposalWorkflow(): Workflow {
  const workflow = baseWorkflow("资料处理");
  workflow.elements = [
    createElement("start", "提交处置申请", 80, 260, {
      id: "disposal_start",
      desc: "选择资料处理范围",
    }),
    createElement("approval", "数据管理员确认", 280, 242, {
      id: "disposal_data",
      assignee: "数据管理员",
      approvalMode: "会签",
      timeoutHours: 4,
      desc: "确认数据范围和处置方式",
    }),
    createElement("approval", "合规管理员审核", 540, 242, {
      id: "disposal_compliance",
      assignee: "合规管理员",
      desc: "核对处理规则和备案影响",
    }),
    createElement("approval", "流程管理员复核", 800, 242, {
      id: "disposal_security",
      assignee: "流程管理员",
      approvalMode: "会签",
      desc: "确认执行窗口和回退策略",
    }),
    createElement("system", "执行资料处理", 1060, 246, {
      id: "disposal_system",
      systemAction: "资料处理",
      systemTarget: "业务资料、缓存、临时文件",
    }),
    createElement("end", "完成归档", 1320, 260, {
      id: "disposal_end",
      desc: "归档处置记录和失败原因",
    }),
  ];
  workflow.edges = [
    createEdge("disposal_start", "disposal_data"),
    createEdge("disposal_data", "disposal_compliance"),
    createEdge("disposal_compliance", "disposal_security"),
    createEdge("disposal_security", "disposal_system"),
    createEdge("disposal_system", "disposal_end"),
  ];
  return workflow;
}

function reportWorkflow(): Workflow {
  const start = createElement("start", "提交导出申请", 80, 270, {
    id: "report_start",
    desc: "选择备案、备案变更或注销备案材料",
  });
  const gateway = createElement("condition", "报表字段判断", 320, 260, {
    id: "report_gateway",
    desc: "判断报表字段范围",
  });
  const security = createElement("approval", "流程管理员复核", 580, 126, {
    id: "report_security",
    assignee: "流程管理员",
    desc: "核验字段范围和文件标记策略",
  });
  const compliance = createElement("approval", "合规管理员审批", 580, 392, {
    id: "report_compliance",
    assignee: "合规管理员",
    desc: "确认统计字段和备案材料范围",
  });
  const system = createElement("system", "生成水印文件", 880, 260, {
    id: "report_system",
    systemAction: "生成备案材料",
    systemTarget: "备案报表、水印文件、文件摘要",
  });
  const end = createElement("end", "完成导出", 1140, 270, {
    id: "report_end",
    desc: "生成水印文件并记录文件摘要",
  });

  return {
    name: "备案报表导出审批",
    status: "草稿",
    version: 1,
    elements: [start, gateway, security, compliance, system, end],
    edges: [
      createEdge(start.id, gateway.id),
      createEdge(
        gateway.id,
        security.id,
        "明细字段",
        "包含明细资料或扩展字段",
        1,
        "如果",
        "branch",
      ),
      createEdge(
        gateway.id,
        compliance.id,
        "仅统计字段",
        "仅包含统计结果、规则清单、措施清单",
        2,
        "如果",
        "branch",
      ),
      createEdge(security.id, system.id),
      createEdge(compliance.id, system.id),
      createEdge(system.id, end.id),
    ],
  };
}
