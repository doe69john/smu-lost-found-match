import { computed, reactive } from 'vue'

let seed = 0
const toasts = reactive([])
const timeouts = new Map()

const removeToast = (id) => {
  const index = toasts.findIndex((toast) => toast.id === id)
  if (index !== -1) {
    toasts.splice(index, 1)
  }

  const timeout = timeouts.get(id)
  if (timeout) {
    globalThis.clearTimeout(timeout)
    timeouts.delete(id)
  }
}

const addToast = ({ title, message, variant = 'primary', duration = 4000 }) => {
  const id = ++seed
  const toast = {
    id,
    title,
    message,
    variant,
    duration
  }

  toasts.push(toast)

  if (duration > 0) {
    const timeout = globalThis.setTimeout(() => {
      removeToast(id)
    }, duration)
    timeouts.set(id, timeout)
  }

  return id
}

export function useToast() {
  return {
    toasts: computed(() => toasts),
    showToast: addToast,
    dismissToast: removeToast
  }
}

export function pushToast(options) {
  return addToast(options)
}
