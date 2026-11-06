<template>
  <div class="schema-page" :class="{ 'has-mobile-batch': isMobile && selections.length > 0 }">
    <div v-if="showHeader" class="schema-page-header">
      <div class="header-left">
        <slot name="headerleft">
          <h3>{{ title }}</h3>
          <p v-if="subtitle" class="header-subtitle">{{ subtitle }}</p>
        </slot>
      </div>
      <div class="header-right">
        <slot name="headerright">
          <Action v-for="action in headerActionList" :key="`header-${action.name}`" :action="action"
            @click="handleHeaderAction" />
          <el-button v-if="!readonly && !hasHeaderCreate" type="primary" :icon="Plus" @click="handleCreate">
            {{ t('action.create') }}
          </el-button>
        </slot>
      </div>
    </div>

    <div class="schema-page-body">
      <div v-if="showSearch" class="schema-page-search">
        <div v-if="searchCollapsible" class="schema-search-summary">
          <el-button class="schema-search-toggle" :class="{ 'is-open': searchOpen }" @click="toggleSearch">
            <el-icon>
              <Filter />
            </el-icon>
            <span>{{ t('search.filter') }}</span>
            <span v-if="activeFilters.length" class="schema-search-count">{{ activeFilters.length }}</span>
            <el-icon class="schema-search-chevron">
              <ArrowDown />
            </el-icon>
          </el-button>

          <div v-if="activeFilters.length" class="schema-search-chips">
            <el-tag v-for="filter in activeFilters" :key="filter.column" closable size="small" type="info"
              effect="light" @close="removeFilter(filter.column)">
              {{ filter.label }}
            </el-tag>
            <el-button link type="primary" size="small" @click="resetSearch">
              {{ t('search.clear') }}
            </el-button>
          </div>
          <span v-else class="schema-search-hint">{{ t('search.hint') }}</span>
        </div>

        <el-collapse-transition>
          <div v-show="!searchCollapsible || searchOpen" class="schema-search-form">
            <SchemaForm ref="searchFormRef" :schemas="searchSchemas" scenario="search" :model="searchModel"
              :inline="true" :actions="searchActionList">
              <template #default="{ model, schema }">
                <slot name="searchform" :model="model" :schema="schema" />
              </template>
            </SchemaForm>
          </div>
        </el-collapse-transition>
      </div>

      <div v-if="showToolbar" class="schema-page-toolbar">
        <div class="schema-toolbar-left">
          <template v-if="!isMobile && selections.length > 0">
            <span class="schema-selection-count">
              {{ t('toolbar.selected', String(selections.length)) }}
            </span>
            <el-button v-for="action in batchActionList" :key="action.name" size="small"
              :type="action.type || 'default'" :plain="isPlainAction(action)" @click="handleBatchAction(action)">
              {{ action.label }}
            </el-button>
            <el-button link size="small" @click="clearSelection">
              {{ t('toolbar.clearSelection') }}
            </el-button>
          </template>
          <template v-else>
            <span class="schema-toolbar-total">
              {{ t('toolbar.total', String(pagination.totalCount)) }}
            </span>
            <template v-if="!isMobile && batchActionList.length > 0">
              <span class="schema-toolbar-divider"></span>
              <span class="schema-toolbar-hint">{{ t('toolbar.hint') }}</span>
            </template>
          </template>
        </div>

        <div v-if="!isMobile" class="schema-toolbar-right">
          <slot name="toolbarright" />
          <el-select v-if="showDensity" :model-value="density" size="small" class="schema-density-select"
            :aria-label="t('density.label')" @update:model-value="setDensity">
            <el-option :label="t('density.default')" value="default" />
            <el-option :label="t('density.compact')" value="small" />
          </el-select>
          <el-popover v-if="showColumnSettings" placement="bottom-end" :width="188" trigger="click">
            <template #reference>
              <el-button size="small" text bg>
                <el-icon>
                  <Setting />
                </el-icon>
                {{ t('columns.title') }}
              </el-button>
            </template>
            <div class="schema-column-panel">
              <p class="schema-column-title">{{ t('columns.title') }}</p>
              <el-checkbox v-for="schema in listSchemas" :key="schema.column"
                :model-value="!hiddenColumns.includes(schema.column)"
                @update:model-value="(checked) => toggleColumn(schema.column, !!checked)">
                {{ schema.label }}
              </el-checkbox>
            </div>
          </el-popover>
        </div>
      </div>

      <div class="schema-page-grid" v-loading="loading">
        <SchemaGrid ref="gridRef" :schemas="displaySchemas" :models="models" scenario="list" :actions="rowActionList"
          :row-key="primaryKey" :actions-label="t('table.actions')" :actions-width="actionsWidth"
          :empty-text="t('table.empty')" :size="density" v-bind="gridProps" @selection="handleSelectionChange"
          @sort="handleSortChange">
          <template #default="{ model, schema }">
            <slot name="gridview" :model="model" :schema="schema" />
          </template>
        </SchemaGrid>
        <div v-if="showPagination" class="schema-page-pagination">
          <el-pagination :page-size="pagination.size" :page-sizes="pageSizes" :total="pagination.totalCount"
            :current-page="pagination.index" :layout="paginationLayout" :small="isMobile"
            @current-change="handlePageChange" @size-change="handleSizeChange" />
        </div>
      </div>
    </div>

    <el-dialog v-if="formMode === 'dialog'" v-model="formVisible" :title="formTitle" :width="formWidth" draggable
      destroy-on-close>
      <!-- 必须传完整 schemas：SchemaForm 会按 scenario 自行过滤字段，
           同时需要完整列表里的 primary_key 元数据把主键补回提交模型。 -->
      <SchemaForm v-bind="resolvedFormProps" :schemas="props.schemas" :scenario="formScenario" :model="formModel"
        :actions="formActionList" :errors="formErrors">
        <template #default="{ model, schema }">
          <slot name="crudform" :model="model" :schema="schema" />
        </template>
      </SchemaForm>
    </el-dialog>
    <el-drawer v-else v-model="formVisible" :title="formTitle" :size="drawerWidth" destroy-on-close>
      <SchemaForm v-bind="resolvedFormProps" :schemas="props.schemas" :scenario="formScenario" :model="formModel"
        :actions="formActionList" :errors="formErrors">
        <template #default="{ model, schema }">
          <slot name="crudform" :model="model" :schema="schema" />
        </template>
      </SchemaForm>
    </el-drawer>

    <el-dialog v-if="formMode === 'dialog'" v-model="detailVisible" :title="detailTitle" :width="detailWidth" draggable
      destroy-on-close>
      <el-descriptions :column="detailColumns" border>
        <el-descriptions-item v-for="schema in detailSchemas" :key="schema.column" :label="schema.label">
          <Cell :model="detailModel" :schema="schema" />
        </el-descriptions-item>
      </el-descriptions>
    </el-dialog>
    <el-drawer v-else v-model="detailVisible" :title="detailTitle" :size="detailWidth" destroy-on-close>
      <el-descriptions :column="detailColumns" border>
        <el-descriptions-item v-for="schema in detailSchemas" :key="schema.column" :label="schema.label">
          <Cell :model="detailModel" :schema="schema" />
        </el-descriptions-item>
      </el-descriptions>
    </el-drawer>

    <transition name="schema-batch-slide">
      <div v-if="isMobile && selections.length > 0" class="schema-mobile-batch">
        <span class="schema-mobile-batch-count">
          {{ t('toolbar.selected', String(selections.length)) }}
        </span>
        <div class="schema-mobile-batch-actions">
          <el-button v-for="action in batchActionList" :key="`mobile-${action.name}`" size="small"
            :type="action.type || 'default'" :plain="isPlainAction(action)" @click="handleBatchAction(action)">
            {{ action.label }}
          </el-button>
          <el-button link size="small" @click="clearSelection">
            {{ t('action.cancel') }}
          </el-button>
        </div>
      </div>
    </transition>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, inject, onMounted, onUnmounted, nextTick } from 'vue'
import ElButton from 'element-plus/es/components/button/index.mjs'
import { ElDescriptions, ElDescriptionsItem } from 'element-plus/es/components/descriptions/index.mjs' // DescriptionsItem 与 Descriptions 同源
import ElDialog from 'element-plus/es/components/dialog/index.mjs'
import ElDrawer from 'element-plus/es/components/drawer/index.mjs'
import ElIcon from 'element-plus/es/components/icon/index.mjs'
import ElPagination from 'element-plus/es/components/pagination/index.mjs'
import ElTag from 'element-plus/es/components/tag/index.mjs'
import { ElSelect, ElOption } from 'element-plus/es/components/select/index.mjs'
import ElPopover from 'element-plus/es/components/popover/index.mjs'
import ElCheckbox from 'element-plus/es/components/checkbox/index.mjs'
import { ElCollapseTransition } from 'element-plus/es/components/collapse-transition/index.mjs'
import { vLoading } from 'element-plus/es/components/loading/index.mjs'
// 说明:必须从 `element-plus/es/components/xxx/index.mjs` 深层路径走,不能直接
// `from 'element-plus'`,后者是聚合 barrel,会让消费方 vendor chunk 膨胀到 1 MB+。
// 深层路径与 `unplugin-vue-components` 的 ElementPlusResolver 内部使用的路径一致,
// 已经被证实可被 rollup treeshake。
import { ArrowDown, Filter, Plus, Setting } from '@element-plus/icons-vue'
import type { Schema, Model, Action as ActionType, Pagination as PaginationType, Scenario, FormSubmitControls } from '../core/types'
import type { SchemaUIConfig } from '../config'
import { filterByScenario } from '../core/form'
import { resolveActions, isActionVisibleSync, isActionPermitted } from '../core/actions'
import { cloneModel } from '../core/model'
import { buildActiveFilters } from '../core/search'
import { createDefaultTranslator } from '../core/i18n'
import { GLOBAL_CONFIG_KEY } from '../config'
import SchemaForm from './SchemaForm.vue'
import SchemaGrid from './SchemaGrid.vue'
import Cell from './parts/Cell.vue'
import Action from './parts/Action.vue'
import '../styles/page.scss'

interface Props {
  schemas: Schema[]
  models: Model[]
  pagination?: PaginationType
  loading?: boolean
  size?: string
  title?: string
  subtitle?: string
  formMode?: 'drawer' | 'dialog'
  showHeader?: boolean
  showSearch?: boolean
  showToolbar?: boolean
  showPagination?: boolean
  showPageSize?: boolean
  showJumper?: boolean
  showDensity?: boolean
  showColumnSettings?: boolean
  pageSizes?: number[]
  searchCollapsible?: boolean
  defaultSearchCollapsed?: boolean
  collapseSearchOnSearch?: boolean
  storageKey?: string
  tableHeight?: number | string
  autoTableHeight?: boolean
  tableHeightOffset?: number
  actionsWidth?: number | string
  readonly?: boolean
  searchActions?: ActionType[]
  headerActions?: ActionType[]
  rowActions?: ActionType[]
  batchActions?: ActionType[]
  formActions?: ActionType[]
  gridProps?: Record<string, any>
  formProps?: Record<string, any>
  presetQuery?: Record<string, any>
  formErrors?: Record<string, string>
}

const props = withDefaults(defineProps<Props>(), {
  pagination: () => ({ index: 1, size: 15, totalCount: 0 }),
  loading: false,
  title: '',
  subtitle: '',
  formMode: 'dialog',
  showHeader: true,
  showSearch: true,
  showToolbar: true,
  showPagination: true,
  showPageSize: true,
  showJumper: true,
  showDensity: true,
  showColumnSettings: true,
  pageSizes: () => [10, 15, 30, 50, 100],
  searchCollapsible: true,
  defaultSearchCollapsed: true,
  collapseSearchOnSearch: true,
  storageKey: '',
  tableHeight: '',
  autoTableHeight: false,
  tableHeightOffset: 500,
  actionsWidth: '',
  readonly: false,
  searchActions: () => [],
  headerActions: () => [],
  rowActions: () => [],
  batchActions: () => [],
  formActions: () => [],
  gridProps: () => ({}),
  formProps: () => ({}),
  presetQuery: () => ({}),
  formErrors: () => ({}),
})

const emit = defineEmits<{
  search: [model: Model]
  create: []
  edit: [model: Model]
  delete: [model: Model]
  pageChange: [index: number]
  sortChange: [sortable: { column: string; order: 'ascending' | 'descending' | null }]
  selectionChange: [selection: any[]]
  formSubmit: [model: Model, scenario: Scenario, controls?: FormSubmitControls]
  sizeChange: [size: number]
}>()

const globalConfig = inject<SchemaUIConfig | null>(GLOBAL_CONFIG_KEY, null)

const t = (key: string, ...args: any[]) => {
  const fn = globalConfig?.i18n?.t || createDefaultTranslator()
  return fn(key, ...args)
}

const formVisible = ref(false)
const formScenario = ref<Scenario>('create')
const searchModel = ref<Model>({ ...props.presetQuery })
const appliedSearchModel = ref<Model>({ ...props.presetQuery })
const formModel = ref<Model>({})
const selections = ref<any[]>([])
const detailVisible = ref(false)
const detailModel = ref<Model>({})
const formSubmitting = ref(false)
const searchOpen = ref(!props.searchCollapsible || !props.defaultSearchCollapsed)
const searchFormRef = ref<any>(null)
const gridRef = ref<any>(null)
const hiddenColumns = ref<string[]>([])
const density = ref<'default' | 'small'>('default')

watch(() => props.presetQuery, (val) => {
  searchModel.value = { ...val }
  appliedSearchModel.value = { ...val }
}, { deep: true })

const searchSchemas = computed(() =>
  filterByScenario(props.schemas, 'search', { includeInvisible: true })
)
const listSchemas = computed(() =>
  filterByScenario(props.schemas, 'list')
)
const displaySchemas = computed(() =>
  listSchemas.value.filter((schema) => !hiddenColumns.value.includes(schema.column))
)
const detailSchemas = computed(() =>
  filterByScenario(props.schemas, 'detail')
)

const primaryKey = computed(() =>
  props.schemas.find((schema) => schema.primary_key === 1)?.column || ''
)

const formTitle = computed(() => {
  return formScenario.value === 'create' ? t('form.create') : t('form.edit')
})

const detailTitle = computed(() => t('form.detail'))

const viewportWidth = ref(typeof window === 'undefined' ? 1200 : window.innerWidth)
const isMobile = computed(() => viewportWidth.value <= 768)

// 桌面/移动端切换会更换整个表格实现，旧勾选无法映射到新视图，直接清空。
watch(isMobile, () => {
  clearSelection()
})

function syncViewportWidth() {
  if (typeof window === 'undefined') return
  viewportWidth.value = window.innerWidth
}

// ── 列显示 / 密度持久化 ────────────────────────────────

const STORAGE_PREFIX = 'rest-ui:schema-page'

function storageKeyOf(name: string): string {
  if (!props.storageKey) return ''
  return `${STORAGE_PREFIX}:${props.storageKey}:${name}`
}

function readStorage(name: string): string | null {
  const key = storageKeyOf(name)
  if (!key || typeof window === 'undefined') return null
  try {
    return window.localStorage.getItem(key)
  } catch {
    return null
  }
}

function writeStorage(name: string, value: string): void {
  const key = storageKeyOf(name)
  if (!key || typeof window === 'undefined') return
  try {
    window.localStorage.setItem(key, value)
  } catch {
    /* localStorage 不可用时静默降级 */
  }
}

onMounted(() => {
  syncViewportWidth()
  window.addEventListener('resize', syncViewportWidth)

  const savedColumns = readStorage('columns')
  if (savedColumns) {
    try {
      const parsed = JSON.parse(savedColumns)
      if (Array.isArray(parsed)) {
        hiddenColumns.value = parsed.filter((item) => typeof item === 'string')
      }
    } catch {
      /* 忽略损坏的缓存 */
    }
  }

  const savedDensity = readStorage('density')
  if (savedDensity === 'small' || savedDensity === 'default') {
    density.value = savedDensity
  }
})

onUnmounted(() => {
  window.removeEventListener('resize', syncViewportWidth)
})

watch(hiddenColumns, (value) => {
  writeStorage('columns', JSON.stringify(value))
}, { deep: true })

watch(density, (value) => {
  writeStorage('density', value)
})

const formWidth = computed(() => {
  const width = viewportWidth.value
  if (width < 768) return '96%'
  if (width <= 1180) return '80%'
  if (width <= 1366) return '60%'
  return '40%'
})

const resolvedFormProps = computed(() => {
  // 抽屉空间足够，默认两列；dialog 保持单列，避免窄弹窗里控件被压扁。
  const defaults = props.formMode === 'drawer'
    ? { grid: true, gridCols: 12 }
    : {}
  return { ...defaults, ...props.formProps }
})

const drawerWidth = computed(() =>
  viewportWidth.value < 768 ? '96%' : 'min(680px, 92vw)',
)

const detailWidth = computed(() =>
  viewportWidth.value < 768 ? '96%' : 'min(760px, 92vw)',
)

const detailColumns = computed(() => (viewportWidth.value < 768 ? 1 : 2))

const paginationLayout = computed(() => {
  // 移动端宽度放不下 sizes + jumper，收敛成 total + 页码，避免横向被裁切。
  if (isMobile.value) return 'total, prev, pager, next'
  const parts = ['total']
  if (props.showPageSize) parts.push('sizes')
  parts.push('prev', 'pager', 'next')
  if (props.showJumper) parts.push('jumper')
  return parts.join(', ')
})

function toggleSearch() {
  searchOpen.value = !searchOpen.value
}

function captureSearch(model: Model) {
  appliedSearchModel.value = { ...model }
  if (props.collapseSearchOnSearch) searchOpen.value = false
  // 搜索结果集已变化，之前跨页保留的勾选不应继续参与批量操作。
  gridRef.value?.clearSelection?.()
  selections.value = []
  emit('selectionChange', [])
}

function wrapSearchAction(action: ActionType): ActionType {
  const wrapped: ActionType = { ...action }
  if (typeof action.callback === 'function') {
    wrapped.callback = (model, schemas, loading) => {
      captureSearch(model)
      action.callback!(model, schemas, loading)
    }
  }
  if (typeof action.asyncCallback === 'function') {
    wrapped.asyncCallback = async (model, schemas, actionArg) => {
      captureSearch(model)
      await action.asyncCallback!(model, schemas, actionArg)
    }
  }
  return wrapped
}

const searchActionList = computed((): ActionType[] => {
  const base = props.searchActions.length > 0
    ? props.searchActions
    : [{
      name: 'search',
      label: t('action.search'),
      type: 'primary' as const,
      asyncCallback: async (model: Model) => {
        emit('search', model)
      },
    }]
  const actions = base.map(wrapSearchAction)
  if (!actions.some((action) => action.name === 'reset')) {
    actions.push({
      name: 'reset',
      label: t('search.reset'),
      callback: () => {
        resetSearch()
      },
    })
  }
  return actions
})

const activeFilters = computed(() =>
  buildActiveFilters(appliedSearchModel.value, searchSchemas.value, t),
)

function primarySearchAction(): ActionType | undefined {
  return searchActionList.value.find((action) => action.name === 'search') ||
    searchActionList.value[0]
}

function removeFilter(column: string) {
  const schema = searchSchemas.value.find((item) => item.column === column)
  const current = searchModel.value[column]
  const isArray = Array.isArray(current) ||
    schema?.format === 'multiSelect' ||
    schema?.attributes?.live?.type === 'cascader'
  searchModel.value = {
    ...searchModel.value,
    [column]: isArray ? [] : '',
  }
  const next = { ...appliedSearchModel.value }
  delete next[column]
  appliedSearchModel.value = next
  nextTick(() => {
    const action = primarySearchAction()
    if (!action) return
    searchFormRef.value?.runAction(action).catch((err: any) => {
      console.error('[rest-ui] re-search after removing filter failed:', err)
    })
  })
}

function resetSearch() {
  searchModel.value = { ...props.presetQuery }
  appliedSearchModel.value = {}
  nextTick(() => {
    const action = primarySearchAction()
    if (!action) return
    searchFormRef.value?.runAction(action).catch((err: any) => {
      console.error('[rest-ui] reset search failed:', err)
    })
  })
}

const headerActionList = computed((): ActionType[] => props.headerActions)

const hasHeaderCreate = computed(() =>
  headerActionList.value.some((action) => action.name === 'create'),
)

const rowActionList = computed((): ActionType[] => {
  const view: ActionType = {
    name: 'view',
    label: t('action.view'),
    type: 'info',
    callback: (model) => handleDetail(model as Model),
  }
  const edit: ActionType = {
    name: 'edit',
    label: t('action.edit'),
    type: 'success',
    callback: (model) => handleEdit(model as Model),
  }
  const del: ActionType = {
    name: 'delete',
    label: t('action.delete'),
    type: 'danger',
    callback: (model) => emit('delete', model as Model),
  }
  const defaults = [view, edit, del]
  const lookup = { view, edit, delete: del }
  // readonly 保留查看详情，只隐藏写操作
  return resolveActions(
    props.rowActions,
    props.readonly ? [view] : defaults,
    lookup,
    true,
  )
})

const actionsWidth = computed(() => {
  if (props.actionsWidth !== '' && props.actionsWidth !== undefined) return props.actionsWidth
  return Math.max(96, rowActionList.value.length * 36 + 24)
})

const batchActionList = computed((): ActionType[] =>
  props.batchActions.filter((action) =>
    isActionVisibleSync(action, selections.value as any, globalConfig),
  ),
)

// Promise-based submit mechanism: the save action's asyncCallback returns
// a Promise that resolves when the parent (SchemaViewer) completes the API call.
let formSubmitResolve: (() => void) | null = null
let formSubmitReject: ((err: any) => void) | null = null

function resolveFormSubmit() {
  formSubmitResolve?.()
  formSubmitResolve = null
  formSubmitReject = null
}

function rejectFormSubmit(err: any) {
  formSubmitReject?.(err)
  formSubmitResolve = null
  formSubmitReject = null
}

const formActionList = computed((): ActionType[] => {
  if (props.formActions.length > 0) {
    // External formActions are used as-is; the parent component
    // (e.g. SchemaViewer) handles save logic and form closing.
    return props.formActions
  }
  return [
    {
      name: 'save',
      label: t('action.save'),
      type: 'primary',
      asyncCallback: async (model) => {
        formSubmitting.value = true
        // 先注册 resolver 再 emit，保证父组件在事件回调里同步调用 controls.resolve()
        // 也能正确结束 loading。
        return new Promise<void>((resolve, reject) => {
          const controls: FormSubmitControls = {
            resolve: () => {
              formSubmitting.value = false
              resolve()
            },
            reject: (err: any) => {
              formSubmitting.value = false
              reject(err)
            },
            close: () => {
              formVisible.value = false
            },
          }
          formSubmitResolve = controls.resolve
          formSubmitReject = controls.reject
          emit('formSubmit', model, formScenario.value, controls)
        })
      },
    },
  ]
})

function handleCreate() {
  formScenario.value = 'create'
  formModel.value = {}
  emit('create')
  formVisible.value = true
}

function handleEdit(model: Model) {
  formScenario.value = 'update'
  formModel.value = cloneModel(model)
  emit('edit', model)
  formVisible.value = true
}

function handleDetail(model: Model) {
  detailModel.value = cloneModel(model)
  detailVisible.value = true
}

function closeForm() {
  formVisible.value = false
}

function handleHeaderAction(action: ActionType, loading: any) {
  if (!isActionPermitted(action, globalConfig)) return
  if (typeof action.callback === 'function') {
    try {
      action.callback(selections.value as any, props.schemas, loading)
    } catch (err) {
      console.error('[SchemaPage] header action failed:', err)
    }
  } else if (typeof action.asyncCallback === 'function') {
    loading.value = true
    action
      .asyncCallback(selections.value as any, props.schemas, action)
      .catch((err) => {
        console.error('[SchemaPage] header action failed:', err)
      })
      .finally(() => {
        loading.value = false
      })
  }
}

function isPlainAction(action: ActionType): boolean {
  return action.type !== undefined &&
    action.type !== 'default' &&
    action.type !== 'primary'
}

function executeBatchAction(action: ActionType) {
  if (typeof action.callback === 'function') {
    try {
      action.callback(selections.value, props.schemas)
    } catch (err) {
      console.error('[SchemaPage] batch action failed:', err)
    }
  } else if (typeof action.asyncCallback === 'function') {
    action
      .asyncCallback(selections.value, props.schemas)
      .catch((err) => {
        // 异步批量动作默认不弹错误,消费方通常会在自己的 asyncCallback 内
        // 用 ElMessage.error 兜底。这里只保证 Promise 链上不会触发 unhandled。
        // eslint-disable-next-line no-console
        console.error('[SchemaPage] batch action failed:', err)
      })
  }
}

function handleBatchAction(action: ActionType) {
  // 与 SchemaGrid.handleActionClick 保持一致:同时支持 callback 与 asyncCallback。
  // 仅处理 callback 会导致消费方只用 asyncCallback(典型:批量导出、批量归档需要
  // await httpClient)时按钮静默 no-op。
  if (!isActionPermitted(action, globalConfig)) return

  const hidden = action.hidden
  if (typeof hidden === 'function') {
    try {
      const result = hidden(selections.value as any)
      if (result instanceof Promise) {
        result
          .then((isHidden) => {
            if (!isHidden) executeBatchAction(action)
          })
          .catch((err) => console.error('[SchemaPage] batch hidden check failed:', err))
        return
      }
      if (result) return
    } catch (err) {
      console.error('[SchemaPage] batch hidden check failed:', err)
      return
    }
  } else if (hidden) {
    return
  }
  executeBatchAction(action)
}

function clearSelection() {
  gridRef.value?.clearSelection?.()
  selections.value = []
  emit('selectionChange', [])
}

function handleSelectionChange(selection: any[]) {
  selections.value = selection
  emit('selectionChange', selection)
}

function handleSortChange(e: { column: string; order: 'ascending' | 'descending' | null }) {
  emit('sortChange', e)
}

function handlePageChange(index: number) {
  emit('pageChange', index)
}

function handleSizeChange(size: number) {
  emit('sizeChange', size)
}

function toggleColumn(column: string, checked: boolean) {
  if (checked) {
    hiddenColumns.value = hiddenColumns.value.filter((item) => item !== column)
    return
  }
  // 至少保留一列数据列，避免整张表只剩勾选框和操作列。
  if (displaySchemas.value.length <= 1) return
  if (!hiddenColumns.value.includes(column)) {
    hiddenColumns.value = [...hiddenColumns.value, column]
  }
}

function setDensity(value: string) {
  if (value === 'small' || value === 'default') {
    density.value = value
  }
}

defineExpose({
  openEdit: handleEdit,
  openDetail: handleDetail,
  closeForm,
  clearSelection,
  formSubmitting,
  resolveFormSubmit,
  rejectFormSubmit,
})
</script>
