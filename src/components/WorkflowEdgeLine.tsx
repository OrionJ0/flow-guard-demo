import {
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
  const defaultStroke =
    edgeData.status === "error"
      ? "#c9362e"
      : edgeData.status === "warning"
        ? "#bd6b13"
        : edgeData.kind === "branch"
          ? "#6952c7"
          : "#7f8fa4";
  const edgeStyle = {
    fill: "none",
    stroke: selected ? "#176bdc" : defaultStroke,
    strokeWidth: selected ? 3 : edgeData.kind === "branch" ? 2.4 : 2,
    opacity: 1,
    ...style,
  };

  return (
    <>
      <path
        id={id}
        className="react-flow__edge-path"
        d={edgePath}
        markerEnd={markerEnd}
        style={edgeStyle}
      />
      <path
        className="react-flow__edge-interaction"
        d={edgePath}
        fill="none"
        strokeOpacity={0}
        strokeWidth={interactionWidth}
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
