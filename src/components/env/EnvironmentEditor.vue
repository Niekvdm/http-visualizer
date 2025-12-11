<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useEnvironmentStore } from '@/stores/environmentStore'
import { useRequestStore } from '@/stores/requestStore'
import type { Environment } from '@/types'
import NeonButton from '@/components/ui/NeonButton.vue'
import { X } from 'lucide-vue-next'

const props = defineProps<{
  show: boolean
}>()

const emit = defineEmits<{
  close: []
}>()

const envStore = useEnvironmentStore()
const requestStore = useRequestStore()

// Tabs: environments list or file overrides
type Tab = 'environments' | 'file-overrides'
const activeTab = ref<Tab>('environments')

// Selected environment for editing
const selectedEnvId = ref<string | null>(null)

// New environment form
const showNewEnvForm = ref(false)
const newEnvName = ref('')

// New variable form
const newVarKey = ref('')
const newVarValue = ref('')

// Computed
const environments = computed(() => envStore.environments)
const selectedEnv = computed(() => 
  environments.value.find(e => e.id === selectedEnvId.value) || null
)
const files = computed(() => requestStore.files)

// Watch for show changes
watch(() => props.show, (show) => {
  if (show) {
    // Select active environment by default
    selectedEnvId.value = envStore.activeEnvironmentId
    showNewEnvForm.value = false
    newEnvName.value = ''
    newVarKey.value = ''
    newVarValue.value = ''
  }
})

// Environment actions
function createEnvironment() {
  if (!newEnvName.value.trim()) return
  
  const env = envStore.createEnvironment(newEnvName.value.trim())
  selectedEnvId.value = env.id
  showNewEnvForm.value = false
  newEnvName.value = ''
}

function deleteEnvironment(envId: string) {
  if (confirm('Are you sure you want to delete this environment?')) {
    const success = envStore.deleteEnvironment(envId)
    if (success && selectedEnvId.value === envId) {
      selectedEnvId.value = environments.value[0]?.id || null
    }
  }
}

function selectEnvironment(envId: string) {
  selectedEnvId.value = envId
}

// Variable actions
function addVariable() {
  if (!selectedEnvId.value || !newVarKey.value.trim()) return
  
  envStore.setEnvironmentVariable(
    selectedEnvId.value,
    newVarKey.value.trim(),
    newVarValue.value
  )
  newVarKey.value = ''
  newVarValue.value = ''
}

function updateVariable(key: string, value: string) {
  if (!selectedEnvId.value) return
  envStore.setEnvironmentVariable(selectedEnvId.value, key, value)
}

function removeVariable(key: string) {
  if (!selectedEnvId.value) return
  envStore.removeEnvironmentVariable(selectedEnvId.value, key)
}

// File override actions
function getFileOverrides(fileId: string): Record<string, string> {
  return envStore.getFileOverrides(fileId)
}

function setFileOverride(fileId: string, key: string, value: string) {
  envStore.setFileOverride(fileId, key, value)
}

function removeFileOverride(fileId: string, key: string) {
  envStore.removeFileOverride(fileId, key)
}

// File override form state per file
const fileOverrideForms = ref<Map<string, { key: string; value: string }>>(new Map())

function getFileOverrideForm(fileId: string) {
  if (!fileOverrideForms.value.has(fileId)) {
    fileOverrideForms.value.set(fileId, { key: '', value: '' })
  }
  return fileOverrideForms.value.get(fileId)!
}

function addFileOverride(fileId: string) {
  const form = getFileOverrideForm(fileId)
  if (!form.key.trim()) return
  
  setFileOverride(fileId, form.key.trim(), form.value)
  form.key = ''
  form.value = ''
}
</script>

<template>
  <Teleport to="body">
    <Transition
      enter-active-class="transition duration-200 ease-out"
      enter-from-class="opacity-0"
      enter-to-class="opacity-100"
      leave-active-class="transition duration-150 ease-in"
      leave-from-class="opacity-100"
      leave-to-class="opacity-0"
    >
      <div
        v-if="show"
        class="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
        @click.self="emit('close')"
      >
        <div class="bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded-lg shadow-2xl w-full max-w-3xl max-h-[70vh] flex flex-col overflow-hidden">
          <!-- Header -->
          <div class="flex items-center justify-between px-4 py-2 border-b border-[var(--color-border)]">
            <h2 class="text-sm font-bold text-[var(--color-text)] font-mono uppercase tracking-wider">
              Environment Variables
            </h2>
            <button
              class="text-[var(--color-text-dim)] hover:text-[var(--color-text)] text-sm"
              @click="emit('close')"
            >
              <X class="w-4 h-4" />
            </button>
          </div>

          <!-- Tabs -->
          <div class="flex border-b border-[var(--color-border)]">
            <button
              class="px-4 py-2 text-xs font-mono uppercase tracking-wider transition-colors relative"
              :class="[
                activeTab === 'environments'
                  ? 'text-[var(--color-primary)]'
                  : 'text-[var(--color-text-dim)] hover:text-[var(--color-text)]'
              ]"
              @click="activeTab = 'environments'"
            >
              Environments
              <div
                v-if="activeTab === 'environments'"
                class="absolute bottom-0 left-0 right-0 h-0.5 bg-[var(--color-primary)]"
              />
            </button>
            <button
              class="px-4 py-2 text-xs font-mono uppercase tracking-wider transition-colors relative"
              :class="[
                activeTab === 'file-overrides'
                  ? 'text-[var(--color-primary)]'
                  : 'text-[var(--color-text-dim)] hover:text-[var(--color-text)]'
              ]"
              @click="activeTab = 'file-overrides'"
            >
              File Overrides
              <div
                v-if="activeTab === 'file-overrides'"
                class="absolute bottom-0 left-0 right-0 h-0.5 bg-[var(--color-primary)]"
              />
            </button>
          </div>

          <!-- Content -->
          <div class="flex-1 overflow-hidden flex">
            <!-- Environments Tab -->
            <template v-if="activeTab === 'environments'">
              <!-- Environment list sidebar -->
              <div class="w-48 border-r border-[var(--color-border)] flex flex-col">
                <div class="flex-1 overflow-y-auto p-2 space-y-0.5">
                  <button
                    v-for="env in environments"
                    :key="env.id"
                    class="w-full px-2 py-1.5 rounded text-left flex items-center gap-2 transition-colors text-xs font-mono"
                    :class="[
                      selectedEnvId === env.id
                        ? 'bg-[var(--color-primary)]/10 text-[var(--color-primary)]'
                        : 'text-[var(--color-text)] hover:bg-[var(--color-bg-tertiary)]'
                    ]"
                    @click="selectEnvironment(env.id)"
                  >
                    <span class="flex-1 truncate">{{ env.name }}</span>
                    <span 
                      v-if="env.isDefault" 
                      class="text-[10px] text-[var(--color-text-dim)]"
                    >
                      def
                    </span>
                  </button>
                </div>

                <!-- New environment form -->
                <div class="p-2 border-t border-[var(--color-border)]">
                  <div v-if="showNewEnvForm" class="space-y-1.5">
                    <input
                      v-model="newEnvName"
                      type="text"
                      placeholder="Name"
                      class="w-full px-2 py-1 bg-[var(--color-bg)] border border-[var(--color-border)] rounded text-[var(--color-text)] text-xs font-mono focus:outline-none focus:border-[var(--color-primary)]"
                      @keydown.enter="createEnvironment"
                      @keydown.escape="showNewEnvForm = false"
                    />
                    <div class="flex gap-1">
                      <NeonButton size="sm" @click="createEnvironment">OK</NeonButton>
                      <NeonButton size="sm" variant="ghost" @click="showNewEnvForm = false">X</NeonButton>
                    </div>
                  </div>
                  <button 
                    v-else 
                    class="w-full px-2 py-1 text-xs font-mono text-[var(--color-text-dim)] hover:text-[var(--color-primary)] hover:bg-[var(--color-bg-tertiary)] rounded transition-colors"
                    @click="showNewEnvForm = true"
                  >
                    + NEW
                  </button>
                </div>
              </div>

              <!-- Environment variables editor -->
              <div class="flex-1 flex flex-col overflow-hidden">
                <template v-if="selectedEnv">
                  <!-- Environment header -->
                  <div class="px-3 py-2 border-b border-[var(--color-border)] flex items-center justify-between">
                    <div class="flex items-center gap-2">
                      <span class="font-mono text-xs text-[var(--color-text)]">{{ selectedEnv.name }}</span>
                      <span class="text-[10px] text-[var(--color-text-dim)]">
                        {{ Object.keys(selectedEnv.variables).length }} vars
                      </span>
                    </div>
                    <div class="flex gap-1">
                      <button
                        v-if="envStore.activeEnvironmentId !== selectedEnv.id"
                        class="px-2 py-0.5 text-[10px] font-mono text-[var(--color-text-dim)] hover:text-[var(--color-primary)] transition-colors"
                        @click="envStore.setActiveEnvironment(selectedEnv.id)"
                      >
                        ACTIVATE
                      </button>
                      <button
                        v-if="!selectedEnv.isDefault"
                        class="px-2 py-0.5 text-[10px] font-mono text-[var(--color-text-dim)] hover:text-[var(--color-error)] transition-colors"
                        @click="deleteEnvironment(selectedEnv.id)"
                      >
                        DEL
                      </button>
                    </div>
                  </div>

                  <!-- Variables list -->
                  <div class="flex-1 overflow-y-auto p-3">
                    <div class="space-y-1.5">
                      <!-- Existing variables -->
                      <div
                        v-for="(value, key) in selectedEnv.variables"
                        :key="key"
                        class="flex items-center gap-1.5 group"
                      >
                        <input
                          :value="key"
                          type="text"
                          readonly
                          class="w-1/3 px-2 py-1 bg-[var(--color-bg-tertiary)] border border-[var(--color-border)] rounded text-[var(--color-text)] text-xs font-mono"
                        />
                        <input
                          :value="value"
                          type="text"
                          placeholder="Value"
                          class="flex-1 px-2 py-1 bg-[var(--color-bg)] border border-[var(--color-border)] rounded text-[var(--color-text)] text-xs font-mono focus:outline-none focus:border-[var(--color-primary)]"
                          @input="(e) => updateVariable(key as string, (e.target as HTMLInputElement).value)"
                        />
                        <button
                          class="px-1 text-[var(--color-text-dim)] hover:text-[var(--color-error)] opacity-0 group-hover:opacity-100 transition-all text-xs"
                          @click="removeVariable(key as string)"
                        >
                          x
                        </button>
                      </div>

                      <!-- Add new variable -->
                      <div class="flex items-center gap-1.5 pt-2 border-t border-[var(--color-border)]">
                        <input
                          v-model="newVarKey"
                          type="text"
                          placeholder="key"
                          class="w-1/3 px-2 py-1 bg-[var(--color-bg)] border border-[var(--color-border)] rounded text-[var(--color-text)] text-xs font-mono focus:outline-none focus:border-[var(--color-primary)]"
                          @keydown.enter="addVariable"
                        />
                        <input
                          v-model="newVarValue"
                          type="text"
                          placeholder="value"
                          class="flex-1 px-2 py-1 bg-[var(--color-bg)] border border-[var(--color-border)] rounded text-[var(--color-text)] text-xs font-mono focus:outline-none focus:border-[var(--color-primary)]"
                          @keydown.enter="addVariable"
                        />
                        <NeonButton size="sm" @click="addVariable">+</NeonButton>
                      </div>
                    </div>
                  </div>
                </template>

                <!-- No environment selected -->
                <div v-else class="flex-1 flex items-center justify-center text-[var(--color-text-dim)] text-xs">
                  Select an environment
                </div>
              </div>
            </template>

            <!-- File Overrides Tab -->
            <template v-else-if="activeTab === 'file-overrides'">
              <div class="flex-1 overflow-y-auto p-3">
                <p class="text-[10px] text-[var(--color-text-dim)] mb-3">
                  File overrides take precedence over environment variables.
                </p>

                <div v-if="files.length === 0" class="text-center py-4 text-[var(--color-text-dim)] text-xs">
                  No files loaded
                </div>

                <div v-else class="space-y-3">
                  <div 
                    v-for="file in files" 
                    :key="file.id"
                    class="bg-[var(--color-bg-tertiary)] rounded p-2"
                  >
                    <div class="flex items-center gap-2 mb-2">
                      <span class="font-mono text-xs text-[var(--color-text)]">{{ file.name }}</span>
                      <span class="text-[10px] text-[var(--color-text-dim)]">
                        {{ Object.keys(getFileOverrides(file.id)).length }} overrides
                      </span>
                    </div>

                    <!-- File variables from parsing -->
                    <div v-if="Object.keys(file.variables).length > 0" class="mb-2">
                      <div class="flex flex-wrap gap-1">
                        <span
                          v-for="(value, key) in file.variables"
                          :key="key"
                          class="px-1.5 py-0.5 bg-[var(--color-bg)] rounded text-[10px] font-mono"
                        >
                          <span class="text-[var(--color-secondary)]">{{ key }}</span>=<span class="text-[var(--color-text)]">{{ value }}</span>
                        </span>
                      </div>
                    </div>

                    <!-- Overrides -->
                    <div class="space-y-1">
                      <div
                        v-for="(value, key) in getFileOverrides(file.id)"
                        :key="key"
                        class="flex items-center gap-1 group"
                      >
                        <input
                          :value="key"
                          type="text"
                          readonly
                          class="w-1/3 px-1.5 py-0.5 bg-[var(--color-bg)] border border-[var(--color-border)] rounded text-[var(--color-text)] text-xs font-mono"
                        />
                        <input
                          :value="value"
                          type="text"
                          class="flex-1 px-1.5 py-0.5 bg-[var(--color-bg)] border border-[var(--color-border)] rounded text-[var(--color-text)] text-xs font-mono focus:outline-none focus:border-[var(--color-primary)]"
                          @input="(e) => setFileOverride(file.id, key as string, (e.target as HTMLInputElement).value)"
                        />
                        <button
                          class="px-1 text-[var(--color-text-dim)] hover:text-[var(--color-error)] opacity-0 group-hover:opacity-100 transition-all text-xs"
                          @click="removeFileOverride(file.id, key as string)"
                        >
                          x
                        </button>
                      </div>

                      <!-- Add new override -->
                      <div class="flex items-center gap-1 pt-1">
                        <input
                          v-model="getFileOverrideForm(file.id).key"
                          type="text"
                          placeholder="key"
                          class="w-1/3 px-1.5 py-0.5 bg-[var(--color-bg)] border border-[var(--color-border)] rounded text-[var(--color-text)] text-xs font-mono focus:outline-none focus:border-[var(--color-primary)]"
                          @keydown.enter="addFileOverride(file.id)"
                        />
                        <input
                          v-model="getFileOverrideForm(file.id).value"
                          type="text"
                          placeholder="value"
                          class="flex-1 px-1.5 py-0.5 bg-[var(--color-bg)] border border-[var(--color-border)] rounded text-[var(--color-text)] text-xs font-mono focus:outline-none focus:border-[var(--color-primary)]"
                          @keydown.enter="addFileOverride(file.id)"
                        />
                        <NeonButton size="sm" @click="addFileOverride(file.id)">+</NeonButton>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </template>
          </div>

          <!-- Footer -->
          <div class="px-3 py-2 border-t border-[var(--color-border)] flex justify-end">
            <NeonButton size="sm" @click="emit('close')">DONE</NeonButton>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

