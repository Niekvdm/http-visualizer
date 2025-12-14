<script setup lang="ts">
import type { Workspace } from '@/types/workspace'
import { Edit2, Trash2, Upload, Check, FolderOpen, Globe } from 'lucide-vue-next'

const props = defineProps<{
  workspace: Workspace
  isActive: boolean
  collectionCount: number | null
  environmentCount: number | null
  canDelete: boolean
}>()

const emit = defineEmits<{
  select: []
  edit: []
  delete: []
  export: []
}>()

function formatDate(timestamp: number): string {
  return new Date(timestamp).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}
</script>

<template>
  <div
    class="group relative p-4 rounded-lg border transition-all cursor-pointer"
    :class="isActive 
      ? 'bg-[var(--color-bg-tertiary)] border-[var(--color-primary)]/50' 
      : 'bg-[var(--color-bg)] border-[var(--color-border)] hover:border-[var(--color-primary)]/30'"
    @click="emit('select')"
  >
    <div class="flex items-start gap-3">
      <!-- Color indicator -->
      <div
        class="w-3 h-3 rounded-full shrink-0 mt-1"
        :style="{ backgroundColor: workspace.color || '#10b981' }"
      />
      
      <!-- Content -->
      <div class="flex-1 min-w-0">
        <div class="flex items-center gap-2">
          <h3 
            class="text-sm font-medium truncate"
            :class="isActive ? 'text-[var(--color-primary)]' : 'text-[var(--color-text)]'"
          >
            {{ workspace.name }}
          </h3>
          <Check 
            v-if="isActive"
            class="w-4 h-4 text-[var(--color-primary)] shrink-0" 
          />
        </div>
        
        <p 
          v-if="workspace.description"
          class="text-xs text-[var(--color-text-dim)] mt-0.5 truncate"
        >
          {{ workspace.description }}
        </p>
        
        <!-- Stats -->
        <div class="flex items-center gap-4 mt-2 text-xs text-[var(--color-text-dim)]">
          <div class="flex items-center gap-1">
            <FolderOpen class="w-3 h-3" />
            <span>{{ collectionCount ?? '—' }} collections</span>
          </div>
          <div class="flex items-center gap-1">
            <Globe class="w-3 h-3" />
            <span>{{ environmentCount ?? '—' }} environments</span>
          </div>
        </div>
        
        <!-- Created date -->
        <div class="text-[10px] text-[var(--color-text-dim)]/60 mt-1">
          Created {{ formatDate(workspace.createdAt) }}
        </div>
      </div>
      
      <!-- Actions -->
      <div 
        class="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity"
        @click.stop
      >
        <button
          class="p-1.5 rounded hover:bg-[var(--color-bg-tertiary)] text-[var(--color-text-dim)] hover:text-[var(--color-text)] transition-colors"
          title="Edit workspace"
          @click="emit('edit')"
        >
          <Edit2 class="w-3.5 h-3.5" />
        </button>
        <button
          class="p-1.5 rounded hover:bg-[var(--color-bg-tertiary)] text-[var(--color-text-dim)] hover:text-[var(--color-secondary)] transition-colors"
          title="Export workspace"
          @click="emit('export')"
        >
          <Upload class="w-3.5 h-3.5" />
        </button>
        <button
          v-if="canDelete"
          class="p-1.5 rounded hover:bg-[var(--color-bg-tertiary)] text-[var(--color-text-dim)] hover:text-[var(--color-error)] transition-colors"
          title="Delete workspace"
          @click="emit('delete')"
        >
          <Trash2 class="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  </div>
</template>
