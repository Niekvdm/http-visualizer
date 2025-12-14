<script setup lang="ts">
import { computed } from 'vue'
import type { ResponseTiming } from '@/types/execution'
import { Clock } from 'lucide-vue-next'
import SectionHeader from '../shared/SectionHeader.vue'
import TimingBar from '../shared/TimingBar.vue'

const props = defineProps<{
  timing: ResponseTiming
}>()

const hasDetailedTiming = computed(() => {
  const t = props.timing
  return t.dns !== undefined || t.tcp !== undefined || t.tls !== undefined ||
         t.ttfb !== undefined || t.download !== undefined || t.blocked !== undefined
})

const timingMetrics = computed(() => {
  const t = props.timing
  const metrics = []

  if (t.blocked !== undefined && t.blocked > 0) {
    metrics.push({ label: 'Blocked', value: t.blocked, color: 'bg-gray-500/80' })
  }
  if (t.dns !== undefined) {
    metrics.push({ label: 'DNS', value: t.dns, color: 'bg-green-500/80' })
  }
  if (t.tcp !== undefined) {
    metrics.push({ label: 'TCP', value: t.tcp, color: 'bg-blue-500/80' })
  }
  if (t.tls !== undefined && t.tls > 0) {
    metrics.push({ label: 'TLS', value: t.tls, color: 'bg-purple-500/80' })
  }
  if (t.ttfb !== undefined) {
    metrics.push({ label: 'TTFB', value: t.ttfb, color: 'bg-orange-500/80' })
  }
  if (t.download !== undefined) {
    metrics.push({ label: 'Download', value: t.download, color: 'bg-cyan-500/80' })
  }

  return metrics
})
</script>

<template>
  <div class="bg-[var(--color-bg-tertiary)] rounded-sm border border-[var(--color-border)]">
    <SectionHeader :icon="Clock" title="Timing Breakdown" />
    <div class="p-2.5">
      <template v-if="hasDetailedTiming">
        <div class="space-y-1.5">
          <TimingBar
            v-for="metric in timingMetrics"
            :key="metric.label"
            :label="metric.label"
            :value="metric.value"
            :total="timing.total"
            :color="metric.color"
          />
          <!-- Total -->
          <div class="flex items-center gap-2 pt-1.5 mt-1 border-t border-[var(--color-border)]">
            <span class="w-16 text-[10px] text-[var(--color-primary)] font-mono font-bold">TOTAL</span>
            <div class="flex-1" />
            <span class="w-12 text-right text-xs text-[var(--color-primary)] font-mono font-bold">
              {{ timing.total.toFixed(0) }}ms
            </span>
          </div>
        </div>
      </template>
      <template v-else>
        <div class="text-center py-2">
          <div class="text-xl font-mono text-[var(--color-primary)] font-bold">
            {{ timing.total.toFixed(0) }}ms
          </div>
          <div class="text-[10px] text-[var(--color-text-dim)] mt-0.5">Total request time</div>
          <div class="text-[10px] text-[var(--color-text-dim)] mt-1">
            Detailed timing not available
          </div>
        </div>
      </template>
    </div>
  </div>
</template>
