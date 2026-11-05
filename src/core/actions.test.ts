import { test } from 'node:test'
import assert from 'node:assert/strict'
import type { Action } from './types.ts'
import {
  isActionPermitted,
  isActionVisibleSync,
  resolveActions,
} from './actions.ts'

const baseAction = (name: string): Action => ({ name, label: name })

test('isActionPermitted 按配置过滤权限', () => {
  const action = { ...baseAction('delete'), permission: 'user:delete' }
  assert.equal(isActionPermitted(action), true)
  assert.equal(
    isActionPermitted(action, { httpClient: {} as any, hasPermission: () => false }),
    false,
  )
  assert.equal(
    isActionPermitted(action, { httpClient: {} as any, hasPermission: () => true }),
    true,
  )
})

test('isActionVisibleSync 处理 permission / boolean hidden / 同步 hidden', () => {
  const config = { httpClient: {} as any, hasPermission: () => false }
  assert.equal(isActionVisibleSync({ ...baseAction('x'), permission: 'p' }, {}, config), false)
  assert.equal(isActionVisibleSync({ ...baseAction('x'), hidden: true }, {}), false)
  assert.equal(isActionVisibleSync({ ...baseAction('x'), hidden: () => true }, {}), false)
  assert.equal(isActionVisibleSync({ ...baseAction('x'), hidden: () => false }, {}), true)
})

test('resolveActions 支持字符串引用默认 action', () => {
  const view = baseAction('view')
  const edit = baseAction('edit')
  const result = resolveActions(['view'], [view, edit], { view, edit }, false)
  assert.deepEqual(result.map((a) => a.name), ['view'])
})

test('resolveActions readonly 下保留查看并追加自定义 action', () => {
  const view = baseAction('view')
  const custom = baseAction('custom')
  const result = resolveActions([custom], [view], { view }, true)
  assert.deepEqual(result.map((a) => a.name), ['view', 'custom'])
})
