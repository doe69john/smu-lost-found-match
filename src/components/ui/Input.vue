<script setup>
import { computed, useAttrs, useSlots } from 'vue'

defineOptions({
  name: 'UiInput'
})

let inputIdCounter = 0

const props = defineProps({
  modelValue: {
    type: [String, Number],
    default: ''
  },
  id: {
    type: String,
    default: null
  },
  type: {
    type: String,
    default: 'text'
  },
  label: {
    type: String,
    default: ''
  },
  description: {
    type: String,
    default: ''
  },
  state: {
    type: String,
    default: 'default'
  },
  required: {
    type: Boolean,
    default: false
  },
  floatingLabel: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits(['update:modelValue', 'blur', 'focus'])

const slots = useSlots()
const attrs = useAttrs()

const generatedId = `ui-input-${++inputIdCounter}`

const inputId = computed(() => props.id || generatedId)

const stateClass = computed(() => {
  if (props.state === 'valid') return 'is-valid'
  if (props.state === 'invalid') return 'is-invalid'
  return null
})

const hasDescriptionSlot = computed(() => Boolean(slots.description))

const descriptionId = computed(() =>
  props.description || hasDescriptionSlot.value
    ? `${inputId.value}-description`
    : undefined
)

const feedbackId = computed(() => `${inputId.value}-feedback`)

const floatingPlaceholder = computed(
  () => props.label || attrs.placeholder || ' '
)

const describedBy = computed(() => {
  const ids = []
  if (descriptionId.value) ids.push(descriptionId.value)
  if (props.state !== 'default') ids.push(feedbackId.value)
  return ids.join(' ') || undefined
})

const handleInput = (event) => {
  emit('update:modelValue', event.target.value)
}

const handleBlur = (event) => {
  emit('blur', event)
}

const handleFocus = (event) => {
  emit('focus', event)
}
</script>

<template>
  <div :class="floatingLabel ? 'form-floating' : 'd-grid gap-1'">
    <template v-if="floatingLabel">
      <input
        :id="inputId"
        :value="modelValue"
        :type="type"
        :class="['form-control', stateClass].filter(Boolean).join(' ')"
        :placeholder="floatingPlaceholder"
        :required="required"
        :aria-describedby="describedBy"
        :aria-invalid="state === 'invalid' ? 'true' : undefined"
        :aria-required="required ? 'true' : undefined"
        v-bind="$attrs"
        @input="handleInput"
        @blur="handleBlur"
        @focus="handleFocus"
      />
      <label v-if="label" :for="inputId">
        <slot name="label">{{ label }}</slot>
      </label>
    </template>
    <template v-else>
      <label v-if="label" class="form-label" :for="inputId">
        <slot name="label">{{ label }}</slot>
        <span v-if="required" class="required-indicator" aria-hidden="true">*</span>
      </label>
      <input
        :id="inputId"
        :value="modelValue"
        :type="type"
        :class="['form-control', stateClass].filter(Boolean).join(' ')"
        :required="required"
        :aria-describedby="describedBy"
        :aria-invalid="state === 'invalid' ? 'true' : undefined"
        :aria-required="required ? 'true' : undefined"
        v-bind="$attrs"
        @input="handleInput"
        @blur="handleBlur"
        @focus="handleFocus"
      />
    </template>

    <div v-if="description" :id="descriptionId" class="form-text">
      {{ description }}
    </div>

    <div v-else-if="hasDescriptionSlot" :id="descriptionId" class="form-text">
      <slot name="description" />
    </div>

    <div v-if="state === 'invalid'" :id="feedbackId" class="invalid-feedback d-block">
      <slot name="error">Please correct this field.</slot>
    </div>
    <div v-else-if="state === 'valid'" :id="feedbackId" class="valid-feedback d-block">
      <slot name="success">Looks good!</slot>
    </div>
  </div>
</template>
