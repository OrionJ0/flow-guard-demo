import type { ApprovalScene } from "../types";

const neutralTextRules: Array<[RegExp, string]> = [
  [/高危数据访问审批/g, "通用资料申请审批"],
  [/高危数据访问/g, "通用资料申请"],
  [/高危/g, "通用"],
  [/风险条件判断/g, "条件判断"],
  [/报表敏感度判断/g, "报表字段判断"],
  [/高风险/g, "条件一"],
  [/普通风险/g, "条件二"],
  [/风险等级/g, "条件级别"],
  [/敏感字段/g, "字段类型"],
  [/含敏感/g, "包含明细"],
  [/包含敏感/g, "包含明细"],
  [/未脱敏人脸图像/g, "明细资料"],
  [/人脸图像/g, "图片资料"],
  [/完整证件号/g, "编号字段"],
  [/完整手机号/g, "联系方式字段"],
  [/原图/g, "图片资料"],
  [/批量导出/g, "批量处理"],
  [/导出文件摘要/g, "处理文件摘要"],
  [/导出数量/g, "申请数量"],
  [/安全管理员/g, "流程管理员"],
  [/数据安全专员/g, "流程专员"],
  [/安全动作/g, "系统动作"],
  [/触发异常告警/g, "记录处理结果"],
  [/删除数据/g, "资料处理"],
  [/匿名化处理/g, "资料处理"],
];

export function neutralizeSceneText(text: string) {
  return neutralTextRules.reduce((current, [pattern, replacement]) => {
    return current.replace(pattern, replacement);
  }, text);
}

function neutralizeValue(value: unknown): unknown {
  if (typeof value === "string") return neutralizeSceneText(value);
  if (Array.isArray(value)) return value.map(neutralizeValue);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [key, neutralizeValue(item)]),
    );
  }
  return value;
}

export function neutralizeScene(scene: ApprovalScene): ApprovalScene {
  const next = neutralizeValue(scene) as ApprovalScene;
  if (next.tag === "高危") next.tag = "通用";
  return next;
}

export function neutralizeScenes(scenes: ApprovalScene[]) {
  return scenes.map(neutralizeScene);
}
