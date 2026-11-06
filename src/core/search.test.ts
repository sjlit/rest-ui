import { test } from 'node:test'
import assert from 'node:assert/strict'
import { buildActiveFilters } from './search.ts'
import type { Schema, SchemaAttribute } from './types.ts'

function attrs(overrides: Partial<SchemaAttribute> = {}): SchemaAttribute {
  return {
    match: 'exactly',
    default_value: '',
    readonly: [],
    disable: [],
    visible: [],
    invisible: false,
    end_of_now: false,
    time_search_range: '',
    live: { enable: false, type: '' },
    sort: false,
    ...overrides,
  } as SchemaAttribute
}

function schema(overrides: Partial<Schema> & { column: string }): Schema {
  return {
    module_name: 'm',
    table_name: 't',
    enable: 1,
    label: 'X',
    type: 'string',
    format: '',
    native: 0,
    primary_key: 0,
    expression: '',
    scenarios: ['search'],
    rules: {} as any,
    attributes: attrs(),
    relations: {} as any,
    position: 0,
    ...overrides,
  } as Schema
}

const t = (key: string, ...args: any[]) => {
  if (key === 'boolean.true') return '是'
  if (key === 'boolean.false') return '否'
  return `${key}${args.length ? `:${args.join(',')}` : ''}`
}

test('buildActiveFilters 跳过空值并格式化普通字段', () => {
  const schemas = [
    schema({ column: 'keyword', label: '关键词' }),
    schema({ column: 'empty', label: '空字段' }),
  ]
  const filters = buildActiveFilters({ keyword: '张三', empty: '' }, schemas, t)
  assert.deepEqual(filters, [
    { column: 'keyword', label: '关键词：张三', value: '张三' },
  ])
})

test('buildActiveFilters 把 dropdown 原始值映射成 label', () => {
  const schemas = [
    schema({
      column: 'status',
      label: '状态',
      format: 'dropdown',
      attributes: attrs({
        values: [
          { label: '启用', value: 'enabled' },
          { label: '停用', value: 'disabled' },
        ],
      }),
    }),
  ]
  const filters = buildActiveFilters({ status: 'enabled' }, schemas, t)
  assert.equal(filters[0].label, '状态：启用')
})

test('buildActiveFilters 处理 boolean / 日期区间 / multiSelect', () => {
  const schemas = [
    schema({ column: 'enabled', label: '启用', type: 'boolean', format: 'boolean' }),
    schema({ column: 'range', label: '创建时间', format: 'daterange' }),
    schema({ column: 'tags', label: '标签', format: 'multiSelect' }),
  ]
  const filters = buildActiveFilters(
    {
      enabled: false,
      range: ['2026-01-01', '2026-01-31'],
      tags: ['a', 'b'],
    },
    schemas,
    t,
  )
  assert.deepEqual(filters.map((item) => item.label), [
    '启用：否',
    '创建时间：2026-01-01 ~ 2026-01-31',
    '标签：a、b',
  ])
})

test('buildActiveFilters 把 encode 后的日期区间字符串拆成 start ~ end', () => {
  const schemas = [schema({ column: 'created_at', label: '创建时间', format: 'datetime' })]
  const filters = buildActiveFilters(
    { created_at: '2026-01-01 00:00:00/2026-01-31 23:59:59' },
    schemas,
    t,
  )
  assert.equal(filters[0].label, '创建时间：2026-01-01 00:00:00 ~ 2026-01-31 23:59:59')
})

test('buildActiveFilters 解包 __format=both 的 { label, value }', () => {
  const schemas = [schema({ column: 'name', label: '姓名' })]
  const filters = buildActiveFilters(
    { name: { label: '张三', value: 'zhangsan' } },
    schemas,
    t,
  )
  assert.equal(filters[0].label, '姓名：zhangsan')
})

test('buildActiveFilters 对空模型返回空数组', () => {
  assert.deepEqual(buildActiveFilters(null, [], t), [])
  assert.deepEqual(buildActiveFilters({}, [schema({ column: 'x' })], t), [])
})
