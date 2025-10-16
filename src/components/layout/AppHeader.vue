<script setup>
import { computed, ref, watch } from 'vue'
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

const CTA_PATHS = ['/report-lost', '/report-found']

const activePath = computed(() => route.path)
const isLoggedIn = computed(() => authStatus.value)
const displayName = computed(
  () =>
    user.value?.user_metadata?.full_name ||
    user.value?.full_name ||
    user.value?.email ||
    'Member'
)

const primaryLinks = computed(() => navigation.filter((link) => !CTA_PATHS.includes(link.path)))
const ctaLinks = computed(() => navigation.filter((link) => CTA_PATHS.includes(link.path)))

const isMenuOpen = ref(false)

const toggleMenu = () => {
  isMenuOpen.value = !isMenuOpen.value
}

const closeMenu = () => {
  isMenuOpen.value = false
}

const buildRedirectQuery = () => {
  if (['auth', 'auth-signup', 'not-found'].includes(route.name)) {
    return undefined
  }

  return { redirect: route.fullPath }
}

const handleGoToSignIn = () => {
  closeMenu()
  const query = buildRedirectQuery()
  router.push(query ? { name: 'auth', query } : { name: 'auth' })
}

const handleGoToSignUp = () => {
  closeMenu()
  const query = buildRedirectQuery()
  router.push(query ? { name: 'auth-signup', query } : { name: 'auth-signup' })
}

const handleLogout = async () => {
  closeMenu()
  await logout()
  pushToast({ title: 'Signed out', message: 'You have been logged out.', variant: 'info' })
  router.push({ name: 'auth' })
}

watch(
  () => route.fullPath,
  () => {
    closeMenu()
  }
)
</script>

<template>
  <header class="app-header">
    <div class="app-header__bar">
      <div class="app-header__brand">
        <RouterLink class="app-header__logo" to="/">
          Lost &amp; Found Portal
        </RouterLink>
      </div>

      <button
        class="app-header__toggle transition-base"
        type="button"
        aria-controls="app-mobile-menu"
        :aria-expanded="isMenuOpen ? 'true' : 'false'"
        @click="toggleMenu"
      >
        <span></span>
      </button>

      <nav v-if="isLoggedIn" class="app-header__nav">
        <RouterLink
          v-for="link in primaryLinks"
          :key="link.path"
          class="app-header__link"
          :class="{ 'is-active': activePath === link.path }"
          :to="link.path"
        >
          {{ link.name }}
        </RouterLink>
      </nav>

      <div class="app-header__cta-group">
        <RouterLink
          v-for="(link, index) in ctaLinks"
          :key="link.path"
          class="app-header__cta-button"
          :class="{ 'app-header__cta-button--outline': index === 1 }"
          :to="link.path"
        >
          {{ link.name }}
        </RouterLink>
      </div>

      <div class="app-header__auth">
        <div v-if="isLoggedIn" class="app-header__identity">
          Signed in as <strong>{{ displayName }}</strong>
        </div>

        <div v-if="!isLoggedIn" class="d-flex align-items-center gap-2">
          <button type="button" class="app-header__ghost-button" @click="handleGoToSignIn">
            Sign in
          </button>
          <button type="button" class="app-header__solid-button" @click="handleGoToSignUp">
            Sign up
          </button>
        </div>

        <button v-else type="button" class="app-header__solid-button" @click="handleLogout">
          Sign out
        </button>
      </div>
    </div>

    <Transition name="drawer-fade">
      <div v-if="isMenuOpen" class="app-header__overlay" @click="closeMenu"></div>
    </Transition>

    <Transition name="drawer-slide">
      <nav v-if="isMenuOpen" id="app-mobile-menu" class="app-header__drawer" aria-label="Mobile navigation">
        <div v-if="isLoggedIn" class="app-header__drawer-nav">
          <RouterLink
            v-for="link in primaryLinks"
            :key="`drawer-${link.path}`"
            class="app-header__drawer-link"
            :class="{ 'is-active': activePath === link.path }"
            :to="link.path"
            @click="closeMenu"
          >
            {{ link.name }}
          </RouterLink>
        </div>

        <div class="app-header__drawer-cta">
          <RouterLink
            v-for="(link, index) in ctaLinks"
            :key="`cta-${link.path}`"
            class="app-header__cta-button"
            :class="{ 'app-header__cta-button--outline': index === 1 }"
            :to="link.path"
            @click="closeMenu"
          >
            {{ link.name }}
          </RouterLink>
        </div>

        <div class="app-header__drawer-auth">
          <template v-if="!isLoggedIn">
            <button type="button" class="app-header__ghost-button" @click="handleGoToSignIn">
              Sign in
            </button>
            <button type="button" class="app-header__solid-button" @click="handleGoToSignUp">
              Sign up
            </button>
          </template>
          <button v-else type="button" class="app-header__solid-button" @click="handleLogout">
            Sign out
          </button>
        </div>
      </nav>
    </Transition>
  </header>
</template>
