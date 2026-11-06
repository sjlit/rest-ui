import type { Model, Schema } from './types'
import { unwrapCellValue } from './model.ts'

export interface ActiveFilter {
  column: string
  label: string
  value: string
}

type Translate = (key: string, ...args: any[]) => string

function isBlank(value: any): boolean {
  if (value === null || value === undefined || value === '') return true
  if (Array.isArray(value) && value.length === 0) return true
  return false
}

function isBooleanSchema(schema: Schema): boolean {
  return schema.type === 'boolean' || schema.format === 'boolean' || schema.format === 'bool'
}

function formatValue(schema: Schema, value: any, t: Translate): string {
  const raw = unwrapCellValue(value)
  if (Array.isArray(raw)) {
    const separator = schema.format === 'multiSelect' ? '、' : ' ~ '
    return raw
      .map((item) => formatValue(schema, item, t))
      .filter((item) => item !== '')
      .join(separator)
  }
  if (raw === null || raw === undefined || raw === '') return ''
  // 日期区间在 encode(search) 后是 'start/end' 字符串，展示时拆开更易读。
  // 只对日期类 format 或形如 YYYY-MM-DD 的值处理，避免把普通路径拆坏。
  const dateFormats = ['date', 'datetime', 'timestamp', 'daterange', 'datetimerange', 'timerange']
  const dateLike = /^\d{4}-\d{2}-\d{2}/.test(raw)
  if (typeof raw === 'string' && raw.includes('/') && (dateLike || dateFormats.includes(schema.format))) {
    const [start, end] = raw.split('/', 2)
    if (start && end) return `${start} ~ ${end}`
  }
  if (isBooleanSchema(schema)) {
    return raw === false || raw === 'false' || raw === '0'
      ? t('boolean.false')
      : t('boolean.true')
  }
  const values = schema.attributes?.values
  if (Array.isArray(values)) {
    const found = values.find((item) => String(item.value) === String(raw))
    if (found) return String(found.label)
  }
  return String(raw)
}

/**
 * 把已提交的搜索模型展开成“条件 chip”列表。
 *
 * 直接展示 schema.label + 格式化后的值，dropdown 尽量映射成 label，
 * 数组（日期区间 / multiSelect）按格式拼接。
 */
export function buildActiveFilters(
  model: Model | null | undefined,
  schemas: Schema[],
  t: Translate,
): ActiveFilter[] {
  if (!model) return []
  const result: ActiveFilter[] = []
  for (const schema of schemas) {
    const value = model[schema.column]
    if (isBlank(value)) continue
    const formatted = formatValue(schema, value, t)
    if (formatted === '') continue
    result.push({
      column: schema.column,
      label: `${schema.label}：${formatted}`,
      value: formatted,
    })
  }
  return result
}
