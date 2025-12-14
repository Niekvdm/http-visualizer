<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { Image, ZoomIn, ZoomOut, RotateCw } from 'lucide-vue-next'
import { formatBytes } from '@/utils/formatters'

const props = defineProps<{
  content: string
  contentType: string
}>()

const imageRef = ref<HTMLImageElement | null>(null)
const dimensions = ref({ width: 0, height: 0 })
const zoom = ref(1)
const error = ref(false)

// Check if content is SVG (text-based)
const isSvg = computed(() => {
  const ct = props.contentType.toLowerCase()
  return ct.includes('svg') || props.content.trim().startsWith('<svg')
})

// Create data URL from content
const imageUrl = computed(() => {
  // If content is already a data URL, use it directly
  if (props.content.startsWith('data:')) {
    return props.content
  }

  // SVG is text-based, create blob URL
  if (isSvg.value) {
    const blob = new Blob([props.content], { type: 'image/svg+xml' })
    return URL.createObjectURL(blob)
  }

  // Otherwise, assume base64 and create a data URL
  return `data:${props.contentType};base64,${props.content}`
})

// Get image format from content type
const format = computed(() => {
  const type = props.contentType.toLowerCase()
  if (type.includes('png')) return 'PNG'
  if (type.includes('jpeg') || type.includes('jpg')) return 'JPEG'
  if (type.includes('gif')) return 'GIF'
  if (type.includes('webp')) return 'WebP'
  if (type.includes('svg')) return 'SVG'
  if (type.includes('ico')) return 'ICO'
  if (type.includes('bmp')) return 'BMP'
  return 'Image'
})

// Size in bytes
const sizeBytes = computed(() => {
  // SVG and data URLs starting with text are actual size
  if (isSvg.value || props.content.startsWith('data:image/svg')) {
    return props.content.length
  }
  // Base64 is about 4/3 the size of the original
  const base64 = props.content.startsWith('data:')
    ? props.content.split(',')[1] || ''
    : props.content
  return Math.round(base64.length * 0.75)
})

function handleLoad() {
  if (imageRef.value) {
    dimensions.value = {
      width: imageRef.value.naturalWidth,
      height: imageRef.value.naturalHeight
    }
  }
}

function handleError() {
  error.value = true
}

function zoomIn() {
  zoom.value = Math.min(zoom.value * 1.25, 5)
}

function zoomOut() {
  zoom.value = Math.max(zoom.value / 1.25, 0.1)
}

function resetZoom() {
  zoom.value = 1
}

// Reset error state when content changes
watch(() => props.content, () => {
  error.value = false
})
</script>

<template>
  <div class="h-full flex flex-col">
    <!-- Info bar -->
    <div class="flex items-center justify-between p-2 border-b border-[var(--color-border)] bg-[var(--color-bg-secondary)]">
      <div class="flex items-center gap-3 text-xs font-mono text-[var(--color-text-dim)]">
        <span class="flex items-center gap-1.5">
          <Image class="w-3.5 h-3.5" />
          {{ format }}
        </span>
        <span v-if="dimensions.width > 0">
          {{ dimensions.width }} × {{ dimensions.height }}
        </span>
        <span>{{ formatBytes(sizeBytes) }}</span>
      </div>

      <!-- Zoom controls -->
      <div class="flex items-center gap-1">
        <button
          class="p-1 text-[var(--color-text-dim)] hover:text-[var(--color-text)] hover:bg-[var(--color-bg)] rounded transition-colors"
          title="Zoom out"
          @click="zoomOut"
        >
          <ZoomOut class="w-4 h-4" />
        </button>
        <span class="text-xs font-mono text-[var(--color-text-dim)] min-w-[3rem] text-center">
          {{ Math.round(zoom * 100) }}%
        </span>
        <button
          class="p-1 text-[var(--color-text-dim)] hover:text-[var(--color-text)] hover:bg-[var(--color-bg)] rounded transition-colors"
          title="Zoom in"
          @click="zoomIn"
        >
          <ZoomIn class="w-4 h-4" />
        </button>
        <button
          class="p-1 text-[var(--color-text-dim)] hover:text-[var(--color-text)] hover:bg-[var(--color-bg)] rounded transition-colors"
          title="Reset zoom"
          @click="resetZoom"
        >
          <RotateCw class="w-4 h-4" />
        </button>
      </div>
    </div>

    <!-- Image container -->
    <div class="flex-1 overflow-auto flex items-center justify-center p-4 bg-[var(--color-bg)]">
      <!-- Checkerboard pattern for transparency -->
      <div
        class="inline-block"
        style="background-image: linear-gradient(45deg, #808080 25%, transparent 25%), linear-gradient(-45deg, #808080 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #808080 75%), linear-gradient(-45deg, transparent 75%, #808080 75%); background-size: 16px 16px; background-position: 0 0, 0 8px, 8px -8px, -8px 0px;"
      >
        <img
          v-if="!error"
          ref="imageRef"
          :src="imageUrl"
          :style="{ transform: `scale(${zoom})`, transformOrigin: 'center' }"
          class="max-w-none transition-transform"
          @load="handleLoad"
          @error="handleError"
        />
        <div
          v-else
          class="flex flex-col items-center justify-center p-8 text-[var(--color-text-dim)]"
        >
          <Image class="w-12 h-12 mb-2 opacity-50" />
          <span class="text-sm">Failed to load image</span>
        </div>
      </div>
    </div>
  </div>
</template>
