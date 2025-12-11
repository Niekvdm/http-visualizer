<script setup lang="ts">
import { ref } from 'vue'
import { useRequestStore } from '@/stores/requestStore'
import { parseFileFromUpload } from '@/parsers'
import { FolderOpen, LoaderCircle } from 'lucide-vue-next'

const requestStore = useRequestStore()
const isDragOver = ref(false)
const isProcessing = ref(false)
const errorMessage = ref<string | null>(null)

async function handleDrop(e: DragEvent) {
  e.preventDefault()
  isDragOver.value = false
  
  const files = e.dataTransfer?.files
  if (!files?.length) return
  
  await processFiles(files)
}

async function handleFileSelect(e: Event) {
  const input = e.target as HTMLInputElement
  const files = input.files
  if (!files?.length) return
  
  await processFiles(files)
  input.value = '' // Reset input
}

async function processFiles(files: FileList) {
  isProcessing.value = true
  errorMessage.value = null
  
  for (const file of Array.from(files)) {
    const result = await parseFileFromUpload(file)
    
    if (result.success && result.file) {
      requestStore.addFile(result.file)
    } else {
      errorMessage.value = result.error || 'Failed to parse file'
    }
  }
  
  isProcessing.value = false
  
  // Clear error after 5 seconds
  if (errorMessage.value) {
    setTimeout(() => {
      errorMessage.value = null
    }, 5000)
  }
}

function onDragOver(e: DragEvent) {
  e.preventDefault()
  isDragOver.value = true
}

function onDragLeave() {
  isDragOver.value = false
}
</script>

<template>
  <div 
    class="relative border-2 border-dashed rounded-lg p-4 transition-all duration-200 cursor-pointer"
    :class="[
      isDragOver 
        ? 'border-[var(--color-primary)] bg-[var(--color-primary)]/10' 
        : 'border-[var(--color-border)] hover:border-[var(--color-primary-dim)]',
      isProcessing ? 'opacity-50 pointer-events-none' : ''
    ]"
    @drop="handleDrop"
    @dragover="onDragOver"
    @dragleave="onDragLeave"
    @click="($refs.fileInput as HTMLInputElement).click()"
  >
    <input 
      ref="fileInput"
      type="file" 
      class="hidden" 
      accept=".http,.rest,.bru"
      multiple
      @change="handleFileSelect"
    />
    
    <div class="flex flex-col items-center gap-2 text-center">
      <component 
        :is="isProcessing ? LoaderCircle : FolderOpen" 
        class="w-6 h-6" 
        :class="isProcessing ? 'animate-spin' : ''"
      />
      <div class="text-sm text-[var(--color-text)]">
        {{ isProcessing ? 'Processing...' : 'Drop .http or .bru files' }}
      </div>
      <div class="text-xs text-[var(--color-text-dim)]">
        or click to browse
      </div>
    </div>
    
    <!-- Error message -->
    <div 
      v-if="errorMessage"
      class="absolute -bottom-8 left-0 right-0 text-xs text-[var(--color-error)] text-center"
    >
      {{ errorMessage }}
    </div>
  </div>
</template>

