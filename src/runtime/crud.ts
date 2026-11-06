import { reactive } from 'vue'
import pluralize from 'pluralize'
import type { Schema, Model, CRUDOptions, Pagination, Sortable, Scenario } from '../core/types'
import { unwrapCellValue } from '../core/model.ts'

type UriScenario = Scenario | 'get'

const DEFAULT_PAGINATION: Pagination = {
  index: 1,
  size: 15,
  totalCount: 0,
}

const DEFAULT_RULES = {
  min: 0,
  max: 0,
  type: '',
  unique: false,
  required: [] as Scenario[],
}

function normalizeSchema(schema: Schema): Schema {
  const attributes = (schema.attributes || {}) as any
  return {
    ...schema,
    rules: schema.rules ? { ...schema.rules } : { ...DEFAULT_RULES },
    attributes: schema.attributes
      ? {
          ...schema.attributes,
          readonly: Array.isArray(attributes.readonly) ? [...attributes.readonly] : [],
          disable: Array.isArray(attributes.disable) ? [...attributes.disable] : [],
          visible: Array.isArray(attributes.visible) ? [...attributes.visible] : [],
          values: Array.isArray(attributes.values)
            ? attributes.values.map((value: any) => ({ ...value }))
            : [],
          live: attributes.live
            ? {
                ...attributes.live,
                columns: Array.isArray(attributes.live.columns)
                  ? [...attributes.live.columns]
                  : attributes.live.columns,
              }
            : attributes.live,
          dropdown: attributes.dropdown ? { ...attributes.dropdown } : attributes.dropdown,
        }
      : schema.attributes,
  }
}

/**
 * AxiosResponse 形态检测。
 *
 * rest-ui 的 httpClient 既可能是原始 axios（返回 AxiosResponse），也可能像
 * admin 一样在拦截器里提前解包成业务 data。CRUD 内部统一归一化，避免
 * search/get/create 与 export 对响应形态做出相反的假设。
 */
function isResponseWrapper(value: any): boolean {
  return (
    value !== null &&
    typeof value === 'object' &&
    'data' in value &&
    'headers' in value
  )
}

function unwrapResponse(value: any): any {
  return isResponseWrapper(value) ? value.data : value
}

export class CRUD {
  private opts: Required<CRUDOptions>
  primaryKey = ''
  schemas: Schema[] = []
  models: Model[] = []
  sortable: Sortable | null = null
  queryParams: Record<string, any> = {}
  fixedQuery: Record<string, any> = {}
  // pagination 会被 SchemaViewer 的 computed 直接读取；必须是 reactive，
  // 否则通过 CRUD 原始实例（init 阶段）调用 searchModel 时，totalCount
  // 的赋值不会触发依赖，工具栏/分页会一直显示初始的 0。
  pagination: Pagination = reactive({ ...DEFAULT_PAGINATION })
  private searchSeq = 0

  constructor(options: CRUDOptions) {
    let schemas: Schema[] = []
    if (Array.isArray(options.schemas)) {
      schemas = options.schemas
    } else if (options.schemas && typeof options.schemas === 'object') {
      schemas = Object.values(options.schemas)
    }

    const normalized = schemas.map(normalizeSchema)
    // 关键：initialize() 判断的是 this.schemas，预加载的 schema 必须落到这里，
    // 否则传入 schemas 仍然会请求 /schema/:module/:table。
    this.schemas = normalized
    this.opts = {
      module: options.module || '',
      table: options.table || '',
      apiPrefix: options.apiPrefix || '',
      httpClient: options.httpClient,
      schemas: normalized,
    }
  }

  private __prepare() {
    for (const schema of this.schemas) {
      if (schema.primary_key === 1) {
        this.primaryKey = schema.column
        break
      }
    }
  }

  private __buildUri(scenario: UriScenario, primaryKey?: string): string {
    return this.__buildModelUri(this.opts.module, this.opts.table, scenario, primaryKey)
  }

  private __buildModelUri(moduleName: string, tableName: string, scenario: UriScenario, primaryKey?: string): string {
    const pk = primaryKey === undefined || primaryKey === null ? '' : String(primaryKey)
    const encodedPk = encodeURIComponent(pk)
    const pluralName = pluralize.plural(tableName)
    const singularName = pluralize.singular(tableName)
    const parts: string[] = []

    if (this.opts.apiPrefix) {
      parts.push(this.opts.apiPrefix)
    }
    if (moduleName) {
      parts.push(moduleName)
    }

    switch (scenario) {
      case 'create':
        parts.push(singularName)
        break
      case 'get':
        parts.push(singularName, 'detail', encodedPk)
        break
      case 'update':
      case 'delete':
        parts.push(singularName, encodedPk)
        break
      case 'search':
        parts.push(pluralName)
        break
      case 'export':
        parts.push(singularName, 'export')
        break
    }

    return parts.join('/')
  }

  async initialize(): Promise<Schema[]> {
    if (this.schemas.length > 0) {
      this.__prepare()
      await this.__fetchVars()
      return this.schemas
    }

    const parts: string[] = []
    if (this.opts.apiPrefix) {
      parts.push(this.opts.apiPrefix)
    }
    parts.push('schema')
    if (this.opts.module) {
      parts.push(this.opts.module)
    }
    parts.push(this.opts.table)
    const uri = '/' + parts.join('/')

    const payload = unwrapResponse(await this.opts.httpClient.get(uri))
    const rawSchemas: Schema[] = Array.isArray(payload) ? payload : payload?.data || []
    this.schemas = rawSchemas.map(normalizeSchema)
    this.__prepare()
    await this.__fetchVars()
    return this.schemas
  }

  private async __fetchVars(): Promise<void> {
    const targets = this.schemas.filter(
      (schema) => schema.attributes?.live?.enable && schema.attributes.live.url,
    )
    if (targets.length === 0) return

    // 一个下拉数据源失败不应该让整页初始化失败，也不应该让保存流程报假失败。
    const results = await Promise.allSettled(targets.map((schema) => this.__lazyFetch(schema)))
    results.forEach((result, index) => {
      const schema = targets[index]
      if (result.status === 'rejected') {
        console.error(
          `[rest-ui] live data source failed for "${schema.column}":`,
          result.reason,
        )
        // 保留上一次成功加载的选项，避免瞬时故障把已有下拉清空。
        return
      }
      const payload = unwrapResponse(result.value.data)
      const values = Array.isArray(payload)
        ? payload
        : Array.isArray(payload?.data)
          ? payload.data
          : []
      if (schema.attributes) {
        schema.attributes.values = values
      }
    })
  }

  private async __lazyFetch(schema: Schema): Promise<{ schema: Schema; data: any }> {
    const live = schema.attributes.live
    if (live.method?.toLowerCase() === 'post') {
      const data = await this.opts.httpClient.post(live.url!, live.body, {
        headers: { 'Content-Type': live.content_type || 'application/json' },
      })
      return { schema, data }
    }
    const data = await this.opts.httpClient.get(live.url!)
    return { schema, data }
  }

  getSchemas(): Schema[] {
    return this.schemas
  }

  getModels(): Model[] {
    return this.models
  }

  fieldErrors: Record<string, string> = {}

  setColumnError(column: string, error: string) {
    this.fieldErrors[column] = error
  }

  resetError() {
    this.fieldErrors = {}
  }

  getFieldErrors(): Record<string, string> {
    return this.fieldErrors
  }

  setPaginationIndex(index: number): this {
    if (typeof index === 'number' && index >= 1) {
      this.pagination.index = index
    }
    return this
  }

  getPaginationIndex(): number {
    return this.pagination.index
  }

  setPaginationSize(size: number): this {
    this.pagination.size = size
    return this
  }

  getPaginationSize(): number {
    return this.pagination.size || 15
  }

  getPaginationCount(): number {
    return this.pagination.totalCount
  }

  resetPagination(): this {
    this.pagination.index = 1
    return this
  }

  setSortable(column: string, order: 'ascending' | 'descending'): this {
    if (!column) {
      this.sortable = null
    } else {
      this.sortable = { column, order: order || 'ascending' }
    }
    return this
  }

  addQueryParams(k: string, v: any): this {
    this.queryParams[k] = v
    return this
  }

  setQueryParams(qs: Record<string, any>): this {
    this.queryParams = qs
    return this
  }

  setFixedQuery(qs: Record<string, any>): this {
    this.fixedQuery = qs
    return this
  }

  findModelPrimaryKey(model: Model | string): any {
    if (model && typeof model === 'object') {
      return unwrapCellValue(model[this.primaryKey])
    }
    return model
  }

  async createModel(model: Model): Promise<Model> {
    const payload = unwrapResponse(
      await this.opts.httpClient.post(this.__buildUri('create'), model),
    )
    // rest 的 CreateResult 固定用 {"id": ...}，即使主键列名不是 id。
    // 先按 primaryKey 取，再回退到 id / 原始返回值。
    const pk =
      this.findModelPrimaryKey(payload) ??
      (payload && typeof payload === 'object' ? payload.id : payload)
    if (pk === undefined || pk === null || pk === '') {
      throw new Error('Cannot find model primary key')
    }
    return this.__refreshModel(pk, model)
  }

  async updateModel(model: Model): Promise<Model> {
    const pk = this.findModelPrimaryKey(model)
    if (pk === undefined || pk === null || pk === '') {
      throw new Error('Cannot find model primary key')
    }
    await this.opts.httpClient.put(this.__buildUri('update', String(pk)), model)
    return this.__refreshModel(pk, model)
  }

  async deleteModel(model: Model | string): Promise<any> {
    const pk = typeof model === 'object' ? this.findModelPrimaryKey(model) : model
    if (pk === undefined || pk === null || pk === '') {
      throw new Error('Cannot find model primary key')
    }
    const payload = unwrapResponse(
      await this.opts.httpClient.delete(this.__buildUri('delete', String(pk))),
    )
    this.__removeModel(pk)
    if (this.pagination.totalCount > 0) {
      this.pagination.totalCount -= 1
    }
    return payload
  }

  async getModel(qs: Record<string, any> | string): Promise<Model> {
    let pk: any = ''
    const params: Record<string, any> = {}
    if (typeof qs === 'object') {
      for (const k in qs) {
        if (k === this.primaryKey) {
          pk = unwrapCellValue(qs[k])
        } else {
          params[k] = qs[k]
        }
      }
    } else {
      pk = qs
    }
    if (pk === undefined || pk === null || pk === '') {
      throw new Error('Cannot find model primary key')
    }
    // 详情默认请求原始值：表单编辑依赖 raw value（dropdown 的 label 不是
    // 可提交值），展示层由 Cell 按 schema.attributes.values 自行映射。
    if (!Object.prototype.hasOwnProperty.call(params, '__format')) {
      params.__format = 'raw'
    }
    return unwrapResponse(
      await this.opts.httpClient.get(this.__buildUri('get', String(pk)), { params }),
    )
  }

  private __buildQueryParams(includePagination: boolean): Record<string, any> {
    const queryParams: Record<string, any> = { ...this.queryParams }
    if (includePagination) {
      queryParams.page = this.pagination.index
      queryParams.page_size = this.pagination.size || 15
    }
    if (this.sortable?.column) {
      queryParams.sort = this.sortable.order === 'descending'
        ? `-${this.sortable.column}`
        : this.sortable.column
    }
    queryParams.__format = 'both'
    // fixedQuery 每次请求都必须附加，导出也不能例外，否则 presetQuery
    // 里的租户/部门范围会在导出时丢失。
    for (const k in this.fixedQuery) {
      queryParams[k] = this.fixedQuery[k]
    }

    // Convert date range arrays to comma-separated strings for backend compatibility
    for (const key in queryParams) {
      const value = queryParams[key]
      if (
        Array.isArray(value) &&
        value.length === 2 &&
        value[0] !== '' && value[0] !== null && value[0] !== undefined &&
        value[1] !== '' && value[1] !== null && value[1] !== undefined
      ) {
        const scm = this.schemas.find(s => s.column === key)
        if (scm && ['datetime', 'date', 'timestamp', 'time'].includes(scm.format)) {
          queryParams[key] = `${value[0]},${value[1]}`
        }
      }
    }
    return queryParams
  }

  async searchModel(): Promise<Model[]> {
    const seq = ++this.searchSeq
    const queryParams = this.__buildQueryParams(true)
    const payload = unwrapResponse(
      await this.opts.httpClient.get(this.__buildUri('search'), { params: queryParams }),
    )
    // 防止先发出的慢请求覆盖后发出的快请求（分页/排序切换时很常见）。
    if (seq !== this.searchSeq) return this.models
    this.pagination.index = (parseInt(payload?.page) || 0) + 1
    this.pagination.size = parseInt(payload?.page_size) || 15
    this.pagination.totalCount = parseInt(payload?.total_count) || 0
    this.models = Array.isArray(payload?.data) ? payload.data : []
    return this.models
  }

  async deleteModels(data: any[]): Promise<{
    total: number
    success: number
    failed: number
    responses: any[]
  }> {
    const pks: any[] = []
    for (const val of data) {
      const pk = typeof val === 'object' ? this.findModelPrimaryKey(val) : val
      if (pk !== undefined && pk !== null && pk !== '') {
        pks.push(pk)
      }
    }
    if (pks.length === 0) {
      return { total: 0, success: 0, failed: 0, responses: [] }
    }
    const results = await Promise.allSettled(pks.map(pk => this.deleteModel(pk)))
    const responses: any[] = []
    for (const result of results) {
      if (result.status === 'fulfilled') responses.push(result.value)
      else console.error('[rest-ui] batch delete failed:', result.reason)
    }
    const success = responses.length
    return {
      total: pks.length,
      success,
      failed: pks.length - success,
      responses,
    }
  }

  async exportModels(): Promise<void> {
    const queryParams = this.__buildQueryParams(false)
    const res = await this.opts.httpClient.get(this.__buildUri('export'), {
      params: queryParams,
      responseType: 'blob',
    })
    this.__downloadFile(res, `${this.opts.table}.csv`)
  }

  private async __refreshModel(primaryKey: any, fallbackModel?: Model): Promise<Model> {
    const qs: Record<string, any> = {
      [this.primaryKey]: primaryKey,
      __format: 'both',
      scenario: 'list',
    }
    let res: Model
    try {
      res = await this.getModel(qs)
    } catch (err) {
      // 写入已经成功；刷新详情失败（权限/网络/列表场景不含主键等）不能
      // 反过来让保存流程报失败。用提交的模型 + 主键兜底。
      console.error('[rest-ui] refresh model after save failed:', err)
      if (!fallbackModel) throw err
      res = { ...fallbackModel, [this.primaryKey]: primaryKey }
    }
    const pk = this.findModelPrimaryKey(res) ?? primaryKey
    const index = this.models.findIndex(
      m => String(this.findModelPrimaryKey(m)) === String(pk),
    )
    if (index >= 0) {
      this.models[index] = res
    } else {
      this.models.push(res)
    }
    try {
      await this.__fetchVars()
    } catch (err) {
      // 写入已经成功，live 下拉刷新失败只记录日志，不能把保存结果翻成失败。
      console.error('[rest-ui] refresh live values after save failed:', err)
    }
    return res
  }

  private __removeModel(primaryKey: any) {
    const target = String(primaryKey)
    this.models = this.models.filter((model) => {
      const value = this.findModelPrimaryKey(model)
      if (value === undefined || value === null) return true
      return String(value) !== target
    })
  }

  private __downloadFile(res: any, defaultFilename: string) {
    let payload: any = res
    let headers: Record<string, any> = {}
    if (isResponseWrapper(res)) {
      payload = res.data
      headers = res.headers || {}
    }

    let blob: Blob
    if (typeof Blob !== 'undefined' && payload instanceof Blob) {
      blob = payload
    } else if (typeof ArrayBuffer !== 'undefined' && payload instanceof ArrayBuffer) {
      blob = new Blob([payload], { type: headers['content-type'] || '' })
    } else {
      blob = new Blob([payload ?? ''], { type: headers['content-type'] || '' })
    }

    const disposition = headers['content-disposition']
    let filename = defaultFilename
    if (disposition) {
      // RFC 5987: filename*=UTF-8''xxx 优先；否则回退 filename=
      const star = /filename\*=(?:UTF-8'')?([^;]+)/i.exec(disposition)
      const plain = /filename=([^;]+)/i.exec(disposition)
      const rawName = star?.[1] || plain?.[1]
      if (rawName) {
        filename = rawName.trim().replace(/^"|"$/g, '')
        try {
          filename = decodeURIComponent(filename)
        } catch (e) { /* ignore */ }
      }
    }

    const element = document.createElement('a')
    element.style.display = 'none'
    element.href = window.URL.createObjectURL(blob)
    element.target = '_blank'
    element.setAttribute('download', filename)
    document.body.appendChild(element)
    element.click()
    setTimeout(() => {
      window.URL.revokeObjectURL(element.href)
      document.body.removeChild(element)
    }, 100)
  }
}
