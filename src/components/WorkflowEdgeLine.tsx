import {
  BaseEdge,
  EdgeLabelRenderer,
  getSmoothStepPath,
  type EdgeProps,
} from "@xyflow/react";

export interface WorkflowEdgeLineData {
  label: string;
  kind: "sequence" | "branch";
  status?: "error" | "warning";
}

export default function WorkflowEdgeLine({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  markerEnd,
  style,
  selected,
  interactionWidth,
  data,
}: EdgeProps) {
  const [edgePath, labelX, labelY] = getSmoothStepPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
    borderRadius: 18,
    offset: 32,
  });
  const edgeData = data as unknown as WorkflowEdgeLineData;

  return (
    <>
      <BaseEdge
        id={id}
        path={edgePath}
        markerEnd={markerEnd}
        style={style}
        interactionWidth={interactionWidth}
      />
      {edgeData.label && (
        <EdgeLabelRenderer>
          <div
            className={[
              "workflow-edge-label",
              edgeData.kind === "branch" ? "is-branch" : "is-sequence",
              edgeData.status === "error" ? "is-error" : "",
              edgeData.status === "warning" ? "is-warning" : "",
              selected ? "is-selected" : "",
            ]
              .filter(Boolean)
              .join(" ")}
            style={{
              transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
            }}
          >
            {edgeData.label}
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  );
}
