<template>
  <section class="panel-block">
    <div class="panel-heading"><h2>&#27969;&#37327;&#35745;</h2><span>{{ project.metrics.activeBuildings }} &#21488;&#36816;&#34892;</span></div>
    <div class="metric-cards">
      <article><small>&#24050;&#20132;&#20184;</small><strong>{{ format(project.metrics.delivered) }}</strong></article>
      <article><small>&#24050;&#29983;&#20135;</small><strong>{{ format(project.metrics.produced) }}</strong></article>
      <article><small>&#20256;&#36865;&#24102;&#21344;&#29992;</small><strong>{{ project.metrics.beltItems }}</strong></article>
    </div>
    <div class="mini-chart" aria-label="recent delivery samples">
      <span v-for="(value, index) in chartValues" :key="index" :style="{ height: `${Math.max(8, value * 22)}%` }"></span>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { shapeById } from '../../data/resources'
import type { FactoryProject } from '../../models/factory'

const props = defineProps<{ project: FactoryProject }>()
const chartValues = computed(() => props.project.metrics.recentDelivery.length ? props.project.metrics.recentDelivery : [0, 0, 0, 0, 0, 0])

function format(record: Record<string, number>): string {
  const entries = Object.entries(record).filter(([, amount]) => amount > 0)
  if (!entries.length) return '0'
  return entries.slice(0, 3).map(([shape, amount]) => `${shapeById[shape]?.code ?? shape} ${amount}`).join(' / ')
}
</script>
