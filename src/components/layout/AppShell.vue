<script setup>
import { RouterView } from 'vue-router'
import AppHeader from './AppHeader.vue'
import AuthGuard from './AuthGuard.vue'
import { UiCard } from '../ui'
import { useToast } from '../../composables/useToast'

const { toasts, dismissToast } = useToast()

const toastClass = (variant = 'primary') =>
  `toast align-items-center text-bg-${variant} border-0 show`
</script>

<template>
  <div class="d-flex flex-column min-vh-100 bg-light">
    <AppHeader />

    <main class="flex-grow-1 py-4">
      <div class="container">
        <RouterView v-slot="{ Component, route }">
          <component :is="route.meta.requiresAuth ? AuthGuard : 'div'" class="h-100">
            <div class="row justify-content-center">
              <div
                :class="[
                  'col-12',
                  route.meta.layout === 'auth'
                    ? 'col-md-8 col-lg-5'
                    : 'col-lg-10'
                ]"
              >
                <UiCard class="h-100" body-class="p-4" :flush="true">
                  <component :is="Component" />
                </UiCard>
              </div>
            </div>
          </component>
        </RouterView>
      </div>
    </main>

    <div class="position-fixed bottom-0 end-0 p-3" style="z-index: 1080;">
      <div class="toast-container">
        <div
          v-for="toast in toasts"
          :key="toast.id"
          :class="toastClass(toast.variant)"
          role="alert"
          aria-live="assertive"
          aria-atomic="true"
        >
          <div class="d-flex">
            <div class="toast-body">
              <strong class="d-block">{{ toast.title }}</strong>
              <span>{{ toast.message }}</span>
            </div>
            <button
              type="button"
              class="btn-close btn-close-white me-2 m-auto"
              aria-label="Close"
              @click="dismissToast(toast.id)"
            ></button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
