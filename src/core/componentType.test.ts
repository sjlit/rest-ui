import { test } from 'node:test'
import assert from 'node:assert/strict'
import { resolveComponentType } from './componentType.ts'
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
    rules: { min: 0, max: 0, type: '', unique: false, required: [] },
    attributes: attrs(),
    relations: { type: '', name: '', module: '', table: '' },
    position: 0,
    ...overrides,
  } as Schema
}

// ============ 回归保护:dropdown / cascader 优先于 number ============

test('format=dropdown + type=integer 走下拉(number 类型不应覆盖 UI format)', () => {
  const s = schema({ column: 'dept_id', type: 'integer', format: 'dropdown' })
  assert.equal(resolveComponentType(s, 'create'), 'dropdown')
  assert.equal(resolveComponentType(s, 'update'), 'dropdown')
  assert.equal(resolveComponentType(s, 'search'), 'dropdown')
})

test('format=dropdown + type=string 仍然走下拉', () => {
  const s = schema({ column: 'role_key', type: 'string', format: 'dropdown' })
  assert.equal(resolveComponentType(s), 'dropdown')
})

test('format=multiSelect + type=integer 走下拉(multi-select)', () => {
  const s = schema({ column: 'tags', type: 'integer', format: 'multiSelect' })
  assert.equal(resolveComponentType(s), 'dropdown')
})

test('format=cascader + type=integer 走 cascader', () => {
  const s = schema({ column: 'region', type: 'integer', format: 'cascader' })
  assert.equal(resolveComponentType(s), 'cascader')
})

// ============ 未触动分支:数字输入框仍走 number ============

test('format=integer + type=integer 走 number', () => {
  const s = schema({ column: 'age', type: 'integer', format: 'integer' })
  assert.equal(resolveComponentType(s), 'number')
})

test('format=decimal + type=float 走 number', () => {
  const s = schema({ column: 'price', type: 'float', format: 'decimal' })
  assert.equal(resolveComponentType(s), 'number')
})

test('format=空 + type=integer 走 number(默认按 type 推断)', () => {
  const s = schema({ column: 'qty', type: 'integer', format: '' })
  assert.equal(resolveComponentType(s), 'number')
})

// ============ 未触动分支:text / password / file 不被提前 ============

test('format=text + type=integer 仍走 number(原逻辑:type=integer 压过 format=text,本修复未扩散)', () => {
  // 关键回归点:本修复只把 dropdown/cascader 提前,没有把 number 整个下沉。
  // 原代码里 type=integer 会先把 format=text 也截胡到 number,这里如实锁住旧行为。
  const s = schema({ column: 'count', type: 'integer', format: 'text' })
  assert.equal(resolveComponentType(s, 'create'), 'number')
  assert.equal(resolveComponentType(s, 'search'), 'number')
})

test('format=text + type=string 在非 search 下走 multistr', () => {
  const s = schema({ column: 'desc', type: 'string', format: 'text' })
  assert.equal(resolveComponentType(s, 'create'), 'multistr')
})

test('format=password + type=integer 仍走 number(password 未被提前)', () => {
  const s = schema({ column: 'pin', type: 'integer', format: 'password' })
  assert.equal(resolveComponentType(s), 'number')
})

test('format=date + type=integer 仍走 number(date 未被提前)', () => {
  const s = schema({ column: 'd', type: 'integer', format: 'date' })
  assert.equal(resolveComponentType(s), 'number')
})

test('format=file + 无 upload_url + type=integer 仍走 number', () => {
  const s = schema({ column: 'f', type: 'integer', format: 'file' })
  assert.equal(resolveComponentType(s), 'number')
})

test('format=file + 有 upload_url + type=integer 仍走 number(原逻辑:type=integer 压过 format=file)', () => {
  // 原代码里 type=integer 会先压过 format=file 走到 number,
  // 即使有 upload_url。本修复未触及 file 分支的相对顺序。
  const s = schema({
    column: 'f',
    type: 'integer',
    format: 'file',
    attributes: attrs({ upload_url: '/upload' }),
  })
  assert.equal(resolveComponentType(s), 'number')
})

// ============ 未触动分支:boolean / time ============

test('format=boolean + type=integer 仍走 number(原逻辑:type=integer 压过 format=boolean)', () => {
  // 原代码里 type=integer 会先压过 format=boolean。本修复未改变这条顺序。
  const s = schema({ column: 'enabled', type: 'integer', format: 'boolean' })
  assert.equal(resolveComponentType(s, 'create'), 'number')
  assert.equal(resolveComponentType(s, 'search'), 'number')
})

test('format=time + type=string 走 time', () => {
  const s = schema({ column: 't', type: 'string', format: 'time' })
  assert.equal(resolveComponentType(s), 'time')
})

// ============ 默认值:scenario 缺省 ============

test('scenario 缺省时按 create 处理', () => {
  const s = schema({ column: 'desc', type: 'string', format: 'text' })
  assert.equal(resolveComponentType(s), 'multistr')
})
