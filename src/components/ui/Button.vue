<script setup>
import { computed, useSlots } from 'vue'
import PulseLoader from '@/components/common/PulseLoader.vue'
import { useLoadingDelay } from '@/composables/useLoadingDelay'

defineOptions({
  name: 'UiButton'
})

const variantClasses = {
  primary: 'btn-primary',
  secondary: 'btn-secondary',
  success: 'btn-success',
  danger: 'btn-danger',
  warning: 'btn-warning',
  info: 'btn-info',
  light: 'btn-light',
  dark: 'btn-dark',
  link: 'btn-link',
  outline: 'btn-outline-primary'
}

const sizeClasses = {
  sm: 'btn-sm',
  md: '',
  lg: 'btn-lg'
}

const invertedVariantSet = new Set(['primary', 'secondary', 'success', 'danger', 'dark', 'info'])

const props = defineProps({
  variant: {
    type: String,
    default: 'primary'
  },
  size: {
    type: String,
    default: 'md'
  },
  type: {
    type: String,
    default: 'button'
  },
  block: {
    type: Boolean,
    default: false
  },
  loading: {
    type: Boolean,
    default: false
  },
  disabled: {
    type: Boolean,
    default: false
  },
  icon: {
    type: [Object, Function],
    default: null
  },
  iconOnly: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits(['click'])

const slots = useSlots()

const hasText = computed(() => Boolean(slots.default))

const classes = computed(() => {
  const classes = ['btn', 'ui-button', 'transition-base', 'transition-lift', 'transition-press']
  const variantClass = variantClasses[props.variant] || `btn-${props.variant}`
  classes.push(variantClass)

  const sizeClass = sizeClasses[props.size]
  if (sizeClass) {
    classes.push(sizeClass)
  }

  if (props.block) {
    classes.push('w-100')
  }

  if ((props.icon || slots.icon) && hasText.value) {
    classes.push('btn-with-icon')
  }

  if (props.iconOnly || ((props.icon || slots.icon) && !hasText.value)) {
    classes.push('btn-icon-only')
  }

  return classes
})

const isDisabled = computed(() => props.disabled || props.loading)

const loaderSize = computed(() => {
  if (props.size === 'sm' || props.iconOnly) {
    return 'sm'
  }
  if (props.size === 'lg') {
    return 'lg'
  }
  return 'md'
})

const loaderContrast = computed(() => {
  if (props.variant.startsWith('outline')) {
    return 'accent'
  }

  if (invertedVariantSet.has(props.variant)) {
    return 'inverted'
  }

  if (props.variant === 'light' || props.variant === 'warning') {
    return 'muted'
  }

  return 'default'
})

const { isVisible: showLoader } = useLoadingDelay(() => props.loading)

const handleClick = (event) => {
  if (isDisabled.value) {
    event.preventDefault()
    return
  }

  emit('click', event)
}
</script>

<template>
  <button
    :type="type"
    :class="classes"
    :disabled="isDisabled"
    :aria-disabled="isDisabled ? 'true' : undefined"
    :aria-busy="loading ? 'true' : undefined"
    v-bind="$attrs"
    @click="handleClick"
  >
    <PulseLoader
      v-if="showLoader"
      :size="loaderSize"
      :contrast="loaderContrast"
      :class="{ 'me-2': hasText }"
      aria-hidden="true"
    />

    <component
      :is="icon"
      v-if="icon"
      class="btn-icon-start"
      :aria-hidden="true"
      :size="18"
      :stroke-width="1.75"
    />

    <slot name="icon" />

    <span v-if="hasText">
      <slot />
    </span>
  </button>
</template>
