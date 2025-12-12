<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useRequestStore } from '@/stores/requestStore'
import { formatBytes, formatDuration, getStatusColor } from '@/utils/formatters'
import JsonTreeView from './JsonTreeView.vue'
import RawView from './RawView.vue'
import TableView from './TableView.vue'
import { AlertTriangle, RefreshCw, Bomb, Radio, Lock, Unlock, ChevronDown, Clock, ArrowRight, Shield, FileText, Server, Globe, Zap, Database, Wifi } from 'lucide-vue-next'

type ViewTab = 'request' | 'json' | 'raw' | 'table' | 'headers' | 'timing'

const requestStore = useRequestStore()
const activeTab = defineModel<ViewTab>('activeTab', { default: 'json' })
const isCollapsed = defineModel<boolean>('collapsed', { default: true })

const executionState = computed(() => requestStore.executionState)
const sentRequest = computed(() => executionState.value.sentRequest)
const response = computed(() => executionState.value.response)
const error = computed(() => executionState.value.error)
const phase = computed(() => executionState.value.phase)

const hasResponse = computed(() => response.value !== undefined)
const hasSentRequest = computed(() => sentRequest.value !== undefined)
const hasError = computed(() => error.value !== undefined)
const isLoading = computed(() => phase.value === 'authenticating' || phase.value === 'fetching')

const statusClass = computed(() => {
  if (!response.value) return ''
  return getStatusColor(response.value.status)
})

const parsedBody = computed(() => {
  if (!response.value?.bodyParsed) return null
  return response.value.bodyParsed
})

const canShowTable = computed(() => {
  if (!parsedBody.value) return false
  if (Array.isArray(parsedBody.value)) return true
  if (typeof parsedBody.value === 'object') return true
  return false
})

const headersArray = computed(() => {
  if (!response.value?.headers) return []
  return Object.entries(response.value.headers)
})

// Timing data
const timing = computed(() => response.value?.timing)
const hasDetailedTiming = computed(() => {
  const t = timing.value
  if (!t) return false
  return t.dns !== undefined || t.tcp !== undefined || t.tls !== undefined || t.ttfb !== undefined || t.download !== undefined || t.blocked !== undefined
})

// Redirect chain
const redirectChain = computed(() => response.value?.redirectChain || [])
const hasRedirects = computed(() => redirectChain.value.length > 0)

// Size breakdown
const sizeBreakdown = computed(() => response.value?.sizeBreakdown)
const hasSizeBreakdown = computed(() => sizeBreakdown.value !== undefined)

// TLS info
const tlsInfo = computed(() => response.value?.tls)

// Network info from webRequest API
const serverIP = computed(() => response.value?.serverIP)
const protocol = computed(() => response.value?.protocol)
const fromCache = computed(() => response.value?.fromCache)
const connectionType = computed(() => response.value?.connection)
const serverSoftware = computed(() => response.value?.serverSoftware)
const resourceType = computed(() => response.value?.resourceType)
const requestBodySizeFromExtension = computed(() => response.value?.requestBodySize)

// Check if we have any network info to display
const hasNetworkInfo = computed(() => {
  return serverIP.value || protocol.value || fromCache.value || connectionType.value || serverSoftware.value
})

const requestHeadersArray = computed(() => {
  if (!sentRequest.value?.headers) return []
  return Object.entries(sentRequest.value.headers)
})

const requestBodyParsed = computed(() => {
  if (!sentRequest.value?.body) return null
  try {
    return JSON.parse(sentRequest.value.body)
  } catch {
    return null
  }
})

const requestBodySize = computed(() => {
  if (!sentRequest.value?.body) return 0
  return new Blob([sentRequest.value.body]).size
})

// Auto-select best tab based on response
watch(response, (newResponse) => {
  if (!newResponse) return
  
  if (newResponse.bodyParsed) {
    activeTab.value = 'json'
  } else {
    activeTab.value = 'raw'
  }
})

// Show request tab when request starts
watch(sentRequest, (newSentRequest) => {
  if (newSentRequest && !response.value) {
    activeTab.value = 'request'
  }
})

// Track which sensitive headers are revealed
const revealedHeaders = ref<Set<string>>(new Set())

// Helper to mask sensitive values (like auth tokens)
function maskSensitiveValue(value: string): string {
  if (value.length <= 20) {
    return value.substring(0, 4) + '••••••••'
  }
  // Show first 10 and last 4 characters
  return value.substring(0, 10) + '••••••••' + value.substring(value.length - 4)
}

function toggleRevealHeader(key: string) {
  if (revealedHeaders.value.has(key)) {
    revealedHeaders.value.delete(key)
  } else {
    revealedHeaders.value.add(key)
  }
}

function isHeaderRevealed(key: string): boolean {
  return revealedHeaders.value.has(key)
}
</script>

<template>
  <div class="flex flex-col" :class="isCollapsed ? '' : 'h-full'">
    <!-- Header -->
    <div 
      class="flex items-center justify-between px-4 py-2 border-b border-[var(--color-border)] bg-[var(--color-bg-tertiary)] hover:bg-[var(--color-bg)] cursor-pointer"
	  @click="isCollapsed = !isCollapsed"
    >
      <div class="flex items-center gap-4">
        <!-- Collapse toggle -->
        <button 
          class="text-[var(--color-text-dim)] hover:text-[var(--color-text)] transition-transform duration-200"
          :class="{ '-rotate-90': isCollapsed }"
        >
          <ChevronDown class="w-4 h-4" />
        </button>
        <!-- Tabs -->
        <div class="flex gap-1" @click.stop>
          <!-- Request tab (always available when there's a sent request) -->
          <button
            class="px-3 py-1 text-xs font-mono uppercase tracking-wider rounded transition-colors"
            :class="[
              activeTab === 'request'
                ? 'bg-[var(--color-secondary)] text-[var(--color-bg)]'
                : 'text-[var(--color-text-dim)] hover:text-[var(--color-text)] hover:bg-[var(--color-bg)]',
              !hasSentRequest ? 'opacity-50 cursor-not-allowed' : ''
            ]"
            :disabled="!hasSentRequest"
            @click="activeTab = 'request'"
          >
            request
          </button>

          <!-- Response tabs -->
          <button
            v-for="tab in (['json', 'raw', 'table', 'headers', 'timing'] as ViewTab[])"
            :key="tab"
            class="px-3 py-1 text-xs font-mono uppercase tracking-wider rounded transition-colors"
            :class="[
              activeTab === tab
                ? 'bg-[var(--color-primary)] text-[var(--color-bg)]'
                : 'text-[var(--color-text-dim)] hover:text-[var(--color-text)] hover:bg-[var(--color-bg)]',
              tab === 'table' && !canShowTable ? 'opacity-50 cursor-not-allowed' : '',
              !hasResponse ? 'opacity-50 cursor-not-allowed' : ''
            ]"
            :disabled="(tab === 'table' && !canShowTable) || !hasResponse"
            @click="activeTab = tab"
          >
            {{ tab }}
          </button>
        </div>
      </div>

      <!-- Response info -->
      <div v-if="hasResponse" class="flex items-center gap-3 text-xs font-mono">
        <span :class="statusClass" class="font-bold">
          {{ response?.status }} {{ response?.statusText }}
        </span>
        <!-- Protocol badge -->
        <span
          v-if="protocol"
          class="px-1.5 py-0.5 rounded text-[10px]"
          :class="protocol === 'HTTP/2' ? 'bg-green-500/20 text-green-400' : 'bg-[var(--color-bg)] text-[var(--color-text-dim)]'"
        >
          {{ protocol }}
        </span>
        <!-- Cache badge -->
        <span
          v-if="fromCache"
          class="px-1.5 py-0.5 rounded text-[10px] bg-blue-500/20 text-blue-400"
        >
          cached
        </span>
        <!-- Redirects badge -->
        <span
          v-if="hasRedirects"
          class="px-1.5 py-0.5 rounded text-[10px] bg-orange-500/20 text-orange-400"
        >
          {{ redirectChain.length }} redirect{{ redirectChain.length > 1 ? 's' : '' }}
        </span>
        <span class="text-[var(--color-text-dim)]">
          {{ formatBytes(response?.size || 0) }}
        </span>
        <span class="text-[var(--color-text-dim)]">
          {{ formatDuration(response?.timing.total || 0) }}
        </span>
      </div>
    </div>

    <!-- Content -->
    <div v-show="!isCollapsed" class="flex-1 overflow-hidden relative">
      <!-- Error banner (shown at top when there's an error but we have data to show) -->
      <div
        v-if="hasError && phase === 'error' && (hasResponse || hasSentRequest)"
        class="absolute top-0 left-0 right-0 z-10 bg-[var(--color-error)]/10 border-b border-[var(--color-error)]/30 px-3 py-1.5"
      >
        <div class="flex items-center gap-2 text-xs">
          <AlertTriangle class="w-3.5 h-3.5 text-[var(--color-error)]" />
          <span class="text-[var(--color-error)] font-medium">{{ error?.message }}</span>
          <span v-if="error?.code" class="text-[var(--color-text-dim)] text-[10px]">({{ error.code }})</span>
        </div>
      </div>

      <!-- Main content area with padding for error banner -->
      <div
        class="h-full"
        :class="{ 'pt-8': hasError && phase === 'error' && (hasResponse || hasSentRequest) }"
      >
        <!-- Loading state (only show if not viewing request tab and no response yet) -->
        <div v-if="isLoading && activeTab !== 'request'" class="h-full flex items-center justify-center">
          <div class="text-center">
            <RefreshCw class="w-8 h-8 mb-3 mx-auto animate-spin text-[var(--color-primary)]" />
            <div class="text-[var(--color-primary)] font-mono text-sm glow-text">
              {{ executionState.funnyText }}
            </div>
            <button
              v-if="hasSentRequest"
              class="mt-3 text-[10px] text-[var(--color-text-dim)] hover:text-[var(--color-secondary)] underline"
              @click="activeTab = 'request'"
            >
              View sent request →
            </button>
          </div>
        </div>

        <!-- Error state (only show full error when there's NO data to display) -->
        <div v-else-if="hasError && phase === 'error' && !hasResponse && !hasSentRequest" class="h-full flex items-center justify-center p-3">
          <div class="text-center max-w-md">
            <Bomb class="w-8 h-8 mb-3 mx-auto text-[var(--color-error)]" />
            <div class="text-[var(--color-error)] font-mono text-sm mb-1.5">
              {{ executionState.funnyText }}
            </div>
            <div class="text-[var(--color-text-dim)] text-xs font-mono">
              {{ error?.message }}
            </div>
            <div v-if="error?.code" class="text-[var(--color-text-dim)] text-[10px] mt-1.5">
              Code: {{ error.code }}
            </div>
          </div>
        </div>

        <!-- Empty state -->
        <div v-else-if="!hasResponse && !hasSentRequest && phase === 'idle'" class="h-full flex items-center justify-center">
          <div class="text-center text-[var(--color-text-dim)]">
            <Radio class="w-8 h-8 mb-3 mx-auto opacity-50" />
            <div class="text-xs">Select a request and click RUN to see the response</div>
          </div>
        </div>

        <!-- Request View (always available when sent request exists) -->
        <div v-show="activeTab === 'request' && hasSentRequest" class="h-full overflow-auto p-2">
          <div class="space-y-2">
            <!-- Request Line -->
            <div class="bg-[var(--color-bg-tertiary)] rounded-sm p-2.5 border border-[var(--color-border)]">
              <div class="flex items-center gap-2 mb-1.5">
                <span
                  class="px-1.5 py-0.5 text-[10px] font-bold rounded-sm"
                  :class="{
                    'bg-green-500/20 text-green-400': sentRequest?.method === 'GET',
                    'bg-blue-500/20 text-blue-400': sentRequest?.method === 'POST',
                    'bg-yellow-500/20 text-yellow-400': sentRequest?.method === 'PUT',
                    'bg-orange-500/20 text-orange-400': sentRequest?.method === 'PATCH',
                    'bg-red-500/20 text-red-400': sentRequest?.method === 'DELETE',
                    'bg-purple-500/20 text-purple-400': !['GET', 'POST', 'PUT', 'PATCH', 'DELETE'].includes(sentRequest?.method || ''),
                  }"
                >
                  {{ sentRequest?.method }}
                </span>
                <span
                  v-if="sentRequest?.viaExtension"
                  class="px-1.5 py-0.5 text-[10px] rounded-sm bg-[var(--color-primary)]/20 text-[var(--color-primary)]"
                  title="Request sent via browser extension (CORS bypassed)"
                >
                  via Extension
                </span>
                <span
                  v-else-if="sentRequest?.viaProxy"
                  class="px-1.5 py-0.5 text-[10px] rounded-sm bg-[var(--color-secondary)]/20 text-[var(--color-secondary)]"
                  title="Request sent via Rust proxy backend (CORS bypassed)"
                >
                  via Proxy
                </span>
                <span
                  v-else
                  class="px-1.5 py-0.5 text-[10px] rounded-sm bg-[var(--color-warning)]/20 text-[var(--color-warning)]"
                  title="Request sent directly (may hit CORS)"
                >
                  Direct Fetch
                </span>
              </div>
              <code class="text-xs text-[var(--color-text)] break-all font-mono">
                {{ sentRequest?.url }}
              </code>
            </div>

            <!-- Request Headers -->
            <div class="bg-[var(--color-bg-tertiary)] rounded-sm border border-[var(--color-border)]">
              <div class="px-2.5 py-1.5 border-b border-[var(--color-border)] flex items-center justify-between">
                <span class="text-[10px] font-bold text-[var(--color-text-dim)] uppercase tracking-wider">
                  Request Headers
                </span>
                <span class="text-[10px] text-[var(--color-text-dim)]">
                  {{ requestHeadersArray.length }}
                </span>
              </div>
              <div class="p-2.5">
                <table v-if="requestHeadersArray.length > 0" class="w-full font-mono text-xs">
                  <tbody>
                    <tr
                      v-for="[key, value] in requestHeadersArray"
                      :key="key"
                      class="hover:bg-[var(--color-bg)]"
                    >
                      <td class="py-0.5 pr-3 text-[var(--color-secondary)] whitespace-nowrap align-top">
                        {{ key }}
                      </td>
                      <td class="py-0.5 text-[var(--color-text)] break-all">
                        <!-- Mask sensitive headers -->
                        <template v-if="key.toLowerCase() === 'authorization'">
                          <span :class="isHeaderRevealed(key) ? 'text-[var(--color-text)]' : 'text-[var(--color-warning)]'">
                            {{ isHeaderRevealed(key) ? value : maskSensitiveValue(value) }}
                          </span>
                          <button
                            class="ml-1.5 text-[10px] text-[var(--color-text-dim)] hover:text-[var(--color-text)]"
                            @click="toggleRevealHeader(key)"
                            :title="isHeaderRevealed(key) ? 'Hide value' : 'Reveal value'"
                          >
                            <component :is="isHeaderRevealed(key) ? Unlock : Lock" class="w-3 h-3 inline" />
                          </button>
                        </template>
                        <template v-else>
                          {{ value }}
                        </template>
                      </td>
                    </tr>
                  </tbody>
                </table>
                <div v-else class="text-[var(--color-text-dim)] text-center py-2 text-xs">
                  No headers sent
                </div>
              </div>
            </div>

            <!-- Request Body (if present) -->
            <div v-if="sentRequest?.body" class="bg-[var(--color-bg-tertiary)] rounded-sm border border-[var(--color-border)]">
              <div class="px-2.5 py-1.5 border-b border-[var(--color-border)] flex items-center justify-between">
                <span class="text-[10px] font-bold text-[var(--color-text-dim)] uppercase tracking-wider">
                  Request Body
                </span>
                <span class="text-[10px] text-[var(--color-text-dim)]">
                  {{ formatBytes(requestBodySize) }}
                </span>
              </div>
              <div class="p-2.5">
                <!-- If JSON, show tree view -->
                <JsonTreeView
                  v-if="requestBodyParsed"
                  :data="requestBodyParsed"
                  :initial-expanded="true"
                />
                <!-- Otherwise show raw -->
                <pre v-else class="font-mono text-xs text-[var(--color-text)] whitespace-pre-wrap break-all">{{ sentRequest.body }}</pre>
              </div>
            </div>
          </div>
        </div>

        <!-- Response content (show when we have response, regardless of error state) -->
        <template v-if="hasResponse">
          <!-- JSON Tree View -->
          <div v-show="activeTab === 'json'" class="h-full overflow-auto p-2">
            <JsonTreeView
              v-if="parsedBody"
              :data="parsedBody"
              :initial-expanded="true"
            />
            <div v-else class="text-[var(--color-text-dim)] text-center py-6 text-xs">
              Response is not valid JSON
            </div>
          </div>

          <!-- Raw View -->
          <div v-show="activeTab === 'raw'" class="h-full">
            <RawView
              :content="response?.body || ''"
              :content-type="response?.headers['content-type']"
            />
          </div>

          <!-- Table View -->
          <div v-show="activeTab === 'table'" class="h-full">
            <TableView :data="parsedBody" />
          </div>

          <!-- Headers View -->
          <div v-show="activeTab === 'headers'" class="h-full overflow-auto p-2">
            <table class="w-full font-mono text-xs">
              <tbody>
                <tr
                  v-for="[key, value] in headersArray"
                  :key="key"
                  class="hover:bg-[var(--color-bg-tertiary)]"
                >
                  <td class="py-0.5 pr-3 text-[var(--color-primary)] whitespace-nowrap align-top">
                    {{ key }}
                  </td>
                  <td class="py-0.5 text-[var(--color-text)] break-all">
                    {{ value }}
                  </td>
                </tr>
              </tbody>
            </table>

            <div v-if="headersArray.length === 0" class="text-[var(--color-text-dim)] text-center py-6 text-xs">
              No headers in response
            </div>
          </div>

          <!-- Timing View -->
          <div v-show="activeTab === 'timing'" class="h-full overflow-auto p-2">
            <div class="space-y-2">
              <!-- Timing Waterfall -->
              <div class="bg-[var(--color-bg-tertiary)] rounded-sm border border-[var(--color-border)]">
                <div class="px-2.5 py-1.5 border-b border-[var(--color-border)] flex items-center gap-1.5">
                  <Clock class="w-3.5 h-3.5 text-[var(--color-primary)]" />
                  <span class="text-[10px] font-bold text-[var(--color-text-dim)] uppercase tracking-wider">
                    Timing Breakdown
                  </span>
                </div>
                <div class="p-2.5">
                  <template v-if="hasDetailedTiming && timing">
                    <div class="space-y-1.5">
                      <!-- Blocked -->
                      <div v-if="timing.blocked !== undefined && timing.blocked > 0" class="flex items-center gap-2">
                        <span class="w-16 text-[10px] text-[var(--color-text-dim)] font-mono">Blocked</span>
                        <div class="flex-1 h-3 bg-[var(--color-bg)] rounded-sm overflow-hidden">
                          <div
                            class="h-full bg-gray-500/80"
                            :style="{ width: `${Math.max(2, (timing.blocked / timing.total) * 100)}%` }"
                          />
                        </div>
                        <span class="w-12 text-right text-[10px] text-[var(--color-text)] font-mono">{{ timing.blocked.toFixed(0) }}ms</span>
                      </div>
                      <!-- DNS -->
                      <div v-if="timing.dns !== undefined" class="flex items-center gap-2">
                        <span class="w-16 text-[10px] text-[var(--color-text-dim)] font-mono">DNS</span>
                        <div class="flex-1 h-3 bg-[var(--color-bg)] rounded-sm overflow-hidden">
                          <div
                            class="h-full bg-green-500/80"
                            :style="{ width: `${Math.max(2, (timing.dns / timing.total) * 100)}%` }"
                          />
                        </div>
                        <span class="w-12 text-right text-[10px] text-[var(--color-text)] font-mono">{{ timing.dns.toFixed(0) }}ms</span>
                      </div>
                      <!-- TCP -->
                      <div v-if="timing.tcp !== undefined" class="flex items-center gap-2">
                        <span class="w-16 text-[10px] text-[var(--color-text-dim)] font-mono">TCP</span>
                        <div class="flex-1 h-3 bg-[var(--color-bg)] rounded-sm overflow-hidden">
                          <div
                            class="h-full bg-blue-500/80"
                            :style="{ width: `${Math.max(2, (timing.tcp / timing.total) * 100)}%` }"
                          />
                        </div>
                        <span class="w-12 text-right text-[10px] text-[var(--color-text)] font-mono">{{ timing.tcp.toFixed(0) }}ms</span>
                      </div>
                      <!-- TLS -->
                      <div v-if="timing.tls !== undefined && timing.tls > 0" class="flex items-center gap-2">
                        <span class="w-16 text-[10px] text-[var(--color-text-dim)] font-mono">TLS</span>
                        <div class="flex-1 h-3 bg-[var(--color-bg)] rounded-sm overflow-hidden">
                          <div
                            class="h-full bg-purple-500/80"
                            :style="{ width: `${Math.max(2, (timing.tls / timing.total) * 100)}%` }"
                          />
                        </div>
                        <span class="w-12 text-right text-[10px] text-[var(--color-text)] font-mono">{{ timing.tls.toFixed(0) }}ms</span>
                      </div>
                      <!-- TTFB -->
                      <div v-if="timing.ttfb !== undefined" class="flex items-center gap-2">
                        <span class="w-16 text-[10px] text-[var(--color-text-dim)] font-mono">TTFB</span>
                        <div class="flex-1 h-3 bg-[var(--color-bg)] rounded-sm overflow-hidden">
                          <div
                            class="h-full bg-orange-500/80"
                            :style="{ width: `${Math.max(2, (timing.ttfb / timing.total) * 100)}%` }"
                          />
                        </div>
                        <span class="w-12 text-right text-[10px] text-[var(--color-text)] font-mono">{{ timing.ttfb.toFixed(0) }}ms</span>
                      </div>
                      <!-- Download -->
                      <div v-if="timing.download !== undefined" class="flex items-center gap-2">
                        <span class="w-16 text-[10px] text-[var(--color-text-dim)] font-mono">Download</span>
                        <div class="flex-1 h-3 bg-[var(--color-bg)] rounded-sm overflow-hidden">
                          <div
                            class="h-full bg-cyan-500/80"
                            :style="{ width: `${Math.max(2, (timing.download / timing.total) * 100)}%` }"
                          />
                        </div>
                        <span class="w-12 text-right text-[10px] text-[var(--color-text)] font-mono">{{ timing.download.toFixed(0) }}ms</span>
                      </div>
                      <!-- Total -->
                      <div class="flex items-center gap-2 pt-1.5 mt-1 border-t border-[var(--color-border)]">
                        <span class="w-16 text-[10px] text-[var(--color-primary)] font-mono font-bold">TOTAL</span>
                        <div class="flex-1" />
                        <span class="w-12 text-right text-xs text-[var(--color-primary)] font-mono font-bold">{{ timing.total.toFixed(0) }}ms</span>
                      </div>
                    </div>
                  </template>
                  <template v-else-if="timing">
                    <div class="text-center py-2">
                      <div class="text-xl font-mono text-[var(--color-primary)] font-bold">{{ timing.total.toFixed(0) }}ms</div>
                      <div class="text-[10px] text-[var(--color-text-dim)] mt-0.5">Total request time</div>
                      <div class="text-[10px] text-[var(--color-text-dim)] mt-1">
                        Detailed timing not available
                      </div>
                    </div>
                  </template>
                </div>
              </div>

              <!-- Network Info -->
              <div v-if="hasNetworkInfo" class="bg-[var(--color-bg-tertiary)] rounded-sm border border-[var(--color-border)]">
                <div class="px-2.5 py-1.5 border-b border-[var(--color-border)] flex items-center gap-1.5">
                  <Globe class="w-3.5 h-3.5 text-[var(--color-secondary)]" />
                  <span class="text-[10px] font-bold text-[var(--color-text-dim)] uppercase tracking-wider">
                    Network Info
                  </span>
                </div>
                <div class="p-2.5">
                  <div class="grid grid-cols-2 md:grid-cols-3 gap-x-4 gap-y-2">
                    <!-- Server IP -->
                    <div v-if="serverIP" class="flex items-center gap-1.5">
                      <Server class="w-3 h-3 text-[var(--color-text-dim)] shrink-0" />
                      <div class="min-w-0">
                        <div class="text-[10px] text-[var(--color-text-dim)]">Server IP</div>
                        <div class="text-xs font-mono text-[var(--color-text)] truncate">{{ serverIP }}</div>
                      </div>
                    </div>

                    <!-- Protocol -->
                    <div v-if="protocol" class="flex items-center gap-1.5">
                      <Zap class="w-3 h-3 text-[var(--color-text-dim)] shrink-0" />
                      <div>
                        <div class="text-[10px] text-[var(--color-text-dim)]">Protocol</div>
                        <div class="text-xs font-mono" :class="protocol === 'HTTP/2' ? 'text-green-400' : 'text-[var(--color-text)]'">
                          {{ protocol }}
                        </div>
                      </div>
                    </div>

                    <!-- From Cache -->
                    <div v-if="fromCache" class="flex items-center gap-1.5">
                      <Database class="w-3 h-3 text-green-400 shrink-0" />
                      <div>
                        <div class="text-[10px] text-[var(--color-text-dim)]">Cache</div>
                        <div class="text-xs font-mono text-green-400">Cached</div>
                      </div>
                    </div>

                    <!-- Connection Type -->
                    <div v-if="connectionType" class="flex items-center gap-1.5">
                      <Wifi class="w-3 h-3 text-[var(--color-text-dim)] shrink-0" />
                      <div>
                        <div class="text-[10px] text-[var(--color-text-dim)]">Connection</div>
                        <div class="text-xs font-mono text-[var(--color-text)]">{{ connectionType }}</div>
                      </div>
                    </div>

                    <!-- Server Software -->
                    <div v-if="serverSoftware" class="flex items-center gap-1.5">
                      <Server class="w-3 h-3 text-[var(--color-text-dim)] shrink-0" />
                      <div class="min-w-0">
                        <div class="text-[10px] text-[var(--color-text-dim)]">Server</div>
                        <div class="text-xs font-mono text-[var(--color-text)] truncate">{{ serverSoftware }}</div>
                      </div>
                    </div>

                    <!-- Resource Type -->
                    <div v-if="resourceType" class="flex items-center gap-1.5">
                      <FileText class="w-3 h-3 text-[var(--color-text-dim)] shrink-0" />
                      <div>
                        <div class="text-[10px] text-[var(--color-text-dim)]">Type</div>
                        <div class="text-xs font-mono text-[var(--color-text)]">{{ resourceType }}</div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <!-- Redirect Chain -->
              <div v-if="hasRedirects" class="bg-[var(--color-bg-tertiary)] rounded-sm border border-[var(--color-border)]">
                <div class="px-2.5 py-1.5 border-b border-[var(--color-border)] flex items-center gap-1.5">
                  <ArrowRight class="w-3.5 h-3.5 text-[var(--color-secondary)]" />
                  <span class="text-[10px] font-bold text-[var(--color-text-dim)] uppercase tracking-wider">
                    Redirects ({{ redirectChain.length }})
                  </span>
                </div>
                <div class="p-2.5">
                  <div class="space-y-1.5">
                    <div
                      v-for="(hop, index) in redirectChain"
                      :key="index"
                      class="flex items-center gap-2 text-xs"
                    >
                      <span
                        class="px-1 py-0.5 rounded-sm text-[10px] font-bold shrink-0"
                        :class="{
                          'bg-yellow-500/20 text-yellow-400': hop.status === 301 || hop.status === 308,
                          'bg-orange-500/20 text-orange-400': hop.status === 302 || hop.status === 307,
                          'bg-blue-500/20 text-blue-400': hop.status === 303,
                        }"
                      >
                        {{ hop.status }}
                      </span>
                      <code class="text-[var(--color-text)] break-all text-[10px] flex-1 min-w-0 truncate">{{ hop.url }}</code>
                      <span class="text-[10px] text-[var(--color-text-dim)] shrink-0">{{ hop.duration.toFixed(0) }}ms</span>
                    </div>
                    <!-- Final destination -->
                    <div class="flex items-center gap-2 text-xs pt-1.5 border-t border-[var(--color-border)]">
                      <span class="px-1 py-0.5 rounded-sm text-[10px] font-bold bg-green-500/20 text-green-400 shrink-0">
                        {{ response?.status }}
                      </span>
                      <code class="text-[var(--color-primary)] break-all text-[10px] font-bold flex-1 min-w-0 truncate">{{ response?.url || 'Final URL' }}</code>
                    </div>
                  </div>
                </div>
              </div>

              <!-- Size Breakdown & TLS in a row -->
              <div class="grid grid-cols-1 md:grid-cols-2 gap-2">
                <!-- Size Breakdown -->
                <div class="bg-[var(--color-bg-tertiary)] rounded-sm border border-[var(--color-border)]">
                  <div class="px-2.5 py-1.5 border-b border-[var(--color-border)] flex items-center gap-1.5">
                    <FileText class="w-3.5 h-3.5 text-[var(--color-primary)]" />
                    <span class="text-[10px] font-bold text-[var(--color-text-dim)] uppercase tracking-wider">
                      Size
                    </span>
                  </div>
                  <div class="p-2.5">
                    <template v-if="hasSizeBreakdown && sizeBreakdown">
                      <div class="grid grid-cols-2 gap-x-3 gap-y-1.5 text-xs">
                        <div v-if="requestBodySizeFromExtension">
                          <span class="text-[10px] text-[var(--color-text-dim)]">Req Body</span>
                          <div class="font-mono text-[var(--color-secondary)]">{{ formatBytes(requestBodySizeFromExtension) }}</div>
                        </div>
                        <div>
                          <span class="text-[10px] text-[var(--color-text-dim)]">Headers</span>
                          <div class="font-mono text-[var(--color-text)]">{{ formatBytes(sizeBreakdown.headers) }}</div>
                        </div>
                        <div>
                          <span class="text-[10px] text-[var(--color-text-dim)]">Body</span>
                          <div class="font-mono text-[var(--color-text)]">{{ formatBytes(sizeBreakdown.body) }}</div>
                        </div>
                        <div>
                          <span class="text-[10px] text-[var(--color-text-dim)]">Total</span>
                          <div class="font-mono text-[var(--color-primary)] font-bold">{{ formatBytes(sizeBreakdown.total) }}</div>
                        </div>
                        <div v-if="sizeBreakdown.encoding && sizeBreakdown.encoding !== 'identity'" class="col-span-2">
                          <span class="text-[10px] text-[var(--color-text-dim)]">Compression</span>
                          <div class="flex items-center gap-1.5">
                            <span class="font-mono text-green-400">{{ sizeBreakdown.encoding.toUpperCase() }}</span>
                            <span v-if="sizeBreakdown.compressionRatio" class="text-[10px] text-green-400">
                              {{ ((1 - sizeBreakdown.compressionRatio) * 100).toFixed(0) }}% saved
                            </span>
                          </div>
                        </div>
                      </div>
                    </template>
                    <template v-else>
                      <div class="text-center py-1">
                        <div class="text-lg font-mono text-[var(--color-primary)] font-bold">{{ formatBytes(response?.size || 0) }}</div>
                        <div class="text-[10px] text-[var(--color-text-dim)]">Total size</div>
                      </div>
                    </template>
                  </div>
                </div>

                <!-- TLS Info -->
                <div v-if="tlsInfo" class="bg-[var(--color-bg-tertiary)] rounded-sm border border-[var(--color-border)]">
                  <div class="px-2.5 py-1.5 border-b border-[var(--color-border)] flex items-center gap-1.5">
                    <Shield class="w-3.5 h-3.5 text-green-400" />
                    <span class="text-[10px] font-bold text-[var(--color-text-dim)] uppercase tracking-wider">
                      TLS / SSL
                    </span>
                  </div>
                  <div class="p-2.5 space-y-2">
                    <!-- Protocol & Cipher -->
                    <div class="flex items-center gap-2">
                      <div class="w-7 h-7 rounded-sm bg-green-500/20 flex items-center justify-center shrink-0">
                        <Lock class="w-4 h-4 text-green-400" />
                      </div>
                      <div class="min-w-0">
                        <div class="text-xs text-[var(--color-text)] font-medium">{{ tlsInfo.protocol || 'HTTPS' }}</div>
                        <div v-if="tlsInfo.cipher" class="text-[10px] text-[var(--color-text-dim)] truncate" :title="tlsInfo.cipher">
                          {{ tlsInfo.cipher }}
                        </div>
                        <div v-else class="text-[10px] text-[var(--color-text-dim)]">Secure</div>
                      </div>
                    </div>

                    <!-- Certificate Details -->
                    <div v-if="tlsInfo.subject || tlsInfo.issuer" class="border-t border-[var(--color-border)] pt-2 space-y-1.5">
                      <!-- Subject -->
                      <div v-if="tlsInfo.subject" class="text-[10px]">
                        <span class="text-[var(--color-text-dim)]">Subject:</span>
                        <span class="text-[var(--color-text)] ml-1 font-mono">{{ tlsInfo.subject }}</span>
                      </div>
                      <!-- Issuer -->
                      <div v-if="tlsInfo.issuer" class="text-[10px]">
                        <span class="text-[var(--color-text-dim)]">Issuer:</span>
                        <span class="text-[var(--color-text)] ml-1 font-mono">{{ tlsInfo.issuer }}</span>
                      </div>
                      <!-- Validity -->
                      <div v-if="tlsInfo.validFrom || tlsInfo.validTo" class="text-[10px]">
                        <span class="text-[var(--color-text-dim)]">Valid:</span>
                        <span class="text-[var(--color-text)] ml-1 font-mono">
                          {{ tlsInfo.validFrom ? new Date(tlsInfo.validFrom * 1000).toLocaleDateString() : '?' }}
                          →
                          {{ tlsInfo.validTo ? new Date(tlsInfo.validTo * 1000).toLocaleDateString() : '?' }}
                        </span>
                        <span
                          v-if="tlsInfo.validTo && tlsInfo.validTo * 1000 < Date.now()"
                          class="ml-1 text-red-400"
                        >
                          (Expired)
                        </span>
                        <span
                          v-else-if="tlsInfo.validTo && (tlsInfo.validTo * 1000 - Date.now()) < 30 * 24 * 60 * 60 * 1000"
                          class="ml-1 text-yellow-400"
                        >
                          (Expiring soon)
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </template>
      </div>
    </div>
  </div>
</template>

