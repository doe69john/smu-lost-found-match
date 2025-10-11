<script setup>
import { computed } from 'vue'

defineOptions({
  name: 'UiCard'
})

const props = defineProps({
  title: {
    type: String,
    default: ''
  },
  subtitle: {
    type: String,
    default: ''
  },
  icon: {
    type: [Object, Function],
    default: null
  },
  bodyClass: {
    type: String,
    default: 'p-4'
  },
  headerClass: {
    type: String,
    default: ''
  },
  footerClass: {
    type: String,
    default: ''
  },
  flush: {
    type: Boolean,
    default: false
  }
})

const bodyClasses = computed(() => [props.flush ? '' : 'card-body', props.bodyClass].filter(Boolean).join(' '))
</script>

<template>
  <div class="card border-0 shadow-sm" v-bind="$attrs">
    <header v-if="$slots.header || title" :class="['card-header bg-white border-0', headerClass]">
      <slot name="header">
        <div class="d-flex align-items-start gap-3">
          <component
            :is="icon"
            v-if="icon"
            class="text-primary flex-shrink-0"
            :size="24"
            :stroke-width="1.75"
            aria-hidden="true"
          />
          <div>
            <h2 class="card-title h5 mb-1">{{ title }}</h2>
            <p v-if="subtitle" class="card-subtitle text-muted mb-0">{{ subtitle }}</p>
          </div>
          <div class="ms-auto" v-if="$slots['header-actions']">
            <slot name="header-actions" />
          </div>
        </div>
      </slot>
    </header>

    <section :class="bodyClasses">
      <slot />
    </section>

    <footer v-if="$slots.footer" :class="['card-footer bg-white border-0', footerClass]">
      <slot name="footer" />
    </footer>
  </div>
</template>
