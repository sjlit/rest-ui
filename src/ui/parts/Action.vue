<template>
  <template v-if="visible">
    <el-tooltip v-if="isComponentIcon" :content="action.label">
      <el-icon class="action-icon" @click="handleClick">
        <component :is="props.action.icon" />
      </el-icon>
    </el-tooltip>
    <el-button v-else :type="action.type || 'default'" :size="action.size || 'default'" :round="action.round"
      :loading="loading" @click="handleClick">
      {{ action.label }}
    </el-button>
  </template>
</template>

<script setup lang="ts">
import { ref, computed, watchEffect, inject } from 'vue'
import ElButton from 'element-plus/es/components/button/index.mjs'
import ElIcon from 'element-plus/es/components/icon/index.mjs'
import ElTooltip from 'element-plus/es/components/tooltip/index.mjs'
import type { Action as ActionType, Model } from '../../core/types'
import type { SchemaUIConfig } from '../../config'
import { GLOBAL_CONFIG_KEY } from '../../config'
import { isActionPermitted } from '../../core/actions'

interface Props {
  action: ActionType
  model?: Model
}

const props = defineProps<Props>()
const emit = defineEmits<{
  click: [action: ActionType, loading: ReturnType<typeof ref<boolean>>]
}>()

const globalConfig = inject<SchemaUIConfig | null>(GLOBAL_CONFIG_KEY, null)
const loading = ref(false)
const visible = ref(true)
let checkSeq = 0

const isComponentIcon = computed(() => props.action.icon !== undefined && props.action.icon !== null && typeof props.action.icon !== 'string')

watchEffect(() => {
  const seq = ++checkSeq
  if (!isActionPermitted(props.action, globalConfig)) {
    visible.value = false
    return
  }

  const hidden = props.action.hidden
  if (hidden === undefined || hidden === null || hidden === false) {
    visible.value = true
    return
  }
  if (hidden === true) {
    visible.value = false
    return
  }
  if (typeof hidden === 'function') {
    // 异步判断完成前先隐藏（fail-closed），避免按钮闪现后消失。
    visible.value = false
    try {
      const result = hidden(props.model || {})
      if (result instanceof Promise) {
        result
          .then((isHidden) => {
            if (seq === checkSeq) visible.value = !isHidden
          })
          .catch((err) => {
            console.error('Action hidden check failed:', err)
            if (seq === checkSeq) visible.value = false
          })
      } else {
        visible.value = !result
      }
    } catch (err) {
      console.error('Action hidden check failed:', err)
      visible.value = false
    }
  }
})

function handleClick() {
  if (!visible.value) return
  emit('click', props.action, loading)
}
</script>
