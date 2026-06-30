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

export function getPropertyPanelTabKeys(
  workflow: Workflow,
  selection?: Selection,
): PropertyPanelTabKey[] {
  if (!selection) return ["element", "check"];

  if (selection.kind === "edge") {
    const edge = workflow.edges.find((item) => item.id === selection.id);
    return edge?.kind === "branch" ? ["branch", "check"] : ["check"];
  }

  const element = workflow.elements.find((item) => item.id === selection.id);
  if (element?.type === "condition") return ["element", "branch", "check"];

  return ["element", "check"];
}
