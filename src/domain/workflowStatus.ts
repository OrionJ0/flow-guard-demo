import type { Workflow, WorkflowStatus } from "../types";

function cloneWorkflow(workflow: Workflow): Workflow {
  return JSON.parse(JSON.stringify(workflow)) as Workflow;
}

export function markWorkflowChanged(workflow: Workflow): Workflow {
  const next = cloneWorkflow(workflow);
  if (next.status === "已启用") next.status = "有未发布变更";
  return next;
}

export function publishWorkflow(workflow: Workflow): Workflow {
  const next = cloneWorkflow(workflow);
  if (next.status === "有未发布变更") next.version += 1;
  next.status = "已启用";
  return next;
}

export function stopWorkflow(workflow: Workflow): Workflow {
  const next = cloneWorkflow(workflow);
  next.status = "已停用";
  return next;
}

export function workflowStatusColor(status: WorkflowStatus) {
  const colorByStatus: Record<WorkflowStatus, string> = {
    草稿: "default",
    已启用: "green",
    有未发布变更: "gold",
    已停用: "default",
  };
  return colorByStatus[status];
}
