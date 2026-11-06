<template>
  <template v-if="enableMobileTable">
    <el-collapse expand-icon-position="left">
      <el-collapse-item v-for="(model, idx) in models" :key="getMobileRowKey(model, idx)"
        :class="{ 'is-selected': isMobileSelected(model) }">
        <template #title>
          <el-checkbox v-if="selection" :model-value="isMobileSelected(model)" class="mobile-select"
            @click.stop @change="(checked) => toggleMobileSelection(model, !!checked)" />
          <span class="mobile-primary-label">{{ getMobilePrimaryLabel(model) }}</span>
          <span class="mobile-actions" v-if="actions.length > 0" @click.stop>
            <Action v-for="action in actions" :key="action.name" :action="action" :model="model"
              @click="(_, loading) => handleActionClick(action, model, loading)" />
          </span>
        </template>
        <div v-for="schema in mobilePreviewSchemas" :key="schema.column" class="mobile-preview-row">
          <div class="mobile-preview-label">{{ schema.label }}</div>
          <div class="mobile-preview-value">
            <slot :model="model" :schema="schema">
              <Cell :model="model" :schema="schema" />
            </slot>
          </div>
        </div>
      </el-collapse-item>
    </el-collapse>
  </template>
  <template v-else>
    <el-table ref="tableRef" :data="models" :size="size" :border="true" :loading="loading"
      :row-key="rowKey || undefined" :max-height="tableHeight || undefined" v-bind="gridProps"
      @selection-change="handleSelectionChange" @sort-change="handleSortChange">
      <el-table-column v-if="selection" type="selection" width="55" :reserve-selection="!!rowKey" />
      <el-table-column v-for="schema in visibleSchemas" :key="schema.column" :prop="schema.column" :label="schema.label"
        :sortable="schema.attributes.sort ? 'custom' : false" show-overflow-tooltip>
        <template #default="scope">
          <template v-if="scope">
            <slot :model="scope.row" :schema="schema">
              <Cell :model="scope.row" :schema="schema" />
            </slot>
          </template>
        </template>
      </el-table-column>
      <el-table-column v-if="actions.length > 0" :label="actionsLabel || t('table.actions')"
        :width="actionsWidth || undefined" fixed="right" class-name="schema-grid-actions" align="center">
        <template #default="scope">
          <template v-if="scope">
            <Action v-for="action in actions" :key="action.name" :action="action" :model="scope.row"
              @click="(_, loading) => handleActionClick(action, scope.row, loading)" />
          </template>
        </template>
      </el-table-column>
      <template #empty>
        <el-empty :description="emptyText || t('table.empty')" />
      </template>
    </el-table>
  </template>
</template>

<script setup lang="ts">
import { computed, ref, onMounted, onUnmounted, watch, inject } from 'vue'
import { ElCollapse, ElCollapseItem } from 'element-plus/es/components/collapse/index.mjs' // CollapseItem 与 Collapse 同源
import ElCheckbox from 'element-plus/es/components/checkbox/index.mjs'
import ElEmpty from 'element-plus/es/components/empty/index.mjs'
import { ElTable, ElTableColumn } from 'element-plus/es/components/table/index.mjs' // TableColumn 与 Table 同源
import type { Schema, Model, Action as ActionType, Scenario, ComponentSize } from '../core/types'
import type { SchemaUIConfig } from '../config'
import { GLOBAL_CONFIG_KEY } from '../config'
import { filterByScenario } from '../core/form'
import { createDefaultTranslator } from '../core/i18n'
import Cell from './parts/Cell.vue'
import Action from './parts/Action.vue'
import '../styles/grid.scss'
import { getModelLabel, unwrapCellValue } from '../core/model'

interface Props {
  size?: ComponentSize
  schemas: Schema[]
  scenario?: Scenario
  selection?: boolean
  models: Model[]
  actions?: ActionType[]
  actionsLabel?: string
  actionsWidth?: number | string
  rowKey?: string
  tableHeight?: number | string
  emptyText?: string
  gridProps?: Record<string, any>
  responsive?: boolean
  loading?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  scenario: 'list',
  selection: true,
  actions: () => [],
  actionsLabel: '',
  actionsWidth: '',
  rowKey: '',
  tableHeight: '',
  emptyText: '',
  gridProps: () => ({}),
  responsive: true,
  loading: false,
})

const globalConfig = inject<SchemaUIConfig | null>(GLOBAL_CONFIG_KEY, null)
const t = (key: string, ...args: any[]) => {
  const fn = globalConfig?.i18n?.t || createDefaultTranslator()
  return fn(key, ...args)
}

const tableRef = ref<any>(null)

const emit = defineEmits<{
  selection: [selection: any[]]
  sort: [sortable: { column: string; order: 'ascending' | 'descending' | null }]
}>()

const isMobileView = ref(
  typeof window !== 'undefined'
    ? window.matchMedia('(max-width: 768px)').matches
    : false,
)

let mql: MediaQueryList | null = null
let mediaListener: ((e: MediaQueryListEvent) => void) | null = null

onMounted(() => {
  mql = window.matchMedia('(max-width: 768px)')
  isMobileView.value = mql.matches
  mediaListener = (e) => { isMobileView.value = e.matches }
  mql.addEventListener?.('change', mediaListener)
})

onUnmounted(() => {
  if (mql && mediaListener) {
    mql.removeEventListener?.('change', mediaListener)
  }
})

const enableMobileTable = computed(() => {
  if (!props.responsive) return false
  return isMobileView.value
})

const visibleSchemas = computed(() => filterByScenario(props.schemas, props.scenario))

/** 移动端卡片详情不展示自增主键;它只用于 row-key / 路由参数,
 *  出现在卡片里既没有业务含义,又会把真正的字段挤到下面。 */
const mobilePreviewSchemas = computed(() => {
  const withoutPrimaryKey = visibleSchemas.value.filter((schema) => schema.primary_key !== 1)
  return withoutPrimaryKey.length > 0 ? withoutPrimaryKey : visibleSchemas.value
})

const mobileSelection = ref<Model[]>([])

function isMobileSelected(model: Model): boolean {
  return mobileSelection.value.includes(model)
}

function toggleMobileSelection(model: Model, checked: boolean) {
  if (checked) {
    if (!mobileSelection.value.includes(model)) {
      mobileSelection.value = [...mobileSelection.value, model]
    }
  } else {
    mobileSelection.value = mobileSelection.value.filter((item) => item !== model)
  }
  emit('selection', mobileSelection.value)
}

// 搜索/分页替换 models 时清空移动端选择，避免批量操作作用在已不在列表中的行。
watch(
  () => props.models,
  () => {
    if (mobileSelection.value.length === 0) return
    mobileSelection.value = []
    emit('selection', [])
  },
)

function getMobileRowKey(model: Model, index: number): string {
  const pkSchema = props.schemas.find((s) => s.primary_key === 1)
  if (pkSchema) {
    const value = unwrapCellValue(model[pkSchema.column])
    if (value !== undefined && value !== null && value !== '') return String(value)
  }
  return `row-${index}`
}

function getMobilePrimaryLabel(model: Model): string {
  // 移动端标题优先展示业务字段，不能直接用自增主键（否则满屏 1/2/3）。
  const visible = visibleSchemas.value
  const preferred = visible.find((schema) => schema.primary_key !== 1 && schema.type === 'string') ||
    visible.find((schema) => schema.primary_key !== 1) ||
    visible[0]
  if (preferred) {
    const val = getModelLabel(model, preferred.column)
    return val !== undefined && val !== null ? String(val) : ''
  }
  const firstKey = Object.keys(model)[0]
  return firstKey !== undefined ? String(getModelLabel(model, firstKey)) : ''
}

function handleActionClick(action: ActionType, model: Model, loading: any) {
  if (typeof action.callback === 'function') {
    action.callback(model, props.schemas)
  } else if (typeof action.asyncCallback === 'function') {
    loading.value = true
    action
      .asyncCallback(model, props.schemas)
      .catch((err) => {
        console.error('[SchemaGrid] action failed:', err)
      })
      .finally(() => {
        loading.value = false
      })
  }
}

function handleSelectionChange(selection: any[]) {
  emit('selection', selection)
}

function clearSelection() {
  tableRef.value?.clearSelection?.()
  if (mobileSelection.value.length > 0) {
    mobileSelection.value = []
    emit('selection', [])
  }
}

function handleSortChange(e: { prop: string; order: 'ascending' | 'descending' | null }) {
  emit('sort', { column: e.prop, order: e.order })
}

defineExpose({ clearSelection })
</script>
