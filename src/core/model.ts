import { toRaw } from 'vue'
import type { Model } from './types'

/**
 * 获取模型中指定列的值
 */
export function getModelValue(model: Model, column: string): any {
  if (model && typeof model === 'object' && column in model) {
    return model[column]
  }
  return undefined
}

/**
 * 解包后端 __format=both 返回的 { label, value } 单元格。
 *
 * 列表接口为了让表格直接显示 label，会把每个单元格包成 { label, value }。
 * 表单编辑/主键提取需要使用底层的 value，而不是展示用的 label。
 * 数组和原始值原样返回。
 */
export function unwrapCellValue(value: any): any {
  if (
    value &&
    typeof value === 'object' &&
    !Array.isArray(value) &&
    'value' in value
  ) {
    return value.value
  }
  return value
}

function toDisplayLabel(value: any): string {
  if (value === null || value === undefined) return ''
  if (Array.isArray(value)) {
    return value
      .map((item) => toDisplayLabel(item))
      .filter((item) => item !== '')
      .join(', ')
  }
  if (typeof value === 'object') {
    if (value.label !== undefined && value.label !== null) {
      return String(value.label)
    }
    if (value.value !== undefined && value.value !== null) {
      return String(value.value)
    }
    return ''
  }
  return String(value)
}

/**
 * 获取模型中指定列的显示标签
 *
 * 支持：
 * - 原始值
 * - { label, value } 单元格
 * - 数组（multiSelect / cascader / has_many），逐项拼接
 */
export function getModelLabel(model: Model, column: string): string {
  return toDisplayLabel(getModelValue(model, column))
}

/**
 * 在 attributes.values / live 选项里按值查找选项。
 * 统一用 String 比较，兼容后端返回的数字 id 与枚举字符串值。
 */
export function findOptionByValue(
  values: any[] | undefined | null,
  value: any,
): any | undefined {
  if (!Array.isArray(values) || Array.isArray(value)) return undefined
  if (value === undefined || value === null) return undefined
  return values.find((item) => String(item?.value) === String(value))
}

/**
 * 深拷贝一行模型数据。
 *
 * Vue 的 ref/reactive 行是 Proxy，直接 structuredClone 会抛 DataCloneError。
 * 先 toRaw 再 clone；structuredClone 自身失败（函数/DOM 等）时回退 JSON。
 */
export function cloneModel(model: Model | null | undefined): Model {
  if (!model) return {}
  const raw = toRaw(model)
  try {
    return typeof structuredClone === 'function'
      ? structuredClone(raw)
      : JSON.parse(JSON.stringify(raw))
  } catch (err) {
    console.warn('[rest-ui] structuredClone failed, falling back to JSON clone:', err)
    return JSON.parse(JSON.stringify(raw))
  }
}
