<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{
  content: string
}>()

// Number of bytes per line
const BYTES_PER_LINE = 16

// Convert string to byte array
function stringToBytes(str: string): number[] {
  const bytes: number[] = []
  for (let i = 0; i < str.length; i++) {
    const code = str.charCodeAt(i)
    // Handle multi-byte characters
    if (code > 255) {
      bytes.push((code >> 8) & 0xff)
      bytes.push(code & 0xff)
    } else {
      bytes.push(code)
    }
  }
  return bytes
}

// Format a byte as two-digit hex
function toHex(byte: number): string {
  return byte.toString(16).padStart(2, '0').toUpperCase()
}

// Format byte as ASCII character (or dot for non-printable)
function toAscii(byte: number): string {
  // Printable ASCII range: 32-126
  if (byte >= 32 && byte <= 126) {
    return String.fromCharCode(byte)
  }
  return '.'
}

// Format offset as 8-digit hex
function formatOffset(offset: number): string {
  return offset.toString(16).padStart(8, '0').toUpperCase()
}

interface HexLine {
  offset: string
  hex: string[]
  ascii: string
}

const hexLines = computed<HexLine[]>(() => {
  const bytes = stringToBytes(props.content)
  const lines: HexLine[] = []

  for (let i = 0; i < bytes.length; i += BYTES_PER_LINE) {
    const lineBytes = bytes.slice(i, i + BYTES_PER_LINE)
    const hex: string[] = []
    let ascii = ''

    for (let j = 0; j < BYTES_PER_LINE; j++) {
      if (j < lineBytes.length) {
        hex.push(toHex(lineBytes[j]))
        ascii += toAscii(lineBytes[j])
      } else {
        hex.push('  ')
        ascii += ' '
      }
    }

    lines.push({
      offset: formatOffset(i),
      hex,
      ascii
    })
  }

  // Ensure at least one empty line for empty content
  if (lines.length === 0) {
    lines.push({
      offset: formatOffset(0),
      hex: Array(BYTES_PER_LINE).fill('  '),
      ascii: ''
    })
  }

  return lines
})

// Total bytes for header
const totalBytes = computed(() => stringToBytes(props.content).length)
</script>

<template>
  <div class="h-full flex flex-col">
    <!-- Header -->
    <div class="flex items-center gap-3 p-2 border-b border-[var(--color-border)] bg-[var(--color-bg-secondary)] text-xs font-mono text-[var(--color-text-dim)]">
      <span>{{ totalBytes }} bytes</span>
      <span class="text-[var(--color-text-dim)]">|</span>
      <span>{{ hexLines.length }} lines</span>
    </div>

    <!-- Hex dump content -->
    <div class="flex-1 overflow-auto p-2 font-mono text-xs">
      <table class="w-full border-collapse">
        <thead class="sticky top-0 bg-[var(--color-bg-secondary)]">
          <tr class="text-[var(--color-text-dim)]">
            <th class="text-left px-2 py-1 border-b border-[var(--color-border)]">Offset</th>
            <th class="text-left px-2 py-1 border-b border-[var(--color-border)]" colspan="16">
              <div class="flex gap-1">
                <span v-for="i in 16" :key="i" class="w-5 text-center">
                  {{ (i - 1).toString(16).toUpperCase() }}
                </span>
              </div>
            </th>
            <th class="text-left px-2 py-1 border-b border-[var(--color-border)]">ASCII</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="(line, idx) in hexLines" :key="idx" class="hover:bg-[var(--color-bg-secondary)]">
            <!-- Offset -->
            <td class="px-2 py-0.5 text-[var(--color-primary)] select-none">
              {{ line.offset }}
            </td>
            <!-- Hex bytes -->
            <td class="px-2 py-0.5">
              <div class="flex gap-1">
                <span
                  v-for="(byte, byteIdx) in line.hex"
                  :key="byteIdx"
                  class="w-5 text-center"
                  :class="byte === '  ' ? 'text-transparent' : 'text-[var(--color-text)]'"
                >
                  {{ byte }}
                </span>
              </div>
            </td>
            <!-- ASCII -->
            <td class="px-2 py-0.5 text-[var(--color-secondary)] border-l border-[var(--color-border)]">
              <span class="whitespace-pre">{{ line.ascii }}</span>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>
