import { Handle, NodeToolbar, Position, type NodeProps } from "@xyflow/react";
import { Tooltip } from "antd";
import {
  CircleStop,
  Diamond,
  Play,
  Send,
  ShieldCheck,
  Trash2,
  UserCheck,
} from "lucide-react";
import type { WorkflowElement, WorkflowElementType } from "../types";

export interface WorkflowNodeData {
  element: WorkflowElement;
  onQuickAdd?: (sourceId: string, type: WorkflowElementType) => void;
  onQuickDelete?: (nodeId: string) => void;
}

const iconByType = {
  start: Play,
  end: CircleStop,
  approval: UserCheck,
  condition: Diamond,
  cc: Send,
  system: ShieldCheck,
};

function subtitleForNode(node: WorkflowElement) {
  if (node.type === "approval") {
    return `${node.approverType}：${node.assignee || "未配置"}`;
  }
  if (node.type === "cc") return node.ccRange || "未配置抄送范围";
  if (node.type === "system") return node.systemAction || "系统动作";
  return node.desc || "流程节点";
}

export default function WorkflowNode({ data, selected }: NodeProps) {
  const { element: node, onQuickAdd, onQuickDelete } = data as unknown as WorkflowNodeData;
  const Icon = iconByType[node.type];
  const canAppend = node.type !== "end";
  const canDelete = node.type !== "start" && node.type !== "end";
  const quickTipProps = {
    placement: "right" as const,
    mouseEnterDelay: 0.15,
  };

  const toolbar = selected && (canAppend || canDelete) && (
    <NodeToolbar position={Position.Right} offset={12} className="node-quick-toolbar">
      {canAppend && (
        <>
          <Tooltip title="添加审批任务" {...quickTipProps}>
            <button
              type="button"
              aria-label="添加审批任务"
              title="添加审批任务"
              onClick={(event) => {
                event.stopPropagation();
                onQuickAdd?.(node.id, "approval");
              }}
            >
              <UserCheck size={15} />
            </button>
          </Tooltip>
          <Tooltip title="添加条件网关" {...quickTipProps}>
            <button
              type="button"
              aria-label="添加条件网关"
              title="添加条件网关"
              onClick={(event) => {
                event.stopPropagation();
                onQuickAdd?.(node.id, "condition");
              }}
            >
              <Diamond size={15} />
            </button>
          </Tooltip>
          <Tooltip title="添加抄送任务" {...quickTipProps}>
            <button
              type="button"
              aria-label="添加抄送任务"
              title="添加抄送任务"
              onClick={(event) => {
                event.stopPropagation();
                onQuickAdd?.(node.id, "cc");
              }}
            >
              <Send size={15} />
            </button>
          </Tooltip>
          <Tooltip title="添加系统动作" {...quickTipProps}>
            <button
              type="button"
              aria-label="添加系统动作"
              title="添加系统动作"
              onClick={(event) => {
                event.stopPropagation();
                onQuickAdd?.(node.id, "system");
              }}
            >
              <ShieldCheck size={15} />
            </button>
          </Tooltip>
        </>
      )}
      {canDelete && (
        <Tooltip title="删除节点" {...quickTipProps}>
          <button
            className="is-danger"
            type="button"
            aria-label="删除节点"
            title="删除节点"
            onClick={(event) => {
              event.stopPropagation();
              onQuickDelete?.(node.id);
            }}
          >
            <Trash2 size={15} />
          </button>
        </Tooltip>
      )}
    </NodeToolbar>
  );

  if (node.type === "start" || node.type === "end") {
    return (
      <div className={`flow-event flow-event-${node.type} ${selected ? "is-selected" : ""}`}>
        {toolbar}
        {node.type !== "start" && <Handle type="target" position={Position.Left} />}
        <div className="flow-event-shape">
          <Icon size={18} />
        </div>
        <div className="flow-event-label">{node.title}</div>
        {node.type !== "end" && <Handle type="source" position={Position.Right} />}
      </div>
    );
  }

  if (node.type === "condition") {
    return (
      <div className={`flow-gateway ${selected ? "is-selected" : ""}`}>
        {toolbar}
        <Handle type="target" position={Position.Left} />
        <div className="flow-gateway-shape">
          <span>×</span>
        </div>
        <div className="flow-gateway-title">{node.title}</div>
        <Handle type="source" position={Position.Right} />
      </div>
    );
  }

  return (
    <div className={`flow-task flow-task-${node.type} ${selected ? "is-selected" : ""}`}>
      {toolbar}
      <Handle type="target" position={Position.Left} />
      <span className="flow-task-icon">
        <Icon size={16} />
      </span>
      <span className="flow-task-copy">
        <strong>{node.title}</strong>
        <em>{subtitleForNode(node)}</em>
      </span>
      <Handle type="source" position={Position.Right} />
    </div>
  );
}
