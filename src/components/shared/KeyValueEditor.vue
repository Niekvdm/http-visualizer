<script setup lang="ts">
import { computed } from 'vue'
import { Plus, Trash2 } from 'lucide-vue-next'

export interface KeyValueItem {
  key: string
  value: string
  enabled: boolean
}

const props = withDefaults(defineProps<{
  /** The key-value items to edit */
  items: KeyValueItem[]
  /** Label for the key column */
  keyLabel?: string
  /** Label for the value column */
  valueLabel?: string
  /** Placeholder for key input */
  keyPlaceholder?: string
  /** Placeholder for value input */
  valuePlaceholder?: string
  /** Text for the add button */
  addButtonText?: string
  /** Empty state message */
  emptyMessage?: string
  /** Whether to show the enabled checkbox */
  showEnabled?: boolean
  /** Whether items are readonly */
  readonly?: boolean
}>(), {
  keyLabel: 'Key',
  valueLabel: 'Value',
  keyPlaceholder: 'Key',
  valuePlaceholder: 'Value',
  addButtonText: 'Add Item',
  emptyMessage: 'No items defined.',
  showEnabled: true,
  readonly: false,
})

const emit = defineEmits<{
  'update:items': [items: KeyValueItem[]]
}>()

const localItems = computed({
  get: () => props.items,
  set: (value) => emit('update:items', value),
})

function addItem() {
  localItems.value = [
    ...localItems.value,
    { key: '', value: '', enabled: true },
  ]
}

function removeItem(index: number) {
  const updated = [...localItems.value]
  updated.splice(index, 1)
  localItems.value = updated
}

function updateItem(index: number, field: keyof KeyValueItem, value: string | boolean) {
  const updated = [...localItems.value]
  updated[index] = { ...updated[index], [field]: value }
  localItems.value = updated
}

function toggleItem(index: number) {
  updateItem(index, 'enabled', !localItems.value[index].enabled)
}
</script>

<template>
  <div class="key-value-editor space-y-2">
    <!-- Header row labels -->
    <div class="flex items-center gap-2 text-[10px] text-[var(--color-text-dim)] uppercase tracking-wider px-1">
      <div v-if="showEnabled" class="w-6"></div>
      <div class="flex-1">{{ keyLabel }}</div>
      <div class="flex-1">{{ valueLabel }}</div>
      <div v-if="!readonly" class="w-8"></div>
    </div>

    <!-- Item rows -->
    <div 
      v-for="(item, index) in localItems" 
      :key="index"
      class="flex items-center gap-2 group"
    >
      <!-- Enable checkbox -->
      <input
        v-if="showEnabled"
        type="checkbox"
        :checked="item.enabled"
        :disabled="readonly"
        class="w-4 h-4 rounded border-[var(--color-border)] bg-[var(--color-bg)] accent-[var(--color-primary)] cursor-pointer disabled:cursor-not-allowed"
        @change="toggleItem(index)"
      />

      <!-- Key input -->
      <input
        :value="item.key"
        type="text"
        :placeholder="keyPlaceholder"
        :disabled="!item.enabled || readonly"
        class="flex-1 px-2 py-1.5 text-xs bg-[var(--color-bg)] border border-[var(--color-border)] rounded text-[var(--color-text)] outline-none focus:border-[var(--color-primary)] font-mono placeholder:text-[var(--color-text-dim)] disabled:opacity-50"
        @input="updateItem(index, 'key', ($event.target as HTMLInputElement).value)"
      />

      <!-- Value input -->
      <input
        :value="item.value"
        type="text"
        :placeholder="valuePlaceholder"
        :disabled="!item.enabled || readonly"
        class="flex-1 px-2 py-1.5 text-xs bg-[var(--color-bg)] border border-[var(--color-border)] rounded text-[var(--color-text)] outline-none focus:border-[var(--color-primary)] font-mono placeholder:text-[var(--color-text-dim)] disabled:opacity-50"
        @input="updateItem(index, 'value', ($event.target as HTMLInputElement).value)"
      />

      <!-- Remove button -->
      <button
        v-if="!readonly"
        class="p-1 rounded opacity-0 group-hover:opacity-100 hover:bg-[var(--color-error)]/20 text-[var(--color-text-dim)] hover:text-[var(--color-error)] transition-all"
        title="Remove"
        @click="removeItem(index)"
      >
        <Trash2 class="w-3.5 h-3.5" />
      </button>
    </div>

    <!-- Add button -->
    <button
      v-if="!readonly"
      class="flex items-center gap-1 px-2 py-1.5 text-xs text-[var(--color-text-dim)] hover:text-[var(--color-primary)] hover:bg-[var(--color-bg-tertiary)] rounded transition-colors"
      @click="addItem"
    >
      <Plus class="w-3.5 h-3.5" />
      {{ addButtonText }}
    </button>

    <!-- Empty state -->
    <div
      v-if="localItems.length === 0"
      class="text-center py-4 text-xs text-[var(--color-text-dim)]"
    >
      {{ emptyMessage }}
    </div>
  </div>
</template>

