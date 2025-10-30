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
  { name: 'Browse Lost', path: '/browse-lost' },
  { name: 'Browse Found', path: '/browse-found' },
  { name: 'I Lost My Item', path: '/report-lost', cta: true },
  { name: 'I Found an Item', path: '/report-found', cta: true }
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

const isAuthRoute = computed(() => ['auth', 'auth-signup'].includes(route.name))

const isMenuOpen = ref(false)

const toggleMenu = () => {
  if (isAuthRoute.value) {
    return
  }

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

watch(
  () => isAuthRoute.value,
  (isAuth) => {
    if (isAuth) {
      closeMenu()
    }
  }
)
</script>

<template>
  <header class="app-header">
    <!-- Row 1 -->
    <div class="app-header__bar app-header__bar--top">
      <div class="app-header__brand">
        <RouterLink class="app-header__logo" to="/" aria-label="Go to home">
          Lost &amp; Found Portal
        </RouterLink>
      </div>

      <div v-if="!isAuthRoute" class="app-header__right">
        <!-- Auth (desktop only) -->
        <div class="app-header__auth only-desktop">
          <template v-if="isLoggedIn">
            <div class="app-header__identity">Signed in as <strong>{{ displayName }}</strong></div>
            <button
              type="button" class="app-header__solid-button signout-button" @click="handleLogout">
              Sign out
            </button>
          </template>
          <template v-else>
            <button type="button" class="app-header__ghost-button" @click="handleGoToSignIn">
              Sign in
            </button>
            <button type="button" class="app-header__solid-button" @click="handleGoToSignUp">
              Sign up
            </button>
          </template>
        </div>

        <!-- Always show hamburger -->
        <button
          class="app-header__toggle transition-base"
          type="button"
          aria-controls="app-mobile-menu"
          :aria-expanded="isMenuOpen ? 'true' : 'false'"
          @click="toggleMenu"
          aria-label="Open menu"
        >
          <span></span>
        </button>
      </div>
    </div>

    <!-- Row 2 -->
    <div v-if="!isAuthRoute" class="app-header__bar app-header__bar--bottom">
      <!-- Tabs (desktop only) -->
      <nav v-if="isLoggedIn" class="app-header__nav only-desktop" aria-label="Sections">
        <div class="app-header__links">
          <RouterLink
            v-for="link in primaryLinks"
            :key="link.path"
            class="app-header__link"
            :class="{ 'is-active': activePath === link.path }"
            :to="link.path"
            :aria-current="activePath === link.path ? 'page' : undefined"
          >
            {{ link.name }}
          </RouterLink>
        </div>
      </nav>

      <!-- CTAs (desktop only) -->
      <div class="app-header__cta-group only-desktop" aria-label="Quick actions">
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
    </div>

    <!-- Overlay -->
    <Transition name="drawer-fade">
      <div
        v-if="!isAuthRoute && isMenuOpen"
        class="app-header__overlay"
        @click="closeMenu"
        aria-hidden="true"
      ></div>
    </Transition>

    <!-- Drawer (mobile) -->
    <Transition name="drawer-slide">
      <nav
        v-if="!isAuthRoute && isMenuOpen"
        id="app-mobile-menu"
        class="app-header__drawer"
        aria-label="Mobile navigation"
      >
        <div v-if="isLoggedIn" class="app-header__drawer-head">
          <p class="app-header__drawer-hello">Hello, <strong>{{ displayName }}</strong></p>
        </div>

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

        <!-- CTAs live here on mobile -->
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
            <button v-else type="button" class="app-header__solid-button signout-button" @click="handleLogout">
              Sign out
            </button>

        </div>
      </nav>
    </Transition>
  </header>
</template>


<style>
.app-header__bar--bottom {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.75rem 2rem;
  border-top: 1px solid rgba(0, 0, 0, 0.05);
}

.app-header__nav {
  flex: 1; 
}

.app-header__links {
  display: flex;
  justify-content: space-evenly; 
  gap: 1rem;
  width: 100%;
}


.app-header__link {
  flex: 1; 
  text-align: center;
  font-weight: 500;
  padding: 0.5rem 0;
  transition: color 0.3s, border-color 0.3s;
  border-bottom: 2px solid transparent;
}

.app-header__link:hover {
  color: #4f46e5; 
}

.app-header__link.is-active {
  border-color: #6366f1; 
  color: #4338ca;
}

.app-header__cta-group {
  display: flex;
  gap: 0.75rem;
  margin-left: 2rem;
}

/* Hide desktop-only elements on small screens */
@media (max-width: 768px) {
  .only-desktop {
    display: none !important;
  }
}

.signout-button {
  background-color: #ef4444 !important; /* Red */
  color: #fff !important;
  transition: background-color 0.2s;
}

.signout-button:hover {
  background-color: #dc2626 !important; /* Darker red */
}



</style>
