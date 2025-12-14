<script setup lang="ts">
import { ref, watch, nextTick } from 'vue'
import CollectionSidebar from '@/components/builder/CollectionSidebar.vue'
import ResponseViewer from '@/components/viewer/ResponseViewer.vue'

const sidebarWidth = ref(320)
const viewerHeight = ref(300)
const isDraggingSidebar = ref(false)
const isDraggingViewer = ref(false)
const isViewerCollapsed = ref(true)

const emit = defineEmits<{
  'run-collection-request': [requestId: string, collectionId: string]
  'edit-collection-request': [requestId: string, collectionId: string]
}>()

// Trigger canvas resize when viewer collapses/expands
watch(isViewerCollapsed, () => {
  // Wait for the CSS transition to complete (200ms) then trigger resize
  setTimeout(() => {
    window.dispatchEvent(new Event('resize'))
  }, 220)
  // Also trigger immediately for a smoother experience
  nextTick(() => {
    window.dispatchEvent(new Event('resize'))
  })
})

function startSidebarDrag() {
  isDraggingSidebar.value = true
  document.addEventListener('mousemove', onSidebarDrag)
  document.addEventListener('mouseup', stopSidebarDrag)
}

function onSidebarDrag(e: MouseEvent) {
  if (isDraggingSidebar.value) {
    sidebarWidth.value = Math.max(240, Math.min(500, e.clientX))
  }
}

function stopSidebarDrag() {
  isDraggingSidebar.value = false
  document.removeEventListener('mousemove', onSidebarDrag)
  document.removeEventListener('mouseup', stopSidebarDrag)
}

function startViewerDrag() {
  isDraggingViewer.value = true
  document.addEventListener('mousemove', onViewerDrag)
  document.addEventListener('mouseup', stopViewerDrag)
}

function onViewerDrag(e: MouseEvent) {
  if (isDraggingViewer.value) {
    const windowHeight = window.innerHeight
    viewerHeight.value = Math.max(150, Math.min(windowHeight - 200, windowHeight - e.clientY))
  }
}

function stopViewerDrag() {
  isDraggingViewer.value = false
  document.removeEventListener('mousemove', onViewerDrag)
  document.removeEventListener('mouseup', stopViewerDrag)
}
</script>

<template>
  <div class="h-screen w-screen flex flex-col bg-[var(--color-bg)] overflow-hidden scanlines">
    <!-- Header -->
    <header class="h-12 flex items-center justify-between px-4 border-b border-[var(--color-border)] bg-[var(--color-bg-secondary)] shrink-0 z-10">
      <div class="flex items-center gap-3">
        <slot name="header-left" />
        <div class="text-[var(--color-primary)] font-bold text-lg tracking-wider glow-text">
          Tommie
        </div>
      </div>
      <div class="flex items-center gap-2">
        <slot name="header-actions" />
      </div>
    </header>

    <!-- Main content -->
    <div class="flex-1 flex overflow-hidden">
      <!-- Sidebar -->
      <aside
        class="shrink-0 border-r border-[var(--color-border)] bg-[var(--color-bg-secondary)] overflow-hidden flex flex-col"
        :style="{ width: `${sidebarWidth}px` }"
      >
        <!-- Collection sidebar only (unified system) -->
        <CollectionSidebar
          @run-request="(reqId, colId) => emit('run-collection-request', reqId, colId)"
          @edit-request="(reqId, colId) => emit('edit-collection-request', reqId, colId)"
        />
      </aside>

      <!-- Sidebar resize handle -->
      <div 
        class="w-1 cursor-col-resize hover:bg-[var(--color-primary)] transition-colors shrink-0"
        :class="{ 'bg-[var(--color-primary)]': isDraggingSidebar }"
        @mousedown="startSidebarDrag"
      />

      <!-- Canvas and viewer area -->
      <div class="flex-1 flex flex-col overflow-hidden">
        <!-- Canvas area -->
        <main class="flex-1 overflow-hidden relative">
          <slot name="canvas" />
        </main>

        <!-- Viewer resize handle (only show when expanded) -->
        <div 
          v-if="!isViewerCollapsed"
          class="h-1 cursor-row-resize hover:bg-[var(--color-primary)] transition-colors shrink-0"
          :class="{ 'bg-[var(--color-primary)]': isDraggingViewer }"
          @mousedown="startViewerDrag"
        />

        <!-- Response viewer -->
        <aside 
          class="shrink-0 border-t border-[var(--color-border)] bg-[var(--color-bg-secondary)] overflow-hidden transition-[height] duration-200"
          :style="{ height: isViewerCollapsed ? 'auto' : `${viewerHeight}px` }"
        >
          <ResponseViewer v-model:collapsed="isViewerCollapsed" />
        </aside>
      </div>
    </div>
  </div>
</template>

