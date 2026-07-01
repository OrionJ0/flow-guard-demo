export type ConditionFieldKey =
  | "requestCount"
  | "fieldType"
  | "riskLevel"
  | "reportScope"
  | "dataAction";

export type ConditionOperatorKey = "gt" | "gte" | "eq" | "contains" | "notContains";

export interface ConditionParts {
  field: ConditionFieldKey;
  operator: ConditionOperatorKey;
  value: string;
}

export interface ConditionFieldOption {
  value: ConditionFieldKey;
  label: string;
  valueKind: "number" | "select";
  valueOptions?: string[];
}

export interface ConditionOperatorOption {
  value: ConditionOperatorKey;
  label: string;
}

export const CONDITION_FIELDS: ConditionFieldOption[] = [
  { value: "requestCount", label: "申请数量", valueKind: "number" },
  {
    value: "fieldType",
    label: "字段类型",
    valueKind: "select",
    valueOptions: ["基础字段", "明细字段", "汇总字段", "扩展字段"],
  },
  {
    value: "riskLevel",
    label: "条件级别",
    valueKind: "select",
    valueOptions: ["一级", "二级", "三级"],
  },
  {
    value: "reportScope",
    label: "报表范围",
    valueKind: "select",
    valueOptions: ["统计字段", "明细字段", "规则清单", "措施清单"],
  },
  {
    value: "dataAction",
    label: "处理动作",
    valueKind: "select",
    valueOptions: ["查看", "处理", "归档", "生成"],
  },
];

export const CONDITION_OPERATORS: ConditionOperatorOption[] = [
  { value: "gt", label: "大于" },
  { value: "gte", label: "大于等于" },
  { value: "eq", label: "等于" },
  { value: "contains", label: "包含" },
  { value: "notContains", label: "不包含" },
];

export const DEFAULT_CONDITION_PARTS: ConditionParts = {
  field: "requestCount",
  operator: "gt",
  value: "500",
};

function fieldMeta(field: ConditionFieldKey) {
  return CONDITION_FIELDS.find((item) => item.value === field) || CONDITION_FIELDS[0];
}

function operatorMeta(operator: ConditionOperatorKey) {
  return CONDITION_OPERATORS.find((item) => item.value === operator) || CONDITION_OPERATORS[0];
}

export function getConditionFieldMeta(field: ConditionFieldKey) {
  return fieldMeta(field);
}

export function composeConditionExpression(parts: ConditionParts) {
  const field = fieldMeta(parts.field).label;
  const operator = operatorMeta(parts.operator).label;
  const value = `${parts.value || ""}`.trim();
  return [field, operator, value].filter(Boolean).join(" ");
}

function detectOperator(expression: string): ConditionOperatorKey {
  if (expression.includes("大于等于") || expression.includes(">=")) return "gte";
  if (expression.includes("大于") || expression.includes(">")) return "gt";
  if (expression.includes("不包含")) return "notContains";
  if (expression.includes("包含")) return "contains";
  if (expression.includes("等于") || expression.includes("=")) return "eq";
  return "eq";
}

function stripKnownTerms(expression: string, field: ConditionFieldKey, operator: ConditionOperatorKey) {
  const fieldLabel = fieldMeta(field).label;
  const operatorLabel = operatorMeta(operator).label;
  return expression
    .replace(fieldLabel, "")
    .replace(operatorLabel, "")
    .replace(/>=|>|=/g, "")
    .replace(/^或/, "")
    .trim();
}

export function parseConditionExpression(expression: string): ConditionParts {
  const trimmed = expression.trim();
  if (!trimmed || trimmed === "请配置条件表达") return { ...DEFAULT_CONDITION_PARTS };

  const directField = CONDITION_FIELDS.find((item) => trimmed.startsWith(item.label));
  if (directField) {
    const operator = detectOperator(trimmed);
    const rawValue = stripKnownTerms(trimmed, directField.value, operator);
    const value =
      directField.valueKind === "number"
        ? rawValue.match(/\d+/)?.[0] || DEFAULT_CONDITION_PARTS.value
        : directField.valueOptions?.find((option) => rawValue.includes(option)) ||
          rawValue.split(/[、,，或]/)[0]?.trim() ||
          DEFAULT_CONDITION_PARTS.value;
    return {
      field: directField.value,
      operator,
      value,
    };
  }

  const exportCountMatch = trimmed.match(/(?:申请数量|导出数量)\s*(?:>|大于|>=|大于等于)\s*(\d+)/);
  if (exportCountMatch) {
    return {
      field: "requestCount",
      operator: trimmed.includes(">=") || trimmed.includes("大于等于") ? "gte" : "gt",
      value: exportCountMatch[1],
    };
  }

  const fieldType = [
    "基础字段",
    "明细字段",
    "汇总字段",
    "扩展字段",
    "未脱敏人脸图像",
    "原图",
    "完整证件号",
    "完整手机号",
  ].find((item) =>
    trimmed.includes(item),
  );
  if (fieldType) {
    const neutralFieldType = ["未脱敏人脸图像", "原图", "完整证件号", "完整手机号"].includes(fieldType)
      ? "明细字段"
      : fieldType;
    return { field: "fieldType", operator: "contains", value: neutralFieldType };
  }

  if (trimmed.includes("统计") || trimmed.includes("规则清单") || trimmed.includes("措施清单")) {
    const value = trimmed.includes("明细") || trimmed.includes("敏感") ? "明细字段" : "统计字段";
    return { field: "reportScope", operator: "eq", value };
  }

  const dataAction = ["查看", "处理", "归档", "生成", "访问", "导出", "删除", "匿名化"].find((item) => trimmed.includes(item));
  if (dataAction) return { field: "dataAction", operator: "eq", value: dataAction };

  const level = ["一级", "二级", "三级"].find((item) => trimmed.includes(item));
  if (level) return { field: "riskLevel", operator: "eq", value: level };

  const legacyLevel = [
    ["高", "一级"],
    ["中", "二级"],
    ["低", "三级"],
  ].find(([legacy]) => trimmed.includes(legacy));
  if (legacyLevel) return { field: "riskLevel", operator: "eq", value: legacyLevel[1] };

  return {
    field: "riskLevel",
    operator: "eq",
    value: "一级",
  };
}
