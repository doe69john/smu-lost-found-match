import { ref, computed, onMounted, onBeforeUnmount } from 'vue'

const STORAGE_KEY = 'theme'
// theme values: 'light' | 'dark' | 'system'

const theme = ref('system')

let mediaQuery
let mediaListener

const prefersDark = () => window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches

const isDark = computed(() => {
  if (theme.value === 'dark') return true
  if (theme.value === 'light') return false
  return prefersDark()
})

function applyThemeClass() {
  const root = document.documentElement
  if (isDark.value) {
    root.classList.add('dark')
  } else {
    root.classList.remove('dark')
  }
}

function setTheme(next) {
  theme.value = next
  try {
    localStorage.setItem(STORAGE_KEY, next)
  } catch {}
  applyThemeClass()
}

function toggleTheme() {
  const next = isDark.value ? 'light' : 'dark'
  setTheme(next)
}

function initTheme() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved === 'light' || saved === 'dark' || saved === 'system') {
      theme.value = saved
    }
  } catch {}

  // Setup media query listener for system changes when using 'system'
  if (window.matchMedia) {
    mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
    mediaListener = () => {
      if (theme.value === 'system') applyThemeClass()
    }
    if (typeof mediaQuery.addEventListener === 'function') {
      mediaQuery.addEventListener('change', mediaListener)
    } else if (typeof mediaQuery.addListener === 'function') {
      mediaQuery.addListener(mediaListener)
    }
  }

  applyThemeClass()
}

function cleanupTheme() {
  if (mediaQuery && mediaListener) {
    if (typeof mediaQuery.removeEventListener === 'function') {
      mediaQuery.removeEventListener('change', mediaListener)
    } else if (typeof mediaQuery.removeListener === 'function') {
      mediaQuery.removeListener(mediaListener)
    }
  }
}

export function useTheme() {
  onMounted(() => {
    // Ensure class is applied if components mount before init
    applyThemeClass()
  })
  onBeforeUnmount(() => cleanupTheme())

  return { theme, isDark, setTheme, toggleTheme, initTheme }
}

// Named export for initializing without creating a component instance
export { initTheme }

