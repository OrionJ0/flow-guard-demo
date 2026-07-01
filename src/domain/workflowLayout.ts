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

function average(values: number[]) {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function branchEdges(workflow: Workflow, id: string) {
  return outgoing(workflow, id).filter((edge) => edge.kind === "branch");
}

function sequenceEdges(workflow: Workflow, id: string) {
  return outgoing(workflow, id).filter((edge) => edge.kind !== "branch");
}

function estimateBranchLeaves(workflow: Workflow, id: string, visiting = new Set<string>()): number {
  if (visiting.has(id)) return 1;
  const nextVisiting = new Set(visiting).add(id);
  const branches = branchEdges(workflow, id);

  if (branches.length) {
    return Math.max(
      1,
      branches.reduce(
        (sum, edge) => sum + estimateBranchLeaves(workflow, edge.target, nextVisiting),
        0,
      ),
    );
  }

  const [sequence] = sequenceEdges(workflow, id);
  if (!sequence) return 1;
  return Math.max(1, Math.min(estimateBranchLeaves(workflow, sequence.target, nextVisiting), 3));
}

function distributeBranchCenters(
  workflow: Workflow,
  branches: ReturnType<typeof branchEdges>,
  centerY: number,
  yGap: number,
) {
  const spans = branches.map((edge) => estimateBranchLeaves(workflow, edge.target));
  const totalLeaves = spans.reduce((sum, span) => sum + span, 0);
  let cursor = centerY - ((totalLeaves - 1) * yGap) / 2;

  return branches.map((edge, index) => {
    const span = spans[index];
    const childY = cursor + ((span - 1) * yGap) / 2;
    cursor += span * yGap;
    return { edge, y: childY };
  });
}

function resolveLevelCollisions(elements: WorkflowElement[], yGap: number) {
  if (elements.length <= 1) return;
  const desiredCenter = average(elements.map((element) => element.y));
  elements.sort((a, b) => {
    const yDelta = a.y - b.y;
    if (yDelta !== 0) return yDelta;
    return typeRank(a) - typeRank(b);
  });

  for (let index = 1; index < elements.length; index += 1) {
    const minY = elements[index - 1].y + yGap;
    if (elements[index].y < minY) elements[index].y = minY;
  }

  const shiftedCenter = average(elements.map((element) => element.y));
  const shift = shiftedCenter - desiredCenter;
  elements.forEach((element) => {
    element.y -= shift;
  });
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

  const desiredY = new Map<string, number[]>();
  const pushDesiredY = (id: string, y: number) => {
    if (!desiredY.has(id)) desiredY.set(id, []);
    desiredY.get(id)!.push(y);
  };
  const placeFrom = (id: string, y: number, visiting = new Set<string>()) => {
    if (visiting.has(id)) return;
    pushDesiredY(id, y);
    const nextVisiting = new Set(visiting).add(id);
    const branches = branchEdges(next, id);

    if (branches.length) {
      distributeBranchCenters(next, branches, y, yGap).forEach(({ edge, y: childY }) => {
        placeFrom(edge.target, childY, nextVisiting);
      });
      return;
    }

    sequenceEdges(next, id).forEach((edge) => {
      placeFrom(edge.target, y, nextVisiting);
    });
  };
  placeFrom(start.id, centerY);

  [...grouped.entries()].forEach(([level, elements]) => {
    elements.sort((a, b) => {
      const priorityDelta = incomingBranchPriority(next, a) - incomingBranchPriority(next, b);
      if (priorityDelta !== 0) return priorityDelta;
      return typeRank(a) - typeRank(b);
    });

    const totalHeight = (elements.length - 1) * yGap;
    elements.forEach((element, index) => {
      element.x = originX + level * xGap;
      element.y = desiredY.has(element.id)
        ? average(desiredY.get(element.id)!)
        : centerY - totalHeight / 2 + index * yGap;
    });
    resolveLevelCollisions(elements, yGap);
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
