import type { Schema, Scenario } from './types'

export interface FieldRules {
  [key: string]: any
}

/**
 * 根据 schema 生成 Element Plus 表单验证规则
 */
export function generateSchemaRule(
  t: (key: string, ...args: any[]) => string,
  schema: Schema,
  scenario: Scenario
): any[] {
  const rules: any[] = []
  const rule = schema.rules

  if (rule.safe) {
    return rules
  }

  if (rule.required && (rule.required as string[]).includes(scenario)) {
    rules.push({
      required: true,
      message: t('validation.required', schema.label),
      trigger: 'blur',
    })
  }

  if (rule.min > 0 && schema.type === 'string') {
    rules.push({
      min: rule.min,
      message: t('validation.min', schema.label, rule.min),
      trigger: 'blur',
    })
  }

  if (rule.max > 0 && schema.type === 'string') {
    rules.push({
      max: rule.max,
      message: t('validation.max', schema.label, rule.max),
      trigger: 'blur',
    })
  }

  if (rule.type) {
    rules.push({
      type: rule.type,
      message: t('validation.type', schema.label),
      trigger: 'blur',
    })
  } else if (
    ['integer', 'float', 'decimal', 'double'].includes(schema.type) ||
    ['integer', 'float', 'decimal'].includes(schema.format)
  ) {
    // rest 的 Rule.Type 目前不会写入 schema，数字字段如果完全交给 encode
    // 会静默把 'abc' 兜底成 0。这里补一个“空值放行、非空必须是数字”的
    // 校验，避免用户输入被悄悄写错。
    rules.push({
      validator: (_rule: any, value: any, callback: (err?: Error) => void) => {
        if (value === '' || value === null || value === undefined) {
          callback()
          return
        }
        const num = Number(value)
        if (Number.isFinite(num)) callback()
        else callback(new Error(t('validation.type', schema.label)))
      },
      trigger: 'blur',
    })
  }

  if (rule.regular) {
    try {
      rules.push({
        pattern: new RegExp(rule.regular),
        message: t('validation.pattern', schema.label),
        trigger: 'blur',
      })
    } catch (err) {
      // 后端来自 Go RE2，语法与 JS 并不完全兼容（例如 (?i) 内联 flag）。
      // 非法正则只跳过该条规则，不能让整个表单 computed 崩掉。
      console.warn(
        `[rest-ui] invalid regular expression for "${schema.column}": ${rule.regular}`,
        err,
      )
    }
  }

  return rules
}

/**
 * 检查 schema 在指定模型下是否可见
 */
export function checkSchemaVisible(schema: Schema, model: Record<string, any>): boolean {
  const conditions = schema.attributes.visible
  if (!conditions || conditions.length === 0) {
    return true
  }

  for (const cond of conditions) {
    const modelValue = model[cond.column]
    const found = cond.values.some((v) => String(v) === String(modelValue))
    if (!found) {
      return false
    }
  }

  return true
}

/**
 * 生成字段描述文本
 */
export function generateSchemaDescription(
  _t: (key: string, ...args: any[]) => string,
  schema: Schema,
  _scenario: Scenario
): string {
  if (schema.attributes.tooltip) {
    return schema.attributes.tooltip
  }
  return ''
}

/**
 * 清空搜索模型中的空值
 */
export function clearSearchModel(
  model: Record<string, any>,
  _schemas: Schema[]
): Record<string, any> {
  const result: Record<string, any> = {}
  for (const key in model) {
    const value = model[key]
    if (value !== '' && value !== null && value !== undefined) {
      result[key] = value
    }
  }
  return result
}

/**
 * 判断 schema 是否属于指定场景。
 *
 * rest/v3 的 canonical scenario 是 detail，但历史 admin 模型大量使用
 * scenarios:"view"。这里把 view 当作 detail 的别名，避免存量 sys_schemas
 * 里的详情字段在 UI 上被再次过滤掉。rest 服务端也需要做同样兼容。
 */
function matchesScenario(schema: Schema, scenario: Scenario): boolean {
  if (!Array.isArray(schema.scenarios)) return false
  if (schema.scenarios.includes(scenario)) return true
  if (scenario === 'detail' && (schema.scenarios as string[]).includes('view')) {
    return true
  }
  return false
}

/**
 * 按场景过滤可见的 schema 列表
 */
export function filterByScenario(
  schemas: Schema[],
  scenario: Scenario,
  options?: {
    includeInvisible?: boolean
    visibleCheck?: (schema: Schema) => boolean
  }
): Schema[] {
  return schemas.filter((schema) => {
    if (schema.enable === 0) return false
    if (!matchesScenario(schema, scenario)) return false
    if (!options?.includeInvisible && schema.attributes.invisible) return false
    if (options?.visibleCheck && !options.visibleCheck(schema)) return false
    return true
  })
}
