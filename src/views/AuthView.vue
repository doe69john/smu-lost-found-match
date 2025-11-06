<script setup>
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { z } from 'zod'
import { LogIn, UserPlus } from 'lucide-vue-next'
import { useAuth } from '../composables/useAuth'
import { pushToast } from '../composables/useToast'
import { UiButton, UiInput } from '../components/ui'

const route = useRoute()
const router = useRouter()
const { login, register } = useAuth()

const modes = {
  signin: 'signin',
  signup: 'signup'
}

const SIGNUP_SUCCESS_FLAG = 'signupSuccess'
const SIGNUP_SUCCESS_MESSAGE = 'Registration successful! Please verify your email before signing in.'

const mode = ref(route.meta?.authMode === 'signup' || route.name === 'auth-signup' ? modes.signup : modes.signin)

watch(
  () => route.name,
  (name) => {
    mode.value = name === 'auth-signup' ? modes.signup : modes.signin
  }
)

const email = ref('')
const password = ref('')
const fullName = ref('')
const loading = ref(false)
const errorMessage = ref('')
const successMessage = ref('')

const isSignup = computed(() => mode.value === modes.signup)

const withoutSignupSuccessFlag = (query) => {
  if (!query || typeof query !== 'object') {
    return undefined
  }

  const sanitizedQuery = { ...query }
  delete sanitizedQuery[SIGNUP_SUCCESS_FLAG]

  return Object.keys(sanitizedQuery).length ? sanitizedQuery : undefined
}

const clearSignupSuccessFlag = () => {
  if (!route.query?.[SIGNUP_SUCCESS_FLAG]) {
    return
  }

  const sanitizedQuery = withoutSignupSuccessFlag(route.query)
  const navigationTarget = sanitizedQuery
    ? { path: route.path, query: sanitizedQuery }
    : { path: route.path }

  router.replace(navigationTarget)
}

const primaryActionIcon = computed(() => (isSignup.value ? UserPlus : LogIn))

const primaryActionLabel = computed(() => {
  if (loading.value) {
    return isSignup.value ? 'Creating account...' : 'Signing in...'
  }

  return isSignup.value ? 'Sign up' : 'Sign in'
})

const smuEmailSchema = z
  .string({ required_error: 'Email is required' })
  .email({ message: 'Enter a valid email address' })
  .refine((value) => /@([a-z]+\.)?smu\.edu\.sg$/i.test(value), {
    message: 'Please use a valid SMU email address (e.g., your.name@smu.edu.sg)'
  })

const signInSchema = z.object({
  email: z.string({ required_error: 'Email is required' }).email({ message: 'Enter a valid email address' }),
  password: z.string({ required_error: 'Password is required' }).min(1, 'Password is required')
})

const signUpSchema = z.object({
  fullName: z.string({ required_error: 'Full name is required' }).min(2, 'Name must be at least 2 characters'),
  email: smuEmailSchema,
  password: z
    .string({ required_error: 'Password is required' })
    .min(6, 'Password must be at least 6 characters for security')
})

const redirectTarget = computed(() => {
  const redirect = route.query.redirect
  return typeof redirect === 'string' && redirect ? redirect : '/dashboard'
})

const goToMode = (targetMode) => {
  if (targetMode === mode.value) return
  resetFeedback()

  const target = targetMode === modes.signup ? { name: 'auth-signup' } : { name: 'auth' }

  if (route.query && Object.keys(route.query).length) {
    target.query = { ...route.query }
  }

  router.replace(target)
}

const resetFeedback = () => {
  errorMessage.value = ''
  successMessage.value = ''
  clearSignupSuccessFlag()
}

const handleSubmit = async () => {
  if (loading.value) return

  resetFeedback()

  try {
    loading.value = true

    if (isSignup.value) {
      const payload = signUpSchema.parse({
        fullName: fullName.value.trim(),
        email: email.value.trim(),
        password: password.value
      })

      const response = await register({
        email: payload.email,
        password: payload.password,
        fullName: payload.fullName
      })

      pushToast({
        title: 'Registration submitted',
        message: 'Check your SMU inbox to verify your account before signing in.',
        variant: 'success'
      })

      if (!response?.session) {
        successMessage.value = 'Registration successful! Please verify your email before signing in.'
        return
      }

      router.replace(redirectTarget.value)
      return
    } else {
      const payload = signInSchema.parse({
        email: email.value.trim(),
        password: password.value
      })

      await login({ email: payload.email, password: payload.password })

      pushToast({
        title: 'Signed in',
        message: 'Welcome back to the Lost & Found dashboard.',
        variant: 'success'
      })

      router.replace(redirectTarget.value)
      return
    }
  } catch (error) {
    if (error instanceof z.ZodError) {
      errorMessage.value = error.errors?.[0]?.message || 'Please review the highlighted fields.'
      return
    }

    errorMessage.value = error?.message || 'Authentication failed. Please try again.'
  } finally {
    loading.value = false
  }
}

</script>

<template>
  <section class="d-grid gap-4">
    <header class="text-center">
      <div class="d-inline-flex align-items-center justify-content-center rounded-3 bg-primary text-white mb-3" style="width: 72px; height: 72px;">
        <span class="fw-bold fs-3">SMU</span>
      </div>
      <h1 class="h3 fw-semibold mb-1">
        {{ isSignup ? 'Create your SMU Lost & Found account' : 'Welcome back' }}
      </h1>
      <p class="text-muted mb-0">
        {{
          isSignup
            ? 'Use your SMU email to register and start matching items.'
            : 'Sign in with your SMU credentials to manage reports.'
        }}
      </p>
    </header>

    <form class="d-grid gap-3" @submit.prevent="handleSubmit">
      <div v-if="errorMessage" class="alert alert-danger" role="alert">
        {{ errorMessage }}
      </div>

      <UiInput
        v-if="isSignup"
        v-model="fullName"
        id="full-name"
        label="Full name"
        placeholder="e.g. Jamie Tan"
        autocomplete="name"
        name="full-name"
        required
      />

      <UiInput
        v-model="email"
        id="email"
        type="email"
        inputmode="email"
        label="SMU email"
        placeholder="your.name@smu.edu.sg"
        autocomplete="email"
        required
      />

      <UiInput
        v-model="password"
        id="password"
        type="password"
        label="Password"
        placeholder="Enter your password"
        :autocomplete="isSignup ? 'new-password' : 'current-password'"
        :description="isSignup ? 'Must be at least 6 characters.' : ''"
        required
      />

      <UiButton
        type="submit"
        class="w-100 justify-content-center"
        :loading="loading"
        :icon="primaryActionIcon"
      >
        {{ primaryActionLabel }}
      </UiButton>

      <div v-if="successMessage" class="alert alert-success mt-2 mb-0" role="status">
        {{ successMessage }}
      </div>
    </form>

    <p class="text-center text-muted small mb-0">
      <template v-if="isSignup">
        Already have an account?
        <UiButton
          type="button"
          variant="link"
          class="p-0 align-baseline"
          @click="goToMode(modes.signin)"
        >
          Sign in
        </UiButton>
      </template>
      <template v-else>
        Don't have an account?
        <UiButton
          type="button"
          variant="link"
          class="p-0 align-baseline"
          @click="goToMode(modes.signup)"
        >
          Create one
        </UiButton>
      </template>
    </p>
  </section>
</template>
