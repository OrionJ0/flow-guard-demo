import type { Workflow } from "../types";

export type BranchDeletionMode = "edge-only" | "branch-subtree";

export interface BranchDeletionImpact {
  edgeId: string;
  removableNodeIds: string[];
}

export interface ConditionDeletionImpact {
  gatewayId: string;
  branchCount: number;
  removableNodeIds: string[];
}

function cloneWorkflow(workflow: Workflow): Workflow {
  return JSON.parse(JSON.stringify(workflow)) as Workflow;
}

function removeNodesAndDanglingEdges(workflow: Workflow, removableNodeIds: Set<string>) {
  workflow.elements = workflow.elements.filter((element) => !removableNodeIds.has(element.id));
  const elementIds = new Set(workflow.elements.map((element) => element.id));
  workflow.edges = workflow.edges.filter(
    (edge) =>
      !removableNodeIds.has(edge.source) &&
      !removableNodeIds.has(edge.target) &&
      elementIds.has(edge.source) &&
      elementIds.has(edge.target),
  );
}

export function getBranchDeletionImpact(
  workflow: Workflow,
  edgeId: string,
): BranchDeletionImpact {
  const edge = workflow.edges.find((item) => item.id === edgeId);
  if (!edge || edge.kind !== "branch") return { edgeId, removableNodeIds: [] };

  const removableNodeIds = new Set<string>();
  const visit = (nodeId: string) => {
    if (removableNodeIds.has(nodeId)) return;
    const element = workflow.elements.find((item) => item.id === nodeId);
    if (!element || element.type === "start" || element.type === "end") return;

    const incoming = workflow.edges.filter((item) => item.target === nodeId);
    const hasExternalIncoming = incoming.some(
      (item) => item.id !== edgeId && !removableNodeIds.has(item.source),
    );
    if (hasExternalIncoming) return;

    removableNodeIds.add(nodeId);
    workflow.edges
      .filter((item) => item.source === nodeId)
      .forEach((item) => visit(item.target));
  };

  visit(edge.target);
  return { edgeId, removableNodeIds: [...removableNodeIds] };
}

export function deleteBranchEdge(
  workflow: Workflow,
  edgeId: string,
  mode: BranchDeletionMode,
) {
  const next = cloneWorkflow(workflow);
  const impact = getBranchDeletionImpact(next, edgeId);
  next.edges = next.edges.filter((edge) => edge.id !== edgeId);

  if (mode === "branch-subtree") {
    removeNodesAndDanglingEdges(next, new Set(impact.removableNodeIds));
  }

  return next;
}

export function getConditionDeletionImpact(
  workflow: Workflow,
  gatewayId: string,
): ConditionDeletionImpact {
  const branchEdges = workflow.edges.filter(
    (edge) => edge.source === gatewayId && edge.kind === "branch",
  );
  const removableNodeIds = new Set<string>();
  branchEdges.forEach((edge) => {
    getBranchDeletionImpact(workflow, edge.id).removableNodeIds.forEach((id) =>
      removableNodeIds.add(id),
    );
  });
  return {
    gatewayId,
    branchCount: branchEdges.length,
    removableNodeIds: [...removableNodeIds],
  };
}

export function deleteConditionGateway(workflow: Workflow, gatewayId: string) {
  const next = cloneWorkflow(workflow);
  const impact = getConditionDeletionImpact(next, gatewayId);
  const removableNodeIds = new Set([gatewayId, ...impact.removableNodeIds]);
  removeNodesAndDanglingEdges(next, removableNodeIds);
  return next;
}
