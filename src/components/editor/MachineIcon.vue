<template>
  <span class="machine-icon" :class="[type, toneClass]" aria-hidden="true">
    <span class="icon-plate">
      <span class="icon-core"></span>
    </span>
  </span>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { BuildingType } from '../../models/factory'

const props = defineProps<{ type: BuildingType }>()

const toneClass = computed(() => {
  if (props.type.includes('source')) return 'tone-source'
  if (props.type.includes('painter')) return 'tone-painter'
  if (['fast-belt', 'splitter', 'merger', 'tunnel', 'launcher'].includes(props.type)) return 'tone-logistic'
  if (props.type === 'trash') return 'tone-danger'
  if (props.type === 'hub') return 'tone-hub'
  return 'tone-machine'
})
</script>
