<script setup>
import { computed } from 'vue'

const sizeTokens = {
  xs: '0.75rem',
  sm: '1rem',
  md: '1.5rem',
  lg: '2rem',
  xl: '2.5rem'
}

const props = defineProps({
  size: {
    type: String,
    default: 'md',
    validator: (value) => ['xs', 'sm', 'md', 'lg', 'xl'].includes(value)
  },
  contrast: {
    type: String,
    default: 'default',
    validator: (value) => ['default', 'accent', 'muted', 'inverted'].includes(value)
  },
  label: {
    type: String,
    default: 'Loading'
  }
})

const sizeClass = computed(() => `pulse-loader--${props.size}`)
const contrastClass = computed(() =>
  props.contrast === 'default' ? null : `pulse-loader--contrast-${props.contrast}`
)

const styles = computed(() => ({ '--pulse-loader-size': sizeTokens[props.size] }))
</script>

<template>
  <span
    class="pulse-loader"
    :class="[sizeClass, contrastClass]"
    :style="styles"
    role="status"
    :aria-label="label"
  >
    <svg viewBox="0 0 32 32" aria-hidden="true" focusable="false">
      <circle class="pulse-loader__glow" cx="16" cy="16" r="12" />
      <path
        class="pulse-loader__glyph"
        d="M10.5 17.8a1.4 1.4 0 0 1 0-2l5.4-5.4a1.4 1.4 0 0 1 2 0l3.6 3.6a1.4 1.4 0 0 1 0 2l-5.4 5.4a1.4 1.4 0 0 1-2 0z"
      />
      <path
        class="pulse-loader__spark"
        d="M12 8.5l1.2-2.7M20.8 9l2.6-1.3M23.5 18.4l2.7 1.2M9.5 20.8L8 23.4"
      />
    </svg>
    <span v-if="$slots.default" class="visually-hidden">
      <slot />
    </span>
  </span>
</template>
