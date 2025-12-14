<script setup lang="ts">
import { Radio } from 'lucide-vue-next'
</script>

<template>
  <div class="h-full flex items-center justify-center">
    <div class="text-center text-[var(--color-text-dim)]">
      <Radio class="w-8 h-8 mb-3 mx-auto opacity-50" />
      <div class="text-xs">Select a request and click RUN to see the response</div>
    </div>
  </div>
</template>
