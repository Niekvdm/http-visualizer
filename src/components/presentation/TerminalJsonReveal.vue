<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue'
import { Check, Play } from 'lucide-vue-next'

const props = defineProps<{
  data: unknown
  animated?: boolean
}>()

const emit = defineEmits<{
  close: []
}>()

const revealedLines = ref(0)
const isRevealing = ref(false)
const revealComplete = ref(false)

// Format JSON into lines with syntax highlighting
interface JsonLine {
  text: string
  indent: number
  type: 'key' | 'string' | 'number' | 'boolean' | 'null' | 'bracket' | 'punctuation'
  delay: number
}

const jsonLines = computed((): JsonLine[] => {
  if (!props.data) return []
  
  const lines: JsonLine[] = []
  let lineIndex = 0
  
  function processValue(value: unknown, indent: number, isLast: boolean = true): void {
    if (value === null) {
      lines.push({ text: 'null' + (isLast ? '' : ','), indent, type: 'null', delay: lineIndex++ * 50 })
    } else if (typeof value === 'boolean') {
      lines.push({ text: String(value) + (isLast ? '' : ','), indent, type: 'boolean', delay: lineIndex++ * 50 })
    } else if (typeof value === 'number') {
      lines.push({ text: String(value) + (isLast ? '' : ','), indent, type: 'number', delay: lineIndex++ * 50 })
    } else if (typeof value === 'string') {
      const escaped = JSON.stringify(value)
      lines.push({ text: escaped + (isLast ? '' : ','), indent, type: 'string', delay: lineIndex++ * 50 })
    } else if (Array.isArray(value)) {
      lines.push({ text: '[', indent, type: 'bracket', delay: lineIndex++ * 50 })
      value.forEach((item, index) => {
        processValue(item, indent + 1, index === value.length - 1)
      })
      lines.push({ text: ']' + (isLast ? '' : ','), indent, type: 'bracket', delay: lineIndex++ * 50 })
    } else if (typeof value === 'object') {
      lines.push({ text: '{', indent, type: 'bracket', delay: lineIndex++ * 50 })
      const entries = Object.entries(value as Record<string, unknown>)
      entries.forEach(([key, val], index) => {
        const isLastEntry = index === entries.length - 1
        
        // Key
        const keyText = `"${key}": `
        
        // If value is primitive, put on same line
        if (val === null || typeof val === 'boolean' || typeof val === 'number' || typeof val === 'string') {
          let valText: string
          if (val === null) {
            valText = 'null'
          } else if (typeof val === 'string') {
            valText = JSON.stringify(val)
          } else {
            valText = String(val)
          }
          lines.push({ 
            text: keyText + valText + (isLastEntry ? '' : ','), 
            indent: indent + 1, 
            type: 'key', 
            delay: lineIndex++ * 50 
          })
        } else {
          // Complex value - key on its own line
          lines.push({ text: keyText, indent: indent + 1, type: 'key', delay: lineIndex++ * 50 })
          processValue(val, indent + 1, isLastEntry)
        }
      })
      lines.push({ text: '}' + (isLast ? '' : ','), indent, type: 'bracket', delay: lineIndex++ * 50 })
    }
  }
  
  processValue(props.data, 0)
  return lines
})

// Start reveal animation
function startReveal() {
  if (props.animated === false) {
    revealedLines.value = jsonLines.value.length
    revealComplete.value = true
    return
  }
  
  isRevealing.value = true
  revealedLines.value = 0
  
  const revealNext = () => {
    if (revealedLines.value < jsonLines.value.length) {
      revealedLines.value++
      setTimeout(revealNext, 40)
    } else {
      isRevealing.value = false
      revealComplete.value = true
    }
  }
  
  setTimeout(revealNext, 200)
}

// Get color for token type (terminal phosphor colors)
function getColorStyle(type: JsonLine['type']): { color: string; textShadow: string } {
  const glow = (color: string) => `0 0 8px ${color}, 0 0 2px ${color}`
  
  switch (type) {
    case 'key':
      return { color: '#00d4ff', textShadow: glow('#00d4ff80') }
    case 'string':
      return { color: '#00ff41', textShadow: glow('#00ff4180') }
    case 'number':
      return { color: '#ffb800', textShadow: glow('#ffb80080') }
    case 'boolean':
      return { color: '#ff00ff', textShadow: glow('#ff00ff80') }
    case 'null':
      return { color: '#ff0040', textShadow: glow('#ff004080') }
    case 'bracket':
      return { color: '#6b8f6b', textShadow: 'none' }
    default:
      return { color: '#b0ffb0', textShadow: glow('#b0ffb080') }
  }
}

// Get value color for inline values
function getValueStyle(value: string): { color: string; textShadow: string } {
  const trimmed = value.trim().replace(/,$/, '')
  const glow = (color: string) => `0 0 8px ${color}, 0 0 2px ${color}`
  
  if (trimmed === 'null') return { color: '#ff0040', textShadow: glow('#ff004080') }
  if (trimmed === 'true' || trimmed === 'false') return { color: '#ff00ff', textShadow: glow('#ff00ff80') }
  if (trimmed.startsWith('"')) return { color: '#00ff41', textShadow: glow('#00ff4180') }
  if (!isNaN(Number(trimmed))) return { color: '#ffb800', textShadow: glow('#ffb80080') }
  return { color: '#b0ffb0', textShadow: glow('#b0ffb080') }
}

onMounted(() => {
  startReveal()
})

watch(() => props.data, () => {
  startReveal()
})
</script>

<template>
  <div class="terminal-crt-frame">
    <!-- CRT Bezel -->
    <div class="terminal-bezel">
      <!-- Header bar -->
      <div class="terminal-header">
        <div class="header-left">
          <span class="header-bracket">[</span>
          <span class="header-label">FILE</span>
          <span class="header-bracket">]</span>
        </div>
        <div class="terminal-title">
          <Play class="title-arrow w-3 h-3" />
          <span class="title-text">OUTPUT.json</span>
          <span v-if="isRevealing" class="cursor-blink">█</span>
        </div>
        <div class="terminal-status">
          <span v-if="isRevealing" class="status-text pulse">
            READING...
          </span>
          <span v-else-if="revealComplete" class="status-text complete flex items-center gap-1">
            <Check class="w-3 h-3" /> COMPLETE
          </span>
          <span class="line-count">[{{ revealedLines }}/{{ jsonLines.length }}]</span>
          <button class="close-btn" @click="emit('close')">[X]</button>
        </div>
      </div>

      <!-- Screen area -->
      <div class="terminal-screen">
        <!-- Scanlines overlay -->
        <div class="scanlines"></div>
        
        <!-- CRT glow effect -->
        <div class="crt-glow"></div>

        <!-- JSON Content -->
        <div class="terminal-content">
          <!-- Line numbers gutter -->
          <div class="line-gutter">
            <div 
              v-for="(line, index) in jsonLines.slice(0, revealedLines)" 
              :key="'ln-' + index"
              class="gutter-line"
              :class="{ 'line-highlight': index === revealedLines - 1 && isRevealing }"
            >
              <span class="line-number">{{ String(index + 1).padStart(3, ' ') }}</span>
              <span class="line-separator">│</span>
            </div>
            <!-- Cursor line gutter -->
            <div 
              v-if="isRevealing && revealedLines < jsonLines.length"
              class="gutter-line"
            >
              <span class="line-number">{{ String(revealedLines + 1).padStart(3, ' ') }}</span>
              <span class="line-separator">│</span>
            </div>
          </div>
          
          <!-- Code content -->
          <div class="code-content">
            <div
              v-for="(line, index) in jsonLines.slice(0, revealedLines)"
              :key="index"
              class="json-line"
              :class="{ 'line-highlight': index === revealedLines - 1 && isRevealing }"
            >
              <!-- Indentation -->
              <span class="indent-space" :style="{ width: `${line.indent * 16}px` }"></span>
              
              <!-- Content with syntax highlighting -->
              <span :style="getColorStyle(line.type)">
                <!-- Highlight keys differently -->
                <template v-if="line.type === 'key' && line.text.includes(':')">
                  <span :style="getColorStyle('key')">{{ line.text.split(':')[0] }}</span>
                  <span class="punctuation">:</span>
                  <span :style="getValueStyle(line.text.split(':').slice(1).join(':').trim())">
                    {{ line.text.split(':').slice(1).join(':') }}
                  </span>
                </template>
                <template v-else>
                  {{ line.text }}
                </template>
              </span>
            </div>

            <!-- Typing cursor -->
            <div 
              v-if="isRevealing && revealedLines < jsonLines.length"
              class="json-line cursor-line"
            >
              <span class="indent-space" :style="{ width: `${(jsonLines[revealedLines]?.indent || 0) * 16}px` }"></span>
              <span class="typing-cursor">█</span>
            </div>
          </div>
        </div>
      </div>

      <!-- Footer -->
      <div class="terminal-footer">
        <span class="footer-bracket">[</span>
        <span class="footer-text">ESC</span>
        <span class="footer-bracket">]</span>
        <span class="footer-label">CLOSE</span>
        <span class="footer-divider">║</span>
        <span class="footer-bracket">[</span>
        <span class="footer-text">↑↓</span>
        <span class="footer-bracket">]</span>
        <span class="footer-label">SCROLL</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.terminal-crt-frame {
  --phosphor-green: #00ff41;
  --phosphor-cyan: #00d4ff;
  --phosphor-dim: #6b8f6b;
  --crt-bg: #0a0a0a;
  --bezel-color: #1a1a1a;
  --bezel-border: #2a2a2a;
  
  width: 100%;
  height: 100%;
  min-height: 0; /* Critical for flex children to shrink */
  display: flex;
  flex-direction: column;
}

.terminal-bezel {
  background: var(--bezel-color);
  border: 2px solid var(--phosphor-dim);
  box-shadow: 
    inset 0 0 30px rgba(0, 0, 0, 0.8),
    0 0 20px rgba(0, 255, 65, 0.1),
    0 0 60px rgba(0, 255, 65, 0.05);
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0; /* Critical for flex children to shrink */
  overflow: hidden;
}

/* Header */
.terminal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 6px 12px;
  background: var(--crt-bg);
  border-bottom: 1px solid var(--phosphor-dim);
  font-family: 'Consolas', 'Monaco', 'Courier New', monospace;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 2px;
  font-size: 11px;
}

.header-bracket {
  color: var(--phosphor-dim);
}

.header-label {
  color: var(--phosphor-cyan);
  text-shadow: 0 0 6px var(--phosphor-cyan);
  letter-spacing: 1px;
}

.terminal-title {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  color: var(--phosphor-green);
  text-shadow: 0 0 10px var(--phosphor-green), 0 0 20px rgba(0, 255, 65, 0.5);
  letter-spacing: 2px;
}

.title-arrow {
  color: var(--phosphor-cyan);
  text-shadow: 0 0 8px var(--phosphor-cyan);
  font-size: 10px;
}

.title-text {
  text-transform: uppercase;
}

.cursor-blink {
  animation: blink 1s step-end infinite;
}

@keyframes blink {
  0%, 50% { opacity: 1; }
  51%, 100% { opacity: 0; }
}

.terminal-status {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 11px;
}

.status-text {
  color: var(--phosphor-cyan);
  text-shadow: 0 0 8px var(--phosphor-cyan);
  letter-spacing: 1px;
}

.status-text.pulse {
  animation: pulse 1s ease-in-out infinite;
}

.status-text.complete {
  color: var(--phosphor-green);
  text-shadow: 0 0 8px var(--phosphor-green);
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}

.line-count {
  color: var(--phosphor-dim);
  font-size: 10px;
}

.close-btn {
  background: none;
  border: none;
  color: var(--phosphor-dim);
  font-family: 'Consolas', 'Monaco', 'Courier New', monospace;
  font-size: 11px;
  cursor: pointer;
  padding: 2px 4px;
  transition: all 0.15s;
}

.close-btn:hover {
  color: #ff0040;
  text-shadow: 0 0 8px #ff0040;
}

/* Screen */
.terminal-screen {
  flex: 1;
  position: relative;
  background: var(--crt-bg);
  overflow: hidden;
  border-top: 1px solid #111;
  border-bottom: 1px solid #111;
  min-height: 0; /* Critical for flex children to shrink and scroll */
}

.scanlines {
  position: absolute;
  inset: 0;
  background: repeating-linear-gradient(
    0deg,
    transparent 0px,
    transparent 2px,
    rgba(0, 0, 0, 0.15) 2px,
    rgba(0, 0, 0, 0.15) 4px
  );
  pointer-events: none;
  z-index: 10;
}

.crt-glow {
  position: absolute;
  inset: 0;
  background: radial-gradient(
    ellipse at center,
    rgba(0, 255, 65, 0.03) 0%,
    transparent 70%
  );
  pointer-events: none;
  z-index: 5;
}

.terminal-content {
  position: relative;
  height: 100%;
  overflow-y: auto;
  overflow-x: auto;
  z-index: 1;
  display: flex;
  font-family: 'Consolas', 'Monaco', 'Courier New', monospace;
  font-size: 13px;
  line-height: 1.6;
}

/* Custom scrollbar - vertical */
.terminal-content::-webkit-scrollbar {
  width: 12px;
  height: 12px;
}

.terminal-content::-webkit-scrollbar-track {
  background: #0d0d0d;
  border-left: 1px solid var(--phosphor-dim);
}

.terminal-content::-webkit-scrollbar-thumb {
  background: linear-gradient(180deg, #2a2a2a 0%, #1a1a1a 100%);
  border: 1px solid var(--phosphor-dim);
  border-radius: 0;
}

.terminal-content::-webkit-scrollbar-thumb:hover {
  background: linear-gradient(180deg, #3a3a3a 0%, #2a2a2a 100%);
  border-color: var(--phosphor-green);
  box-shadow: 0 0 8px var(--phosphor-green);
}

.terminal-content::-webkit-scrollbar-corner {
  background: #0d0d0d;
}

/* Line gutter (fixed left side) */
.line-gutter {
  position: sticky;
  left: 0;
  z-index: 2;
  background: var(--crt-bg);
  padding: 8px 0;
  border-right: 1px solid var(--phosphor-dim);
  flex-shrink: 0;
}

.gutter-line {
  display: flex;
  align-items: center;
  height: 20.8px; /* Match line-height of 1.6 * 13px */
  padding-right: 4px;
}

.gutter-line.line-highlight {
  background: rgba(0, 255, 65, 0.08);
}

.line-number {
  color: var(--phosphor-dim);
  opacity: 0.6;
  user-select: none;
  min-width: 28px;
  text-align: right;
  padding-left: 8px;
}

.line-separator {
  color: var(--phosphor-dim);
  opacity: 0.4;
  margin-left: 8px;
  user-select: none;
}

/* Code content (scrollable) */
.code-content {
  flex: 1;
  padding: 8px 12px;
  min-width: 0;
}

.json-line {
  display: flex;
  align-items: baseline;
  white-space: pre;
  height: 20.8px; /* Match gutter line height */
  transition: background 0.15s;
}

.json-line.line-highlight {
  background: rgba(0, 255, 65, 0.08);
}

.indent-space {
  display: inline-block;
  flex-shrink: 0;
}

.punctuation {
  color: var(--phosphor-dim);
}

.cursor-line {
  height: 20.8px;
}

.typing-cursor {
  color: var(--phosphor-green);
  text-shadow: 0 0 10px var(--phosphor-green);
  animation: blink 0.7s step-end infinite;
}

/* Footer */
.terminal-footer {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  padding: 6px 12px;
  background: var(--crt-bg);
  border-top: 1px solid var(--phosphor-dim);
  font-family: 'Consolas', 'Monaco', 'Courier New', monospace;
  font-size: 10px;
}

.footer-bracket {
  color: var(--phosphor-dim);
  opacity: 0.5;
}

.footer-text {
  color: var(--phosphor-cyan);
  text-shadow: 0 0 4px var(--phosphor-cyan);
  letter-spacing: 1px;
}

.footer-label {
  color: var(--phosphor-dim);
  opacity: 0.7;
  margin-right: 12px;
}

.footer-divider {
  color: var(--phosphor-dim);
  opacity: 0.3;
  margin: 0 8px;
}
</style>

