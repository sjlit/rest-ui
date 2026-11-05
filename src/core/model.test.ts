import { test } from 'node:test'
import assert from 'node:assert/strict'
import { ref } from 'vue'
import {
  cloneModel,
  findOptionByValue,
  getModelLabel,
  getModelValue,
  unwrapCellValue,
} from './model.ts'

test('unwrapCellValue 解包 { label, value }，数组和原始值原样返回', () => {
  assert.equal(unwrapCellValue({ label: 'Alice', value: 'alice' }), 'alice')
  assert.equal(unwrapCellValue({ label: '1', value: 1 }), 1)
  assert.equal(unwrapCellValue('raw'), 'raw')
  assert.deepEqual(unwrapCellValue([1, 2]), [1, 2])
})

test('getModelLabel 支持数组、对象和原始值', () => {
  assert.equal(getModelLabel({ tags: [{ label: 'A' }, { label: 'B' }] }, 'tags'), 'A, B')
  assert.equal(getModelLabel({ tags: ['a', 'b'] }, 'tags'), 'a, b')
  assert.equal(getModelLabel({ status: { label: '启用', value: 'enabled' } }, 'status'), '启用')
  assert.equal(getModelLabel({ status: 0 }, 'status'), '0')
  assert.equal(getModelLabel({}, 'status'), '')
})

test('getModelValue 缺失列返回 undefined', () => {
  assert.equal(getModelValue({ a: 1 }, 'a'), 1)
  assert.equal(getModelValue({ a: 1 }, 'b'), undefined)
})

test('cloneModel 可以克隆 Vue 响应式行', () => {
  const rows = ref([{ id: 1, name: 'a', nested: { x: 1 } }])
  const cloned = cloneModel(rows.value[0])
  assert.deepEqual(cloned, { id: 1, name: 'a', nested: { x: 1 } })
})

test('findOptionByValue 兼容数字/字符串值，且不对数组做单值匹配', () => {
  const values = [{ label: '研发部', value: 2 }, { label: '新建', value: 'create' }]
  assert.equal(findOptionByValue(values, 2)?.label, '研发部')
  assert.equal(findOptionByValue(values, '2')?.label, '研发部')
  assert.equal(findOptionByValue(values, 'create')?.label, '新建')
  assert.equal(findOptionByValue(values, [2]), undefined)
})
