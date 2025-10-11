<script setup>
import { computed } from 'vue'
import { useRouter, useRoute, RouterLink } from 'vue-router'
import { useAuth } from '../../composables/useAuth'
import { pushToast } from '../../composables/useToast'

const { isAuthenticated: authStatus, user, logout } = useAuth()
const router = useRouter()
const route = useRoute()

const navigation = [
  { name: 'Dashboard', path: '/dashboard' },
  { name: 'Report Lost', path: '/report-lost' },
  { name: 'Report Found', path: '/report-found' },
  { name: 'Browse Lost', path: '/browse-lost' },
  { name: 'Browse Found', path: '/browse-found' }
]

const activePath = computed(() => route.path)
const isLoggedIn = computed(() => authStatus.value)
const displayName = computed(
  () =>
    user.value?.user_metadata?.full_name ||
    user.value?.full_name ||
    user.value?.email ||
    'Member'
)

const buildRedirectQuery = () => {
  if (['auth', 'auth-signup', 'not-found'].includes(route.name)) {
    return undefined
  }

  return { redirect: route.fullPath }
}

const handleGoToSignIn = () => {
  const query = buildRedirectQuery()
  router.push(query ? { name: 'auth', query } : { name: 'auth' })
}

const handleGoToSignUp = () => {
  const query = buildRedirectQuery()
  router.push(query ? { name: 'auth-signup', query } : { name: 'auth-signup' })
}

const handleLogout = async () => {
  await logout()
  pushToast({ title: 'Signed out', message: 'You have been logged out.', variant: 'info' })
  router.push({ name: 'auth' })
}
</script>

<template>
  <header class="bg-primary text-white shadow-sm">
    <div class="container py-3">
      <div class="d-flex flex-column flex-md-row align-items-md-center justify-content-between gap-3">
        <RouterLink class="text-white text-decoration-none fs-4 fw-semibold" to="/">
          Lost &amp; Found Portal
        </RouterLink>

        <nav v-if="isLoggedIn" class="d-flex flex-wrap gap-3 align-items-center">
          <RouterLink
            v-for="link in navigation"
            :key="link.path"
            class="text-white text-decoration-none"
            :class="{ 'fw-semibold text-decoration-underline': activePath === link.path }"
            :to="link.path"
          >
            {{ link.name }}
          </RouterLink>
        </nav>

        <div class="d-flex align-items-center gap-3 ms-md-3">
          <div v-if="isLoggedIn" class="text-white-50 small">
            Signed in as <strong class="text-white">{{ displayName }}</strong>
          </div>
          <div v-if="!isLoggedIn" class="d-flex align-items-center gap-2">
            <button
              type="button"
              class="btn btn-outline-light btn-sm"
              @click="handleGoToSignIn"
            >
              Sign in
            </button>
            <button
              type="button"
              class="btn btn-light btn-sm text-primary"
              @click="handleGoToSignUp"
            >
              Sign up
            </button>
          </div>
          <button
            v-else
            type="button"
            class="btn btn-light btn-sm text-primary"
            @click="handleLogout"
          >
            Sign out
          </button>
        </div>
      </div>
    </div>
  </header>
</template>
