# Issue 03: 导出当前审批场景 workflow JSON

## Parent

[PRD: 审批流程编排器可靠性与可用性增强](../../prd/workflow-editor-hardening-prd.md)

## Type

AFK

## Priority

P0

## Status

Done

## What to build

在流程配置页增加导出 JSON 能力。用户点击导出后，下载当前审批场景及其 workflow 配置，文件可用于备份、后端联调、问题复现和后续导入能力的基础契约。

## Acceptance criteria

- [x] 流程配置页提供明确的 `导出 JSON` 操作。
- [x] 导出内容包含 `schemaVersion`、`exportedAt`、`scene`。
- [x] `scene` 中包含场景 id、名称、标签、描述、更新时间和 workflow。
- [x] workflow 中包含状态、版本、节点、连线、分支条件、优先级等当前可编辑数据。
- [x] 导出文件名包含场景名称或场景 id，便于识别。
- [x] 导出前使用当前内存中的最新 workflow，而不是旧的 localStorage 快照。
- [x] 导出的 JSON 可被浏览器或编辑器正常打开，格式化后结构清晰。
- [x] 导出动作不改变当前流程状态。
- [x] 项目构建通过。

## Verification

- `npm run test:workflow`
- `npm run build`

## Blocked by

None - can start immediately
