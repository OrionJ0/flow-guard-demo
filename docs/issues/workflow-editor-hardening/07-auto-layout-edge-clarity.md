# Issue 07: 增强自动布局与连线可读性

## Parent

[PRD: 审批流程编排器可靠性与可用性增强](../../prd/workflow-editor-hardening-prd.md)

## Type

AFK

## Priority

P1

## Status

Done

## What to build

增强当前流程画布的整理布局和连线表现。用户仍然可以自由拖拽，但点击整理布局后，主流程、条件网关、分支路径和结束节点应形成更清晰的层级关系，连线交叉更少，分支标签和优先级更容易阅读。

## Acceptance criteria

- [x] 保留用户自由拖拽能力。
- [x] `整理布局` 后开始节点、主流程节点、条件网关、结束节点形成稳定方向。
- [x] 多个分支按优先级或创建顺序分配清晰泳道。
- [x] 分支连线标签包含顺序、模式和条件摘要。
- [x] 连线 label 背景不遮挡节点主体。
- [x] 选中连线时视觉反馈清楚。
- [x] 连线点击命中区域足够大，方便选择。
- [x] 自动布局后视图能适当 fit view 或让用户快速看到完整结构。
- [x] 自动布局行为进入撤销/重做历史。
- [x] 项目构建通过。

## Verification

- `npm run test:workflow`
- `npm run build`

## Blocked by

Issue 05: 增加图结构校验与发布前拦截
