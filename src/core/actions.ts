import type { Action, Model } from './types'
import type { SchemaUIConfig } from '../config'

/**
 * 权限判断：没有配置 hasPermission 时保持旧行为（允许），配置后按 permission 字段过滤。
 */
export function isActionPermitted(
  action: Pick<Action, 'permission'>,
  config?: SchemaUIConfig | null,
): boolean {
  if (!action.permission) return true
  if (!config?.hasPermission) return true
  try {
    return config.hasPermission(action.permission)
  } catch (err) {
    console.error('[rest-ui] hasPermission failed:', err)
    return false
  }
}

/**
 * 同步判断可见性，供列表/批量 action 渲染使用。
 * hidden 为异步函数时先按“可见”处理，点击时由 Action.vue 再做最终判断。
 */
export function isActionVisibleSync(
  action: Action,
  model?: Model,
  config?: SchemaUIConfig | null,
): boolean {
  if (!isActionPermitted(action, config)) return false
  if (typeof action.hidden === 'function') {
    try {
      const hidden = action.hidden(model || {})
      if (hidden instanceof Promise) return true
      return !hidden
    } catch (err) {
      console.error('[rest-ui] action hidden check failed:', err)
      return false
    }
  }
  return !action.hidden
}

/**
 * 解析 action 配置：
 * - input 为空 → 根据 autoIncludeDefaults 决定是否返回底板默认
 * - 字符串：命中底板默认则使用默认；未命中静默跳过
 * - ActionType：名字命中底板则替换默认；否则按用户传入顺序追加在底板之后
 * - 同一 name 出现多次：后者覆盖前者
 */
export function resolveActions(
  input: (string | Action)[],
  defaults: Action[],
  lookup: Record<string, Action>,
  autoIncludeDefaults: boolean,
): Action[] {
  if (input.length === 0) {
    return autoIncludeDefaults ? [...defaults] : []
  }

  const overrides = new Map<string, Action>()
  const newActions: Action[] = []

  for (const item of input) {
    if (typeof item === 'string') {
      const def = lookup[item]
      if (def) {
        overrides.set(def.name, def)
      } else {
        console.warn(`[rest-ui] unknown action: ${item}`)
      }
      continue
    }
    if (overrides.has(item.name)) {
      const idx = newActions.indexOf(overrides.get(item.name)!)
      if (idx >= 0) newActions[idx] = item
      overrides.set(item.name, item)
    } else if (lookup[item.name]) {
      overrides.set(item.name, item)
    } else {
      overrides.set(item.name, item)
      newActions.push(item)
    }
  }

  const result: Action[] = []
  if (autoIncludeDefaults) {
    for (const def of defaults) {
      result.push(overrides.get(def.name) ?? def)
    }
  } else {
    for (const def of defaults) {
      if (overrides.has(def.name)) {
        result.push(overrides.get(def.name)!)
      }
    }
  }
  for (const action of newActions) {
    if (!result.some((r) => r.name === action.name)) {
      result.push(action)
    }
  }
  return result
}
