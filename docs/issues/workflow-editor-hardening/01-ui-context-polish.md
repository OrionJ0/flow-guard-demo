# Issue 01: 修复基础 UI 状态与属性面板上下文

## Parent

[PRD: 审批流程编排器可靠性与可用性增强](../../prd/workflow-editor-hardening-prd.md)

## Type

AFK

## Priority

P0

## Status

Done

## What to build

修复当前用户截图中已经暴露的基础体验问题: 场景卡片右上角 `高危` 等标签高度异常、校验面板排版不清楚、属性面板在非分支节点上仍展示 `分支` tab。完成后，场景管理和流程配置页在桌面视口下应更稳定，属性面板应根据当前选择展示相关内容。

## Acceptance criteria

- [x] 场景卡片 header 的标签不再被拉伸，`高危`、`强制`、`受控` 等 tag 均保持正常高度并顶部对齐。
- [x] 场景卡片标题、描述和标签在窄卡片下不重叠。
- [x] 校验面板每一行使用稳定的图标列和文本列，标题、描述均左对齐。
- [x] 校验描述较长时自动换行，不挤压图标、不溢出右侧属性面板。
- [x] 选中审批、抄送、系统、开始、结束等非条件节点时，属性面板不展示 `分支` tab。
- [x] 选中条件网关或分支连线时，属性面板展示 `分支` tab。
- [x] 未选中节点时，属性面板不展示无关分支配置。
- [x] 新增或调整的图标按钮具有可理解的 title 或 aria-label。
- [x] 项目构建通过。

## Verification

- `npm run test:workflow`
- `npm run build`

## Blocked by

None - can start immediately
