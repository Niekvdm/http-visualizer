<script setup lang="ts">
import { ref } from 'vue'
import { useCollectionStore } from '@/stores/collectionStore'
import { X, Folder } from 'lucide-vue-next'

const props = defineProps<{
  collectionId: string
}>()

const emit = defineEmits<{
  close: []
}>()

const collectionStore = useCollectionStore()

const name = ref('')

function createFolder() {
  if (!name.value.trim()) return

  collectionStore.createFolder(props.collectionId, name.value.trim())
  emit('close')
}

function close() {
  emit('close')
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
      <div class="relative w-full max-w-sm mx-4 bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded-lg shadow-2xl">
        <!-- Header -->
        <div class="flex items-center justify-between px-4 py-3 border-b border-[var(--color-border)]">
          <div class="flex items-center gap-2">
            <Folder class="w-4 h-4 text-[var(--color-secondary)]" />
            <h2 class="text-sm font-mono uppercase tracking-wider text-[var(--color-text)]">
              New Folder
            </h2>
          </div>
          <button
            class="p-1 rounded hover:bg-[var(--color-bg-tertiary)] text-[var(--color-text-dim)] hover:text-[var(--color-text)]"
            @click="close"
          >
            <X class="w-4 h-4" />
          </button>
        </div>

        <!-- Body -->
        <div class="p-4">
          <label class="block text-xs text-[var(--color-text-dim)] mb-1">Folder Name</label>
          <input
            v-model="name"
            type="text"
            placeholder="Authentication"
            class="w-full px-3 py-2 text-sm bg-[var(--color-bg)] border border-[var(--color-border)] rounded text-[var(--color-text)] outline-none focus:border-[var(--color-secondary)] placeholder:text-[var(--color-text-dim)]"
            autofocus
            @keydown.enter="createFolder"
            @keydown.escape="close"
          />
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
            class="px-4 py-1.5 text-sm bg-[var(--color-secondary)] text-[var(--color-bg)] rounded font-medium hover:brightness-110 disabled:opacity-50 disabled:cursor-not-allowed"
            :disabled="!name.trim()"
            @click="createFolder"
          >
            Create
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

