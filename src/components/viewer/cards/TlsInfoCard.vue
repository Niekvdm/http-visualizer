<script setup lang="ts">
import { computed } from 'vue'
import type { TlsInfo } from '@/types/execution'
import { Shield, Lock, Info } from 'lucide-vue-next'
import SectionHeader from '../shared/SectionHeader.vue'
import { isWails } from '@/services/storage/platform'

const props = defineProps<{
  tlsInfo: TlsInfo
}>()

// Detect if running in browser (not desktop)
const isBrowserMode = computed(() => !isWails())

// Check if certificate details are missing (browser limitation)
const hasMissingCertDetails = computed(() => {
  return isBrowserMode.value && !props.tlsInfo.issuer && !props.tlsInfo.subject
})

const validFromDate = computed(() => {
  if (!props.tlsInfo.validFrom) return '?'
  return new Date(props.tlsInfo.validFrom * 1000).toLocaleDateString()
})

const validToDate = computed(() => {
  if (!props.tlsInfo.validTo) return '?'
  return new Date(props.tlsInfo.validTo * 1000).toLocaleDateString()
})

const isExpired = computed(() => {
  if (!props.tlsInfo.validTo) return false
  return props.tlsInfo.validTo * 1000 < Date.now()
})

const isExpiringSoon = computed(() => {
  if (!props.tlsInfo.validTo || isExpired.value) return false
  const thirtyDays = 30 * 24 * 60 * 60 * 1000
  return (props.tlsInfo.validTo * 1000 - Date.now()) < thirtyDays
})

const hasCertDetails = computed(() => {
  return props.tlsInfo.subject || props.tlsInfo.issuer
})

const hasSANs = computed(() => {
  return props.tlsInfo.san && props.tlsInfo.san.length > 0
})
</script>

<template>
  <div class="bg-[var(--color-bg-tertiary)] rounded-sm border border-[var(--color-border)]">
    <SectionHeader :icon="Shield" title="TLS / SSL" />
    <div class="p-2.5 space-y-2">
      <!-- Protocol & Cipher -->
      <div class="flex items-center gap-2">
        <div class="w-7 h-7 rounded-sm bg-green-500/20 flex items-center justify-center shrink-0">
          <Lock class="w-4 h-4 text-green-400" />
        </div>
        <div class="min-w-0">
          <div class="text-xs text-[var(--color-text)] font-medium">
            {{ tlsInfo.protocol || 'HTTPS' }}
          </div>
          <div v-if="tlsInfo.cipher" class="text-[10px] text-[var(--color-text-dim)] truncate" :title="tlsInfo.cipher">
            {{ tlsInfo.cipher }}
          </div>
          <div v-else class="text-[10px] text-[var(--color-text-dim)]">Secure</div>
        </div>
      </div>

      <!-- Certificate Details -->
      <div v-if="hasCertDetails" class="border-t border-[var(--color-border)] pt-2 space-y-1.5">
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
            {{ validFromDate }} → {{ validToDate }}
          </span>
          <span v-if="isExpired" class="ml-1 text-red-400">(Expired)</span>
          <span v-else-if="isExpiringSoon" class="ml-1 text-yellow-400">(Expiring soon)</span>
        </div>
      </div>

      <!-- Subject Alternative Names (SANs) -->
      <div v-if="hasSANs" class="border-t border-[var(--color-border)] pt-2">
        <div class="text-[10px] text-[var(--color-text-dim)] mb-1">Subject Alternative Names:</div>
        <div class="flex flex-wrap gap-1">
          <span
            v-for="san in tlsInfo.san"
            :key="san"
            class="px-1.5 py-0.5 text-[10px] font-mono bg-[var(--color-bg)] text-[var(--color-text)] rounded"
          >
            {{ san }}
          </span>
        </div>
      </div>

      <!-- Browser limitation notice -->
      <div
        v-if="hasMissingCertDetails"
        class="border-t border-[var(--color-border)] pt-2 flex items-start gap-1.5"
      >
        <Info class="w-3 h-3 text-[var(--color-text-dim)] shrink-0 mt-0.5" />
        <span class="text-[10px] text-[var(--color-text-dim)] leading-tight">
          Certificate details (issuer, subject, validity) require the desktop app due to browser API limitations.
        </span>
      </div>
    </div>
  </div>
</template>
