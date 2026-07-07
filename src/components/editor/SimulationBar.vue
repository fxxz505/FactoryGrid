<template>
  <footer class="simulation-bar">
    <div><strong>&#20132;&#20184;</strong><span>{{ total(metrics.delivered) }}</span></div>
    <div><strong>&#29983;&#20135;</strong><span>{{ total(metrics.produced) }}</span></div>
    <div><strong>&#22581;&#22622;</strong><span>{{ errors.length }}</span></div>
    <div class="event-stream"><strong>&#20107;&#20214;&#26085;&#24535;</strong><span>{{ events[0]?.message ?? '\u70b9\u51fb\u8fd0\u884c\uff0c\u8ba9\u56fe\u5f62\u5f00\u59cb\u6d41\u52a8' }}</span></div>
  </footer>
</template>

<script setup lang="ts">
import type { FactoryError, FactoryMetrics, SimulationEvent } from '../../models/factory'

defineProps<{ metrics: FactoryMetrics; errors: FactoryError[]; events: SimulationEvent[] }>()
function total(record: Record<string, number>): number { return Object.values(record).reduce((sum, amount) => sum + amount, 0) }
</script>
