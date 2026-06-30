import type { ApprovalScene } from "../types";

export const WORKFLOW_EXPORT_SCHEMA_VERSION = "approval-workflow-export/v1";

export interface WorkflowExportPayload {
  schemaVersion: typeof WORKFLOW_EXPORT_SCHEMA_VERSION;
  exportedAt: string;
  scene: ApprovalScene;
}

function cloneScene(scene: ApprovalScene): ApprovalScene {
  return JSON.parse(JSON.stringify(scene)) as ApprovalScene;
}

export function buildWorkflowExport(
  scene: ApprovalScene,
  exportedAt = new Date().toISOString(),
): WorkflowExportPayload {
  return {
    schemaVersion: WORKFLOW_EXPORT_SCHEMA_VERSION,
    exportedAt,
    scene: cloneScene(scene),
  };
}

export function workflowExportFileName(sceneName: string, sceneId: string) {
  const safeName = sceneName
    .trim()
    .replace(/[\\/:*?"<>|]+/g, "-")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
  return `approval-workflow-${safeName || "scene"}-${sceneId}.json`;
}
