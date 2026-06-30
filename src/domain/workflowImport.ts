import type { WorkflowExportPayload } from "./workflowExport";
import { WORKFLOW_EXPORT_SCHEMA_VERSION } from "./workflowExport";

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export function parseWorkflowImport(raw: string): WorkflowExportPayload {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error("JSON 文件格式不正确");
  }

  if (!isObject(parsed) || parsed.schemaVersion !== WORKFLOW_EXPORT_SCHEMA_VERSION) {
    throw new Error("不支持的 JSON 版本");
  }

  const scene = parsed.scene;
  if (!isObject(scene)) throw new Error("导入 JSON 缺少 scene");
  if (!isObject(scene.workflow)) throw new Error("导入 JSON 缺少 workflow");
  if (!Array.isArray(scene.workflow.elements)) {
    throw new Error("导入 JSON 缺少 workflow.elements");
  }
  if (!Array.isArray(scene.workflow.edges)) {
    throw new Error("导入 JSON 缺少 workflow.edges");
  }

  return parsed as unknown as WorkflowExportPayload;
}
