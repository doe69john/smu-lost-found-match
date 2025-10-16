<script setup>
import { computed, useSlots } from 'vue'

defineOptions({
  name: 'UiSelect'
})

let selectIdCounter = 0

const props = defineProps({
  modelValue: {
    type: [String, Number, Array],
    default: ''
  },
  id: {
    type: String,
    default: null
  },
  label: {
    type: String,
    default: ''
  },
  description: {
    type: String,
    default: ''
  },
  options: {
    type: Array,
    default: () => []
  },
  state: {
    type: String,
    default: 'default'
  },
  placeholder: {
    type: String,
    default: ''
  },
  multiple: {
    type: Boolean,
    default: false
  },
  required: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits(['update:modelValue', 'blur', 'focus'])

const slots = useSlots()

const generatedId = `ui-select-${++selectIdCounter}`

const selectId = computed(() => props.id || generatedId)

const stateClass = computed(() => {
  if (props.state === 'valid') return 'is-valid'
  if (props.state === 'invalid') return 'is-invalid'
  return null
})

const hasDescriptionSlot = computed(() => Boolean(slots.description))

const descriptionId = computed(() =>
  props.description || hasDescriptionSlot.value
    ? `${selectId.value}-description`
    : undefined
)

const feedbackId = computed(() => `${selectId.value}-feedback`)

const describedBy = computed(() => {
  const ids = []
  if (descriptionId.value) ids.push(descriptionId.value)
  if (props.state !== 'default') ids.push(feedbackId.value)
  return ids.join(' ') || undefined
})

const normalizedOptions = computed(() =>
  props.options.map((option) => {
    if (typeof option === 'object') {
      return {
        value: option.value,
        label: option.label ?? option.value,
        disabled: option.disabled ?? false
      }
    }

    return {
      value: option,
      label: option,
      disabled: false
    }
  })
)

const handleChange = (event) => {
  const { options } = event.target
  let value

  if (props.multiple) {
    value = Array.from(options)
      .filter((option) => option.selected)
      .map((option) => option.value)
  } else {
    value = event.target.value
  }

  emit('update:modelValue', value)
}

const handleBlur = (event) => emit('blur', event)
const handleFocus = (event) => emit('focus', event)

const shouldShowPlaceholder = computed(
  () => props.placeholder && !props.multiple && !slots.default
)
</script>

<template>
  <div class="form-field">
    <label v-if="label" class="form-label" :for="selectId">
      <slot name="label">{{ label }}</slot>
      <span v-if="required" class="required-indicator" aria-hidden="true">*</span>
    </label>

    <select
      :id="selectId"
      :class="['form-select', 'ui-input', 'transition-base', stateClass].filter(Boolean).join(' ')"
      :multiple="multiple"
      :required="required"
      :aria-describedby="describedBy"
      :aria-invalid="state === 'invalid' ? 'true' : undefined"
      :aria-required="required ? 'true' : undefined"
      :value="multiple ? undefined : modelValue"
      v-bind="$attrs"
      @change="handleChange"
      @blur="handleBlur"
      @focus="handleFocus"
    >
      <option
        v-if="shouldShowPlaceholder"
        value=""
        disabled
        hidden
        :selected="!multiple && (modelValue === '' || modelValue === null)"
      >
        {{ placeholder }}
      </option>
      <option
        v-for="option in normalizedOptions"
        :key="option.value"
        :value="option.value"
        :disabled="option.disabled"
        :selected="
          multiple && Array.isArray(modelValue)
            ? modelValue.includes(option.value)
            : undefined
        "
      >
        {{ option.label }}
      </option>
      <slot />
    </select>

    <div v-if="description" :id="descriptionId" class="form-text">
      {{ description }}
    </div>
    <div v-else-if="hasDescriptionSlot" :id="descriptionId" class="form-text">
      <slot name="description" />
    </div>

    <div v-if="state === 'invalid'" :id="feedbackId" class="invalid-feedback d-block">
      <slot name="error">Please choose an option.</slot>
    </div>
    <div v-else-if="state === 'valid'" :id="feedbackId" class="valid-feedback d-block">
      <slot name="success">Looks good!</slot>
    </div>
  </div>
</template>
