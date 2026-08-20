import type { Scenario, Schema } from './types'

/**
 * FormItem.vue 渲染分派所用的组件类型。
 * 与 <template v-else-if="..."> 链一一对应,新增分支需同步更新 FormItem.vue。
 */
export type ComponentType =
  | 'time'
  | 'date'
  | 'datetime'
  | 'dropdown'
  | 'search_boolean'
  | 'boolean'
  | 'cascader'
  | 'file'
  | 'password'
  | 'multistr'
  | 'number'
  | 'text'

/**
 * 根据 schema 的 format/type 决定渲染哪个表单组件。
 *
 * 优先级:明确的 UI format(dropdown / multiSelect / cascader)优先于 type 推断的数字形态。
 * 否则 type=integer/float/double 会把 format=dropdown 错误地截胡成 number 输入框。
 *
 * 形参 scenario 仅在 multistr / boolean 分支上影响结果(搜索场景下落到 textarea / 三态 select)。
 */
export function resolveComponentType(schema: Schema, scenario: Scenario = 'create'): ComponentType {
  const fmt = schema.format
  const tp = schema.type
  const isSearch = scenario === 'search'

  // UI format 优先:format=dropdown 明确声明意图是下拉,不应被 type=integer 覆盖。
  if (fmt === 'dropdown' || fmt === 'multiSelect') return 'dropdown'
  if (fmt === 'cascader') return 'cascader'

  if (
    ['integer', 'float', 'decimal'].includes(fmt) ||
    ['integer', 'float', 'double'].includes(tp)
  ) {
    return 'number'
  }
  if (fmt === 'password' || fmt === 'pass') return 'password'
  if (fmt === 'time') return 'time'
  if (fmt === 'date') return 'date'
  if (fmt === 'datetime' || fmt === 'timestamp') return 'datetime'
  if (fmt === 'bool' || fmt === 'boolean') {
    return isSearch ? 'search_boolean' : 'boolean'
  }
  if (fmt === 'file' && !!schema.attributes.upload_url) return 'file'
  if (!isSearch && fmt === 'text') return 'multistr'
  return 'text'
}
