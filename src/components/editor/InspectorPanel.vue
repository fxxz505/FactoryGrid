<template>
  <section class="inspector panel-block">
    <div class="panel-heading">
      <h2>&#26816;&#26597;&#22120;</h2>
      <span v-if="entity">{{ statusText(entity.status) }}</span>
    </div>
    <div v-if="entity" class="inspector-body">
      <div class="entity-title">
        <strong>{{ entity.label }}</strong>
        <small>{{ entity.type }} <span class="sep">/</span> {{ entity.position.x }}, {{ entity.position.y }} <span class="sep">/</span> {{ directionText(entity.direction) }}</small>
      </div>
      <div class="kv-grid">
        <span>&#36755;&#20837;</span><strong>{{ formatItems(entity.input) }}</strong>
        <span>&#36755;&#20986;</span><strong>{{ formatItems(entity.output) }}</strong>
        <span>&#30719;&#33033;</span><strong>{{ entity.sourceShape ? shapeById[entity.sourceShape]?.name : '\u65e0' }}</strong>
        <span>&#36827;&#24230;</span><strong>{{ entity.progress }} tick</strong>
      </div>
      <button class="danger" type="button" @click="$emit('deleteEntity', entity.id)">&#21024;&#38500;&#24314;&#31569;</button>
    </div>
    <p v-else class="empty-note">&#36873;&#25321;&#19968;&#20010;&#26684;&#23376;&#26597;&#30475;&#35814;&#24773;&#65292;&#25110;&#36873;&#25321;&#24314;&#36896;&#24037;&#20855;&#21518;&#28857;&#20987;&#30011;&#24067;&#12290;</p>
  </section>
</template>

<script setup lang="ts">
import { shapeById } from '../../data/resources'
import type { Direction, EntityStatus, FactoryEntity, FactoryProject, ShapeItem } from '../../models/factory'

defineProps<{ entity?: FactoryEntity; project: FactoryProject }>()
defineEmits<{ deleteEntity: [entityId: string] }>()

function formatItems(items: ShapeItem[]): string {
  if (!items.length) return '\u7a7a'
  return items.map((item) => shapeById[item.shape]?.name ?? item.shape).join('\u3001')
}

function directionText(direction: Direction): string {
  return direction === 'north' ? '\u5411\u4e0a' : direction === 'south' ? '\u5411\u4e0b' : direction === 'west' ? '\u5411\u5de6' : '\u5411\u53f3'
}

function statusText(status: EntityStatus): string {
  const map: Record<EntityStatus, string> = { idle: '\u7a7a\u95f2', running: '\u8fd0\u884c', waiting: '\u7b49\u5f85', blocked: '\u5835\u585e', delivering: '\u4ea4\u4ed8' }
  return map[status]
}
</script>
