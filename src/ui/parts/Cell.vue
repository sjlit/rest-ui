<template>
  <template v-if="tagVisible">
    <span class="schema-cell-tag" :style="{ color: textColor, backgroundColor: bgColor }">
      {{ displayValue }}
    </span>
  </template>
  <template v-else-if="schema.format === 'boolean' || schema.format === 'bool'">
    <el-tag round :type="isTrue ? 'success' : 'danger'">
      {{ isTrue ? t('boolean.true') : t('boolean.false') }}
    </el-tag>
  </template>
  <template v-else>
    <span class="schema-cell">{{ displayValue }}</span>
  </template>
</template>

<script setup lang="ts">
import { computed, inject } from 'vue'
import ElTag from 'element-plus/es/components/tag/index.mjs'
import type { Model, Schema } from '../../core/types'
import type { SchemaUIConfig } from '../../config'
import { GLOBAL_CONFIG_KEY } from '../../config'
import { createDefaultTranslator } from '../../core/i18n'
import '../../styles/cell.scss'

interface Props {
  model: Model
  schema: Schema
}

const props = defineProps<Props>()

// 与 SchemaPage / SchemaForm 一致:叶子组件也要 inject GLOBAL_CONFIG_KEY,
// 否则 SchemaUIPlugin 配置的 i18n 永远拿不到,boolean 标签 / tag 文案
// 停留默认中文兜底。
const globalConfig = inject<SchemaUIConfig | null>(GLOBAL_CONFIG_KEY, null)
const t = (key: string, ...args: any[]) => {
  const fn = globalConfig?.i18n?.t || createDefaultTranslator()
  return fn(key, ...args)
}

const rawValue = computed(() => {
  const val = props.model[props.schema.column]
  if (val === null || val === undefined) return ''
  // multiSelect / cascader 等 format 走到这里时,后端已通过 codec.decode 把字段
  // 解成对象数组,每项形如 { label, value }。typeof [] === 'object' 且数组没有
  // .label/.value,直接走下面对象分支会被错误地退化成空串,导致整列渲染空白。
  // 先按数组分支把各项 label 拼成逗号串,再走 default 分支输出。
  if (Array.isArray(val)) {
    return val
      .map((item) => (item && item.label) || String(item?.value ?? ''))
      .filter((s) => s !== '')
      .join(', ')
  }
  if (typeof val === 'object') {
    return val.label || val.value || ''
  }
  return val
})

function formatValueByFormat(value: any, format: string): string {
  if (value === null || value === undefined || value === '') return ''

  switch (format) {
    case 'date': {
      if (typeof value === 'string') {
        const match = value.match(/^(\d{4}-\d{2}-\d{2})/)
        if (match) return match[1]
      }
      if (typeof value === 'number') {
        const ts = value < 1e12 ? value * 1000 : value
        const d = new Date(ts)
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
      }
      return String(value)
    }
    case 'time': {
      if (typeof value === 'string') {
        const match = value.match(/(\d{2}:\d{2}:\d{2})/)
        if (match) return match[1]
      }
      if (typeof value === 'number') {
        const ts = value < 1e12 ? value * 1000 : value
        const d = new Date(ts)
        return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}:${String(d.getSeconds()).padStart(2, '0')}`
      }
      return String(value)
    }
    case 'datetime':
    case 'timestamp': {
      if (typeof value === 'string') {
        const match = value.match(/^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2}:\d{2})/)
        if (match) return `${match[1]} ${match[2]}`
      }
      if (typeof value === 'number') {
        const ts = value < 1e12 ? value * 1000 : value
        const d = new Date(ts)
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}:${String(d.getSeconds()).padStart(2, '0')}`
      }
      return String(value)
    }
    case 'percentage': {
      const n = Number(value)
      if (isNaN(n)) return String(value)
      if (n <= 1) return `${(n * 100).toFixed(2)}%`
      return `${n.toFixed(2)}%`
    }
    case 'duration': {
      const n = Number(value)
      if (isNaN(n)) return String(value)
      const hour = Math.floor(n / 3600)
      const minVal = Math.floor((n - hour * 3600) / 60)
      const sec = n - hour * 3600 - minVal * 60
      return `${String(hour).padStart(2, '0')}:${String(minVal).padStart(2, '0')}:${String(sec).padStart(2, '0')}`
    }
    default:
      return String(value)
  }
}

const displayValue = computed(() => {
  const values = props.schema.attributes.values
  if (Array.isArray(values) && values.length > 0) {
    const found = values.find((v) => v.value === String(rawValue.value))
    if (found) return found.label
  }
  return formatValueByFormat(rawValue.value, props.schema.format)
})

const isTrue = computed(() => {
  const val = props.model[props.schema.column]
  return !!val
})

const tagVisible = computed(() => {
  if (props.schema.format !== 'dropdown') return false
  const values = props.schema.attributes.values
  if (!Array.isArray(values)) return false
  return values.length > 0 && values.every((v) => !!v.color)
})

const textColor = computed(() => {
  const val = rawValue.value
  const found = props.schema.attributes.values?.find((v) => v.value === String(val))
  return found?.color || ''
})

const bgColor = computed(() => {
  const val = rawValue.value
  const found = props.schema.attributes.values?.find((v) => v.value === String(val))
  if (!found?.color) return ''
  return found.color + '1A'
})
</script>
