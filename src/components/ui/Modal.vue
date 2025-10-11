<script setup>
import { computed, onBeforeUnmount, watch } from 'vue'

defineOptions({
  name: 'UiModal'
})

const props = defineProps({
  modelValue: {
    type: Boolean,
    default: false
  },
  title: {
    type: String,
    default: ''
  },
  size: {
    type: String,
    default: 'md'
  },
  closeOnBackdrop: {
    type: Boolean,
    default: true
  },
  hideHeader: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits(['update:modelValue', 'show', 'hide', 'cancel'])

const dialogClass = computed(() => {
  const classes = ['modal-dialog']
  if (props.size === 'sm') classes.push('modal-sm')
  else if (props.size === 'lg') classes.push('modal-lg')
  else if (props.size === 'xl') classes.push('modal-xl')
  else if (props.size === 'fullscreen') classes.push('modal-fullscreen')
  return classes.join(' ')
})

const handleClose = () => {
  emit('update:modelValue', false)
}

const handleBackdropClick = () => {
  if (!props.closeOnBackdrop) return
  emit('cancel')
  handleClose()
}

const handleEscape = (event) => {
  if (event.key === 'Escape') {
    handleBackdropClick()
  }
}

const toggleBodyLock = (isOpen) => {
  if (typeof document === 'undefined') return
  document.body.classList.toggle('modal-open', isOpen)
  if (isOpen) {
    document.body.style.overflow = 'hidden'
  } else {
    document.body.style.removeProperty('overflow')
  }
}

watch(
  () => props.modelValue,
  (value, oldValue) => {
    toggleBodyLock(value)
    if (typeof window !== 'undefined') {
      if (value && !oldValue) {
        emit('show')
        window.addEventListener('keydown', handleEscape)
      }
      if (!value && oldValue) {
        window.removeEventListener('keydown', handleEscape)
        emit('hide')
      }
    } else if (value && !oldValue) {
      emit('show')
    } else if (!value && oldValue) {
      emit('hide')
    }
  },
  { immediate: true }
)

onBeforeUnmount(() => {
  toggleBodyLock(false)
  if (typeof window !== 'undefined') {
    window.removeEventListener('keydown', handleEscape)
  }
})
</script>

<template>
  <teleport to="body">
    <transition name="fade" mode="out-in">
      <div
        v-if="modelValue"
        class="modal fade show d-block"
        role="dialog"
        aria-modal="true"
      >
        <div :class="dialogClass">
          <div class="modal-content">
            <header v-if="!hideHeader" class="modal-header">
              <h2 class="modal-title h5 mb-0">{{ title }}</h2>
              <button type="button" class="btn-close" aria-label="Close" @click="handleClose"></button>
            </header>
            <section class="modal-body">
              <slot />
            </section>
            <footer v-if="$slots.footer" class="modal-footer">
              <slot name="footer" :close="handleClose" />
            </footer>
          </div>
        </div>
      </div>
    </transition>
    <transition name="fade">
      <div
        v-if="modelValue"
        class="modal-backdrop fade show"
        @click="handleBackdropClick"
      ></div>
    </transition>
  </teleport>
</template>
