import type { ValidationItem, Workflow, WorkflowEdge, WorkflowElement } from "../types";

function byId<T extends { id: string }>(items: T[]) {
  return new Map(items.map((item) => [item.id, item]));
}

function names(elements: WorkflowElement[]) {
  return elements.map((element) => element.title).join("、");
}

function validEdge(edge: WorkflowEdge, elementIds: Set<string>) {
  return elementIds.has(edge.source) && elementIds.has(edge.target);
}

function reachableFrom(starts: string[], edges: WorkflowEdge[]) {
  const visited = new Set<string>();
  const queue = [...starts];
  while (queue.length) {
    const current = queue.shift()!;
    if (visited.has(current)) continue;
    visited.add(current);
    edges
      .filter((edge) => edge.source === current)
      .forEach((edge) => {
        if (!visited.has(edge.target)) queue.push(edge.target);
      });
  }
  return visited;
}

function canReachTargets(targets: string[], edges: WorkflowEdge[]) {
  const visited = new Set<string>();
  const queue = [...targets];
  while (queue.length) {
    const current = queue.shift()!;
    if (visited.has(current)) continue;
    visited.add(current);
    edges
      .filter((edge) => edge.target === current)
      .forEach((edge) => {
        if (!visited.has(edge.source)) queue.push(edge.source);
      });
  }
  return visited;
}

export function buildWorkflowValidation(workflow: Workflow): ValidationItem[] {
  const elementsById = byId(workflow.elements);
  const elementIds = new Set(workflow.elements.map((element) => element.id));
  const validEdges = workflow.edges.filter((edge) => validEdge(edge, elementIds));
  const startElements = workflow.elements.filter((element) => element.type === "start");
  const endElements = workflow.elements.filter((element) => element.type === "end");
  const firstStart = startElements[0];
  const reachable = firstStart ? reachableFrom([firstStart.id], validEdges) : new Set<string>();
  const canReachEnd = canReachTargets(endElements.map((element) => element.id), validEdges);

  const incoming = (id: string) => validEdges.filter((edge) => edge.target === id);
  const outgoing = (id: string) => validEdges.filter((edge) => edge.source === id);
  const branchEdges = (id: string) =>
    validEdges.filter((edge) => edge.source === id && edge.kind === "branch");

  const emptyApprovers = workflow.elements.filter(
    (element) =>
      element.type === "approval" &&
      (!element.assignee.trim() ||
        element.assignee.includes("待配置") ||
        element.assignee.includes("请选择")),
  );
  const badGateways = workflow.elements.filter(
    (element) => element.type === "condition" && branchEdges(element.id).length < 2,
  );
  const invalidBranchEdges = workflow.edges.filter((edge) => {
    if (edge.kind !== "branch") return false;
    const source = elementsById.get(edge.source);
    const missingEndpoint = !elementIds.has(edge.source) || !elementIds.has(edge.target);
    const wrongSource = source?.type !== "condition";
    return missingEndpoint || wrongSource;
  });
  const emptyBranchEdges = workflow.edges.filter(
    (edge) => edge.kind === "branch" && edge.mode !== "否则" && !edge.expression.trim(),
  );
  const orphanNodes = workflow.elements.filter(
    (element) =>
      !["start", "end"].includes(element.type) &&
      incoming(element.id).length === 0 &&
      outgoing(element.id).length === 0,
  );
  const unreachableNodes = workflow.elements.filter(
    (element) => element.type !== "start" && !reachable.has(element.id),
  );
  const deadEndNodes = workflow.elements.filter(
    (element) => element.type !== "end" && !canReachEnd.has(element.id),
  );
  const startIncomingEdges = workflow.edges.filter((edge) => {
    const target = elementsById.get(edge.target);
    return target?.type === "start";
  });
  const endOutgoingEdges = workflow.edges.filter((edge) => {
    const source = elementsById.get(edge.source);
    return source?.type === "end";
  });

  return [
    {
      key: "events",
      ok: startElements.length === 1 && endElements.length === 1,
      title: "开始和结束事件",
      detail: `开始 ${startElements.length} 个，结束 ${endElements.length} 个`,
      severity: "error",
      elementIds: [...startElements, ...endElements].map((element) => element.id),
    },
    {
      key: "approvers",
      ok: emptyApprovers.length === 0,
      title: "审批人配置",
      detail: emptyApprovers.length
        ? `${emptyApprovers.length} 个审批任务未配置审批对象：${names(emptyApprovers)}`
        : "审批任务均已配置审批对象",
      severity: "warning",
      blocking: true,
      elementIds: emptyApprovers.map((element) => element.id),
    },
    {
      key: "gateways",
      ok: badGateways.length === 0,
      title: "条件网关",
      detail: badGateways.length
        ? `${badGateways.length} 个条件网关少于 2 条有效分支：${names(badGateways)}`
        : "条件网关均具备有效分支",
      severity: "error",
      elementIds: badGateways.map((element) => element.id),
    },
    {
      key: "invalid-branches",
      ok: invalidBranchEdges.length === 0,
      title: "分支配置",
      detail: invalidBranchEdges.length
        ? `${invalidBranchEdges.length} 条分支端点无效或源节点不是条件网关`
        : "条件分支端点和源节点均有效",
      severity: "error",
      edgeIds: invalidBranchEdges.map((edge) => edge.id),
      elementIds: invalidBranchEdges.flatMap((edge) => [edge.source, edge.target]),
    },
    {
      key: "branch-expressions",
      ok: emptyBranchEdges.length === 0,
      title: "分支条件",
      detail: emptyBranchEdges.length
        ? `${emptyBranchEdges.length} 条分支未填写条件表达`
        : "条件分支表达完整",
      severity: "warning",
      blocking: true,
      edgeIds: emptyBranchEdges.map((edge) => edge.id),
      elementIds: emptyBranchEdges.flatMap((edge) => [edge.source, edge.target]),
    },
    {
      key: "orphan-nodes",
      ok: orphanNodes.length === 0,
      title: "孤立节点",
      detail: orphanNodes.length ? `${orphanNodes.length} 个节点没有入口和出口：${names(orphanNodes)}` : "没有孤立节点",
      severity: "error",
      elementIds: orphanNodes.map((element) => element.id),
    },
    {
      key: "unreachable-nodes",
      ok: unreachableNodes.length === 0,
      title: "不可达节点",
      detail: unreachableNodes.length
        ? `${unreachableNodes.length} 个节点无法从开始事件到达：${names(unreachableNodes)}`
        : "所有节点均可从开始事件到达",
      severity: "error",
      elementIds: unreachableNodes.map((element) => element.id),
    },
    {
      key: "dead-end-nodes",
      ok: deadEndNodes.length === 0,
      title: "无出口路径",
      detail: deadEndNodes.length
        ? `${deadEndNodes.length} 个节点无法到达结束事件：${names(deadEndNodes)}`
        : "所有路径均可到达结束事件",
      severity: "error",
      elementIds: deadEndNodes.map((element) => element.id),
    },
    {
      key: "start-incoming",
      ok: startIncomingEdges.length === 0,
      title: "开始事件入口",
      detail: startIncomingEdges.length ? "开始事件不允许被其他节点连入" : "开始事件没有非法入口",
      severity: "error",
      edgeIds: startIncomingEdges.map((edge) => edge.id),
      elementIds: startIncomingEdges.map((edge) => edge.target),
    },
    {
      key: "end-outgoing",
      ok: endOutgoingEdges.length === 0,
      title: "结束事件出口",
      detail: endOutgoingEdges.length ? "结束事件不允许继续连出" : "结束事件没有非法出口",
      severity: "error",
      edgeIds: endOutgoingEdges.map((edge) => edge.id),
      elementIds: endOutgoingEdges.map((edge) => edge.source),
    },
  ];
}

export function hasBlockingValidationErrors(validations: ValidationItem[]) {
  return validations.some((item) => !item.ok && item.blocking !== false);
}
