import { test } from 'node:test'
import assert from 'node:assert/strict'
import { computed, isReactive, nextTick } from 'vue'
import { CRUD } from './crud.ts'

const noopHttp = {
  get: async () => ({}),
  post: async () => ({}),
  put: async () => ({}),
  delete: async () => ({}),
}

test('pagination 是 reactive，组件 computed 能跟踪 totalCount 变化', async () => {
  const crud = new CRUD({ module: 'user', table: 'admin', httpClient: noopHttp })
  const total = computed(() => crud.pagination.totalCount)
  assert.equal(isReactive(crud.pagination), true)
  assert.equal(total.value, 0)
  crud.pagination.totalCount = 30
  await nextTick()
  assert.equal(total.value, 30)
})

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

const localSchema = (column: string, extra: Record<string, any> = {}): any => ({
  column,
  primary_key: column === 'id' ? 1 : 0,
  scenarios: ['list', 'detail', 'create', 'update'],
  rules: {},
  attributes: {
    invisible: false,
    readonly: [],
    disable: [],
    visible: [],
    values: [],
    live: { enable: false, type: '' },
  },
  ...extra,
})

test('CRUDOptions.schemas 预加载：不请求 /schema，主键可用', async () => {
  const calls: string[] = []
  const crud = new CRUD({
    module: 'm',
    table: 't',
    httpClient: {
      ...noopHttp,
      get: async (url: string) => {
        calls.push(url)
        return []
      },
    },
    schemas: [localSchema('id'), localSchema('name')],
  })
  const schemas = await crud.initialize()
  assert.equal(schemas.length, 2)
  assert.equal(crud.primaryKey, 'id')
  assert.deepEqual(calls, [])
})

test('__fetchVars 合并 live 选项不依赖 schema.id，且单点失败不影响初始化', async () => {
  const schemas = [
    localSchema('a', {
      attributes: {
        invisible: false,
        readonly: [],
        disable: [],
        visible: [],
        live: { enable: true, type: 'dropdown', url: '/live/a' },
      },
    }),
    localSchema('b', {
      attributes: {
        invisible: false,
        readonly: [],
        disable: [],
        visible: [],
        live: { enable: true, type: 'dropdown', url: '/live/b' },
      },
    }),
  ]
  const crud = new CRUD({
    module: 'm',
    table: 't',
    schemas,
    httpClient: {
      ...noopHttp,
      get: async (url: string) => {
        if (url === '/live/a') return [{ label: 'A', value: 'a' }]
        throw new Error('live b down')
      },
    },
  })
  const warn = console.error
  console.error = () => {}
  try {
    await crud.initialize()
  } finally {
    console.error = warn
  }
  assert.deepEqual(crud.schemas[0].attributes.values, [{ label: 'A', value: 'a' }])
  assert.deepEqual(crud.schemas[1].attributes.values, [])
})

test('createModel 兼容非 id 主键与 rest 的 {id} 响应', async () => {
  const gets: string[] = []
  const crud = new CRUD({
    module: 'm',
    table: 't',
    schemas: [localSchema('uuid')],
    httpClient: {
      ...noopHttp,
      post: async () => ({ id: 'abc' }),
      get: async (url: string) => {
        gets.push(url)
        return { uuid: 'abc', name: 'x' }
      },
    },
  })
  crud.primaryKey = 'uuid'
  const model = await crud.createModel({ name: 'x' })
  assert.equal(model.uuid, 'abc')
  assert.deepEqual(gets, ['m/t/detail/abc'])
})

test('deleteModels 兼容数字主键与字符串主键，并移除行', async () => {
  const crud = new CRUD({
    module: 'm',
    table: 't',
    httpClient: {
      ...noopHttp,
      delete: async () => ({ id: 7 }),
    },
  })
  crud.primaryKey = 'id'
  crud.models = [{ id: 7 }, { id: 8 }]
  const result = await crud.deleteModels([{ id: 7 }])
  assert.equal(result.success, 1)
  assert.deepEqual(crud.models, [{ id: 8 }])
})

test('searchModel 兼容 AxiosResponse 并忽略过期响应', async () => {
  let resolveFirst: ((v: any) => void) | null = null
  const crud = new CRUD({
    module: 'm',
    table: 't',
    httpClient: {
      ...noopHttp,
      get: (() => {
        let call = 0
        return async () => {
          call++
          if (call === 1) {
            return new Promise((resolve) => { resolveFirst = resolve })
          }
          return { page: 1, page_size: 15, total_count: 20, data: [{ id: 2 }] }
        }
      })(),
    },
  })
  const first = crud.searchModel()
  const second = crud.searchModel()
  await second
  resolveFirst!({ page: 0, page_size: 15, total_count: 1, data: [{ id: 1 }] })
  await first
  assert.deepEqual(crud.models, [{ id: 2 }])
  assert.equal(crud.pagination.index, 2)
})

test('exportModels 带上 fixedQuery 并兼容 AxiosResponse/Blob', async () => {
  const requests: any[] = []
  let downloaded: any = null
  const crud = new CRUD({
    module: 'm',
    table: 't',
    httpClient: {
      ...noopHttp,
      get: async (_url: string, config: any) => {
        requests.push(config)
        return { data: new Blob(['a,b']), headers: { 'content-disposition': 'attachment;filename=x.csv' } }
      },
    },
  })
  crud.setFixedQuery({ tenant_id: 't1' })
  ;(crud as any).__downloadFile = (res: any, name: string) => { downloaded = { res, name } }
  await crud.exportModels()
  assert.equal(requests[0].params.tenant_id, 't1')
  assert.equal(requests[0].responseType, 'blob')
  assert.equal(downloaded.name, 't.csv')
})

test('getModel 默认请求 raw，且允许调用方覆盖 __format', async () => {
  const requests: any[] = []
  const crud = new CRUD({
    module: 'm',
    table: 't',
    httpClient: {
      ...noopHttp,
      get: async (_url: string, config: any) => {
        requests.push(config)
        return { id: 1 }
      },
    },
  })
  crud.primaryKey = 'id'
  await crud.getModel('1')
  assert.equal(requests[0].params.__format, 'raw')
  await crud.getModel({ id: 1, __format: 'both', scenario: 'update' })
  assert.equal(requests[1].params.__format, 'both')
})
