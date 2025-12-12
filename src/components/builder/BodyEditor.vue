<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import type { CollectionRequest } from '@/types'
import FormBodyEditor, { type FormField, parseUrlEncoded, serializeToUrlEncoded } from './FormBodyEditor.vue'

type BodyType = CollectionRequest['bodyType']

const props = defineProps<{
  body?: string
  bodyType?: BodyType
}>()

const emit = defineEmits<{
  'update:body': [body: string | undefined]
  'update:bodyType': [bodyType: BodyType]
}>()

const bodyTypes: { value: BodyType; label: string }[] = [
  { value: undefined, label: 'None' },
  { value: 'json', label: 'JSON' },
  { value: 'text', label: 'Text' },
  { value: 'form', label: 'Form URL Encoded' },
  { value: 'multipart', label: 'Multipart Form' },
  { value: 'graphql', label: 'GraphQL' },
]

const localBodyType = computed({
  get: () => props.bodyType,
  set: (value) => emit('update:bodyType', value)
})

const localBody = computed({
  get: () => props.body || '',
  set: (value) => emit('update:body', value || undefined)
})

// Form fields for form/multipart body types
const formFields = ref<FormField[]>([])

// Check if current body type is a form type
const isFormType = computed(() => 
  localBodyType.value === 'form' || localBodyType.value === 'multipart'
)

// Parse body string to form fields when switching to form type
watch([() => props.body, () => props.bodyType], ([newBody, newType]) => {
  if (newType === 'form' || newType === 'multipart') {
    formFields.value = parseUrlEncoded(newBody || '')
  }
}, { immediate: true })

// Update body string when form fields change
function onFormFieldsUpdate(fields: FormField[]) {
  formFields.value = fields
  localBody.value = serializeToUrlEncoded(fields)
}

// Format JSON on blur
function formatJson() {
  if (localBodyType.value === 'json' && localBody.value) {
    try {
      const parsed = JSON.parse(localBody.value)
      localBody.value = JSON.stringify(parsed, null, 2)
    } catch {
      // Invalid JSON, leave as is
    }
  }
}

// Get placeholder text based on body type
const placeholder = computed(() => {
  switch (localBodyType.value) {
    case 'json':
      return '{\n  "key": "value"\n}'
    case 'text':
      return 'Plain text content...'
    case 'graphql':
      return 'query {\n  users {\n    id\n    name\n  }\n}'
    default:
      return ''
  }
})

// Line count for textarea
const lineCount = computed(() => {
  return (localBody.value.match(/\n/g) || []).length + 1
})
</script>

<template>
  <div class="body-editor space-y-3">
    <!-- Body type selector -->
    <div class="flex items-center gap-2">
      <label class="text-xs text-[var(--color-text-dim)]">Body Type:</label>
      <div class="flex gap-1 flex-wrap">
        <button
          v-for="type in bodyTypes"
          :key="type.value || 'none'"
          class="px-2 py-1 text-xs font-mono uppercase rounded transition-colors"
          :class="[
            localBodyType === type.value
              ? 'bg-[var(--color-primary)] text-[var(--color-bg)]'
              : 'bg-[var(--color-bg)] text-[var(--color-text-dim)] hover:text-[var(--color-text)]'
          ]"
          @click="localBodyType = type.value"
        >
          {{ type.label }}
        </button>
      </div>
    </div>

    <!-- Form body editor for form/multipart types -->
    <FormBodyEditor
      v-if="isFormType"
      :fields="formFields"
      :body-type="localBodyType as 'form' | 'multipart'"
      @update:fields="onFormFieldsUpdate"
    />

    <!-- Textarea body content for other types -->
    <div v-else-if="localBodyType" class="relative">
      <!-- Line numbers -->
      <div 
        class="absolute left-0 top-0 bottom-0 w-8 bg-[var(--color-bg-tertiary)] border-r border-[var(--color-border)] text-right pr-2 pt-2 text-xs text-[var(--color-text-dim)] font-mono select-none overflow-hidden"
      >
        <div v-for="n in Math.max(lineCount, 10)" :key="n" class="leading-[1.5]">
          {{ n }}
        </div>
      </div>

      <!-- Textarea -->
      <textarea
        v-model="localBody"
        :placeholder="placeholder"
        class="w-full min-h-[200px] pl-10 pr-3 py-2 text-xs bg-[var(--color-bg)] border border-[var(--color-border)] rounded text-[var(--color-text)] outline-none focus:border-[var(--color-primary)] font-mono placeholder:text-[var(--color-text-dim)] resize-y leading-[1.5]"
        spellcheck="false"
        @blur="formatJson"
      />
    </div>

    <!-- No body message -->
    <div
      v-else
      class="text-center py-8 text-xs text-[var(--color-text-dim)] bg-[var(--color-bg)] rounded border border-dashed border-[var(--color-border)]"
    >
      Select a body type to add request body content
    </div>
  </div>
</template>
