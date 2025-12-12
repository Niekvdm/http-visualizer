<script setup lang="ts">
import { computed } from 'vue'
import type { CollectionRequest } from '@/types'
import { useConfirmDialog } from '@/composables/useConfirmDialog'
import MethodBadge from '@/components/shared/MethodBadge.vue'
import ContextMenu from '@/components/shared/ContextMenu.vue'
import ContextMenuItem from '@/components/shared/ContextMenuItem.vue'
import ContextMenuDivider from '@/components/shared/ContextMenuDivider.vue'
import { 
  MoreVertical, 
  Pencil, 
  Trash2, 
  Play,
  Copy,
  GripVertical,
  Lock
} from 'lucide-vue-next'

const props = defineProps<{
  request: CollectionRequest
  collectionId: string
  isSelected: boolean
  isDragging?: boolean
}>()

const emit = defineEmits<{
  'select': []
  'edit': []
  'run': []
  'duplicate': []
  'delete': []
}>()

// Confirm dialog
const { confirm } = useConfirmDialog()

// Safe computed values that handle undefined request during drag
const methodDisplay = computed(() => props.request?.method || 'GET')
const nameDisplay = computed(() => props.request?.name || '')

// Check if request has its own auth (not inherited)
const hasOwnAuth = computed(() => {
  if (!props.request) return false
  return props.request.auth != null && props.request.auth.type !== 'none'
})

// Get auth tooltip text
const authTooltip = computed(() => {
  if (!props.request?.auth) return ''
  
  const labels: Record<string, string> = {
    'basic': 'Basic Auth',
    'bearer': 'Bearer Token',
    'api-key': 'API Key',
    'oauth2': 'OAuth2',
  }
  
  return labels[props.request.auth.type] || 'Auth'
})

// Menu actions
function handleEdit() {
  emit('edit')
}

function handleRun() {
  emit('run')
}

function handleDuplicate() {
  emit('duplicate')
}

function handleDelete() {
  emit('delete')
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
      <GripVertical class="w-3.5 h-3.5 text-[var(--color-text-dim)]" />
    </div>

    <!-- Method badge -->
    <MethodBadge :method="methodDisplay" size="xs" />

    <!-- Request name -->
    <span class="text-sm text-[var(--color-text)] truncate flex-1">
      {{ nameDisplay }}
    </span>

    <!-- Auth indicator (only for own auth, not inherited) -->
    <Lock 
      v-if="hasOwnAuth"
      class="w-3.5 h-3.5 text-[var(--color-warning)] shrink-0"
      :title="authTooltip"
    />

    <!-- Run button -->
    <button
      class="p-1 rounded opacity-0 group-hover:opacity-100 hover:bg-[var(--color-primary)]/20 transition-opacity shrink-0"
      title="Run request"
      @click.stop="emit('run')"
    >
      <Play class="w-3.5 h-3.5 text-[var(--color-primary)]" />
    </button>
    
    <!-- Context menu -->
    <ContextMenu align="right">
      <template #trigger>
        <button
          class="p-1 rounded opacity-0 group-hover:opacity-100 hover:bg-[var(--color-bg)] transition-opacity shrink-0"
          title="More options"
        >
          <MoreVertical class="w-3.5 h-3.5 text-[var(--color-text-dim)]" />
        </button>
      </template>

      <ContextMenuItem :icon="Pencil" @click="handleEdit">
        Edit
      </ContextMenuItem>
      <ContextMenuItem :icon="Play" @click="handleRun">
        Run
      </ContextMenuItem>
      <ContextMenuItem :icon="Copy" @click="handleDuplicate">
        Duplicate
      </ContextMenuItem>
      <ContextMenuDivider />
      <ContextMenuItem :icon="Trash2" danger @click="handleDelete">
        Delete
      </ContextMenuItem>
    </ContextMenu>
  </div>
</template>
