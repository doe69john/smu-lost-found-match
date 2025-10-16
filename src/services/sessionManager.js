const subscribers = new Set()
let routerRef = null
let lastInvalidationAt = 0

export function registerSessionRouter(router) {
  routerRef = router
}

export function onSessionExpired(handler) {
  if (typeof handler !== 'function') return () => {}
  subscribers.add(handler)
  return () => {
    subscribers.delete(handler)
  }
}

export function resetSessionInvalidationThrottle() {
  lastInvalidationAt = 0
}

export function emitSessionExpired(detail = {}) {
  const now = Date.now()
  if (now - lastInvalidationAt < 500) {
    return
  }

  lastInvalidationAt = now
  const payload = {
    reason: 'expired',
    ...detail
  }

  subscribers.forEach((handler) => {
    try {
      handler(payload)
    } catch (error) {
      console.error('Failed to notify session expiration subscriber', error)
    }
  })

  if (routerRef) {
    const currentRoute = routerRef.currentRoute?.value
    const isAuthRoute = ['auth', 'auth-signup'].includes(currentRoute?.name)
    const redirectQuery = !isAuthRoute && currentRoute?.fullPath ? { redirect: currentRoute.fullPath } : undefined
    const targetRoute =
      payload.targetRoute ||
      (payload.redirect === false
        ? null
        : { name: 'auth', query: redirectQuery })

    if (targetRoute) {
      routerRef.push(targetRoute).catch(() => {})
    }
  } else if (typeof window !== 'undefined' && payload.redirect !== false) {
    const redirectPath = payload.redirectPath || '/auth'
    try {
      window.location.assign(redirectPath)
    } catch {
      window.location.href = redirectPath
    }
  }
}
