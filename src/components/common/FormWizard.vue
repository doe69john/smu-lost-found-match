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

    <ol class="wizard-steps list-unstyled d-flex flex-wrap gap-3 gap-md-4 align-items-center mb-0">
      <li
        v-for="(step, index) in steps"
        :key="step.id ?? index"
        class="wizard-step-item"
      >
        <button
          type="button"
          class="btn btn-link p-0 text-decoration-none d-flex align-items-center gap-2"
          :class="{
            active: index === currentStepIndex,
            completed: index < currentStepIndex
          }"
          :disabled="index > furthestVisited"
          @click="goToStep(index)"
        >
          <span class="step-index rounded-circle fw-semibold">{{ index + 1 }}</span>
          <span class="d-flex flex-column text-start">
            <span class="step-title fw-semibold">{{ step.title }}</span>
            <small v-if="step.description" class="text-muted">{{ step.description }}</small>
          </span>
        </button>
      </li>
    </ol>

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
.wizard-progress .progress {
  height: 0.75rem;
  background-color: rgba(13, 110, 253, 0.1);
}

.wizard-progress .progress-bar {
  transition: width 0.4s ease;
}

.wizard-step-item .btn {
  color: inherit;
  transition: color 0.3s ease;
}

.wizard-step-item .btn:disabled {
  color: #adb5bd;
}

.step-index {
  width: 2.25rem;
  height: 2.25rem;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: 2px solid var(--bs-primary);
  color: var(--bs-primary);
  background: rgba(13, 110, 253, 0.08);
  transition: all 0.3s ease;
}

.wizard-step-item .btn.completed .step-index {
  background: var(--bs-primary);
  color: #fff;
}

.wizard-step-item .btn.active .step-index {
  transform: scale(1.05);
  box-shadow: 0 0 0 4px rgba(13, 110, 253, 0.15);
}

.step-title {
  font-size: 0.95rem;
}

.wizard-content {
  min-height: 300px;
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
  background: #fff;
  border-radius: 1rem;
  box-shadow: 0 12px 40px -16px rgba(15, 34, 58, 0.25);
  padding: 1.5rem;
}

@media (max-width: 576px) {
  .wizard-step-panel {
    padding: 1.25rem;
  }

  .wizard-step-item {
    flex: 1 1 100%;
  }

  .wizard-step-item .btn {
    width: 100%;
    justify-content: flex-start;
  }
}
</style>
