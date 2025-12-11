<script setup lang="ts">
import { ref, computed, watch, onUnmounted, nextTick } from 'vue'
import type { CollectionRequest } from '@/types'
import { getMethodColor } from '@/utils/formatters'
import { 
  MoreVertical, 
  Pencil, 
  Trash2, 
  Play,
  Copy,
  GripVertical
} from 'lucide-vue-next'

const props = defineProps<{
  request: CollectionRequest
  collectionId: string
  isSelected: boolean
  isDragging?: boolean
}>()

// Safe method color that handles undefined request during drag
const methodColor = computed(() => {
  if (!props.request?.method) return ''
  return getMethodColor(props.request.method)
})

const methodDisplay = computed(() => props.request?.method || 'GET')
const nameDisplay = computed(() => props.request?.name || '')

const emit = defineEmits<{
  'select': []
  'edit': []
  'run': []
  'duplicate': []
  'delete': []
}>()

// Menu state
const showMenu = ref(false)
const menuRef = ref<HTMLElement | null>(null)
const dropdownRef = ref<HTMLElement | null>(null)

function toggleMenu() {
  showMenu.value = !showMenu.value
}

function onClickOutside(e: MouseEvent) {
  const target = e.target as Node
  if (dropdownRef.value && !dropdownRef.value.contains(target)) {
    showMenu.value = false
  }
}

// Watch for menu open/close to add/remove click listener
watch(showMenu, (isOpen) => {
  if (isOpen) {
    nextTick(() => {
      document.addEventListener('click', onClickOutside, true)
    })
  } else {
    document.removeEventListener('click', onClickOutside, true)
  }
})

// Cleanup on unmount
onUnmounted(() => {
  document.removeEventListener('click', onClickOutside, true)
})

// Menu actions
function handleEdit() {
  emit('edit')
  showMenu.value = false
}

function handleRun() {
  emit('run')
  showMenu.value = false
}

function handleDuplicate() {
  emit('duplicate')
  showMenu.value = false
}

function handleDelete() {
  emit('delete')
  showMenu.value = false
}
</script>

<template>
  <div
    class="flex items-center gap-2 px-2 py-1.5 rounded cursor-pointer group transition-colors select-none"
    :class="[
      isSelected
        ? 'bg-[var(--color-primary)]/15 border border-[var(--color-primary)]/40'
        : 'hover:bg-[var(--color-bg-tertiary)] border border-transparent',
      isDragging ? 'opacity-50' : ''
    ]"
    @click="emit('select')"
    @dblclick="emit('edit')"
  >
    <!-- Drag handle -->
    <div class="drag-handle cursor-grab opacity-0 group-hover:opacity-50 hover:!opacity-100 shrink-0">
      <GripVertical class="w-3 h-3 text-[var(--color-text-dim)]" />
    </div>

    <!-- Method badge -->
    <span 
      class="text-[10px] font-bold px-1.5 py-0.5 rounded bg-[var(--color-bg)] font-mono shrink-0"
      :class="methodColor"
    >
      {{ methodDisplay }}
    </span>

    <!-- Request name -->
    <span class="text-sm text-[var(--color-text)] truncate flex-1">
      {{ nameDisplay }}
    </span>

    <!-- Run button -->
    <button
      class="p-1 rounded opacity-0 group-hover:opacity-100 hover:bg-[var(--color-primary)]/20 transition-opacity shrink-0"
      title="Run request"
      @click.stop="emit('run')"
    >
      <Play class="w-3.5 h-3.5 text-[var(--color-primary)]" />
    </button>
    
    <!-- Context menu -->
    <div class="relative" ref="menuRef">
      <button
        class="p-1 rounded opacity-0 group-hover:opacity-100 hover:bg-[var(--color-bg)] transition-opacity shrink-0"
        title="More options"
        @click.stop="toggleMenu"
      >
        <MoreVertical class="w-3.5 h-3.5 text-[var(--color-text-dim)]" />
      </button>

      <!-- Dropdown menu -->
      <Teleport to="body">
        <div
          v-if="showMenu"
          :ref="el => { dropdownRef = el as HTMLElement }"
          class="fixed z-[200] min-w-[160px] py-1 bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded shadow-xl"
          :style="{
            top: menuRef ? `${menuRef.getBoundingClientRect().bottom + 4}px` : '0',
            left: menuRef ? `${menuRef.getBoundingClientRect().left - 100}px` : '0'
          }"
        >
          <button
            class="w-full px-3 py-1.5 text-left text-sm text-[var(--color-text)] hover:bg-[var(--color-bg-tertiary)] flex items-center gap-2"
            @click="handleEdit"
          >
            <Pencil class="w-4 h-4" />
            Edit
          </button>
          <button
            class="w-full px-3 py-1.5 text-left text-sm text-[var(--color-text)] hover:bg-[var(--color-bg-tertiary)] flex items-center gap-2"
            @click="handleRun"
          >
            <Play class="w-4 h-4" />
            Run
          </button>
          <button
            class="w-full px-3 py-1.5 text-left text-sm text-[var(--color-text)] hover:bg-[var(--color-bg-tertiary)] flex items-center gap-2"
            @click="handleDuplicate"
          >
            <Copy class="w-4 h-4" />
            Duplicate
          </button>
          <div class="my-1 border-t border-[var(--color-border)]" />
          <button
            class="w-full px-3 py-1.5 text-left text-sm text-[var(--color-error)] hover:bg-[var(--color-bg-tertiary)] flex items-center gap-2"
            @click="handleDelete"
          >
            <Trash2 class="w-4 h-4" />
            Delete
          </button>
        </div>
      </Teleport>
    </div>
  </div>
</template>

