# Issue 08: 增加本地数据恢复与 JSON 导入能力

## Parent

[PRD: 审批流程编排器可靠性与可用性增强](../../prd/workflow-editor-hardening-prd.md)

## Type

AFK

## Priority

P2

## Status

Done

## What to build

在 mock API + localStorage 阶段增加本地数据恢复能力。用户可以恢复示例数据，也可以导入之前导出的 JSON。导入后需要执行基础 schema 校验和流程图结构校验，避免坏数据直接覆盖当前工作。

## Acceptance criteria

- [x] 场景管理页或流程配置页提供恢复示例数据入口。
- [x] 恢复示例数据前有确认提示，说明会覆盖当前 localStorage 数据。
- [x] 支持选择 JSON 文件导入当前场景或新增场景。
- [x] 导入时校验 `schemaVersion`。
- [x] 导入时校验 scene 和 workflow 的必要字段。
- [x] 导入成功后写入 mock API/localStorage。
- [x] 导入后自动运行流程校验，并展示问题。
- [x] 导入失败时展示清晰错误，不覆盖当前数据。
- [x] 导入能力兼容 Issue 03 导出的 JSON。
- [x] 项目构建通过。

## Verification

- `npm run test:workflow`
- `npm run build`

## Blocked by

Issue 03: 导出当前审批场景 workflow JSON
Issue 05: 增加图结构校验与发布前拦截
