<script setup lang="ts">
import { computed } from 'vue'
import { Table } from 'lucide-vue-next'

const props = defineProps<{
  data: unknown
}>()

interface TableData {
  headers: string[]
  rows: unknown[][]
}

const tableData = computed((): TableData | null => {
  if (!props.data) return null

  // Handle array of objects
  if (Array.isArray(props.data) && props.data.length > 0) {
    const firstItem = props.data[0]
    
    if (typeof firstItem === 'object' && firstItem !== null) {
      const headers = Object.keys(firstItem)
      const rows = props.data.map(item => 
        headers.map(h => (item as Record<string, unknown>)[h])
      )
      return { headers, rows }
    }
    
    // Array of primitives
    return {
      headers: ['Value'],
      rows: props.data.map(v => [v])
    }
  }

  // Handle single object
  if (typeof props.data === 'object' && props.data !== null && !Array.isArray(props.data)) {
    const entries = Object.entries(props.data)
    return {
      headers: ['Key', 'Value'],
      rows: entries.map(([k, v]) => [k, v])
    }
  }

  return null
})

function formatCell(value: unknown): string {
  if (value === null) return 'null'
  if (value === undefined) return 'undefined'
  if (typeof value === 'object') return JSON.stringify(value)
  return String(value)
}

function getCellClass(value: unknown): string {
  if (value === null || value === undefined) return 'text-[var(--color-text-dim)]'
  if (typeof value === 'number') return 'text-[var(--color-warning)]'
  if (typeof value === 'boolean') return 'text-[var(--color-primary)]'
  if (typeof value === 'string') return 'text-[var(--color-secondary)]'
  return 'text-[var(--color-text)]'
}
</script>

<template>
  <div class="h-full overflow-auto p-4">
    <template v-if="tableData">
      <table class="w-full border-collapse font-mono text-sm">
        <thead>
          <tr>
            <th 
              v-for="header in tableData.headers" 
              :key="header"
              class="text-left p-2 border-b-2 border-[var(--color-border)] text-[var(--color-primary)] font-bold uppercase text-xs tracking-wider"
            >
              {{ header }}
            </th>
          </tr>
        </thead>
        <tbody>
          <tr 
            v-for="(row, i) in tableData.rows" 
            :key="i"
            class="hover:bg-[var(--color-bg-tertiary)] transition-colors"
          >
            <td 
              v-for="(cell, j) in row" 
              :key="j"
              class="p-2 border-b border-[var(--color-border)]"
              :class="getCellClass(cell)"
            >
              {{ formatCell(cell) }}
            </td>
          </tr>
        </tbody>
      </table>
      
      <div class="mt-4 text-xs text-[var(--color-text-dim)]">
        {{ tableData.rows.length }} row(s)
      </div>
    </template>
    
    <template v-else>
      <div class="flex items-center justify-center h-full text-[var(--color-text-dim)]">
        <div class="text-center">
          <Table class="w-6 h-6 mx-auto mb-2" />
          <div>Data cannot be displayed as a table</div>
          <div class="text-xs mt-1">Try JSON or Raw view instead</div>
        </div>
      </div>
    </template>
  </div>
</template>

