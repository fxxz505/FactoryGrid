<template>
  <footer class="simulation-bar">
    <div><strong>交付</strong><span>{{ total(metrics.delivered) }}</span></div>
    <div><strong>生产</strong><span>{{ total(metrics.produced) }}</span></div>
    <div><strong>堵塞</strong><span>{{ errors.length }}</span></div>
    <div class="performance-readout" :class="performanceTone">
      <strong>性能</strong>
      <span>{{ performance.fps }} FPS · {{ performance.frameTime.toFixed(1) }} ms · {{ performance.quality === 'high' ? '清晰' : '流畅' }}</span>
    </div>
    <div class="event-stream"><strong>事件日志</strong><span>{{ events[0]?.message ?? '点击运行，让物品开始流动' }}</span></div>
  </footer>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { FactoryError, FactoryMetrics, FactoryPerformance, SimulationEvent } from '../../models/factory'

const props = defineProps<{
  metrics: FactoryMetrics
  errors: FactoryError[]
  events: SimulationEvent[]
  performance: FactoryPerformance
}>()

const performanceTone = computed(() => props.performance.fps >= 55 ? 'good' : props.performance.fps >= 40 ? 'warn' : 'bad')
function total(record: Record<string, number>): number {
  return Object.values(record).reduce((sum, amount) => sum + amount, 0)
}
</script>