# 审批流程编排器可靠性与可用性增强 Issue 拆分

父 PRD: [审批流程编排器可靠性与可用性增强](../../prd/workflow-editor-hardening-prd.md)

## Breakdown

1. [修复基础 UI 状态与属性面板上下文](./01-ui-context-polish.md)
   Type: AFK
   Priority: P0
   Status: Done
   Blocked by: None
   User stories: US-01, US-02, US-03, US-17, US-26

2. [实现流程状态生命周期与发布动作](./02-workflow-status-lifecycle.md)
   Type: AFK
   Priority: P0
   Status: Done
   Blocked by: None
   User stories: US-04, US-05, US-06, US-16, US-24

3. [导出当前审批场景 workflow JSON](./03-export-workflow-json.md)
   Type: AFK
   Priority: P0
   Status: Done
   Blocked by: None
   User stories: US-07, US-08, US-24, US-26

4. [增加撤销重做与编辑历史栈](./04-undo-redo-history.md)
   Type: AFK
   Priority: P1
   Status: Done
   Blocked by: None
   User stories: US-09, US-10, US-11, US-23, US-26

5. [增加图结构校验与发布前拦截](./05-graph-validation-publish-guard.md)
   Type: AFK
   Priority: P1
   Status: Done
   Blocked by: Issue 02
   User stories: US-12, US-13, US-14, US-15, US-16, US-17, US-26

6. [实现复杂分支和条件网关删除策略](./06-safe-branch-deletion.md)
   Type: AFK
   Priority: P1
   Status: Done
   Blocked by: Issue 05
   User stories: US-18, US-19, US-20, US-26

7. [增强自动布局与连线可读性](./07-auto-layout-edge-clarity.md)
   Type: AFK
   Priority: P1
   Status: Done
   Blocked by: Issue 05
   User stories: US-21, US-22, US-23, US-26

8. [增加本地数据恢复与 JSON 导入能力](./08-local-data-recovery-import.md)
   Type: AFK
   Priority: P2
   Status: Done
   Blocked by: Issue 03, Issue 05
   User stories: US-24, US-25, US-26

## Suggested Execution Order

先做 Issue 01、02、03，快速解决当前可见问题并补齐 JSON 交付物。随后做 Issue 04、05，让编辑器进入可安全试错、可阻止错误发布的状态。最后做 Issue 06、07，处理复杂流程的误删和可读性问题。Issue 08 是增强项，可以在核心编辑体验稳定后再做。
