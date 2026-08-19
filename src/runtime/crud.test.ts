import { test } from 'node:test'
import assert from 'node:assert/strict'
import { CRUD } from './crud.ts'

const noopHttp = {
  get: async () => ({}),
  post: async () => ({}),
  put: async () => ({}),
  delete: async () => ({}),
}

test('findModelPrimaryKey 解包 __format=both 格式的 { label, value } 单元格', () => {
  const crud = new CRUD({ module: 'user', table: 'admin', httpClient: noopHttp })
  crud.primaryKey = 'id'
  assert.equal(crud.findModelPrimaryKey({ id: { label: '1', value: 1 } }), 1)
})

test('findModelPrimaryKey 对原始值原样返回', () => {
  const crud = new CRUD({ module: 'user', table: 'admin', httpClient: noopHttp })
  crud.primaryKey = 'id'
  assert.equal(crud.findModelPrimaryKey({ id: 5 }), 5)
  assert.equal(crud.findModelPrimaryKey({ id: 'abc' }), 'abc')
  assert.equal(crud.findModelPrimaryKey('raw'), 'raw')
})

test('deleteModel 用解包后的主键构建删除 URI', async () => {
  const calls: string[] = []
  const crud = new CRUD({
    module: 'user',
    table: 'admin',
    httpClient: {
      ...noopHttp,
      delete: async (url: string) => {
        calls.push(url)
        return { id: 1 }
      },
    },
  })
  crud.primaryKey = 'id'
  await crud.deleteModel({ id: { label: '1', value: 1 } })
  assert.deepEqual(calls, ['user/admin/1'])
})

test('__refreshModel 用解包后的主键原位替换行而不是追加重复行', async () => {
  let detailCalls = 0
  const crud = new CRUD({
    module: 'user',
    table: 'admin',
    httpClient: {
      ...noopHttp,
      get: async (url: string) => {
        if (url.includes('/detail/')) {
          detailCalls++
          return { id: { label: '1', value: 1 }, name: { label: 'b', value: 'b' } }
        }
        return {}
      },
    },
  })
  crud.primaryKey = 'id'
  crud.models = [{ id: { label: '1', value: 1 }, name: { label: 'a', value: 'a' } }]
  await crud.updateModel({ id: { label: '1', value: 1 }, name: { label: 'a', value: 'a' } })
  assert.equal(crud.models.length, 1)
  assert.equal(detailCalls, 1)
})

test('initialize 在空 apiPrefix 下不产生 // 前缀', async () => {
  const calls: string[] = []
  const crud = new CRUD({
    module: 'user',
    table: 'admin',
    apiPrefix: '',
    httpClient: {
      ...noopHttp,
      get: async (url: string) => {
        calls.push(url)
        return []
      },
    },
  })
  await crud.initialize()
  assert.deepEqual(calls, ['/schema/user/admin'])
})

test('initialize 在非空 apiPrefix 下保留前缀', async () => {
  const calls: string[] = []
  const crud = new CRUD({
    module: 'user',
    table: 'admin',
    apiPrefix: 'rest',
    httpClient: {
      ...noopHttp,
      get: async (url: string) => {
        calls.push(url)
        return []
      },
    },
  })
  await crud.initialize()
  assert.deepEqual(calls, ['/rest/schema/user/admin'])
})

test('initialize 在无 module 时 URI 仍正确', async () => {
  const calls: string[] = []
  const crud = new CRUD({
    module: '',
    table: 'profile',
    apiPrefix: '',
    httpClient: {
      ...noopHttp,
      get: async (url: string) => {
        calls.push(url)
        return []
      },
    },
  })
  await crud.initialize()
  assert.deepEqual(calls, ['/schema/profile'])
})
