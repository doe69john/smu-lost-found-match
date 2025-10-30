<script setup>
import { computed, ref, watch } from 'vue'

const props = defineProps({
  steps: {
    type: Array,
    default: () => []
  },
  initialStep: {
    type: Number,
    default: 0
  },
  autoScroll: {
    type: Boolean,
    default: true
  },
  finishLabel: {
    type: String,
    default: 'Submit'
  }
})

const emit = defineEmits(['update:currentStep', 'step-change', 'complete'])

const currentStepIndex = ref(props.initialStep)
const furthestVisited = ref(props.initialStep)

const steps = computed(() => props.steps || [])
const totalSteps = computed(() => steps.value.length)

watch(
  () => props.initialStep,
  (value) => {
    if (typeof value === 'number' && value >= 0 && value < totalSteps.value) {
      currentStepIndex.value = value
      furthestVisited.value = Math.max(furthestVisited.value, value)
    }
  }
)

const currentStep = computed(() => steps.value[currentStepIndex.value] || null)
const isFirstStep = computed(() => currentStepIndex.value === 0)
const isLastStep = computed(() => currentStepIndex.value === totalSteps.value - 1)

const progressPercentage = computed(() => {
  if (!totalSteps.value) return 0
  return Math.round(((currentStepIndex.value + 1) / totalSteps.value) * 100)
})

function scrollIntoView() {
  if (!props.autoScroll || typeof window === 'undefined' || typeof document === 'undefined') {
    return
  }

  window.requestAnimationFrame(() => {
    const el = document.querySelector('.form-wizard')
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  })
}

async function runGuard(guard, direction) {
  if (typeof guard !== 'function') return true
  try {
    const result = await guard({
      step: currentStep.value,
      index: currentStepIndex.value,
      direction
    })
    return result !== false
  } catch {
    return false
  }
}

async function goToStep(index, { allowForward = false } = {}) {
  if (index === currentStepIndex.value) return
  if (index < 0 || index >= totalSteps.value) return

  if (index > currentStepIndex.value && !allowForward && index > furthestVisited.value) {
    return
  }

  const targetStep = steps.value[index]
  const guard = index > currentStepIndex.value ? currentStep.value?.beforeLeave : currentStep.value?.beforeBack
  const allowed = await runGuard(guard, index > currentStepIndex.value ? 'forward' : 'back')
  if (!allowed) {
    return
  }

  currentStepIndex.value = index
  furthestVisited.value = Math.max(furthestVisited.value, index)
  emit('update:currentStep', index)
  emit('step-change', { step: targetStep, index })
  scrollIntoView()
}

async function next() {
  if (!currentStep.value) return
  const guard = currentStep.value?.beforeNext
  const allowed = await runGuard(guard, 'forward')
  if (!allowed) return

  if (isLastStep.value) {
    emit('complete', { step: currentStep.value, index: currentStepIndex.value })
    return
  }

  await goToStep(currentStepIndex.value + 1, { allowForward: true })
}

async function previous() {
  if (isFirstStep.value) return
  const guard = currentStep.value?.beforeBack
  const allowed = await runGuard(guard, 'back')
  if (!allowed) return
  await goToStep(currentStepIndex.value - 1, { allowForward: true })
}

defineExpose({
  next,
  previous,
  goToStep,
  currentStepIndex
})
</script>

<template>
  <div class="form-wizard d-flex flex-column gap-4">
    <div class="wizard-progress">
      <div class="progress rounded-pill" role="progressbar" :aria-valuenow="progressPercentage" aria-valuemin="0" aria-valuemax="100">
        <div class="progress-bar progress-bar-striped progress-bar-animated" :style="{ width: `${progressPercentage}%` }">
          <span class="visually-hidden">{{ progressPercentage }}% Complete</span>
        </div>
      </div>
    </div>

    <div class="wizard-step-header d-grid gap-1">
      <div class="text-muted text-uppercase fw-semibold small">Step {{ currentStepIndex + 1 }} of {{ totalSteps }}</div>
      <div class="d-flex flex-column flex-md-row flex-md-wrap gap-1 gap-md-2 align-items-md-center">
        <h2 class="h5 fw-semibold mb-0">{{ currentStep?.title }}</h2>
        <p v-if="currentStep?.description" class="text-muted mb-0">{{ currentStep.description }}</p>
      </div>
    </div>

    <div class="wizard-content position-relative">
      <Transition name="wizard-fade" mode="out-in">
        <div :key="currentStep?.id ?? currentStepIndex" class="wizard-step-panel">
          <slot :step="currentStep" :index="currentStepIndex" :is-first="isFirstStep" :is-last="isLastStep" :go-next="next" :go-previous="previous" />
        </div>
      </Transition>
    </div>

    <div class="wizard-footer d-flex justify-content-between gap-3 flex-wrap">
      <slot name="footer" :is-first="isFirstStep" :is-last="isLastStep" :go-next="next" :go-previous="previous">
        <button type="button" class="btn btn-outline-secondary" :disabled="isFirstStep" @click="previous">
          Back
        </button>
        <button type="button" class="btn btn-primary ms-auto" @click="next">
          {{ isLastStep ? finishLabel : 'Next' }}
        </button>
      </slot>
    </div>
  </div>
</template>

<style scoped>
.form-wizard {
  scroll-margin-top: 6rem;
}

.wizard-progress .progress {
  height: 0.75rem;
  background: color-mix(in srgb, var(--color-primary-500) 15%, transparent);
  border-radius: var(--radius-pill, 999px);
}

.wizard-progress .progress-bar {
  transition: width 0.4s ease;
  background: linear-gradient(135deg, var(--color-primary-500), var(--color-primary-400));
}

.wizard-content {
  min-height: 300px;
}

.wizard-step-header {
  background: color-mix(in srgb, var(--surface-base) 92%, transparent);
  border-radius: 1rem;
  border: 1px solid color-mix(in srgb, var(--color-border) 65%, transparent);
  box-shadow: 0 18px 32px -22px rgba(15, 23, 42, 0.45);
  padding: 1.25rem 1.5rem;
}

.wizard-fade-enter-active,
.wizard-fade-leave-active {
  transition: opacity 0.25s ease, transform 0.25s ease;
}

.wizard-fade-enter-from,
.wizard-fade-leave-to {
  opacity: 0;
  transform: translateY(8px);
}

.wizard-step-panel {
  background: color-mix(in srgb, var(--surface-base) 96%, transparent);
  border-radius: 1rem;
  border: 1px solid color-mix(in srgb, var(--color-border) 55%, transparent);
  box-shadow: 0 22px 48px -20px rgba(15, 23, 42, 0.32);
  padding: 1.5rem;
}

@media (max-width: 576px) {
  .form-wizard {
    scroll-margin-top: 7.5rem;
  }

  .wizard-step-panel {
    padding: 1.25rem;
  }
}
</style>
