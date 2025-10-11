<script setup>
import { RouterLink } from 'vue-router'

const props = defineProps({
  title: {
    type: String,
    default: 'Page not found'
  },
  description: {
    type: String,
    default:
      'The page you were looking for could not be found. Check the URL or return to the dashboard.'
  },
  ctaLabel: {
    type: String,
    default: 'Back to dashboard'
  },
  ctaTo: {
    type: [String, Object],
    default: () => ({ name: 'dashboard' })
  }
})
</script>

<template>
  <section class="py-5 text-center d-grid gap-3">
    <h1 class="display-5 fw-bold mb-0">{{ props.title }}</h1>
    <p class="text-muted mx-auto" style="max-width: 36rem;">
      {{ props.description }}
    </p>
    <RouterLink class="btn btn-primary" :to="props.ctaTo">
      {{ props.ctaLabel }}
    </RouterLink>
  </section>
</template>
