import { test } from 'node:test'
import assert from 'node:assert/strict'
import { Scenarios } from './scenarios.ts'

test('Scenarios 保留 Array 子类行为：map/filter/slice 不崩', () => {
  const scenarios = Scenarios.from('create;update;list')
  assert.deepEqual([...scenarios], ['create', 'update', 'list'])
  assert.deepEqual([...scenarios.map((s) => s.toUpperCase())], ['CREATE', 'UPDATE', 'LIST'])
  assert.deepEqual([...scenarios.filter((s) => s !== 'update')], ['create', 'list'])
  assert.deepEqual([...scenarios.slice(0, 2)], ['create', 'update'])
  assert.equal(scenarios.has('create'), true)
  assert.equal(scenarios.has('detail'), false)
})

test('Scenarios.from 过滤未知值并支持数组入参', () => {
  const scenarios = Scenarios.from(['create', 'view' as any, 'detail'])
  assert.deepEqual([...scenarios], ['create', 'detail'])
})
