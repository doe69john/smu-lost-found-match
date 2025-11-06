<script setup>
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { z } from 'zod'
import { usePasswordReset } from '../composables/usePasswordReset'
import { pushToast } from '../composables/useToast'
import { UiButton, UiInput } from '../components/ui'

const route = useRoute()
const router = useRouter()
const { applyRecoverySession, completePasswordReset } = usePasswordReset()

const password = ref('')
const confirmPassword = ref('')
const loading = ref(false)
const verifying = ref(true)
const sessionReady = ref(false)
const linkError = ref(
  'This reset link is invalid or has expired. Please request a new one.'
)
const errorMessage = ref('')
const successMessage = ref('')

const redirectTarget = computed(() => {
  const redirect = route.query?.redirect
  return typeof redirect === 'string' && redirect ? redirect : '/dashboard'
})

const passwordSchema = z
  .object({
    password: z
      .string({ required_error: 'Password is required' })
      .min(6, 'Password must be at least 6 characters for security'),
    confirmPassword: z
      .string({ required_error: 'Please confirm your password' })
      .min(6, 'Password confirmation is required')
  })
  .refine((value) => value.password === value.confirmPassword, {
    message: 'Passwords do not match.',
    path: ['confirmPassword']
  })

const sensitiveParams = [
  'access_token',
  'refresh_token',
  'expires_in',
  'expires_at',
  'token_type',
  'type',
  'token',
  'recovery_token',
  'oob_code'
]

function parseRecoveryParams(currentRoute) {
  const params = {}

  if (currentRoute.hash) {
    const hash = currentRoute.hash.startsWith('#')
      ? currentRoute.hash.slice(1)
      : currentRoute.hash
    const hashParams = new URLSearchParams(hash)
    hashParams.forEach((value, key) => {
      params[key] = value
    })
  }

  if (currentRoute.query) {
    sensitiveParams.forEach((key) => {
      const value = currentRoute.query[key]
      if (typeof value === 'string' && value) {
        params[key] = value
      }
    })
  }

  if (!params.access_token || !params.refresh_token) {
    if (!params.token && !params.recovery_token && !params.oob_code) {
      return null
    }
  }

  if (params.type && params.type !== 'recovery') {
    return null
  }

  return params
}

function sanitizeRecoveryRoute() {
  const sanitizedQuery = {}
  let mutated = false

  Object.entries(route.query || {}).forEach(([key, value]) => {
    if (!sensitiveParams.includes(key)) {
      sanitizedQuery[key] = value
    } else {
      mutated = true
    }
  })

  if (route.hash || mutated) {
    router.replace({
      path: route.path,
      query: sanitizedQuery,
      hash: ''
    })
  }
}

onMounted(async () => {
  const params = parseRecoveryParams(route)

  if (!params) {
    sanitizeRecoveryRoute()
    verifying.value = false
    sessionReady.value = false
    linkError.value =
      'This reset link is invalid or has expired. Please request a new one.'
    return
  }

  try {
    await applyRecoverySession(params)
    sessionReady.value = true
    sanitizeRecoveryRoute()
  } catch (error) {
    console.error('Failed to apply recovery session', error)
    sessionReady.value = false
    sanitizeRecoveryRoute()
    linkError.value =
      error?.message ||
      'This reset link is invalid or has expired. Please request a new one.'
  } finally {
    verifying.value = false
  }
})

const handleSubmit = async () => {
  if (!sessionReady.value || loading.value) return

  errorMessage.value = ''
  successMessage.value = ''

  try {
    loading.value = true
    const payload = passwordSchema.parse({
      password: password.value,
      confirmPassword: confirmPassword.value
    })

    await completePasswordReset({ password: payload.password })

    successMessage.value =
      'Password updated successfully. Redirecting to your dashboard...'
    pushToast({
      title: 'Password updated',
      message: 'You are now signed in with your new credentials.',
      variant: 'success'
    })

    setTimeout(() => {
      router.replace(redirectTarget.value)
    }, 1200)
  } catch (error) {
    if (error instanceof z.ZodError) {
      errorMessage.value =
        error.errors?.[0]?.message || 'Please verify the password fields.'
      return
    }

    errorMessage.value =
      error?.message || 'Unable to update the password. Please try again.'
  } finally {
    loading.value = false
  }
}

const goToForgotPassword = () => {
  const redirect = redirectTarget.value !== '/dashboard' ? redirectTarget.value : ''
  const query = redirect ? { redirect } : undefined
  router.push({ name: 'auth-forgot-password', ...(query ? { query } : {}) })
}
</script>

<template>
  <section class="d-grid gap-4">
    <header class="text-center">
      <div
        class="d-inline-flex align-items-center justify-content-center rounded-3 bg-primary text-white mb-3"
        style="width: 72px; height: 72px;"
      >
        <span class="fw-bold fs-3">SMU</span>
      </div>
      <h1 class="h3 fw-semibold mb-1">Choose a new password</h1>
      <p class="text-muted mb-0">
        {{
          sessionReady
            ? 'Enter a new password to secure your account.'
            : 'We could not verify this reset link.'
        }}
      </p>
    </header>

    <div v-if="verifying" class="alert alert-info" role="status">
      Validating your reset link...
    </div>

    <div v-else-if="!sessionReady" class="d-grid gap-3">
      <div class="alert alert-danger mb-0" role="alert">
        {{ linkError }}
      </div>
      <UiButton
        type="button"
        class="justify-content-center"
        variant="secondary"
        @click="goToForgotPassword"
      >
        Request a new link
      </UiButton>
    </div>

    <form v-else class="d-grid gap-3" @submit.prevent="handleSubmit">
      <div v-if="errorMessage" class="alert alert-danger" role="alert">
        {{ errorMessage }}
      </div>

      <UiInput
        v-model="password"
        id="new-password"
        type="password"
        label="New password"
        placeholder="Enter a new password"
        autocomplete="new-password"
        description="Must be at least 6 characters."
        required
        :disabled="loading"
      />

      <UiInput
        v-model="confirmPassword"
        id="confirm-password"
        type="password"
        label="Confirm password"
        placeholder="Re-enter your new password"
        autocomplete="new-password"
        required
        :disabled="loading"
      />

      <UiButton
        type="submit"
        class="w-100 justify-content-center"
        :loading="loading"
      >
        Update password
      </UiButton>

      <div v-if="successMessage" class="alert alert-success mt-2 mb-0" role="status">
        {{ successMessage }}
      </div>
    </form>
  </section>
</template>
