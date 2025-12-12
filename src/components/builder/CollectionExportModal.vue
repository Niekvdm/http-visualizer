<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useFileExport } from '@/composables/useFileExport'
import BaseModal from '@/components/shared/BaseModal.vue'
import { 
  AlertTriangle, 
  Shield, 
  ShieldCheck,
  Download,
  Eye,
  EyeOff,
  Globe,
  Lock
} from 'lucide-vue-next'
import type { ExportPreview, SecretFinding } from '@/types'

const props = defineProps<{
  show: boolean
}>()

const emit = defineEmits<{
  close: []
  exported: []
}>()

const { getExportPreview, exportCollectionsWithOptions } = useFileExport()

// Export options
const includeEnvironments = ref(false)
const redactSecrets = ref(false)

// Preview data
const preview = ref<ExportPreview | null>(null)

// Load preview when modal opens
watch(() => props.show, (isShown) => {
  if (isShown) {
    preview.value = getExportPreview()
    // Reset options
    includeEnvironments.value = false
    redactSecrets.value = false
  }
}, { immediate: true })

// Computed values
const hasCollections = computed(() => (preview.value?.collections.length ?? 0) > 0)
const collectionCount = computed(() => preview.value?.collections.length ?? 0)
const environmentCount = computed(() => preview.value?.environments.length ?? 0)

const secretScan = computed(() => preview.value?.secretScan)
const hasHardcodedSecrets = computed(() => secretScan.value?.hasHardcodedSecrets ?? false)
const hardcodedCount = computed(() => secretScan.value?.hardcodedCount ?? 0)
const variableRefCount = computed(() => secretScan.value?.variableRefCount ?? 0)

// Get only hardcoded findings for display
const hardcodedFindings = computed((): SecretFinding[] => {
  if (!secretScan.value) return []
  return secretScan.value.findings.filter(f => !f.isVariable).slice(0, 5)
})

const remainingHardcodedCount = computed(() => {
  const total = secretScan.value?.hardcodedCount ?? 0
  return Math.max(0, total - 5)
})

// Security status
const securityStatus = computed(() => {
  if (!hasHardcodedSecrets.value) {
    return { level: 'safe', label: 'Safe to share', icon: ShieldCheck }
  }
  if (redactSecrets.value) {
    return { level: 'redacted', label: 'Secrets will be redacted', icon: Shield }
  }
  return { level: 'warning', label: 'Contains data', icon: AlertTriangle }
})

// Handle export
function handleExport() {
  exportCollectionsWithOptions({
    includeEnvironments: includeEnvironments.value,
    redactSecrets: redactSecrets.value,
  })
  emit('exported')
  emit('close')
}

function handleCancel() {
  emit('close')
}
</script>

<template>
  <BaseModal 
    :show="show" 
    title="Export Collections"
    :subtitle="`${collectionCount} collection${collectionCount !== 1 ? 's' : ''}`"
    max-width="max-w-xl"
    @close="handleCancel"
  >
    <div class="space-y-4">
      <!-- No collections warning -->
      <div v-if="!hasCollections" class="text-center py-8">
        <p class="text-[var(--color-text-dim)]">No collections to export.</p>
      </div>

      <template v-else>
        <!-- Security Status Banner -->
        <div 
          class="flex items-center gap-3 p-3 rounded-lg border"
          :class="{
            'bg-green-500/10 border-green-500/30': securityStatus.level === 'safe',
            'bg-yellow-500/10 border-yellow-500/30': securityStatus.level === 'redacted',
            'bg-red-500/10 border-red-500/30': securityStatus.level === 'warning',
          }"
        >
          <component 
            :is="securityStatus.icon" 
            class="w-5 h-5 shrink-0"
            :class="{
              'text-green-400': securityStatus.level === 'safe',
              'text-yellow-400': securityStatus.level === 'redacted',
              'text-red-400': securityStatus.level === 'warning',
            }"
          />
          <div class="flex-1 min-w-0">
            <p 
              class="text-sm font-medium"
              :class="{
                'text-green-400': securityStatus.level === 'safe',
                'text-yellow-400': securityStatus.level === 'redacted',
                'text-red-400': securityStatus.level === 'warning',
              }"
            >
              {{ securityStatus.label }}
            </p>
            <p class="text-xs text-[var(--color-text-dim)] mt-0.5">
              <template v-if="variableRefCount > 0">
                {{ variableRefCount }} secret{{ variableRefCount !== 1 ? 's' : '' }} using variables (safe)
              </template>
              <template v-if="variableRefCount > 0 && hardcodedCount > 0"> · </template>
              <template v-if="hardcodedCount > 0">
                {{ hardcodedCount }} hardcoded secret{{ hardcodedCount !== 1 ? 's' : '' }}
              </template>
              <template v-if="variableRefCount === 0 && hardcodedCount === 0">
                No authentication secrets found
              </template>
            </p>
          </div>
        </div>

        <!-- Hardcoded Secrets Warning -->
        <div 
          v-if="hasHardcodedSecrets && !redactSecrets"
          class="p-3 rounded-lg bg-[var(--color-bg-tertiary)] border border-[var(--color-border)]"
        >
          <div class="flex items-start gap-2 mb-2">
            <AlertTriangle class="w-4 h-4 text-yellow-400 shrink-0 mt-0.5" />
            <div>
              <p class="text-sm text-[var(--color-text)] font-medium">
                Hardcoded secrets detected
              </p>
              <p class="text-xs text-[var(--color-text-dim)] mt-0.5">
                Consider using <code class="px-1 py-0.5 bg-[var(--color-bg)] rounded text-[var(--color-primary)]">environment variables</code> instead for better security.
              </p>
            </div>
          </div>
          
          <!-- Findings list -->
          <ul class="mt-3 space-y-1 text-xs">
            <li 
              v-for="finding in hardcodedFindings" 
              :key="`${finding.location}-${finding.fieldType}`"
              class="flex items-center gap-2 text-[var(--color-text-dim)]"
            >
              <Lock class="w-3 h-3 text-red-400 shrink-0" />
              <span class="truncate">{{ finding.location }}</span>
              <span class="text-[var(--color-text-dim)]/60">·</span>
              <span class="text-yellow-400 shrink-0">{{ finding.fieldName }}</span>
            </li>
            <li v-if="remainingHardcodedCount > 0" class="text-[var(--color-text-dim)] pl-5">
              ...and {{ remainingHardcodedCount }} more
            </li>
          </ul>
        </div>

        <!-- Export Options -->
        <div class="space-y-3">
          <h3 class="text-xs font-mono uppercase tracking-wider text-[var(--color-text-dim)]">
            Export Options
          </h3>

          <!-- Include Environments -->
          <label class="flex items-start gap-3 p-3 rounded-lg bg-[var(--color-bg-tertiary)] border border-[var(--color-border)] cursor-pointer hover:border-[var(--color-primary)]/50 transition-colors">
            <input 
              v-model="includeEnvironments"
              type="checkbox"
              class="mt-0.5 w-4 h-4 rounded border-[var(--color-border)] bg-[var(--color-bg)] text-[var(--color-primary)] focus:ring-[var(--color-primary)] focus:ring-offset-0"
            />
            <div class="flex-1 min-w-0">
              <div class="flex items-center gap-2">
                <Globe class="w-4 h-4 text-[var(--color-secondary)]" />
                <span class="text-sm text-[var(--color-text)]">Include environments</span>
              </div>
              <p class="text-xs text-[var(--color-text-dim)] mt-1">
                Bundle {{ environmentCount }} environment{{ environmentCount !== 1 ? 's' : '' }} with the export.
                <span v-if="environmentCount > 0" class="text-yellow-400">
                  Environment variables may contain secrets.
                </span>
              </p>
            </div>
          </label>

          <!-- Redact Secrets -->
          <label 
            v-if="hasHardcodedSecrets"
            class="flex items-start gap-3 p-3 rounded-lg bg-[var(--color-bg-tertiary)] border border-[var(--color-border)] cursor-pointer hover:border-[var(--color-primary)]/50 transition-colors"
          >
            <input 
              v-model="redactSecrets"
              type="checkbox"
              class="mt-0.5 w-4 h-4 rounded border-[var(--color-border)] bg-[var(--color-bg)] text-[var(--color-primary)] focus:ring-[var(--color-primary)] focus:ring-offset-0"
            />
            <div class="flex-1 min-w-0">
              <div class="flex items-center gap-2">
                <component :is="redactSecrets ? EyeOff : Eye" class="w-4 h-4 text-[var(--color-secondary)]" />
                <span class="text-sm text-[var(--color-text)]">Redact hardcoded secrets</span>
              </div>
              <p class="text-xs text-[var(--color-text-dim)] mt-1">
                Replace {{ hardcodedCount }} hardcoded secret{{ hardcodedCount !== 1 ? 's' : '' }} with 
                <code class="px-1 py-0.5 bg-[var(--color-bg)] rounded text-[var(--color-primary)]">REDACTED</code>
              </p>
            </div>
          </label>
        </div>
      </template>
    </div>

    <!-- Footer -->
    <template #footer>
      <button
        class="px-4 py-2 text-sm text-[var(--color-text-dim)] hover:text-[var(--color-text)] transition-colors"
        @click="handleCancel"
      >
        Cancel
      </button>
      <button
        :disabled="!hasCollections"
        class="flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        :class="{
          'bg-[var(--color-primary)] text-[var(--color-bg)] hover:bg-[var(--color-primary)]/90': hasCollections,
        }"
        @click="handleExport"
      >
        <Download class="w-4 h-4" />
        Export Collections
      </button>
    </template>
  </BaseModal>
</template>

