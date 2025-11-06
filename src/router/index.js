import { createRouter, createWebHistory } from 'vue-router'
import { isUserAuthenticated } from '../composables/useAuth'
import { pushToast } from '../composables/useToast'

function parseHashParams(hash) {
  if (!hash) return new URLSearchParams()

  const normalized = hash.startsWith('#') ? hash.slice(1) : hash
  return new URLSearchParams(normalized)
}

function shouldRedirectToRecovery(route) {
  const query = route.query || {}
  const hashParams = parseHashParams(route.hash)

  const queryType = typeof query.type === 'string' ? query.type : null
  const hashType = hashParams.get('type')

  if (queryType !== 'recovery' && hashType !== 'recovery') {
    return false
  }

  const tokenKeys = [
    'token',
    'token_hash',
    'code',
    'access_token',
    'refresh_token',
    'recovery_token',
    'oob_code'
  ]

  const queryHasToken = tokenKeys.some((key) => {
    const value = query[key]
    return typeof value === 'string' && value
  })

  const hashHasToken = tokenKeys.some((key) => {
    const value = hashParams.get(key)
    return typeof value === 'string' && value
  })

  return queryHasToken || hashHasToken
}

function createRecoveryRedirect(route) {
  return {
    name: 'auth-reset-password',
    query: { ...route.query },
    hash: route.hash
  }
}

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/auth',
      name: 'auth',
      component: () => import('../views/AuthView.vue'),
      meta: { guestOnly: true, layout: 'auth' }
    },
    {
      path: '/auth/signup',
      name: 'auth-signup',
      component: () => import('../views/AuthView.vue'),
      meta: { guestOnly: true, layout: 'auth', authMode: 'signup' }
    },
    {
      path: '/auth/forgot-password',
      name: 'auth-forgot-password',
      component: () => import('../views/ForgotPasswordView.vue'),
      meta: { guestOnly: true, layout: 'auth' }
    },
    {
      path: '/auth/reset-password',
      name: 'auth-reset-password',
      component: () => import('../views/ResetPasswordView.vue'),
      meta: { layout: 'auth' }
    },
    {
      path: '/dashboard',
      name: 'dashboard',
      component: () => import('../views/DashboardView.vue'),
      meta: { requiresAuth: true }
    },
    {
      path: '/report-lost',
      name: 'report-lost',
      component: () => import('../views/ReportLostView.vue'),
      meta: { requiresAuth: true }
    },
    {
      path: '/report-found',
      name: 'report-found',
      component: () => import('../views/ReportFoundView.vue'),
      meta: { requiresAuth: true }
    },
    {
      path: '/browse-lost',
      name: 'browse-lost',
      component: () => import('../views/BrowseLostView.vue'),
      meta: { requiresAuth: true }
    },
    {
      path: '/browse-found',
      name: 'browse-found',
      component: () => import('../views/BrowseFoundView.vue'),
      meta: { requiresAuth: true }
    },
    {
      path: '/',
      redirect: (to) => {
        if (shouldRedirectToRecovery(to)) {
          return createRecoveryRedirect(to)
        }

        return { name: 'dashboard' }
      }
    },
    {
      path: '/:pathMatch(.*)*',
      name: 'not-found',
      component: () => import('../views/NotFoundView.vue'),
      meta: { layout: 'auth' }
    }
  ],
  scrollBehavior() {
    return { top: 0 }
  }
})

router.beforeEach((to, from, next) => {
  if (to.name !== 'auth-reset-password' && shouldRedirectToRecovery(to)) {
    next(createRecoveryRedirect(to))
    return
  }

  if (to.meta.requiresAuth && !isUserAuthenticated()) {
    if (to.name !== 'auth') {
      pushToast({
        title: 'Authentication required',
        message: 'Please sign in to continue.',
        variant: 'warning'
      })
    }
    next({ name: 'auth', query: { redirect: to.fullPath } })
    return
  }

  if (to.meta.guestOnly && isUserAuthenticated()) {
    next({ name: 'dashboard' })
    return
  }

  next()
})

export default router
