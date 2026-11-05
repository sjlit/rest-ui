import { test } from 'node:test'
import assert from 'node:assert/strict'
import { filterByScenario, generateSchemaRule } from './form.ts'
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
    scenarios: ['create', 'update', 'search'],
    rules: {} as any,
    attributes: attrs(),
    relations: {} as any,
    position: 0,
    ...overrides,
  } as Schema
}

test('filterByScenario 把 view 当作 detail 别名', () => {
  const schemas = [
    schema({ column: 'a', scenarios: ['view' as any] }),
    schema({ column: 'b', scenarios: ['detail'] }),
    schema({ column: 'c', scenarios: ['list'] }),
  ]
  assert.deepEqual(
    filterByScenario(schemas, 'detail').map((s) => s.column),
    ['a', 'b'],
  )
})

test('非法后端正则不会让 generateSchemaRule 抛异常', () => {
  const warn = console.warn
  console.warn = () => {}
  try {
    const rules = generateSchemaRule(
      (key) => key,
      schema({ column: 'x', rules: { regular: '(?i)abc' } as any }),
      'create',
    )
    assert.equal(Array.isArray(rules), true)
  } finally {
    console.warn = warn
  }
})

test('数字字段补非空数字校验，空值放行', () => {
  const rules = generateSchemaRule(
    (key) => key,
    schema({ column: 'age', type: 'integer', rules: {} as any }),
    'create',
  )
  const numeric = rules.find((rule) => typeof rule.validator === 'function')
  assert.ok(numeric)
  let error: Error | undefined
  numeric.validator(null, '12abc', (err?: Error) => { error = err })
  assert.ok(error)
  error = undefined
  numeric.validator(null, '', (err?: Error) => { error = err })
  assert.equal(error, undefined)
})
