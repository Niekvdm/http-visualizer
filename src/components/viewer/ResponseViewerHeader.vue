<script setup lang="ts">
import { computed } from 'vue'
import type { ExecutionResponse } from '@/types/execution'
import { formatBytes, formatDuration, getStatusColor } from '@/utils/formatters'
import { ChevronDown } from 'lucide-vue-next'

export type ViewTab = 'request' | 'response' | 'headers' | 'timing'

const props = defineProps<{
  activeTab: ViewTab
  isCollapsed: boolean
  response?: ExecutionResponse
  hasSentRequest: boolean
  hasResponse: boolean
  redirectCount: number
  protocol?: string
  fromCache?: boolean
}>()

const emit = defineEmits<{
  'update:activeTab': [tab: ViewTab]
  'update:isCollapsed': [collapsed: boolean]
}>()

const statusClass = computed(() => {
  if (!props.response) return ''
  return getStatusColor(props.response.status)
})

const responseTabs: ViewTab[] = ['response', 'headers', 'timing']

function isTabDisabled(tab: ViewTab): boolean {
  if (!props.hasResponse) return true
  return false
}

function handleTabClick(tab: ViewTab) {
  if (isTabDisabled(tab)) return
  emit('update:activeTab', tab)
}

function handleRequestTabClick() {
  if (!props.hasSentRequest) return
  emit('update:activeTab', 'request')
}

function toggleCollapse() {
  emit('update:isCollapsed', !props.isCollapsed)
}
</script>

<template>
  <div
    class="flex items-center justify-between px-4 py-2 border-b border-[var(--color-border)] bg-[var(--color-bg-tertiary)] hover:bg-[var(--color-bg)] cursor-pointer"
    @click="toggleCollapse"
  >
    <div class="flex items-center gap-4">
      <!-- Collapse toggle -->
      <button
        class="text-[var(--color-text-dim)] hover:text-[var(--color-text)] transition-transform duration-200"
        :class="{ '-rotate-90': isCollapsed }"
      >
        <ChevronDown class="w-4 h-4" />
      </button>

      <!-- Tabs -->
      <div class="flex gap-1" @click.stop>
        <!-- Request tab -->
        <button
          class="px-3 py-1 text-xs font-mono uppercase tracking-wider rounded transition-colors"
          :class="[
            activeTab === 'request'
              ? 'bg-[var(--color-secondary)] text-[var(--color-bg)]'
              : 'text-[var(--color-text-dim)] hover:text-[var(--color-text)] hover:bg-[var(--color-bg)]',
            !hasSentRequest ? 'opacity-50 cursor-not-allowed' : ''
          ]"
          :disabled="!hasSentRequest"
          @click="handleRequestTabClick"
        >
          request
        </button>

        <!-- Response tabs -->
        <button
          v-for="tab in responseTabs"
          :key="tab"
          class="px-3 py-1 text-xs font-mono uppercase tracking-wider rounded transition-colors"
          :class="[
            activeTab === tab
              ? 'bg-[var(--color-primary)] text-[var(--color-bg)]'
              : 'text-[var(--color-text-dim)] hover:text-[var(--color-text)] hover:bg-[var(--color-bg)]',
            isTabDisabled(tab) ? 'opacity-50 cursor-not-allowed' : ''
          ]"
          :disabled="isTabDisabled(tab)"
          @click="handleTabClick(tab)"
        >
          {{ tab }}
        </button>
      </div>
    </div>

    <!-- Response info -->
    <div v-if="hasResponse && response" class="flex items-center gap-3 text-xs font-mono">
      <span :class="statusClass" class="font-bold">
        {{ response.status }} {{ response.statusText }}
      </span>
      <!-- Protocol badge -->
      <span
        v-if="protocol"
        class="px-1.5 py-0.5 rounded text-[10px]"
        :class="protocol === 'HTTP/2' ? 'bg-green-500/20 text-green-400' : 'bg-[var(--color-bg)] text-[var(--color-text-dim)]'"
      >
        {{ protocol }}
      </span>
      <!-- Cache badge -->
      <span
        v-if="fromCache"
        class="px-1.5 py-0.5 rounded text-[10px] bg-blue-500/20 text-blue-400"
      >
        cached
      </span>
      <!-- Redirects badge -->
      <span
        v-if="redirectCount > 0"
        class="px-1.5 py-0.5 rounded text-[10px] bg-orange-500/20 text-orange-400"
      >
        {{ redirectCount }} redirect{{ redirectCount > 1 ? 's' : '' }}
      </span>
      <span class="text-[var(--color-text-dim)]">
        {{ formatBytes(response.size || 0) }}
      </span>
      <span class="text-[var(--color-text-dim)]">
        {{ formatDuration(response.timing.total || 0) }}
      </span>
    </div>
  </div>
</template>
