import type { Selection, Workflow, WorkflowEdge } from "../types";

export type PropertyPanelTabKey = "element" | "branch" | "check";

function compactLabel(value: string, maxLength: number) {
  const trimmed = value.trim();
  if (trimmed.length <= maxLength) return trimmed;
  return `${trimmed.slice(0, maxLength)}...`;
}

export function formatWorkflowEdgeLabel(edge: WorkflowEdge) {
  if (edge.kind !== "branch") return edge.label;
  const label = compactLabel(edge.label || (edge.mode === "否则" ? "其他情况" : "条件"), 7);
  return `${edge.priority}. ${edge.mode} ${label}`;
}

function outgoing(workflow: Workflow, id: string) {
  return workflow.edges.filter((edge) => edge.source === id);
}

function distancesFrom(workflow: Workflow, startId: string) {
  const distances = new Map<string, number>();
  const queue: Array<{ id: string; distance: number }> = [{ id: startId, distance: 0 }];

  while (queue.length) {
    const current = queue.shift()!;
    const existing = distances.get(current.id);
    if (existing !== undefined && existing <= current.distance) continue;
    distances.set(current.id, current.distance);

    outgoing(workflow, current.id).forEach((edge) => {
      queue.push({ id: edge.target, distance: current.distance + 1 });
    });
  }

  return distances;
}

export function findGatewayMergeTarget(workflow: Workflow, gatewayId: string) {
  const branchTargetIds = workflow.edges
    .filter((edge) => edge.source === gatewayId && edge.kind === "branch")
    .map((edge) => edge.target);
  if (branchTargetIds.length < 2) return undefined;

  const branchTargetSet = new Set(branchTargetIds);
  const elementsById = new Map(workflow.elements.map((element) => [element.id, element]));
  const distanceMaps = branchTargetIds.map((targetId) => distancesFrom(workflow, targetId));
  const commonTargetIds = [...distanceMaps[0].keys()].filter(
    (id) =>
      id !== gatewayId &&
      !branchTargetSet.has(id) &&
      distanceMaps.every((distances) => distances.has(id)) &&
      elementsById.has(id),
  );

  commonTargetIds.sort((a, b) => {
    const aElement = elementsById.get(a);
    const bElement = elementsById.get(b);
    if (aElement?.type === "end" && bElement?.type !== "end") return 1;
    if (aElement?.type !== "end" && bElement?.type === "end") return -1;

    const aMaxDistance = Math.max(...distanceMaps.map((distances) => distances.get(a) || 0));
    const bMaxDistance = Math.max(...distanceMaps.map((distances) => distances.get(b) || 0));
    if (aMaxDistance !== bMaxDistance) return aMaxDistance - bMaxDistance;

    const aTotalDistance = distanceMaps.reduce((total, distances) => total + (distances.get(a) || 0), 0);
    const bTotalDistance = distanceMaps.reduce((total, distances) => total + (distances.get(b) || 0), 0);
    return aTotalDistance - bTotalDistance;
  });

  return commonTargetIds[0];
}

export function getPropertyPanelTabKeys(
  workflow: Workflow,
  selection?: Selection,
): PropertyPanelTabKey[] {
  if (!selection || selection.kind === "none") return ["element", "check"];

  if (selection.kind === "edge") {
    const edge = workflow.edges.find((item) => item.id === selection.id);
    return edge?.kind === "branch" ? ["branch", "check"] : ["check"];
  }

  const element = workflow.elements.find((item) => item.id === selection.id);
  if (element?.type === "condition") return ["element", "branch", "check"];

  return ["element", "check"];
}
