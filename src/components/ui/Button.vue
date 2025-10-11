<script setup>
import { computed, useSlots } from 'vue'

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
  const classes = ['btn']
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
    <span
      v-if="loading"
      class="spinner-border spinner-border-sm me-2"
      role="status"
      aria-hidden="true"
    ></span>

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
