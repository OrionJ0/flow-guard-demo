# Issue 04: 增加撤销重做与编辑历史栈

## Parent

[PRD: 审批流程编排器可靠性与可用性增强](../../prd/workflow-editor-hardening-prd.md)

## Type

AFK

## Priority

P1

## Status

Done

## What to build

为流程配置编辑器增加撤销/重做能力。用户对节点、连线、分支、属性和布局进行修改后，可以通过工具栏按钮或键盘快捷键撤销和重做。历史记录只存在于当前编辑会话，不需要写入 mock API。

## Acceptance criteria

- [x] 工具栏提供撤销和重做按钮，并根据是否可用展示禁用态。
- [x] 支持 `Cmd/Ctrl+Z` 撤销。
- [x] 支持 `Cmd/Ctrl+Shift+Z` 或 `Cmd/Ctrl+Y` 重做。
- [x] 新增节点、删除节点、连线变化、属性变化、分支变化、自动布局都可撤销。
- [x] 拖拽节点只在拖拽结束后记录一次历史，不在拖拽过程中产生大量历史记录。
- [x] 撤销后执行新的编辑会清空 redo 栈。
- [x] 默认最多保留 50 步历史，避免内存无限增长。
- [x] 保存到 mock API 不清空当前历史，刷新页面后历史可以不保留。
- [x] 撤销/重做后画布节点、连线和右侧属性面板保持同步。
- [x] 项目构建通过。

## Verification

- `npm run test:workflow`
- `npm run build`

## Blocked by

None - can start immediately
