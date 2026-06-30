import type { Workflow, WorkflowElement } from "../types";

export interface WorkflowLayoutOptions {
  originX?: number;
  centerY?: number;
  xGap?: number;
  yGap?: number;
}

export interface GatewayBranchSpreadOptions {
  xGap?: number;
  yGap?: number;
  nestedXGap?: number;
  nestedYGap?: number;
}

function cloneWorkflow(workflow: Workflow): Workflow {
  return JSON.parse(JSON.stringify(workflow)) as Workflow;
}

function outgoing(workflow: Workflow, id: string) {
  return workflow.edges
    .filter((edge) => edge.source === id)
    .sort((a, b) => a.priority - b.priority);
}

function incomingBranchPriority(workflow: Workflow, element: WorkflowElement) {
  const branch = workflow.edges.find(
    (edge) => edge.target === element.id && edge.kind === "branch",
  );
  return branch?.priority ?? 999;
}

function typeRank(element: WorkflowElement) {
  const rank: Record<WorkflowElement["type"], number> = {
    start: 0,
    condition: 1,
    approval: 2,
    cc: 3,
    system: 4,
    end: 5,
  };
  return rank[element.type];
}

export function shiftReachableElements(
  workflow: Workflow,
  startId: string,
  deltaX: number,
  deltaY = 0,
): Workflow {
  const next = cloneWorkflow(workflow);
  const visited = new Set<string>();
  const queue = [startId];

  while (queue.length) {
    const current = queue.shift()!;
    if (visited.has(current)) continue;
    visited.add(current);

    const element = next.elements.find((item) => item.id === current);
    if (element) {
      element.x += deltaX;
      element.y += deltaY;
    }

    outgoing(next, current).forEach((edge) => {
      if (!visited.has(edge.target)) queue.push(edge.target);
    });
  }

  return next;
}

export function layoutWorkflow(
  workflow: Workflow,
  options: WorkflowLayoutOptions = {},
): Workflow {
  const originX = options.originX ?? 80;
  const centerY = options.centerY ?? 300;
  const xGap = options.xGap ?? 280;
  const yGap = options.yGap ?? 170;
  const next = cloneWorkflow(workflow);
  const start = next.elements.find((element) => element.type === "start") || next.elements[0];
  if (!start) return next;

  const levels = new Map<string, number>([[start.id, 0]]);
  const queue = [start.id];
  while (queue.length) {
    const current = queue.shift()!;
    const level = levels.get(current) || 0;
    outgoing(next, current).forEach((edge) => {
      const targetExists = next.elements.some((element) => element.id === edge.target);
      if (!targetExists) return;
      if (!levels.has(edge.target) || (levels.get(edge.target) || 0) < level + 1) {
        levels.set(edge.target, level + 1);
        queue.push(edge.target);
      }
    });
  }

  const maxLevel = Math.max(0, ...levels.values());
  next.elements.forEach((element) => {
    if (!levels.has(element.id)) levels.set(element.id, maxLevel + 1);
  });

  const grouped = new Map<number, WorkflowElement[]>();
  next.elements.forEach((element) => {
    const level = levels.get(element.id) || 0;
    if (!grouped.has(level)) grouped.set(level, []);
    grouped.get(level)!.push(element);
  });

  [...grouped.entries()].forEach(([level, elements]) => {
    elements.sort((a, b) => {
      const priorityDelta = incomingBranchPriority(next, a) - incomingBranchPriority(next, b);
      if (priorityDelta !== 0) return priorityDelta;
      return typeRank(a) - typeRank(b);
    });

    const totalHeight = (elements.length - 1) * yGap;
    elements.forEach((element, index) => {
      element.x = originX + level * xGap;
      element.y = centerY - totalHeight / 2 + index * yGap;
    });
  });

  return next;
}

export function spreadGatewayBranches(
  workflow: Workflow,
  gatewayId: string,
  options: GatewayBranchSpreadOptions = {},
): Workflow {
  const next = cloneWorkflow(workflow);
  const gateway = next.elements.find((element) => element.id === gatewayId);
  if (!gateway) return next;

  const xGap = options.xGap ?? 300;
  const yGap = options.yGap ?? 190;
  const nestedXGap = options.nestedXGap ?? 280;
  const nestedYGap = options.nestedYGap ?? 150;
  const branches = outgoing(next, gatewayId).filter((edge) => edge.kind === "branch");

  branches.forEach((edge, index) => {
    const target = next.elements.find((element) => element.id === edge.target);
    if (!target) return;

    const laneIndex = index - (branches.length - 1) / 2;
    target.x = gateway.x + xGap;
    target.y = gateway.y + laneIndex * yGap;

    if (target.type !== "condition") return;

    const nestedBranches = outgoing(next, target.id).filter((item) => item.kind === "branch");
    nestedBranches.forEach((nestedEdge, nestedIndex) => {
      const nestedTarget = next.elements.find((element) => element.id === nestedEdge.target);
      if (!nestedTarget) return;
      const nestedLaneIndex = nestedIndex - (nestedBranches.length - 1) / 2;
      nestedTarget.x = target.x + nestedXGap;
      nestedTarget.y = target.y + nestedLaneIndex * nestedYGap;
    });
  });

  return next;
}
