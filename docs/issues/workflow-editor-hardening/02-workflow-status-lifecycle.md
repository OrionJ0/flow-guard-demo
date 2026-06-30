# Issue 02: 实现流程状态生命周期与发布动作

## Parent

[PRD: 审批流程编排器可靠性与可用性增强](../../prd/workflow-editor-hardening-prd.md)

## Type

AFK

## Priority

P0

## Status

Done

## What to build

把流程状态从静态展示升级为动作驱动的生命周期。用户不直接编辑状态字段，而是通过保存草稿、启用、发布变更、停用等动作改变状态。已启用流程被编辑后应进入 `有未发布变更`，让用户明确知道当前配置和线上生效版本存在差异。

## Acceptance criteria

- [x] 流程状态支持 `草稿`、`已启用`、`有未发布变更`、`已停用`。
- [x] 新建场景默认状态为 `草稿`。
- [x] 草稿流程通过发布/启用动作后变为 `已启用`。
- [x] 已启用流程发生节点、连线、分支、属性、布局修改后变为 `有未发布变更`。
- [x] 有未发布变更的流程通过发布动作后变为 `已启用`，版本号递增。
- [x] 已启用流程可以停用，停用后状态为 `已停用`。
- [x] 状态 tag 的文案和颜色能清楚区分四种状态。
- [x] 场景管理页和流程配置页展示同一套状态语义。
- [x] mock API + localStorage 能保存状态变化，刷新页面后状态不丢失。
- [x] 项目构建通过。

## Verification

- `npm run test:workflow`
- `npm run build`

## Blocked by

None - can start immediately
