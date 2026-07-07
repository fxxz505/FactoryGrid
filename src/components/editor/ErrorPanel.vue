<template>
  <section class="panel-block">
    <div class="panel-heading">
      <h2>&#22581;&#28857;</h2>
      <span>{{ errors.length }}</span>
    </div>
    <div v-if="errors.length" class="error-list">
      <button
        v-for="error in errors"
        :key="`${error.entityId}-${error.message}`"
        class="error-row"
        type="button"
        @click="$emit('focus', error.entityId)"
      >
        <strong>{{ error.message }}</strong>
        <small>{{ error.suggestion }}</small>
      </button>
    </div>
    <p v-else class="empty-note">&#27809;&#26377;&#22581;&#28857;&#65292;&#20135;&#32447;&#27969;&#21160;&#31283;&#23450;&#12290;</p>
  </section>
</template>

<script setup lang="ts">
import type { FactoryError } from '../../models/factory'

defineProps<{
  errors: FactoryError[]
}>()

defineEmits<{
  focus: [entityId: string]
}>()
</script>
