<template>
  <div class="schema-form" :class="{ 'schema-form--inline': inline }" ref="formElement">
    <div v-if="globalError" class="schema-form-error">{{ globalError }}</div>
    <el-form
      :model="activeModel"
      :label-width="labelWidthComputed"
      :rules="formRules"
      :validate-on-rule-change="false"
      :inline="inlineMode"
      ref="formRef"
      status-icon
    >
      <slot name="container" :model="activeModel" :schemas="displayColumns">
        <el-row :gutter="20" v-if="grid">
          <el-col
            :span="getColSpan(schema)"
            v-for="schema in displayColumns"
            :key="schema.column"
          >
            <el-form-item
              :prop="schema.column"
              :label="schema.label"
              :error="fieldErrors[schema.column]"
            >
              <slot name="default" :model="activeModel" :schema="schema">
                <FormItem v-model="activeModel[schema.column]" :schema="schema" :scenario="scenario" />
              </slot>
            </el-form-item>
          </el-col>
        </el-row>
        <template v-else>
          <el-form-item
            v-for="schema in displayColumns"
            :key="schema.column"
            :prop="schema.column"
            :label="schema.label"
            :error="fieldErrors[schema.column]"
          >
            <slot name="default" :model="activeModel" :schema="schema">
              <FormItem v-model="activeModel[schema.column]" :schema="schema" :scenario="scenario" />
            </slot>
          </el-form-item>
        </template>
        <el-form-item v-if="actions.length > 0" class="schema-form-actions">
          <Action
            v-for="action in actions"
            :key="action.name"
            :action="action"
            @click="handleActionClick"
          />
        </el-form-item>
      </slot>
    </el-form>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted, nextTick, inject } from 'vue'
import ElCol from 'element-plus/es/components/col/index.mjs'
import { ElForm, ElFormItem } from 'element-plus/es/components/form/index.mjs' // FormItem 与 Form 同源 export
import ElRow from 'element-plus/es/components/row/index.mjs'
import type { Schema, Model, Action as ActionType, Scenario } from '../core/types'
import type { SchemaUIConfig } from '../config'
import { decode, encode } from '../core/codec'
import { unwrapCellValue } from '../core/model'
import { generateSchemaRule, checkSchemaVisible, filterByScenario } from '../core/form'
import { createDefaultTranslator } from '../core/i18n'
import { GLOBAL_CONFIG_KEY } from '../config'
import FormItem from './parts/FormItem.vue'
import Action from './parts/Action.vue'
import '../styles/form.scss'

interface Props {
  size?: string
  schemas: Schema[]
  scenario?: Scenario
  labelWidth?: string
  model?: Model
  inline?: boolean
  grid?: boolean
  gridCols?: number
  actions?: ActionType[]
  autoSubmit?: boolean
  errors?: Record<string, string>
}

const props = withDefaults(defineProps<Props>(), {
  scenario: 'create',
  labelWidth: '',
  model: undefined,
  inline: false,
  grid: false,
  gridCols: 0,
  actions: () => [],
  autoSubmit: false,
  errors: () => ({}),
})

const formRef = ref<any>(null)
const formElement = ref<HTMLElement | null>(null)
const activeModel = ref<Model>({})
const formWidth = ref<number>(1200)
const fieldErrors = ref<Record<string, string>>({})
const stopWatchers: (() => void)[] = []
let resizeHandler: (() => void) | null = null
let resizeObserver: ResizeObserver | null = null

const BREAKPOINTS = { MOBILE: 768, TABLET: 960 }
const LABEL_WIDTHS = { MOBILE: '80px', DESKTOP: '120px' }
const COL_SPANS = { FULL: 24, HALF: 12, THIRD: 8 }

const displayColumns = computed(() => {
  return filterByScenario(props.schemas, props.scenario, {
    visibleCheck: (schema) => checkSchemaVisible(schema, activeModel.value),
  })
})

const inlineMode = computed(() => {
  if (props.grid) return false
  return props.inline
})

const labelWidthComputed = computed(() => {
  if (props.inline) return '0'
  if (props.labelWidth) return props.labelWidth
  return formWidth.value < BREAKPOINTS.MOBILE ? LABEL_WIDTHS.MOBILE : LABEL_WIDTHS.DESKTOP
})

const globalConfig = inject<SchemaUIConfig | null>(GLOBAL_CONFIG_KEY, null)

const t = (key: string, ...args: any[]) => {
  const fn = globalConfig?.i18n?.t || createDefaultTranslator()
  return fn(key, ...args)
}

const globalError = computed(() => fieldErrors.value['*'] || '')

const formRules = computed(() => {
  const rules: Record<string, any> = {}
  if (props.scenario === 'search') return rules
  for (const schema of displayColumns.value) {
    rules[schema.column] = generateSchemaRule(t, schema, props.scenario)
  }
  return rules
})

function getColSpan(schema: Schema): number {
  if (schema.format === 'textarea') return COL_SPANS.FULL
  if (props.gridCols > 0) {
    // 抽屉宽度通常 < 768px，但仍适合两列；只有真正窄屏才退回单列。
    return formWidth.value < 480 ? COL_SPANS.FULL : Math.min(props.gridCols, 24)
  }
  if (formWidth.value < BREAKPOINTS.MOBILE) return COL_SPANS.FULL
  if (formWidth.value < BREAKPOINTS.TABLET) return COL_SPANS.HALF
  return COL_SPANS.THIRD
}

onMounted(() => {
  activeModel.value = decode(props.model || {}, props.schemas, props.scenario)
  if (props.autoSubmit) {
    nextTick(() => {
      submit().catch((err) => console.error('[rest-ui] auto submit failed:', err))
    })
  }
  const updateFormWidth = () => {
    if (formElement.value) {
      formWidth.value = formElement.value.offsetWidth
    }
  }
  updateFormWidth()
  // 抽屉/弹窗开启动画期间 offsetWidth 可能还是 0（或旧值）；
  // nextTick + ResizeObserver 保证宽度稳定后重新计算栅格列数。
  nextTick(updateFormWidth)
  if (typeof ResizeObserver !== 'undefined' && formElement.value) {
    resizeObserver = new ResizeObserver(updateFormWidth)
    resizeObserver.observe(formElement.value)
  }

  resizeHandler = updateFormWidth
  window.addEventListener('resize', resizeHandler)

  stopWatchers.push(
    watch(
      () => props.model,
      (val) => {
        activeModel.value = decode(val || {}, props.schemas, props.scenario)
      },
      { deep: true }
    )
  )

  // Sync external errors prop to internal fieldErrors
  stopWatchers.push(
    watch(
      () => props.errors,
      (val) => {
        fieldErrors.value = { ...val }
      },
      { deep: true, immediate: true }
    )
  )
})

onUnmounted(() => {
  stopWatchers.forEach((stop) => stop())
  resizeObserver?.disconnect()
  resizeObserver = null
  if (resizeHandler) {
    window.removeEventListener('resize', resizeHandler)
  }
})

async function submit(): Promise<Model> {
  try {
    await formRef.value!.validate()
  } catch (e: any) {
    if (e && typeof e === 'object') {
      const fields = Object.values(e)
      for (const field of fields) {
        if (Array.isArray(field) && field.length > 0 && field[0]?.message) {
          throw new Error(field[0].message)
        }
      }
    }
    throw new Error(t('error.validation'))
  }

  const model = encode(activeModel.value, displayColumns.value, props.scenario)
  if (props.model) {
    // 主键通常不在 update/create 场景里，但更新仍需要它构建 URI。
    // props.schemas 必须是完整 schema 列表，不能只传按场景过滤后的子集。
    const pkSchema = props.schemas.find((s) => s.primary_key === 1)
    if (pkSchema && pkSchema.column in props.model) {
      model[pkSchema.column] = unwrapCellValue(props.model[pkSchema.column])
    }
  }
  return model
}

async function handleActionClick(action: ActionType, loading: any) {
  if (typeof action.callback === 'function') {
    try {
      const result = await submit()
      action.callback(result, displayColumns.value, loading)
    } catch (e) {
      console.error('Form submit failed:', e)
    }
  } else if (typeof action.asyncCallback === 'function') {
    loading.value = true
    try {
      await action.asyncCallback(await submit(), displayColumns.value)
    } catch (e) {
      // 校验失败和接口 rejection 都会走到这里；不 catch 会产生 unhandled rejection。
      console.error('Form submit failed:', e)
    } finally {
      loading.value = false
    }
  }
}

/**
 * 供外部（例如移除筛选 chip 后）复用表单的提交 + action 执行链路：
 * submit() 只负责校验和 encode，不会触发 action，单独调用不会发起搜索。
 */
async function runAction(action: ActionType) {
  const loading = ref(false)
  await handleActionClick(action, loading)
}

defineExpose({ submit, runAction })
</script>
