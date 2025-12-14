<script setup lang="ts">
import { computed } from 'vue'
import type { ExecutionResponse } from '@/types/execution'
import TimingBreakdownCard from '../cards/TimingBreakdownCard.vue'
import NetworkInfoCard from '../cards/NetworkInfoCard.vue'
import RedirectChainCard from '../cards/RedirectChainCard.vue'
import SizeBreakdownCard from '../cards/SizeBreakdownCard.vue'
import TlsInfoCard from '../cards/TlsInfoCard.vue'

const props = defineProps<{
  response: ExecutionResponse
}>()

// Computed properties to extract data from response
const timing = computed(() => props.response.timing)
const redirectChain = computed(() => props.response.redirectChain || [])
const hasRedirects = computed(() => redirectChain.value.length > 0)
const sizeBreakdown = computed(() => props.response.sizeBreakdown)
const tlsInfo = computed(() => props.response.tls)

// Network info
const serverIP = computed(() => props.response.serverIP)
const protocol = computed(() => props.response.protocol)
const fromCache = computed(() => props.response.fromCache)
const connectionType = computed(() => props.response.connection)
const serverSoftware = computed(() => props.response.serverSoftware)
const resourceType = computed(() => props.response.resourceType)
const requestBodySize = computed(() => props.response.requestBodySize)

// DNS/connection details
const hostname = computed(() => props.response.hostname)
const port = computed(() => props.response.port)
const resolvedIPs = computed(() => props.response.resolvedIps)

const hasNetworkInfo = computed(() => {
  return serverIP.value || protocol.value || fromCache.value ||
         connectionType.value || serverSoftware.value || hostname.value ||
         port.value || (resolvedIPs.value && resolvedIPs.value.length > 0)
})
</script>

<template>
  <div class="h-full overflow-auto p-2">
    <div class="space-y-2">
      <!-- Timing Breakdown -->
      <TimingBreakdownCard :timing="timing" />

      <!-- Network Info -->
      <NetworkInfoCard
        v-if="hasNetworkInfo"
        :server-i-p="serverIP"
        :protocol="protocol"
        :from-cache="fromCache"
        :connection-type="connectionType"
        :server-software="serverSoftware"
        :resource-type="resourceType"
        :hostname="hostname"
        :port="port"
        :resolved-i-ps="resolvedIPs"
      />

      <!-- Redirect Chain -->
      <RedirectChainCard
        v-if="hasRedirects"
        :redirect-chain="redirectChain"
        :final-status="response.status"
        :final-url="response.url"
      />

      <!-- Size & TLS Grid -->
      <div class="grid grid-cols-1 md:grid-cols-2 gap-2">
        <!-- Size Breakdown -->
        <SizeBreakdownCard
          :size-breakdown="sizeBreakdown"
          :total-size="response.size || 0"
          :request-body-size="requestBodySize"
        />

        <!-- TLS Info -->
        <TlsInfoCard v-if="tlsInfo" :tls-info="tlsInfo" />
      </div>
    </div>
  </div>
</template>
