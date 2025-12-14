<script setup lang="ts">
import { ref } from 'vue'
import { Lock, Unlock } from 'lucide-vue-next'

const props = defineProps<{
  headers: [string, string][]
  keyColorClass?: string
  maskSensitive?: boolean
}>()

// Track which sensitive headers are revealed
const revealedHeaders = ref<Set<string>>(new Set())

// Sensitive header patterns to mask
const sensitivePatterns = ['authorization', 'x-api-key', 'api-key', 'secret', 'token', 'password']

function isSensitiveHeader(key: string): boolean {
  if (!props.maskSensitive) return false
  const lowerKey = key.toLowerCase()
  return sensitivePatterns.some(pattern => lowerKey.includes(pattern))
}

function maskSensitiveValue(value: string): string {
  if (value.length <= 20) {
    return value.substring(0, 4) + '••••••••'
  }
  return value.substring(0, 10) + '••••••••' + value.substring(value.length - 4)
}

function toggleRevealHeader(key: string) {
  if (revealedHeaders.value.has(key)) {
    revealedHeaders.value.delete(key)
  } else {
    revealedHeaders.value.add(key)
  }
}

function isHeaderRevealed(key: string): boolean {
  return revealedHeaders.value.has(key)
}
</script>

<template>
  <table v-if="headers.length > 0" class="w-full font-mono text-xs">
    <tbody>
      <tr
        v-for="[key, value] in headers"
        :key="key"
        class="hover:bg-[var(--color-bg-tertiary)]"
      >
        <td
          class="py-0.5 pr-3 whitespace-nowrap align-top"
          :class="keyColorClass || 'text-[var(--color-primary)]'"
        >
          {{ key }}
        </td>
        <td class="py-0.5 text-[var(--color-text)] break-all">
          <!-- Mask sensitive headers -->
          <template v-if="isSensitiveHeader(key)">
            <span :class="isHeaderRevealed(key) ? 'text-[var(--color-text)]' : 'text-[var(--color-warning)]'">
              {{ isHeaderRevealed(key) ? value : maskSensitiveValue(value) }}
            </span>
            <button
              class="ml-1.5 text-[10px] text-[var(--color-text-dim)] hover:text-[var(--color-text)]"
              :title="isHeaderRevealed(key) ? 'Hide value' : 'Reveal value'"
              @click="toggleRevealHeader(key)"
            >
              <component :is="isHeaderRevealed(key) ? Unlock : Lock" class="w-3 h-3 inline" />
            </button>
          </template>
          <template v-else>
            {{ value }}
          </template>
        </td>
      </tr>
    </tbody>
  </table>
  <div v-else class="text-[var(--color-text-dim)] text-center py-2 text-xs">
    No headers
  </div>
</template>
