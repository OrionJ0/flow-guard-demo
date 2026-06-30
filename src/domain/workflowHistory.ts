import type { Workflow } from "../types";

export interface WorkflowHistory {
  past: Workflow[];
  future: Workflow[];
  limit: number;
}

function cloneWorkflow(workflow: Workflow): Workflow {
  return JSON.parse(JSON.stringify(workflow)) as Workflow;
}

export function createWorkflowHistory(limit = 50): WorkflowHistory {
  return { past: [], future: [], limit };
}

export function canUndoWorkflow(history: WorkflowHistory) {
  return history.past.length > 0;
}

export function canRedoWorkflow(history: WorkflowHistory) {
  return history.future.length > 0;
}

export function pushWorkflowHistory(
  history: WorkflowHistory,
  previousWorkflow: Workflow,
): WorkflowHistory {
  const past = [...history.past, cloneWorkflow(previousWorkflow)].slice(-history.limit);
  return {
    ...history,
    past,
    future: [],
  };
}

export function undoWorkflowHistory(
  history: WorkflowHistory,
  currentWorkflow: Workflow,
): { history: WorkflowHistory; workflow: Workflow } {
  if (!canUndoWorkflow(history)) {
    return { history, workflow: currentWorkflow };
  }

  const previous = history.past[history.past.length - 1];
  return {
    history: {
      ...history,
      past: history.past.slice(0, -1),
      future: [cloneWorkflow(currentWorkflow), ...history.future],
    },
    workflow: cloneWorkflow(previous),
  };
}

export function redoWorkflowHistory(
  history: WorkflowHistory,
  currentWorkflow: Workflow,
): { history: WorkflowHistory; workflow: Workflow } {
  if (!canRedoWorkflow(history)) {
    return { history, workflow: currentWorkflow };
  }

  const next = history.future[0];
  return {
    history: {
      ...history,
      past: [...history.past, cloneWorkflow(currentWorkflow)].slice(-history.limit),
      future: history.future.slice(1),
    },
    workflow: cloneWorkflow(next),
  };
}
