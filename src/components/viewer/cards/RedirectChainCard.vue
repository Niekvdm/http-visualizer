<script setup lang="ts">
import type { RedirectHop } from '@/types/execution'
import { ArrowRight } from 'lucide-vue-next'
import SectionHeader from '../shared/SectionHeader.vue'

defineProps<{
  redirectChain: RedirectHop[]
  finalStatus: number
  finalUrl?: string
}>()

function getStatusClass(status: number): string {
  if (status === 301 || status === 308) return 'bg-yellow-500/20 text-yellow-400'
  if (status === 302 || status === 307) return 'bg-orange-500/20 text-orange-400'
  if (status === 303) return 'bg-blue-500/20 text-blue-400'
  return 'bg-gray-500/20 text-gray-400'
}
</script>

<template>
  <div v-if="redirectChain.length > 0" class="bg-[var(--color-bg-tertiary)] rounded-sm border border-[var(--color-border)]">
    <SectionHeader :icon="ArrowRight" title="Redirects" :badge="redirectChain.length" />
    <div class="p-2.5">
      <div class="space-y-1.5">
        <div
          v-for="(hop, index) in redirectChain"
          :key="index"
          class="flex items-center gap-2 text-xs"
        >
          <span
            class="px-1 py-0.5 rounded-sm text-[10px] font-bold shrink-0"
            :class="getStatusClass(hop.status)"
          >
            {{ hop.status }}
          </span>
          <code class="text-[var(--color-text)] break-all text-[10px] flex-1 min-w-0 truncate">
            {{ hop.url }}
          </code>
          <span class="text-[10px] text-[var(--color-text-dim)] shrink-0">
            {{ hop.duration.toFixed(0) }}ms
          </span>
        </div>
        <!-- Final destination -->
        <div class="flex items-center gap-2 text-xs pt-1.5 border-t border-[var(--color-border)]">
          <span class="px-1 py-0.5 rounded-sm text-[10px] font-bold bg-green-500/20 text-green-400 shrink-0">
            {{ finalStatus }}
          </span>
          <code class="text-[var(--color-primary)] break-all text-[10px] font-bold flex-1 min-w-0 truncate">
            {{ finalUrl || 'Final URL' }}
          </code>
        </div>
      </div>
    </div>
  </div>
</template>
