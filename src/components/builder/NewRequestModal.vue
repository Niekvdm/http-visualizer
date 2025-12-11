<script setup lang="ts">
import { ref } from 'vue'
import type { HttpMethod } from '@/types'
import { useCollectionStore } from '@/stores/collectionStore'
import { X } from 'lucide-vue-next'

const props = defineProps<{
  collectionId: string
  folderId?: string
}>()

const emit = defineEmits<{
  close: []
}>()

const collectionStore = useCollectionStore()

const name = ref('')
const method = ref<HttpMethod>('GET')
const url = ref('')

const methods: HttpMethod[] = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS']

function createRequest() {
  if (!name.value.trim() || !url.value.trim()) return

  collectionStore.createRequest(props.collectionId, {
    name: name.value.trim(),
    method: method.value,
    url: url.value.trim(),
    folderId: props.folderId,
  })

  emit('close')
}

function close() {
  emit('close')
}

function getMethodClass(m: HttpMethod): string {
  const colors: Record<HttpMethod, string> = {
    GET: 'text-green-400',
    POST: 'text-blue-400',
    PUT: 'text-orange-400',
    PATCH: 'text-yellow-400',
    DELETE: 'text-red-400',
    HEAD: 'text-purple-400',
    OPTIONS: 'text-gray-400',
  }
  return colors[m] || 'text-gray-400'
}
</script>

<template>
  <Teleport to="body">
    <div class="fixed inset-0 z-[100] flex items-center justify-center">
      <!-- Backdrop -->
      <div 
        class="absolute inset-0 bg-black/60 backdrop-blur-sm"
        @click="close"
      />

      <!-- Modal -->
      <div class="relative w-full max-w-md mx-4 bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded-lg shadow-2xl">
        <!-- Header -->
        <div class="flex items-center justify-between px-4 py-3 border-b border-[var(--color-border)]">
          <h2 class="text-sm font-mono uppercase tracking-wider text-[var(--color-text)]">
            New Request
          </h2>
          <button
            class="p-1 rounded hover:bg-[var(--color-bg-tertiary)] text-[var(--color-text-dim)] hover:text-[var(--color-text)]"
            @click="close"
          >
            <X class="w-4 h-4" />
          </button>
        </div>

        <!-- Body -->
        <div class="p-4 space-y-4">
          <!-- Name -->
          <div>
            <label class="block text-xs text-[var(--color-text-dim)] mb-1">Name</label>
            <input
              v-model="name"
              type="text"
              placeholder="My Request"
              class="w-full px-3 py-2 text-sm bg-[var(--color-bg)] border border-[var(--color-border)] rounded text-[var(--color-text)] outline-none focus:border-[var(--color-primary)] placeholder:text-[var(--color-text-dim)]"
              autofocus
              @keydown.enter="createRequest"
            />
          </div>

          <!-- Method + URL -->
          <div>
            <label class="block text-xs text-[var(--color-text-dim)] mb-1">Method & URL</label>
            <div class="flex gap-2">
              <select
                v-model="method"
                class="px-2 py-2 text-sm bg-[var(--color-bg)] border border-[var(--color-border)] rounded text-[var(--color-text)] outline-none focus:border-[var(--color-primary)] font-mono"
                :class="getMethodClass(method)"
              >
                <option v-for="m in methods" :key="m" :value="m" :class="getMethodClass(m)">
                  {{ m }}
                </option>
              </select>
              <input
                v-model="url"
                type="text"
                placeholder="https://api.example.com/endpoint"
                class="flex-1 px-3 py-2 text-sm bg-[var(--color-bg)] border border-[var(--color-border)] rounded text-[var(--color-text)] outline-none focus:border-[var(--color-primary)] font-mono placeholder:text-[var(--color-text-dim)]"
                @keydown.enter="createRequest"
              />
            </div>
          </div>
        </div>

        <!-- Footer -->
        <div class="flex justify-end gap-2 px-4 py-3 border-t border-[var(--color-border)]">
          <button
            class="px-4 py-1.5 text-sm bg-[var(--color-bg)] text-[var(--color-text-dim)] rounded hover:text-[var(--color-text)] transition-colors"
            @click="close"
          >
            Cancel
          </button>
          <button
            class="px-4 py-1.5 text-sm bg-[var(--color-primary)] text-[var(--color-bg)] rounded font-medium hover:brightness-110 disabled:opacity-50 disabled:cursor-not-allowed"
            :disabled="!name.trim() || !url.trim()"
            @click="createRequest"
          >
            Create
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

