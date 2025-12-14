<script setup lang="ts">
import { computed } from 'vue'
import { Globe, Server, Zap, Database, Wifi, FileText, Hash, Network } from 'lucide-vue-next'
import SectionHeader from '../shared/SectionHeader.vue'
import InfoItem from '../shared/InfoItem.vue'

const props = defineProps<{
  serverIP?: string
  protocol?: string
  fromCache?: boolean
  connectionType?: string
  serverSoftware?: string
  resourceType?: string
  hostname?: string
  port?: string
  resolvedIPs?: string[]
}>()

const hasAnyInfo = computed(() => {
  return props.serverIP || props.protocol || props.fromCache ||
         props.connectionType || props.serverSoftware || props.hostname ||
         props.port || (props.resolvedIPs && props.resolvedIPs.length > 0)
})

const protocolClass = computed(() => {
  return props.protocol === 'HTTP/2' ? 'text-green-400' : 'text-[var(--color-text)]'
})

const allIPsText = computed(() => {
  if (!props.resolvedIPs || props.resolvedIPs.length === 0) return ''
  if (props.resolvedIPs.length === 1) return props.resolvedIPs[0]
  return props.resolvedIPs.join(', ')
})
</script>

<template>
  <div v-if="hasAnyInfo" class="bg-[var(--color-bg-tertiary)] rounded-sm border border-[var(--color-border)]">
    <SectionHeader :icon="Globe" title="Network Info" />
    <div class="p-2.5">
      <div class="grid grid-cols-2 md:grid-cols-3 gap-x-4 gap-y-2">
        <!-- Hostname -->
        <InfoItem
          v-if="hostname"
          :icon="Globe"
          label="Hostname"
          :value="hostname"
          :truncate="true"
        />

        <!-- Port -->
        <InfoItem
          v-if="port"
          :icon="Hash"
          label="Port"
          :value="port"
        />

        <!-- Server IP -->
        <InfoItem
          v-if="serverIP"
          :icon="Server"
          label="Server IP"
          :value="serverIP"
          :truncate="true"
        />

        <!-- All Resolved IPs (if more than one) -->
        <div v-if="resolvedIPs && resolvedIPs.length > 1" class="col-span-2 md:col-span-3 flex items-start gap-1.5">
          <Network class="w-3 h-3 text-[var(--color-text-dim)] shrink-0 mt-0.5" />
          <div class="min-w-0 flex-1">
            <div class="text-[10px] text-[var(--color-text-dim)]">All Resolved IPs</div>
            <div class="text-xs font-mono text-[var(--color-text)] break-all">
              {{ allIPsText }}
            </div>
          </div>
        </div>

        <!-- Protocol -->
        <InfoItem
          v-if="protocol"
          :icon="Zap"
          label="Protocol"
          :value="protocol"
          :value-class="protocolClass"
        />

        <!-- From Cache -->
        <InfoItem
          v-if="fromCache"
          :icon="Database"
          label="Cache"
          value="Cached"
          value-class="text-green-400"
        />

        <!-- Connection Type -->
        <InfoItem
          v-if="connectionType"
          :icon="Wifi"
          label="Connection"
          :value="connectionType"
        />

        <!-- Server Software -->
        <InfoItem
          v-if="serverSoftware"
          :icon="Server"
          label="Server"
          :value="serverSoftware"
          :truncate="true"
        />

        <!-- Resource Type -->
        <InfoItem
          v-if="resourceType"
          :icon="FileText"
          label="Type"
          :value="resourceType"
        />
      </div>
    </div>
  </div>
</template>
