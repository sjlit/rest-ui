<template>
  <template v-if="isReady">
    <SchemaPage ref="schemaPageRef" :schemas="schemas" :models="crud?.getModels() || []" :pagination="pagination"
      :loading="searching" :size="size" :title="title" :subtitle="subtitle" :formMode="formMode"
      :showHeader="showHeader" :showSearch="showSearch" :showToolbar="showToolbar"
      :showPagination="showPagination" :showPageSize="showPageSize" :showJumper="showJumper"
      :showDensity="showDensity" :showColumnSettings="showColumnSettings" :readonly="readonly"
      :searchCollapsible="searchCollapsible" :defaultSearchCollapsed="defaultSearchCollapsed"
      :collapseSearchOnSearch="collapseSearchOnSearch" :storageKey="storageKey || `${module}/${table}`"
      :tableHeight="tableHeight" :autoTableHeight="autoTableHeight" :tableHeightOffset="tableHeightOffset"
      :actionsWidth="actionsWidth" :searchActions="searchActionList"
      :headerActions="headerActionList" :rowActions="rowActionList" :batchActions="batchActionList"
      :formActions="formActionList" :gridProps="gridProps" :formProps="formProps" :presetQuery="presetQuery"
      :formErrors="crud?.getFieldErrors() || {}"
      @search="handleSearch" @create="handleCreate" @delete="handleDelete" @pageChange="handlePageChange"
      @sortChange="handleSortChange" @sizeChange="handleSizeChange" @formSubmit="handleFormSubmit">
      <template #searchform="{ model, schema }">
        <slot name="searchform" :model="model" :schema="schema" />
      </template>
      <template #gridview="{ model, schema }">
        <slot name="gridview" :model="model" :schema="schema" />
      </template>
      <template #crudform="{ model, schema }">
        <slot name="crudform" :model="model" :schema="schema" />
      </template>
      <template #headerleft>
        <slot name="headerleft" />
      </template>
      <template #headerright>
        <slot name="headerright" />
      </template>
      <template #toolbarright>
        <slot name="toolbarright" />
      </template>
    </SchemaPage>
  </template>
  <template v-else></template>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { ElMessageBox } from 'element-plus/es/components/message-box/index.mjs'
import type { Schema, Model, Action as ActionType, CRUDOptions, Scenario, FormSubmitControls } from '../core/types'
import { CRUD } from '../runtime/crud'
import { useSchemaUI } from '../runtime/useSchemaUI'
import { clearSearchModel } from '../core/form'
import { resolveActions } from '../core/actions'
import { createDefaultTranslator } from '../core/i18n'
import { Delete, Download, EditPen, Refresh, View } from '@element-plus/icons-vue'
import SchemaPage from './SchemaPage.vue'

interface Props {
  module: string
  table: string
  title?: string
  subtitle?: string
  apiPrefix?: string
  config?: Partial<CRUDOptions>
  size?: string
  formMode?: 'drawer' | 'dialog'
  showHeader?: boolean
  showSearch?: boolean
  showToolbar?: boolean
  showPagination?: boolean
  showPageSize?: boolean
  showJumper?: boolean
  showDensity?: boolean
  showColumnSettings?: boolean
  searchCollapsible?: boolean
  defaultSearchCollapsed?: boolean
  collapseSearchOnSearch?: boolean
  showExport?: boolean
  showRefresh?: boolean
  showBatchDelete?: boolean
  storageKey?: string
  tableHeight?: number | string
  autoTableHeight?: boolean
  tableHeightOffset?: number
  actionsWidth?: number | string
  readonly?: boolean
  autoFetch?: boolean
  rowActions?: (string | ActionType)[]
  headerActions?: (string | ActionType)[]
  batchActions?: (string | ActionType)[]
  formActions?: (string | ActionType)[]
  searchActions?: (string | ActionType)[]
  defaultSort?: string
  presetQuery?: Record<string, any>
  gridProps?: Record<string, any>
  formProps?: Record<string, any>
}

const props = withDefaults(defineProps<Props>(), {
  title: '',
  subtitle: '',
  apiPrefix: '',
  config: () => ({}),
  formMode: 'drawer',
  showHeader: true,
  showSearch: true,
  showToolbar: true,
  showPagination: true,
  showPageSize: true,
  showJumper: true,
  showDensity: true,
  showColumnSettings: true,
  searchCollapsible: true,
  defaultSearchCollapsed: true,
  collapseSearchOnSearch: true,
  showExport: true,
  showRefresh: true,
  showBatchDelete: true,
  storageKey: '',
  tableHeight: '',
  autoTableHeight: true,
  tableHeightOffset: 500,
  actionsWidth: '',
  readonly: false,
  autoFetch: true,
  rowActions: () => [],
  headerActions: () => [],
  batchActions: () => [],
  formActions: () => [],
  searchActions: () => [],
  defaultSort: '',
  presetQuery: () => ({}),
  gridProps: () => ({}),
  formProps: () => ({}),
})

const emit = defineEmits<{
  ready: [crud: CRUD]
}>()

const globalConfig = useSchemaUI()
const t = (key: string, ...args: any[]) => {
  const fn = globalConfig?.i18n?.t || createDefaultTranslator()
  return fn(key, ...args)
}
const crud = ref<CRUD | null>(null)
const schemas = ref<Schema[]>([])
const searching = ref(false)
const isReady = ref(false)
const schemaPageRef = ref<any>(null)

interface ActionDefaults {
  list: ActionType[]
  lookup: Record<string, ActionType>
}

function buildRowDefaults(): ActionDefaults {
  const view: ActionType = {
    name: 'view',
    label: t('action.view'),
    icon: View,
    type: 'info',
    asyncCallback: async (model) => handleView(model),
  }
  const edit: ActionType = {
    name: 'edit',
    label: t('action.edit'),
    icon: EditPen,
    type: 'success',
    asyncCallback: async (model) => handleEdit(model),
  }
  const del: ActionType = {
    name: 'delete',
    label: t('action.delete'),
    icon: Delete,
    type: 'danger',
    callback: (model) => handleDelete(model),
  }
  return {
    list: [view, edit, del],
    lookup: { view, edit, delete: del },
  }
}

function buildExportAction(): ActionType {
  return {
    name: 'export',
    label: t('action.export'),
    icon: Download,
    display: 'button',
    callback: () => {
      crud.value!.exportModels().catch((e) => console.error('Export failed:', e))
    },
  }
}

function buildHeaderDefaults(): ActionDefaults {
  const exp = buildExportAction()
  const refresh: ActionType = {
    name: 'refresh',
    label: t('action.refresh'),
    icon: Refresh,
    display: 'button',
    asyncCallback: async () => {
      await runSearch(() => crud.value!.searchModel())
    },
  }
  const batchExportRequested = props.batchActions.some((item) =>
    typeof item === 'string' ? item === 'export' : item.name === 'export',
  )
  const list: ActionType[] = []
  if (props.showExport && !batchExportRequested) list.push(exp)
  if (props.showRefresh) list.push(refresh)
  return {
    list,
    lookup: { export: exp, refresh },
  }
}

function buildBatchDefaults(): ActionDefaults {
  // 导出默认提升到页头；batchActions 显式传 'export' 时仍兼容旧的批量入口。
  const exp = buildExportAction()
  const del: ActionType = {
    name: 'delete',
    label: t('action.batchDelete'),
    type: 'danger',
    asyncCallback: async (models) => {
      const list = Array.isArray(models) ? models : []
      if (list.length === 0) return
      try {
        await ElMessageBox.confirm(
          t('confirm.batchDelete.message', String(list.length)),
          t('confirm.batchDelete.title'),
          {
            confirmButtonText: t('action.delete'),
            cancelButtonText: t('action.cancel'),
            type: 'warning',
          },
        )
      } catch {
        return
      }
      const instance = crud.value
      if (!instance) return
      const result = await instance.deleteModels(list)
      if (result.failed > 0) {
        console.error(`[rest-ui] batch delete failed: ${result.failed}/${result.total}`)
      }
      await runSearch(() => instance.searchModel())
      schemaPageRef.value?.clearSelection?.()
    },
  }

  const batchExportRequested = props.batchActions.some((item) =>
    typeof item === 'string' ? item === 'export' : item.name === 'export',
  )
  const list: ActionType[] = []
  // 只读页面（审计/登录日志等）没有删除端点，不注入批量删除。
  if (props.showBatchDelete && !props.readonly) list.push(del)
  if (batchExportRequested) list.push(exp)
  return {
    list,
    lookup: { delete: del, export: exp },
  }
}

function buildSearchDefaults(): ActionDefaults {
  const search: ActionType = {
    name: 'search',
    label: t('action.search'),
    type: 'primary',
    asyncCallback: async (model, displaySchemas) => {
      await runSearch(async () => {
        const instance = crud.value
        if (!instance) return
        instance.resetPagination().setQueryParams(
          clearSearchModel(model, displaySchemas || []),
        )
        await instance.searchModel()
      })
    },
  }
  return {
    list: [search],
    lookup: { search },
  }
}

const pagination = computed(() => {
  if (!crud.value) return { index: 1, size: 15, totalCount: 0 }
  return {
    index: crud.value.getPaginationIndex(),
    size: crud.value.getPaginationSize(),
    totalCount: crud.value.getPaginationCount(),
  }
})

const searchActionList = computed((): ActionType[] => {
  const { list, lookup } = buildSearchDefaults()
  return resolveActions(props.searchActions, list, lookup, true)
})

const headerActionList = computed((): ActionType[] => {
  const { list, lookup } = buildHeaderDefaults()
  return resolveActions(props.headerActions, list, lookup, true)
})

const rowActionList = computed((): ActionType[] => {
  const { list, lookup } = buildRowDefaults()
  // readonly 只保留查看详情，不再把 view 一起隐藏
  const defaults = props.readonly
    ? list.filter((action) => action.name === 'view')
    : list
  return resolveActions(props.rowActions, defaults, lookup, true)
})

const batchActionList = computed((): ActionType[] => {
  const { list, lookup } = buildBatchDefaults()
  // 默认只注入批量删除；导出只有显式传入时才进入批量入口。
  return resolveActions(props.batchActions, list, lookup, true)
})

const formActionList = computed((): ActionType[] => {
  // formActions 没有内建默认；字符串无法命中默认会被过滤，ActionType 原样保留。
  // 当为空时，SchemaPage 使用其内置的 save 动作并发出 'formSubmit' 事件。
  return resolveActions(props.formActions, [], {}, true)
})

let initSeq = 0
let searchSeq = 0

async function runSearch(fn: () => Promise<unknown>): Promise<void> {
  const seq = ++searchSeq
  searching.value = true
  try {
    await fn()
  } catch (err) {
    console.error('[SchemaViewer] search failed:', err)
  } finally {
    // 旧请求完成时不能提前关闭新请求的 loading
    if (seq === searchSeq) searching.value = false
  }
}

async function init() {
  const seq = ++initSeq
  const instance = new CRUD({
    module: props.module,
    table: props.table,
    apiPrefix: props.apiPrefix || globalConfig.apiPrefix || '',
    httpClient: globalConfig.httpClient,
    schemas: props.config?.schemas,
  })

  const loadedSchemas = await instance.initialize()
  // 快速切换 module/table 时，旧的 init 不能覆盖新的状态。
  if (seq !== initSeq) return
  schemas.value = loadedSchemas
  crud.value = instance

  // Use fixedQuery for presetQuery so they survive setQueryParams during search
  if (Object.keys(props.presetQuery).length > 0) {
    instance.setFixedQuery(props.presetQuery)
  }

  if (props.defaultSort) {
    if (props.defaultSort.startsWith('-')) {
      instance.setSortable(props.defaultSort.slice(1), 'descending')
    } else {
      instance.setSortable(props.defaultSort, 'ascending')
    }
  }

  if (globalConfig.defaultPageSize && globalConfig.defaultPageSize > 0) {
    instance.setPaginationSize(globalConfig.defaultPageSize)
  }

  isReady.value = true
  emit('ready', instance)

  if (props.autoFetch) {
    await runSearch(async () => {
      if (seq === initSeq) await instance.searchModel()
    })
  }
}

init().catch((err) => {
  console.error('[SchemaViewer] init failed:', err)
})

watch(
  () => [props.module, props.table],
  () => {
    isReady.value = false
    crud.value = null
    schemas.value = []
    init().catch((err) => {
      console.error('[SchemaViewer] init failed:', err)
    })
  },
)

watch(
  () => props.presetQuery,
  (value) => {
    crud.value?.setFixedQuery(value || {})
  },
  { deep: true },
)

function handleSearch(model: Model) {
  runSearch(async () => {
    const instance = crud.value
    if (!instance) return
    instance.resetPagination().setQueryParams(
      clearSearchModel(model, schemas.value),
    )
    await instance.searchModel()
  })
}

function handleCreate() {
  // SchemaPage handles dialog display
}

async function handleView(model: Model) {
  try {
    const instance = crud.value
    const pk = instance?.findModelPrimaryKey(model)
    if (instance && pk !== undefined && pk !== null && pk !== '') {
      const detail = await instance.getModel(String(pk))
      schemaPageRef.value?.openDetail(detail)
    } else {
      schemaPageRef.value?.openDetail(model)
    }
  } catch (e) {
    console.error('Failed to fetch detail:', e)
    // 详情是只读的，回退到列表行不会写回数据
    schemaPageRef.value?.openDetail(model)
  }
}

async function handleEdit(model: Model) {
  try {
    const instance = crud.value
    const pk = instance?.findModelPrimaryKey(model)
    if (instance && pk !== undefined && pk !== null && pk !== '') {
      // Pass scenario='update' so the backend returns fields aligned with the update form,
      // matching the pattern used by __refreshModel in CRUD.
      const detail = await instance.getModel({
        [instance.primaryKey]: pk,
        scenario: 'update',
      })
      schemaPageRef.value?.openEdit(detail)
    } else {
      schemaPageRef.value?.openEdit(model)
    }
  } catch (e) {
    // 不能用列表投影（__format=both）的行直接打开编辑表单：字段会被
    // decode 成 JSON 字符串/0，保存有覆盖真实数据的风险。失败时保持关闭。
    console.error('Failed to fetch detail:', e)
  }
}

function handleDelete(model: Model) {
  ElMessageBox.confirm(
    t('confirm.delete.message'),
    t('confirm.delete.title'),
    {
      confirmButtonText: t('action.confirm'),
      cancelButtonText: t('action.cancel'),
      type: 'warning',
    },
  )
    .then(async () => {
      try {
        await crud.value!.deleteModel(model)
        // reserve-selection 会保留已删除行的主键，删除后主动清空勾选。
        schemaPageRef.value?.clearSelection?.()
      } catch (e) {
        console.error('Delete failed:', e)
      }
    })
    .catch(() => { })
}

function handlePageChange(index: number) {
  runSearch(async () => {
    const instance = crud.value
    if (!instance) return
    instance.setPaginationIndex(index)
    await instance.searchModel()
  })
}

function handleSizeChange(size: number) {
  runSearch(async () => {
    const instance = crud.value
    if (!instance) return
    instance.setPaginationSize(size).resetPagination()
    await instance.searchModel()
  })
}

function handleSortChange(e: { column: string; order: 'ascending' | 'descending' | null }) {
  const instance = crud.value
  if (!instance) return
  if (!e.order) {
    instance.setSortable('', 'ascending')
  } else {
    instance.setSortable(e.column, e.order)
  }
  runSearch(() => instance.searchModel())
}

async function handleFormSubmit(
  model: Model,
  scenario: Scenario,
  controls?: FormSubmitControls,
) {
  const instance = crud.value
  if (!instance) return
  instance.resetError()
  const resolve = controls?.resolve ?? (() => schemaPageRef.value?.resolveFormSubmit())
  const reject = controls?.reject ?? ((err: any) => schemaPageRef.value?.rejectFormSubmit(err))
  const close = controls?.close ?? (() => schemaPageRef.value?.closeForm())
  try {
    if (scenario === 'create') {
      await instance.createModel(model)
    } else {
      await instance.updateModel(model)
    }
    close()
    resolve()
  } catch (e: any) {
    console.error('Form submit failed:', e)
    // Surface error to the form via fieldErrors
    const message = e?.message || e?.response?.data?.message || t('error.save')
    instance.setColumnError('*', message)
    reject(e)
  }
}
</script>
