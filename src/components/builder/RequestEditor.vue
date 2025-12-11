<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import type { HttpMethod, HttpHeader, HttpAuth, CollectionRequest } from '@/types'
import { useCollectionStore } from '@/stores/collectionStore'
import HeadersEditor from './HeadersEditor.vue'
import BodyEditor from './BodyEditor.vue'
import AuthTab from './AuthTab.vue'
import VariablesTab from './VariablesTab.vue'
import VariableUrlInput from './VariableUrlInput.vue'
import { X, Save, Play, Copy, Trash2, AlertTriangle } from 'lucide-vue-next'

const props = defineProps<{
  requestId: string
  collectionId: string
}>()

const emit = defineEmits<{
  close: []
  run: []
  saved: []
}>()

const collectionStore = useCollectionStore()

// Get the request from the store
const request = computed(() => {
  const collection = collectionStore.collections.find(c => c.id === props.collectionId)
  return collection?.requests.find(r => r.id === props.requestId)
})

// Get folder ID from request
const folderId = computed(() => request.value?.folderId)

// Local editable state
const name = ref('')
const method = ref<HttpMethod>('GET')
const url = ref('')
const headers = ref<HttpHeader[]>([])
const body = ref<string | undefined>(undefined)
const bodyType = ref<CollectionRequest['bodyType']>(undefined)
const auth = ref<HttpAuth | undefined>(undefined)

// Active tab
const activeTab = ref<'headers' | 'body' | 'auth' | 'variables'>('headers')

// URL validation state
const urlTouched = ref(false)

// Methods
const methods: HttpMethod[] = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS']

// Initialize from request
watch(
  () => props.requestId,
  () => {
    if (request.value) {
      name.value = request.value.name
      method.value = request.value.method
      url.value = request.value.url
      headers.value = [...(request.value.headers || [])]
      body.value = request.value.body
      bodyType.value = request.value.bodyType
      auth.value = request.value.auth ? JSON.parse(JSON.stringify(request.value.auth)) : undefined
      urlTouched.value = false
    }
  },
  { immediate: true }
)

// Track if there are unsaved changes
const hasChanges = computed(() => {
  if (!request.value) return false
  return (
    name.value !== request.value.name ||
    method.value !== request.value.method ||
    url.value !== request.value.url ||
    JSON.stringify(headers.value) !== JSON.stringify(request.value.headers || []) ||
    body.value !== request.value.body ||
    bodyType.value !== request.value.bodyType ||
    JSON.stringify(auth.value) !== JSON.stringify(request.value.auth)
  )
})

// URL validation
const urlValidation = computed(() => {
  if (!url.value || !urlTouched.value) return { valid: true, message: '' }
  
  // Replace variables with placeholder to validate structure
  const urlWithoutVars = url.value.replace(/\{\{[^}]+\}\}/g, 'placeholder')
  
  // Check if it's a valid URL structure
  try {
    // Allow relative URLs starting with /
    if (urlWithoutVars.startsWith('/')) {
      return { valid: true, message: '' }
    }
    
    // Check for protocol
    if (!urlWithoutVars.match(/^https?:\/\//i)) {
      return { valid: false, message: 'URL should start with http:// or https://' }
    }
    
    new URL(urlWithoutVars)
    return { valid: true, message: '' }
  } catch {
    return { valid: false, message: 'Invalid URL format' }
  }
})

// Count variables for badge (simple extraction)
const variableCount = computed(() => {
  const varRegex = /\{\{([^}]+)\}\}/g
  const vars = new Set<string>()
  
  // Check URL
  let match
  while ((match = varRegex.exec(url.value)) !== null) {
    vars.add(match[1].trim())
  }
  
  // Check headers
  for (const header of headers.value) {
    varRegex.lastIndex = 0
    while ((match = varRegex.exec(header.key + header.value)) !== null) {
      vars.add(match[1].trim())
    }
  }
  
  // Check body
  if (body.value) {
    varRegex.lastIndex = 0
    while ((match = varRegex.exec(body.value)) !== null) {
      vars.add(match[1].trim())
    }
  }
  
  return vars.size
})

// Get auth type label for badge (including inherited)
const authTypeLabel = computed(() => {
  const labels: Record<string, string> = {
    'basic': 'Basic',
    'bearer': 'Bearer',
    'api-key': 'API Key',
    'oauth2': 'OAuth2',
  }
  
  // Check own auth first
  if (auth.value && auth.value.type !== 'none') {
    return labels[auth.value.type] || null
  }
  
  // Check inherited from folder
  if (folderId.value) {
    const folderAuth = collectionStore.getFolderAuth(props.collectionId, folderId.value)
    if (folderAuth && folderAuth.type !== 'none') {
      return `↑ ${labels[folderAuth.type]}`
    }
  }
  
  return null
})

function save() {
  if (!request.value) return

  collectionStore.updateRequest(props.collectionId, props.requestId, {
    name: name.value,
    method: method.value,
    url: url.value,
    headers: headers.value,
    body: body.value,
    bodyType: bodyType.value,
    auth: auth.value,
  })

  emit('saved')
}

function run() {
  // Save first if there are changes
  if (hasChanges.value) {
    save()
  }
  emit('run')
}

function duplicate() {
  collectionStore.duplicateRequest(props.collectionId, props.requestId)
}

function deleteRequest() {
  if (confirm(`Delete request "${name.value}"?`)) {
    collectionStore.deleteRequest(props.collectionId, props.requestId)
    emit('close')
  }
}

function close() {
  if (hasChanges.value) {
    if (confirm('You have unsaved changes. Discard them?')) {
      emit('close')
    }
  } else {
    emit('close')
  }
}

function onUrlBlur() {
  urlTouched.value = true
}

function getMethodClass(m: HttpMethod): string {
  const colors: Record<HttpMethod, string> = {
    GET: 'text-green-400 bg-green-400/10',
    POST: 'text-blue-400 bg-blue-400/10',
    PUT: 'text-orange-400 bg-orange-400/10',
    PATCH: 'text-yellow-400 bg-yellow-400/10',
    DELETE: 'text-red-400 bg-red-400/10',
    HEAD: 'text-purple-400 bg-purple-400/10',
    OPTIONS: 'text-gray-400 bg-gray-400/10',
  }
  return colors[m] || 'text-gray-400 bg-gray-400/10'
}
</script>

<template>
  <div class="request-editor h-full flex flex-col bg-[var(--color-bg-secondary)]">
    <!-- Header -->
    <div class="flex items-center justify-between px-4 py-3 border-b border-[var(--color-border)] shrink-0">
      <div class="flex items-center gap-3 min-w-0 flex-1">
        <span 
          class="text-xs font-bold px-2 py-1 rounded font-mono shrink-0"
          :class="getMethodClass(method)"
        >
          {{ method }}
        </span>
        <input
          v-model="name"
          type="text"
          class="flex-1 min-w-0 px-2 py-1 text-sm bg-transparent border-b border-transparent hover:border-[var(--color-border)] focus:border-[var(--color-primary)] text-[var(--color-text)] outline-none truncate"
          placeholder="Request name"
        />
      </div>
      <div class="flex items-center gap-1 shrink-0">
        <button
          class="p-1.5 rounded hover:bg-[var(--color-bg-tertiary)] text-[var(--color-text-dim)] hover:text-[var(--color-text)]"
          title="Duplicate"
          @click="duplicate"
        >
          <Copy class="w-4 h-4" />
        </button>
        <button
          class="p-1.5 rounded hover:bg-[var(--color-error)]/20 text-[var(--color-text-dim)] hover:text-[var(--color-error)]"
          title="Delete"
          @click="deleteRequest"
        >
          <Trash2 class="w-4 h-4" />
        </button>
        <button
          class="p-1.5 rounded hover:bg-[var(--color-bg-tertiary)] text-[var(--color-text-dim)] hover:text-[var(--color-text)]"
          title="Close"
          @click="close"
        >
          <X class="w-4 h-4" />
        </button>
      </div>
    </div>

    <!-- URL bar -->
    <div class="px-4 py-3 border-b border-[var(--color-border)] shrink-0 space-y-1">
      <div class="flex items-center gap-2">
        <select
          v-model="method"
          class="px-2 py-2 text-sm bg-[var(--color-bg)] border border-[var(--color-border)] rounded outline-none focus:border-[var(--color-primary)] font-mono font-bold"
          :class="getMethodClass(method)"
        >
          <option v-for="m in methods" :key="m" :value="m">
            {{ m }}
          </option>
        </select>
        <div class="flex-1 relative">
          <VariableUrlInput
            v-model="url"
            :collection-id="collectionId"
            placeholder="https://api.example.com/endpoint"
            :invalid="!urlValidation.valid"
            @blur="onUrlBlur"
            @keydown.enter="run"
          />
          <AlertTriangle 
            v-if="!urlValidation.valid"
            class="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--color-warning)] pointer-events-none"
            :title="urlValidation.message"
          />
        </div>
        <button
          class="px-4 py-2 text-sm bg-[var(--color-primary)] text-[var(--color-bg)] rounded font-bold hover:brightness-110 flex items-center gap-1.5 shrink-0"
          @click="run"
        >
          <Play class="w-4 h-4" />
          Run
        </button>
      </div>
      <div v-if="!urlValidation.valid" class="text-[10px] text-[var(--color-warning)] pl-[88px]">
        {{ urlValidation.message }}
      </div>
    </div>

    <!-- Tabs -->
    <div class="flex border-b border-[var(--color-border)] shrink-0">
      <button
        class="px-4 py-2 text-xs font-mono uppercase tracking-wider transition-colors"
        :class="[
          activeTab === 'headers'
            ? 'text-[var(--color-primary)] border-b-2 border-[var(--color-primary)]'
            : 'text-[var(--color-text-dim)] hover:text-[var(--color-text)]'
        ]"
        @click="activeTab = 'headers'"
      >
        Headers
        <span 
          v-if="headers.filter(h => h.enabled).length > 0"
          class="ml-1 px-1.5 py-0.5 text-[10px] rounded-full bg-[var(--color-primary)]/20"
        >
          {{ headers.filter(h => h.enabled).length }}
        </span>
      </button>
      <button
        class="px-4 py-2 text-xs font-mono uppercase tracking-wider transition-colors"
        :class="[
          activeTab === 'body'
            ? 'text-[var(--color-primary)] border-b-2 border-[var(--color-primary)]'
            : 'text-[var(--color-text-dim)] hover:text-[var(--color-text)]'
        ]"
        @click="activeTab = 'body'"
      >
        Body
        <span 
          v-if="bodyType"
          class="ml-1 px-1.5 py-0.5 text-[10px] rounded-full bg-[var(--color-secondary)]/20 text-[var(--color-secondary)]"
        >
          {{ bodyType }}
        </span>
      </button>
      <button
        class="px-4 py-2 text-xs font-mono uppercase tracking-wider transition-colors"
        :class="[
          activeTab === 'auth'
            ? 'text-[var(--color-primary)] border-b-2 border-[var(--color-primary)]'
            : 'text-[var(--color-text-dim)] hover:text-[var(--color-text)]'
        ]"
        @click="activeTab = 'auth'"
      >
        Auth
        <span 
          v-if="authTypeLabel"
          class="ml-1 px-1.5 py-0.5 text-[10px] rounded-full bg-[var(--color-warning)]/20 text-[var(--color-warning)]"
        >
          {{ authTypeLabel }}
        </span>
      </button>
      <button
        class="px-4 py-2 text-xs font-mono uppercase tracking-wider transition-colors"
        :class="[
          activeTab === 'variables'
            ? 'text-[var(--color-primary)] border-b-2 border-[var(--color-primary)]'
            : 'text-[var(--color-text-dim)] hover:text-[var(--color-text)]'
        ]"
        @click="activeTab = 'variables'"
      >
        Variables
        <span 
          v-if="variableCount > 0"
          class="ml-1 px-1.5 py-0.5 text-[10px] rounded-full bg-[var(--color-text-dim)]/20"
        >
          {{ variableCount }}
        </span>
      </button>
    </div>

    <!-- Tab content -->
    <div class="flex-1 overflow-y-auto p-4">
      <HeadersEditor 
        v-if="activeTab === 'headers'"
        v-model:headers="headers"
      />
      <BodyEditor
        v-else-if="activeTab === 'body'"
        v-model:body="body"
        v-model:body-type="bodyType"
      />
      <AuthTab
        v-else-if="activeTab === 'auth'"
        v-model:auth="auth"
        :folder-id="folderId"
        :collection-id="collectionId"
        :request-id="requestId"
      />
      <VariablesTab
        v-else-if="activeTab === 'variables'"
        :url="url"
        :headers="headers"
        :body="body"
        :collection-id="collectionId"
      />
    </div>

    <!-- Footer -->
    <div class="flex items-center justify-between px-4 py-3 border-t border-[var(--color-border)] shrink-0">
      <div class="text-xs text-[var(--color-text-dim)]">
        <span v-if="hasChanges" class="text-[var(--color-warning)]">● Unsaved changes</span>
        <span v-else>No changes</span>
      </div>
      <div class="flex gap-2">
        <button
          class="px-3 py-1.5 text-xs bg-[var(--color-bg)] text-[var(--color-text-dim)] rounded hover:text-[var(--color-text)] transition-colors"
          @click="close"
        >
          Cancel
        </button>
        <button
          class="px-3 py-1.5 text-xs bg-[var(--color-primary)] text-[var(--color-bg)] rounded font-medium hover:brightness-110 disabled:opacity-50 flex items-center gap-1"
          :disabled="!hasChanges"
          @click="save"
        >
          <Save class="w-3.5 h-3.5" />
          Save
        </button>
      </div>
    </div>
  </div>
</template>
