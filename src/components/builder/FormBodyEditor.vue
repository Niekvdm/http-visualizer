<script lang="ts">
// Serialize fields to URL-encoded string
export function serializeToUrlEncoded(fields: FormField[]): string {
  return fields
    .filter(f => f.enabled && f.key)
    .map(f => `${encodeURIComponent(f.key)}=${encodeURIComponent(f.value)}`)
    .join('&')
}

// Parse URL-encoded string to fields
export function parseUrlEncoded(body: string): FormField[] {
  if (!body || !body.trim()) return []
  
  return body.split('&').map(pair => {
    const [key, ...valueParts] = pair.split('=')
    const value = valueParts.join('=') // Handle values with = in them
    return {
      key: decodeURIComponent(key || ''),
      value: decodeURIComponent(value || ''),
      enabled: true
    }
  }).filter(f => f.key || f.value)
}
</script>
<script setup lang="ts">
import { computed } from 'vue'
import { Plus, Trash2 } from 'lucide-vue-next'

export interface FormField {
  key: string
  value: string
  enabled: boolean
}

const props = defineProps<{
  fields: FormField[]
  bodyType: 'form' | 'multipart'
}>()

const emit = defineEmits<{
  'update:fields': [fields: FormField[]]
}>()

const localFields = computed({
  get: () => props.fields,
  set: (value) => emit('update:fields', value)
})

function addField() {
  localFields.value = [
    ...localFields.value,
    { key: '', value: '', enabled: true }
  ]
}

function removeField(index: number) {
  const updated = [...localFields.value]
  updated.splice(index, 1)
  localFields.value = updated
}

function updateField(index: number, field: keyof FormField, value: string | boolean) {
  const updated = [...localFields.value]
  updated[index] = { ...updated[index], [field]: value }
  localFields.value = updated
}

function toggleField(index: number) {
  updateField(index, 'enabled', !localFields.value[index].enabled)
}
</script>

<template>
  <div class="form-body-editor space-y-2">
    <!-- Header row labels -->
    <div class="flex items-center gap-2 text-[10px] text-[var(--color-text-dim)] uppercase tracking-wider px-1">
      <div class="w-6"></div>
      <div class="flex-1">Key</div>
      <div class="flex-1">Value</div>
      <div class="w-8"></div>
    </div>

    <!-- Field rows -->
    <div 
      v-for="(field, index) in localFields" 
      :key="index"
      class="flex items-center gap-2 group"
    >
      <!-- Enable checkbox -->
      <input
        type="checkbox"
        :checked="field.enabled"
        class="w-4 h-4 rounded border-[var(--color-border)] bg-[var(--color-bg)] accent-[var(--color-primary)] cursor-pointer"
        @change="toggleField(index)"
      />

      <!-- Key input -->
      <input
        :value="field.key"
        type="text"
        placeholder="Field name"
        class="flex-1 px-2 py-1.5 text-xs bg-[var(--color-bg)] border border-[var(--color-border)] rounded text-[var(--color-text)] outline-none focus:border-[var(--color-primary)] font-mono placeholder:text-[var(--color-text-dim)] disabled:opacity-50"
        :disabled="!field.enabled"
        @input="updateField(index, 'key', ($event.target as HTMLInputElement).value)"
      />

      <!-- Value input -->
      <input
        :value="field.value"
        type="text"
        placeholder="Value"
        class="flex-1 px-2 py-1.5 text-xs bg-[var(--color-bg)] border border-[var(--color-border)] rounded text-[var(--color-text)] outline-none focus:border-[var(--color-primary)] font-mono placeholder:text-[var(--color-text-dim)] disabled:opacity-50"
        :disabled="!field.enabled"
        @input="updateField(index, 'value', ($event.target as HTMLInputElement).value)"
      />

      <!-- Remove button -->
      <button
        class="p-1 rounded opacity-0 group-hover:opacity-100 hover:bg-[var(--color-error)]/20 text-[var(--color-text-dim)] hover:text-[var(--color-error)] transition-all"
        title="Remove field"
        @click="removeField(index)"
      >
        <Trash2 class="w-3.5 h-3.5" />
      </button>
    </div>

    <!-- Add field button -->
    <button
      class="flex items-center gap-1 px-2 py-1.5 text-xs text-[var(--color-text-dim)] hover:text-[var(--color-primary)] hover:bg-[var(--color-bg-tertiary)] rounded transition-colors"
      @click="addField"
    >
      <Plus class="w-3.5 h-3.5" />
      Add Field
    </button>

    <!-- Empty state -->
    <div
      v-if="localFields.length === 0"
      class="text-center py-4 text-xs text-[var(--color-text-dim)]"
    >
      No form fields defined. Click "Add Field" to add one.
    </div>

    <!-- Info text -->
    <div class="text-[10px] text-[var(--color-text-dim)] pt-2 border-t border-[var(--color-border)]">
      <template v-if="bodyType === 'form'">
        Content-Type: application/x-www-form-urlencoded
      </template>
      <template v-else>
        Content-Type: multipart/form-data
      </template>
    </div>
  </div>
</template>

