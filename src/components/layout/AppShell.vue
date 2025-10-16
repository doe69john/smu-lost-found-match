<script setup>
import { RouterView } from 'vue-router'
import AppHeader from './AppHeader.vue'
import AuthGuard from './AuthGuard.vue'
import { UiCard } from '../ui'
import { useToast } from '../../composables/useToast'

const { toasts, dismissToast } = useToast()

const toastClass = (variant = 'primary') =>
  [
    'toast',
    'app-toast',
    'align-items-center',
    `text-bg-${variant}`,
    'border-0',
    'show',
    'transition-base',
    'transition-lift'
  ].join(' ')
</script>

<template>
  <div class="app-shell">
    <AppHeader />

    <main class="app-main">
      <div class="app-main__background">
        <div class="app-main__glow app-main__glow--one"></div>
        <div class="app-main__glow app-main__glow--two"></div>
      </div>

      <div class="app-main__content">
        <RouterView v-slot="{ Component, route }">
          <Transition name="page-fade" mode="out-in">
            <component
              :is="route.meta.requiresAuth ? AuthGuard : 'div'"
              :key="route.fullPath"
              class="app-main__route"
            >
              <Transition name="surface-slide" appear>
                <div
                  class="app-surface-wrapper"
                  :class="[
                    route.meta.layout === 'auth'
                      ? 'app-surface-wrapper--narrow'
                      : 'app-surface-wrapper--wide'
                  ]"
                >
                  <UiCard
                    class="app-surface-card transition-press"
                    body-class="app-surface-card__body"
                    :flush="true"
                  >
                    <component :is="Component" />
                  </UiCard>
                </div>
              </Transition>
            </component>
          </Transition>
        </RouterView>
      </div>
    </main>

    <div class="position-fixed bottom-0 end-0 p-3" style="z-index: 1080;">
      <TransitionGroup tag="div" name="toast-slide" class="toast-container app-toast-stack">
        <div
          v-for="toast in toasts"
          :key="toast.id"
          :class="toastClass(toast.variant)"
          role="alert"
          aria-live="assertive"
          aria-atomic="true"
        >
          <div class="d-flex align-items-start gap-3">
            <div class="toast-body">
              <strong class="d-block">{{ toast.title }}</strong>
              <span>{{ toast.message }}</span>
            </div>
            <button
              type="button"
              class="btn-close btn-close-white ms-auto"
              aria-label="Close"
              @click="dismissToast(toast.id)"
            ></button>
          </div>
        </div>
      </TransitionGroup>
    </div>
  </div>
</template>
