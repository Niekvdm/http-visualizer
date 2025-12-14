<script setup lang="ts">
import { computed } from 'vue'
import type { SizeBreakdown } from '@/types/execution'
import { formatBytes } from '@/utils/formatters'
import { FileText } from 'lucide-vue-next'
import SectionHeader from '../shared/SectionHeader.vue'

const props = defineProps<{
  sizeBreakdown?: SizeBreakdown
  totalSize: number
  requestBodySize?: number
}>()

const hasBreakdown = computed(() => props.sizeBreakdown !== undefined)

const compressionSaved = computed(() => {
  if (!props.sizeBreakdown?.compressionRatio) return null
  return ((1 - props.sizeBreakdown.compressionRatio) * 100).toFixed(0)
})
</script>

<template>
  <div class="bg-[var(--color-bg-tertiary)] rounded-sm border border-[var(--color-border)]">
    <SectionHeader :icon="FileText" title="Size" />
    <div class="p-2.5">
      <template v-if="hasBreakdown && sizeBreakdown">
        <div class="grid grid-cols-2 gap-x-3 gap-y-1.5 text-xs">
          <div v-if="requestBodySize">
            <span class="text-[10px] text-[var(--color-text-dim)]">Req Body</span>
            <div class="font-mono text-[var(--color-secondary)]">{{ formatBytes(requestBodySize) }}</div>
          </div>
          <div>
            <span class="text-[10px] text-[var(--color-text-dim)]">Headers</span>
            <div class="font-mono text-[var(--color-text)]">{{ formatBytes(sizeBreakdown.headers) }}</div>
          </div>
          <div>
            <span class="text-[10px] text-[var(--color-text-dim)]">Body</span>
            <div class="font-mono text-[var(--color-text)]">{{ formatBytes(sizeBreakdown.body) }}</div>
          </div>
          <div>
            <span class="text-[10px] text-[var(--color-text-dim)]">Total</span>
            <div class="font-mono text-[var(--color-primary)] font-bold">{{ formatBytes(sizeBreakdown.total) }}</div>
          </div>
          <div v-if="sizeBreakdown.encoding && sizeBreakdown.encoding !== 'identity'" class="col-span-2">
            <span class="text-[10px] text-[var(--color-text-dim)]">Compression</span>
            <div class="flex items-center gap-1.5">
              <span class="font-mono text-green-400">{{ sizeBreakdown.encoding.toUpperCase() }}</span>
              <span v-if="compressionSaved" class="text-[10px] text-green-400">
                {{ compressionSaved }}% saved
              </span>
            </div>
          </div>
        </div>
      </template>
      <template v-else>
        <div class="text-center py-1">
          <div class="text-lg font-mono text-[var(--color-primary)] font-bold">
            {{ formatBytes(totalSize) }}
          </div>
          <div class="text-[10px] text-[var(--color-text-dim)]">Total size</div>
        </div>
      </template>
    </div>
  </div>
</template>
