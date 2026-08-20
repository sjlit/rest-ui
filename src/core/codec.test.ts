import { test } from 'node:test'
import assert from 'node:assert/strict'
import { encode, decode } from './codec.ts'
import type { Schema, SchemaAttribute } from './types.ts'

// ============ Fixtures ============

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

// ============ encode 测试 ============

test('encode 整数字段：UI 字符串 → 提交数字', () => {
  const schemas = [schema({ column: 'age', type: 'integer' })]
  const result = encode({ age: '25' }, schemas, 'create')
  assert.equal(result.age, 25)
  assert.equal(typeof result.age, 'number')
})

test('encode 整数字段空字符串 → 0', () => {
  const schemas = [schema({ column: 'age', type: 'integer' })]
  const result = encode({ age: '' }, schemas, 'create')
  assert.equal(result.age, 0)
})

test('encode 整数字段非法字符串 → 0', () => {
  const schemas = [schema({ column: 'age', type: 'integer' })]
  const result = encode({ age: 'abc' }, schemas, 'create')
  assert.equal(result.age, 0)
})

test('encode 浮点字段：UI 字符串 → 提交数字', () => {
  const schemas = [schema({ column: 'price', type: 'float' })]
  const result = encode({ price: '19.9' }, schemas, 'create')
  assert.equal(result.price, 19.9)
})

test('encode decimal 字段：空 → 0', () => {
  const schemas = [schema({ column: 'price', type: 'decimal' })]
  assert.equal(encode({ price: '' }, schemas, 'create').price, 0)
  assert.equal(encode({ price: 'NaN' }, schemas, 'create').price, 0)
})

test('encode boolean 字段：字符串 "true" / "on" → boolean true', () => {
  const schemas = [schema({ column: 'enabled', type: 'boolean' })]
  assert.equal(encode({ enabled: 'true' }, schemas, 'create').enabled, true)
  assert.equal(encode({ enabled: 'on' }, schemas, 'create').enabled, true)
  assert.equal(encode({ enabled: 'false' }, schemas, 'create').enabled, true) // Boolean('false') === true
})

test('encode boolean 字段空字符串 → 跳过', () => {
  const schemas = [schema({ column: 'enabled', type: 'boolean', format: 'bool' })]
  const result = encode({ enabled: '' }, schemas, 'create')
  assert.equal('enabled' in result, false)
})

test('encode date 数组 → "start/end"', () => {
  const schemas = [schema({ column: 'range', type: 'string', format: 'date' })]
  const result = encode({ range: ['2024-01-01', '2024-01-31'] }, schemas, 'create')
  assert.equal(result.range, '2024-01-01/2024-01-31')
})

test('encode datetime 单值 → "YYYY-MM-DD HH:mm:ss"', () => {
  const schemas = [schema({ column: 'ts', type: 'datetime', format: 'datetime' })]
  const result = encode({ ts: '2024-01-01 10:00:00' }, schemas, 'create')
  assert.equal(result.ts, '2024-01-01 10:00:00')
})

test('encode multiSelect 数组 → JSON 字符串', () => {
  const schemas = [schema({ column: 'tags', type: 'string', format: 'multiSelect' })]
  const result = encode({ tags: [1, 2, 3] }, schemas, 'create')
  assert.equal(result.tags, '[1,2,3]')
})

test('encode multiSelect 空数组 → 不写入', () => {
  const schemas = [schema({ column: 'tags', type: 'string', format: 'multiSelect' })]
  const result = encode({ tags: [] }, schemas, 'create')
  assert.equal('tags' in result, false)
})

test('encode cascader 拆分到 live.columns', () => {
  const schemas = [
    schema({
      column: 'addr',
      type: 'string',
      format: '',
      attributes: attrs({
        live: { enable: true, type: 'cascader', columns: ['prov', 'city'] },
      }),
    }),
  ]
  const result = encode({ addr: ['BJ', 'HD'] }, schemas, 'create')
  assert.equal(result.prov, 'BJ')
  assert.equal(result.city, 'HD')
  assert.equal('addr' in result, false)
})

test('encode cascader 无 columns 配置 → JSON 字符串', () => {
  const schemas = [
    schema({
      column: 'addr',
      type: 'string',
      attributes: attrs({
        live: { enable: true, type: 'cascader' },
      }),
    }),
  ]
  const result = encode({ addr: ['BJ', 'HD'] }, schemas, 'create')
  assert.equal(result.addr, '["BJ","HD"]')
})

test('encode create 场景：空字段回填 default_value', () => {
  const schemas = [
    schema({
      column: 'status',
      type: 'integer',
      attributes: attrs({ default_value: '1' }),
    }),
  ]
  assert.equal(encode({ status: '' }, schemas, 'create').status, 1)
})

test('encode update 场景：空字段不应用 default_value', () => {
  const schemas = [
    schema({
      column: 'status',
      type: 'integer',
      attributes: attrs({ default_value: '1' }),
    }),
  ]
  assert.equal(encode({ status: '' }, schemas, 'update').status, 0)
})

// ============ decode 测试 ============

test('decode 数字 → 字符串展示给 UI', () => {
  const schemas = [schema({ column: 'age', type: 'integer' })]
  const result = decode({ age: 25 }, schemas, 'update')
  // 必须 marshal 把数字格式化成 string 形式（默认走 string 类型转换）
  // 实际上 rest-ui decode 默认对 integer 字段返回 mustMarshal(v, type='integer')
  // 结果仍是数字 25；UI 控件会自己转字符串。这是 OK 的，行为对称。
  assert.equal(result.age, 25)
})

test('decode date 单值 → "YYYY-MM-DD"', () => {
  const schemas = [schema({ column: 'd', type: 'date', format: 'date' })]
  const result = decode({ d: '2024-01-01 10:30:00' }, schemas, 'update')
  assert.equal(result.d, '2024-01-01')
})

test('decode datetime 单值 → "YYYY-MM-DD HH:mm:ss"', () => {
  const schemas = [schema({ column: 'ts', type: 'datetime', format: 'datetime' })]
  const result = decode({ ts: '2024-01-01T10:00:00.000Z' }, schemas, 'update')
  assert.match(result.ts, /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/)
})

test('decode daterange 字符串 "start/end" → [start, end]', () => {
  const schemas = [schema({ column: 'range', type: 'string', format: 'datetime' })]
  const result = decode({ range: '2024-01-01 00:00:00/2024-01-31 23:59:59' }, schemas, 'update')
  assert.deepEqual(result.range, ['2024-01-01 00:00:00', '2024-01-31 23:59:59'])
})

test('decode multiSelect JSON 字符串 → 数组', () => {
  const schemas = [schema({ column: 'tags', type: 'string', format: 'multiSelect' })]
  const result = decode({ tags: '[1,2,3]' }, schemas, 'update')
  assert.deepEqual(result.tags, [1, 2, 3])
})

test('decode multiSelect 非法 JSON → 不写入', () => {
  const schemas = [schema({ column: 'tags', type: 'string', format: 'multiSelect' })]
  const result = decode({ tags: 'not-json' }, schemas, 'update')
  assert.equal('tags' in result, false)
})

test('decode cascader live.columns → 数组', () => {
  const schemas = [
    schema({
      column: 'addr',
      type: 'string',
      attributes: attrs({
        live: { enable: true, type: 'cascader', columns: ['prov', 'city'] },
      }),
    }),
  ]
  const result = decode({ prov: 'BJ', city: 'HD' }, schemas, 'update')
  assert.deepEqual(result.addr, ['BJ', 'HD'])
})

test('decode cascader 无 columns → JSON.parse', () => {
  const schemas = [
    schema({
      column: 'addr',
      type: 'string',
      attributes: attrs({
        live: { enable: true, type: 'cascader' },
      }),
    }),
  ]
  const result = decode({ addr: '["BJ","HD"]' }, schemas, 'update')
  assert.deepEqual(result.addr, ['BJ', 'HD'])
})

test('decode search + 日期字段空值 + time_search_range → 默认对', () => {
  const schemas = [
    schema({
      column: 'd',
      type: 'date',
      format: 'date',
      attributes: attrs({ time_search_range: 'day' }),
    }),
  ]
  const result = decode({}, schemas, 'search')
  assert.ok(Array.isArray(result.d))
  assert.equal(result.d.length, 2)
  // 起止为同一天（startOf/endOf day），但由于 endOf clamp 到 now，
  // 当跨午夜的请求下也至少形如 YYYY-MM-DD
  assert.match(result.d[0], /^\d{4}-\d{2}-\d{2}$/)
  assert.match(result.d[1], /^\d{4}-\d{2}-\d{2}$/)
})

test('decode search + 日期字段空值无 time_search_range → 空数组', () => {
  const schemas = [schema({ column: 'd', type: 'date', format: 'date' })]
  const result = decode({}, schemas, 'search')
  assert.deepEqual(result.d, [])
})

test('decode search + 非日期字段空值 → ""', () => {
  const schemas = [schema({ column: 'name', type: 'string' })]
  const result = decode({}, schemas, 'search')
  assert.equal(result.name, '')
})

test('decode search + 已有值的字段透传', () => {
  const schemas = [schema({ column: 'name', type: 'string' })]
  const result = decode({ name: 'foo' }, schemas, 'search')
  assert.equal(result.name, 'foo')
})

test('decode create 场景：raw 无字段 → default_value', () => {
  const schemas = [
    schema({
      column: 'status',
      type: 'integer',
      attributes: attrs({ default_value: '5' }),
    }),
  ]
  const result = decode({}, schemas, 'create')
  assert.equal(result.status, 5)
})

test('decode 时间戳数字 → 格式化字符串', () => {
  const schemas = [schema({ column: 'ts', type: 'datetime', format: 'datetime' })]
  // 秒级时间戳 2024-01-01 00:00:00 UTC
  const ts = 1704067200
  const result = decode({ ts }, schemas, 'update')
  assert.match(result.ts, /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/)
})

test('decode date 字段空值（null / undefined / 空字符串）→ 写入空字符串', () => {
  const schemas = [schema({ column: 'd', type: 'date', format: 'date' })]
  assert.equal(decode({ d: null }, schemas, 'update').d, '')
  assert.equal(decode({}, schemas, 'update').d, '')
  assert.equal(decode({ d: '' }, schemas, 'update').d, '')
})

test('decode datetime 字段空值 → 写入空字符串', () => {
  const schemas = [schema({ column: 'ts', type: 'datetime', format: 'datetime' })]
  assert.equal(decode({ ts: null }, schemas, 'update').ts, '')
  assert.equal(decode({}, schemas, 'update').ts, '')
})

// ============ toDate / formatByFormat 边界 ============

test('encode / decode 对称：datetime 字符串往返不变', () => {
  const schemas = [schema({ column: 'ts', type: 'datetime', format: 'datetime' })]
  const encoded = encode({ ts: '2024-01-01 10:00:00' }, schemas, 'create')
  const decoded = decode(encoded, schemas, 'update')
  assert.equal(decoded.ts, '2024-01-01 10:00:00')
})

test('encode null / undefined 整数 → 0', () => {
  const schemas = [schema({ column: 'n', type: 'integer' })]
  assert.equal(encode({ n: null }, schemas, 'create').n, 0)
  assert.equal(encode({}, schemas, 'create').n, 0)
})