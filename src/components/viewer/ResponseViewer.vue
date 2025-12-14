<script setup lang="ts">
import { computed, watch } from 'vue'
import { useExecutionStore } from '@/stores/executionStore'

// Child components
import ResponseViewerHeader, { type ViewTab } from './ResponseViewerHeader.vue'
import LoadingState from './states/LoadingState.vue'
import ErrorState from './states/ErrorState.vue'
import EmptyState from './states/EmptyState.vue'
import ErrorBanner from './states/ErrorBanner.vue'
import RequestTabView from './tabs/RequestTabView.vue'
import ResponseTabView from './tabs/ResponseTabView.vue'
import ResponseHeadersView from './tabs/ResponseHeadersView.vue'
import TimingTabView from './tabs/TimingTabView.vue'

// State
const executionStore = useExecutionStore()
const activeTab = defineModel<ViewTab>('activeTab', { default: 'response' })
const isCollapsed = defineModel<boolean>('collapsed', { default: true })

// Execution state from store
const executionState = computed(() => executionStore.executionState)
const sentRequest = computed(() => executionState.value.sentRequest)
const response = computed(() => executionState.value.response)
const error = computed(() => executionState.value.error)
const phase = computed(() => executionState.value.phase)

// Derived state
const hasResponse = computed(() => response.value !== undefined)
const hasSentRequest = computed(() => sentRequest.value !== undefined)
const hasError = computed(() => error.value !== undefined)
const isLoading = computed(() => phase.value === 'authenticating' || phase.value === 'fetching')

// Redirect count for header
const redirectCount = computed(() => response.value?.redirectChain?.length ?? 0)

// Show error banner when we have error but also have data to show
const showErrorBanner = computed(() => {
  return hasError.value && phase.value === 'error' && (hasResponse.value || hasSentRequest.value)
})

// Show full error state when we have error but NO data to show
const showFullError = computed(() => {
  return hasError.value && phase.value === 'error' && !hasResponse.value && !hasSentRequest.value
})

// Show empty state
const showEmpty = computed(() => {
  return !hasResponse.value && !hasSentRequest.value && phase.value === 'idle'
})

// Show loading state (not viewing request tab)
const showLoading = computed(() => {
  return isLoading.value && activeTab.value !== 'request'
})

// Auto-select response tab when response arrives
watch(response, (newResponse) => {
  if (!newResponse) return
  activeTab.value = 'response'
})

// Show request tab when request starts
watch(sentRequest, (newSentRequest) => {
  if (newSentRequest && !response.value) {
    activeTab.value = 'request'
  }
})

function handleViewRequest() {
  activeTab.value = 'request'
}
</script>

<template>
  <div class="flex flex-col" :class="isCollapsed ? '' : 'h-full'">
    <!-- Header with tabs -->
    <ResponseViewerHeader
      v-model:active-tab="activeTab"
      v-model:is-collapsed="isCollapsed"
      :response="response"
      :has-sent-request="hasSentRequest"
      :has-response="hasResponse"
      :redirect-count="redirectCount"
      :protocol="response?.protocol"
      :from-cache="response?.fromCache"
    />

    <!-- Content -->
    <div v-show="!isCollapsed" class="flex-1 overflow-hidden relative">
      <!-- Error banner -->
      <ErrorBanner v-if="showErrorBanner && error" :error="error" />

      <!-- Main content area -->
      <div class="h-full" :class="{ 'pt-8': showErrorBanner }">
        <!-- Loading state -->
        <LoadingState
          v-if="showLoading"
          :funny-text="executionState.funnyText"
          :show-view-request="hasSentRequest"
          @view-request="handleViewRequest"
        />

        <!-- Full error state -->
        <ErrorState
          v-else-if="showFullError && error"
          :error="error"
          :funny-text="executionState.funnyText"
        />

        <!-- Empty state -->
        <EmptyState v-else-if="showEmpty" />

        <!-- Request Tab -->
        <RequestTabView
          v-show="activeTab === 'request' && hasSentRequest && sentRequest"
          :sent-request="sentRequest!"
        />

        <!-- Response content tabs -->
        <template v-if="hasResponse && response">
          <!-- Response Tab (JSON, XML, HTML, Text, Image, Hex, Table) -->
          <ResponseTabView
            v-show="activeTab === 'response'"
            :response="response"
            class="h-full"
          />

          <!-- Headers View -->
          <ResponseHeadersView v-show="activeTab === 'headers'" :headers="response.headers" />

          <!-- Timing View -->
          <TimingTabView v-show="activeTab === 'timing'" :response="response" />
        </template>
      </div>
    </div>
  </div>
</template>
