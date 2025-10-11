<script setup>
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAuth } from '../../composables/useAuth'

const { isAuthenticated } = useAuth()
const route = useRoute()
const router = useRouter()

const redirectToAuth = () => {
  router.push({ name: 'auth', query: { redirect: route.fullPath } })
}

const redirectToSignup = () => {
  router.push({ name: 'auth-signup', query: { redirect: route.fullPath } })
}

const isGuest = computed(() => !isAuthenticated.value)
</script>

<template>
  <div>
    <slot v-if="!isGuest" />
    <div v-else class="text-center py-5">
      <h2 class="fw-semibold mb-3">Please sign in</h2>
      <p class="text-muted mb-4">You need to be authenticated to access this area.</p>
      <div class="d-flex flex-column flex-sm-row gap-2 justify-content-center">
        <button type="button" class="btn btn-primary" @click="redirectToAuth">
          Go to sign in
        </button>
        <button type="button" class="btn btn-outline-primary" @click="redirectToSignup">
          Create an account
        </button>
      </div>
    </div>
  </div>
</template>
