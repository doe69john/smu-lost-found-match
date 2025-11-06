<script setup>
import { computed, ref, watch } from 'vue'
import { useRouter, useRoute, RouterLink } from 'vue-router'
import { useAuth } from '../../composables/useAuth'
import { pushToast } from '../../composables/useToast'
import { useTheme } from '../../composables/useTheme'

const { isAuthenticated: authStatus, user, logout } = useAuth()
const router = useRouter()
const route = useRoute()

const navigation = [
  { name: 'Dashboard', path: '/dashboard' },
  { name: 'My Lost Items', path: '/browse-lost' },
  { name: 'My Found Items', path: '/browse-found' },
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

// Theme toggle
const { isDark, toggleTheme } = useTheme()
</script>

<template>
  <header class="app-header">
    <!-- Row 1 (always shown). On mobile this is the ONLY row -->
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
            <div class="app-header__identity">
              Signed in as <strong>{{ displayName }}</strong>
            </div>
            <button
              type="button"
              class="app-header__solid-button signout-button"
              @click="handleLogout"
            >
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

        <!-- Single hamburger (mobile only) -->
        <button
          class="app-header__toggle transition-base only-mobile"
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

    <!-- Row 2 (desktop only) -->
    <div v-if="!isAuthRoute" class="app-header__bar app-header__bar--bottom only-desktop">
      <!-- Tabs (desktop only) -->
      <nav v-if="isLoggedIn" class="app-header__nav" aria-label="Sections">
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
      <div class="app-header__cta-group" aria-label="Quick actions">
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

      <!-- Theme + auth area (desktop only) -->
      <div class="app-header__auth">
        <button
          type="button"
          class="app-header__ghost-button"
          aria-label="Toggle theme"
          title="Toggle theme"
          @click="toggleTheme"
        >
          <span v-if="isDark" aria-hidden="true" style="display:inline-flex;align-items:center;gap:.35rem;">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
              <path d="M21.64 13.64A9 9 0 1 1 10.36 2.36 7 7 0 0 0 21.64 13.64z"/>
            </svg>
            Dark
          </span>
          <span v-else aria-hidden="true" style="display:inline-flex;align-items:center;gap:.35rem;">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
              <path d="M12 4V2m0 20v-2m8-8h2M2 12h2m13.657 6.343l1.414 1.414M4.929 4.929l1.414 1.414m0 11.314l-1.414 1.414M19.071 4.929l-1.414 1.414M12 6a6 6 0 100 12 6 6 0 000-12z" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round"/>
            </svg>
            Light
          </span>
        </button>

        <div v-if="!isLoggedIn" class="d-flex align-items-center gap-2">
          <button type="button" class="app-header__ghost-button" @click="handleGoToSignIn">
            Sign in
          </button>
          <button type="button" class="app-header__solid-button" @click="handleGoToSignUp">
            Sign up
          </button>
        </div>
      </div>
<!-- (No “Signed in as” or Sign out here — both handled in Row 1) -->

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
        <div class="app-header__drawer-auth">
          <button type="button" class="app-header__drawer-link" @click="toggleTheme">
            <span v-if="isDark">Switch to Light Mode</span>
            <span v-else>Switch to Dark Mode</span>
          </button>
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

        <!-- CTAs on mobile -->
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

/* Hide mobile-only elements on larger screens */
@media (min-width: 1025px) {
  .only-mobile {
    display: none !important;
  }
}

/* Hide desktop-only elements on tablets and mobile */
@media (max-width: 1024px) {
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
