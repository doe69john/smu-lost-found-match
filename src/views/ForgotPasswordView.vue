<script setup>
import { computed, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { z } from 'zod'
import { usePasswordReset } from '../composables/usePasswordReset'
import { pushToast } from '../composables/useToast'
import { UiButton, UiInput } from '../components/ui'

const route = useRoute()
const router = useRouter()
const { requestPasswordReset } = usePasswordReset()

const email = ref('')
const loading = ref(false)
const errorMessage = ref('')
const successMessage = ref('')

const redirectParam = computed(() => {
  const redirect = route.query?.redirect
  return typeof redirect === 'string' && redirect ? redirect : ''
})

const smuEmailSchema = z
  .string({ required_error: 'Email is required' })
  .email({ message: 'Enter a valid email address' })
  .refine((value) => /@([a-z]+\.)?smu\.edu\.sg$/i.test(value), {
    message: 'Please use your SMU email address (e.g., your.name@smu.edu.sg)'
  })

const schema = z.object({
  email: smuEmailSchema
})

const resolveAppBaseUrl = () => {
  const envUrl = import.meta?.env?.VITE_SITE_URL

  if (envUrl) {
    try {
      const url = new URL(envUrl)
      url.hash = ''
      return url.toString()
    } catch (error) {
      console.warn('Invalid VITE_SITE_URL provided. Falling back to window.location.', error)
    }
  }

  if (typeof window !== 'undefined' && window.location?.origin) {
    return window.location.origin
  }

  throw new Error('Password reset links cannot be generated in this environment.')
}

const buildRedirectUrl = () => {
  const baseUrl = resolveAppBaseUrl()
  const base = new URL(baseUrl)

  base.search = ''
  base.hash = ''

  const basePath = base.pathname === '/' ? '' : base.pathname.replace(/\/$/, '')
  base.pathname = `${basePath}/auth/reset-password`

  if (redirectParam.value) {
    base.searchParams.set('redirect', redirectParam.value)
  }

  return base.toString()
}

const handleSubmit = async () => {
  if (loading.value) return

  errorMessage.value = ''
  successMessage.value = ''

  try {
    loading.value = true
    const payload = schema.parse({ email: email.value.trim() })
    const redirectTo = buildRedirectUrl()

    await requestPasswordReset({ email: payload.email, redirectTo })

    successMessage.value =
      "If an account exists for this email, we've sent password reset instructions to your inbox."
    pushToast({
      title: 'Reset email sent',
      message: 'Check your SMU inbox for the password reset link.',
      variant: 'success'
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      errorMessage.value =
        error.errors?.[0]?.message || 'Please enter a valid SMU email address.'
      return
    }

    errorMessage.value =
      error?.message || 'Unable to send the password reset email. Please try again later.'
  } finally {
    loading.value = false
  }
}

const goToSignIn = () => {
  const query = redirectParam.value ? { redirect: redirectParam.value } : undefined
  router.push({ name: 'auth', ...(query ? { query } : {}) })
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
      <h1 class="h3 fw-semibold mb-1">Reset your password</h1>
      <p class="text-muted mb-0">Enter your SMU email and we'll send you a reset link.</p>
    </header>

    <form class="d-grid gap-3" @submit.prevent="handleSubmit">
      <div v-if="errorMessage" class="alert alert-danger" role="alert">
        {{ errorMessage }}
      </div>

      <UiInput
        v-model="email"
        id="reset-email"
        type="email"
        inputmode="email"
        label="SMU email"
        placeholder="your.name@smu.edu.sg"
        autocomplete="email"
        required
        :disabled="loading"
      />

      <UiButton type="submit" class="w-100 justify-content-center" :loading="loading">
        Send reset link
      </UiButton>

      <div v-if="successMessage" class="alert alert-success mt-2 mb-0" role="status">
        {{ successMessage }}
      </div>
    </form>

    <p class="text-center text-muted small mb-0">
      Remembered your password?
      <UiButton
        type="button"
        variant="link"
        class="p-0 align-baseline"
        @click="goToSignIn"
      >
        Return to sign in
      </UiButton>
    </p>
  </section>
</template>
