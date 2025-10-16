import { onScopeDispose, ref, unref, watch } from 'vue'

export function useLoadingDelay(source, options = {}) {
  const delay = options.delay ?? 150
  const minDuration = options.minDuration ?? 250

  const isVisible = ref(false)

  let delayTimer
  let hideTimer
  let activatedAt = 0

  const clearDelay = () => {
    if (delayTimer) {
      clearTimeout(delayTimer)
      delayTimer = undefined
    }
  }

  const clearHide = () => {
    if (hideTimer) {
      clearTimeout(hideTimer)
      hideTimer = undefined
    }
  }

  const show = () => {
    clearHide()
    if (!isVisible.value) {
      isVisible.value = true
    }
    activatedAt = Date.now()
  }

  const hide = () => {
    const timeVisible = Date.now() - activatedAt
    const remaining = Math.max(minDuration - timeVisible, 0)

    if (remaining > 0) {
      hideTimer = setTimeout(() => {
        isVisible.value = false
        hideTimer = undefined
      }, remaining)
    } else {
      isVisible.value = false
    }
  }

  watch(
    () => (typeof source === 'function' ? source() : unref(source)),
    (value) => {
      const isActive = Boolean(value)
      if (isActive) {
        clearDelay()
        if (delay <= 0) {
          show()
        } else {
          delayTimer = setTimeout(() => {
            show()
            delayTimer = undefined
          }, delay)
        }
      } else {
        clearDelay()
        if (isVisible.value) {
          hide()
        }
      }
    },
    { immediate: true }
  )

  onScopeDispose(() => {
    clearDelay()
    clearHide()
  })

  return { isVisible }
}
