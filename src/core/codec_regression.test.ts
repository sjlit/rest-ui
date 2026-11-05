import { test } from 'node:test'
import assert from 'node:assert/strict'
import { decode, encode } from './codec.ts'
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

test('decode/encode time 字段往返不变', () => {
  const schemas = [schema({ column: 't', format: 'time', type: 'string' })]
  const decoded = decode({ t: '10:30:00' }, schemas, 'update')
  assert.equal(decoded.t, '10:30:00')
  assert.equal(encode(decoded, schemas, 'update').t, '10:30:00')
})

test('纯日期字符串按本地时间解析，不受负时区影响', () => {
  const hadTZ = process.env.TZ
  process.env.TZ = 'America/New_York'
  try {
    const schemas = [schema({ column: 'd', format: 'date', type: 'string' })]
    assert.deepEqual(decode({ d: '2024-01-01' }, schemas, 'update'), { d: '2024-01-01' })
    assert.deepEqual(encode({ d: '2024-01-01' }, schemas, 'update'), { d: '2024-01-01' })
  } finally {
    if (hadTZ === undefined) delete process.env.TZ
    else process.env.TZ = hadTZ
  }
})

test('boolean 默认值 false / 字符串 false 不会被翻成 true', () => {
  const schemas = [
    schema({
      column: 'enabled',
      type: 'boolean',
      format: 'boolean',
      attributes: attrs({ default_value: 'false' }),
    }),
  ]
  assert.equal(decode({}, schemas, 'create').enabled, false)
  assert.equal(decode({ enabled: 'false' }, schemas, 'update').enabled, false)
  assert.equal(decode({ enabled: 'true' }, schemas, 'update').enabled, true)
})

test('timestamp + integer 提交 Unix 秒', () => {
  const schemas = [schema({ column: 'ts', type: 'integer', format: 'timestamp' })]
  const decoded = decode({ ts: 1704067200 }, schemas, 'update')
  assert.equal(typeof decoded.ts, 'string')
  const encoded = encode(decoded, schemas, 'update')
  assert.equal(encoded.ts, 1704067200)
  assert.equal(typeof encoded.ts, 'number')
})

test('multiSelect 更新场景空数组提交 []，create 保持稀疏', () => {
  const schemas = [schema({ column: 'tags', type: 'string', format: 'multiSelect' })]
  assert.deepEqual(encode({ tags: [] }, schemas, 'update'), { tags: '[]' })
  assert.deepEqual(encode({ tags: [] }, schemas, 'create'), {})
})

test('decode search 日期字段回显 start/end 与单日期', () => {
  const schemas = [schema({ column: 'd', format: 'date', type: 'string' })]
  assert.deepEqual(decode({ d: '2024-01-01/2024-01-31' }, schemas, 'search'), {
    d: ['2024-01-01', '2024-01-31'],
  })
  assert.deepEqual(decode({ d: '2024-01-01' }, schemas, 'search'), {
    d: ['2024-01-01', '2024-01-01'],
  })
})

test('decode 解包 __format=both 的 { label, value } 单元格', () => {
  const schemas = [
    schema({ column: 'name' }),
    schema({ column: 'age', type: 'integer' }),
    schema({ column: 'tags', type: 'integer', format: 'multiSelect' }),
  ]
  const decoded = decode(
    {
      name: { label: 'Alice', value: 'alice' },
      age: { label: '25', value: 25 },
      tags: { label: '1,2', value: [1, 2] },
    },
    schemas,
    'update',
  )
  assert.deepEqual(decoded, { name: 'alice', age: 25, tags: [1, 2] })
})

test('create 默认值按 schema.type 解析，update 不使用默认值', () => {
  const schemas = [
    schema({ column: 'n', type: 'integer', attributes: attrs({ default_value: '5' }) }),
    schema({ column: 'flag', type: 'boolean', format: 'boolean', attributes: attrs({ default_value: 'false' }) }),
    schema({ column: 'd', format: 'date', type: 'string', attributes: attrs({ default_value: '2024-01-01' }) }),
  ]
  const created = decode({}, schemas, 'create')
  assert.equal(created.n, 5)
  assert.equal(created.flag, false)
  assert.equal(created.d, '2024-01-01')
  assert.deepEqual(decode({}, schemas, 'update'), { n: '', flag: '', d: '' })
})
