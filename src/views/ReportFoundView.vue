<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { Form as VForm, Field } from 'vee-validate'
import { toTypedSchema } from '@vee-validate/zod'
import { z } from 'zod'
import FormWizard from '@/components/common/FormWizard.vue'
import PulseLoader from '@/components/common/PulseLoader.vue'
import { useAuth } from '../composables/useAuth'
import { pushToast } from '../composables/useToast'
import { useLoadingDelay } from '@/composables/useLoadingDelay'
import { createFoundItem } from '../services/foundItemsService'
import { uploadFilesSequentially } from '../services/storageService'
import { fetchSecurityOffices, getCachedSecurityOffices } from '../services/securityOfficesService'

const MAX_IMAGES = 3

const categories = [
  'Electronics',
  'Clothing',
  'Accessories',
  'Books',
  'Keys',
  'Wallet',
  'Bag',
  'Documents',
  'Sports Equipment',
  'Other'
]

const now = new Date()
const initialValues = {
  title: '',
  category: '',
  brand: '',
  color: '',
  location_found: '',
  description: '',
  unique_features: '',
  date_found: now.toISOString().split('T')[0],
  time_found: now.toTimeString().slice(0, 5),
  drop_off_office_id: '',
  dropOffConfirmed: false
}

const validationSchema = toTypedSchema(
  z.object({
    title: z.string().min(3, 'Give the item a short title'),
    category: z.string().min(1, 'Select a category'),
    brand: z.string().optional().nullable(),
    color: z.string().optional().nullable(),
    location_found: z.string().min(3, 'Where did you find the item?'),
    description: z.string().min(20, 'Please provide at least 20 characters.'),
    unique_features: z.string().optional().nullable(),
    date_found: z.string().min(1, 'Date is required'),
    time_found: z.string().optional().nullable(),
    drop_off_office_id: z.union([z.string().uuid('Select a drop-off office'), z.literal('')]),
    dropOffConfirmed: z.boolean().refine((value) => value, 'Confirm you have dropped the item off with security.')
  })
)

const formRef = ref(null)
const wizardRef = ref(null)
const router = useRouter()
const { user } = useAuth()
const imageEntries = ref([])
const imageError = ref('')
const isSubmitting = ref(false)
const submissionError = ref('')
const securityOffices = ref(getCachedSecurityOffices())
const officesLoading = ref(false)
const officesError = ref('')

const { isVisible: showSubmitLoader } = useLoadingDelay(isSubmitting)

function toSafeSlug(value, fallback = 'item') {
  if (!value) return fallback
  return value
    .toString()
    .normalize('NFKD')
    .replace(/[\u0300-\u036F]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/-{2,}/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase() || fallback
}

const canAddMoreImages = computed(() => imageEntries.value.length < MAX_IMAGES)
const remainingImages = computed(() => Math.max(0, MAX_IMAGES - imageEntries.value.length))

function resetFileInput(event) {
  if (event?.target) {
    event.target.value = ''
  }
}

function handleFilesSelected(event) {
  const files = Array.from(event.target?.files || [])
  resetFileInput(event)

  if (!files.length) return

  if (!canAddMoreImages.value) {
    pushToast({
      title: 'Image limit reached',
      message: `You can upload up to ${MAX_IMAGES} images. Remove one to add another.`,
      variant: 'warning'
    })
    return
  }

  const availableSlots = remainingImages.value
  const selectedFiles = files.slice(0, availableSlots)

  selectedFiles.forEach((file) => {
    if (!file.type?.startsWith('image/')) {
      pushToast({
        title: 'Unsupported file',
        message: `${file.name} is not an image file.`,
        variant: 'danger'
      })
      return
    }

    const previewUrl = URL.createObjectURL(file)
    imageEntries.value.push({
      id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
      file,
      previewUrl,
      progress: 0
    })
  })

  if (files.length > selectedFiles.length) {
    pushToast({
      title: 'Images trimmed',
      message: `Only the first ${availableSlots} image(s) were added to stay within the ${MAX_IMAGES}-image limit.`,
      variant: 'info'
    })
  }
}

function removeImage(index) {
  const [removed] = imageEntries.value.splice(index, 1)
  if (removed?.previewUrl) {
    URL.revokeObjectURL(removed.previewUrl)
  }
}

onBeforeUnmount(() => {
  imageEntries.value.forEach((entry) => {
    if (entry.previewUrl) {
      URL.revokeObjectURL(entry.previewUrl)
    }
  })
})

async function fetchOffices() {
  officesLoading.value = true
  officesError.value = ''
  try {
    securityOffices.value = await fetchSecurityOffices()
  } catch (error) {
    officesError.value = error?.message || 'Unable to load security offices.'
  } finally {
    officesLoading.value = false
  }
}

onMounted(() => {
  if (!securityOffices.value?.length) {
    fetchOffices()
  }
})

function getOfficeLabel(id) {
  if (!id) return 'To be confirmed'
  const match = securityOffices.value.find((office) => office.id === id)
  if (!match) return 'To be confirmed'
  return match.location ? `${match.name} — ${match.location}` : match.name
}

async function validateFields(fieldNames) {
  if (!formRef.value) return true
  const results = await Promise.all(
    fieldNames.map((field) => formRef.value?.validateField(field))
  )
  return results.every((result) => result?.valid !== false)
}

async function validateImagesStep() {
  imageError.value = ''
  if (!imageEntries.value.length) {
    imageError.value = 'Add at least one photo of the item.'
    return false
  }
  return true
}

async function validateBasicsStep() {
  return validateFields(['title', 'category', 'brand', 'color'])
}

async function validateLocationStep() {
  return validateFields(['location_found'])
}

async function validateDetailsStep() {
  return validateFields(['description', 'unique_features'])
}

async function validateScheduleStep() {
  return validateFields(['date_found', 'time_found'])
}

async function validateSecurityStep() {
  const officesAvailable = securityOffices.value.length > 0
  let isValid = true

  if (officesAvailable) {
    const { valid } = (await formRef.value?.validateField('drop_off_office_id')) || { valid: true }
    isValid = isValid && valid
  } else {
    formRef.value?.setFieldValue('drop_off_office_id', '')
  }

  const confirmation = formRef.value?.values?.dropOffConfirmed
  if (!confirmation) {
    formRef.value?.setFieldError(
      'dropOffConfirmed',
      'Confirm you have reviewed the drop-off instructions.'
    )
    isValid = false
  } else {
    formRef.value?.setFieldError('dropOffConfirmed', undefined)
  }

  return isValid
}

const wizardSteps = computed(() => [
  {
    id: 'images',
    title: 'Capture photos',
    description: 'Add up to 3 images',
    beforeNext: validateImagesStep
  },
  {
    id: 'basics',
    title: 'Item basics',
    description: 'Title, category & brand',
    beforeNext: validateBasicsStep
  },
  {
    id: 'location',
    title: 'Where you found it',
    description: 'Share the exact location',
    beforeNext: validateLocationStep
  },
  {
    id: 'details',
    title: 'Describe the item',
    description: 'Share distinctive details',
    beforeNext: validateDetailsStep
  },
  {
    id: 'timing',
    title: 'Date & time',
    description: 'When it was found',
    beforeNext: validateScheduleStep
  },
  {
    id: 'security',
    title: 'Security handoff',
    description: 'Confirm drop-off details',
    beforeNext: validateSecurityStep
  },
  {
    id: 'review',
    title: 'Review & submit',
    description: 'Confirm everything looks right'
  }
])

async function handleWizardComplete(submitHandler) {
  if (import.meta.env.DEV) {
    console.debug('handleWizardComplete invoked', {
      isSubmitting: isSubmitting.value,
      hasSubmitHelper: typeof submitHandler === 'function'
    })
  }

  if (isSubmitting.value) return

  if (typeof submitHandler !== 'function') {
    if (import.meta.env.DEV) {
      console.warn('VForm submit helper was not provided to handleWizardComplete')
    }
    return
  }

  try {
    if (import.meta.env.DEV) {
      console.debug('Invoking VeeValidate handleSubmit helper from handleWizardComplete')
    }
    await submitHandler()
    if (import.meta.env.DEV) {
      console.debug('VeeValidate handleSubmit helper resolved without throwing')
    }
  } catch (error) {
    if (import.meta.env.DEV) {
      console.error('VeeValidate handleSubmit helper rejected', error)
    }
    throw error
  }
}

async function onSubmit(values, { resetForm }) {
  if (import.meta.env.DEV) {
    console.debug('onSubmit handler invoked with values', values)
  }
  if (!user.value?.id) {
    pushToast({
      title: 'Authentication required',
      message: 'Please sign in again before submitting a report.',
      variant: 'warning'
    })
    router.push({ name: 'auth', query: { redirect: router.currentRoute.value.fullPath } })
    return
  }

  submissionError.value = ''
  isSubmitting.value = true

  try {
    const files = imageEntries.value.map((entry) => entry.file)
    const timestamp = Date.now()

    imageEntries.value = imageEntries.value.map((entry) => ({ ...entry, progress: 0 }))

    const imageMetadata = await uploadFilesSequentially(files, {
      buildPath: (file, index) => {
        const extension = file.name?.split('.').pop()?.toLowerCase() || 'jpg'
        const baseName = toSafeSlug(file.name?.replace(/\.[^.]+$/, '') || `image-${index}`)
        return `${user.value.id}/found/${timestamp}-${index + 1}-${baseName}.${extension}`
      },
      onFileStart: ({ index }) => {
        if (imageEntries.value[index]) {
          imageEntries.value[index].progress = 5
        }
      },
      onFileProgress: ({ index, percentage }) => {
        if (imageEntries.value[index]) {
          imageEntries.value[index].progress = Math.min(percentage, 100)
        }
      },
      onFileComplete: ({ index }) => {
        if (imageEntries.value[index]) {
          imageEntries.value[index].progress = 100
        }
      }
    })

    const submissionValues = { ...values }
    const dropOffConfirmed = submissionValues.dropOffConfirmed
    const itemTitle = submissionValues.title

    delete submissionValues.dropOffConfirmed
    delete submissionValues.title

    submissionValues.model = itemTitle
    submissionValues.user_id = user.value.id
    submissionValues.status = dropOffConfirmed ? 'handed_to_security' : 'active'
    submissionValues.drop_off_office_id = submissionValues.drop_off_office_id || null
    submissionValues.drop_off_confirmed_at = dropOffConfirmed ? new Date().toISOString() : null
    submissionValues.image_metadata = imageMetadata

    Object.keys(submissionValues).forEach((key) => {
      if (submissionValues[key] === '') {
        submissionValues[key] = null
      }
    })

    if (import.meta.env.DEV) {
      console.debug('Submitting payload to createFoundItem', submissionValues)
    }

    await createFoundItem(submissionValues)

    if (import.meta.env.DEV) {
      console.debug('createFoundItem resolved successfully')
    }

    pushToast({
      title: 'Report submitted',
      message: dropOffConfirmed
        ? 'Thanks! Security has been notified of your drop-off.'
        : 'Thanks! Security will expect this item shortly.',
      variant: 'success'
    })

    resetForm({ values: { ...initialValues } })
    imageEntries.value.forEach((entry) => {
      if (entry.previewUrl) {
        URL.revokeObjectURL(entry.previewUrl)
      }
    })
    imageEntries.value = []

    router.push({ name: 'dashboard' })
  } catch (error) {
    submissionError.value = error?.message || 'Unable to submit the report. Please try again.'
    pushToast({
      title: 'Submission failed',
      message: submissionError.value,
      variant: 'danger'
    })
  } finally {
    isSubmitting.value = false
  }
}
</script>

<template>
  <section class="d-grid gap-4">
    <header>
      <h1 class="h3 fw-semibold mb-0">Report a found item</h1>
    </header>

    <VForm
      ref="formRef"
      :validation-schema="validationSchema"
      :initial-values="initialValues"
      @submit="onSubmit"
    >
      <template #default="{ values, handleSubmit }">
        <FormWizard
          ref="wizardRef"
          :steps="wizardSteps"
          finish-label="Submit report"
          @complete="() => handleWizardComplete(handleSubmit(onSubmit))"
        >
          <template #default="{ step }">
            <div v-if="step?.id === 'images'" class="d-grid gap-3">
              <div class="upload-helper text-center">
                <div class="d-grid gap-2">
                  <span class="fw-semibold">Upload photos</span>
                  <p class="text-muted mb-0">Use your camera or photo library to add up to {{ MAX_IMAGES }} clear images.</p>
                  <div class="d-flex justify-content-center">
                    <label class="btn btn-outline-primary d-inline-flex align-items-center gap-2 mb-0">
                      <i class="bi bi-camera"></i>
                      <span>{{ canAddMoreImages ? 'Add photos' : 'Limit reached' }}</span>
                      <input
                        type="file"
                        accept="image/*"
                        capture="environment"
                        multiple
                        class="d-none"
                        :disabled="!canAddMoreImages || isSubmitting"
                        @change="handleFilesSelected"
                      />
                    </label>
                  </div>
                  <small class="text-muted">{{ remainingImages }} picture(s) remaining</small>
                </div>
              </div>

              <p v-if="imageError" class="text-danger small mb-0">{{ imageError }}</p>

              <div v-if="imageEntries.length" class="d-grid gap-3">
                <article
                  v-for="(entry, index) in imageEntries"
                  :key="entry.id"
                  class="card border shadow-sm overflow-hidden"
                >
                  <div class="ratio ratio-4x3 upload-preview">
                    <img :src="entry.previewUrl" :alt="`Selected image ${index + 1}`" class="object-fit-cover" />
                  </div>
                  <div class="card-body d-grid gap-2">
                    <div class="d-flex align-items-center justify-content-between">
                      <span class="fw-semibold">Image {{ index + 1 }}</span>
                    </div>
                    <div
                      v-if="isSubmitting || (entry.progress > 0 && entry.progress < 100)"
                      class="progress"
                      role="progressbar"
                      aria-valuemin="0"
                      aria-valuemax="100"
                      :aria-valuenow="entry.progress"
                    >
                      <div
                        class="progress-bar"
                        :class="{ 'progress-bar-striped progress-bar-animated': isSubmitting && entry.progress < 100 }"
                        :style="{ width: `${entry.progress}%` }"
                      >
                        <span class="visually-hidden">{{ entry.progress }}% uploaded</span>
                      </div>
                    </div>
                    <div class="d-flex justify-content-between align-items-center">
                      <small class="text-muted text-truncate w-75" :title="entry.file?.name">{{ entry.file?.name }}</small>
                      <button
                        type="button"
                        class="btn btn-link text-danger p-0"
                        :disabled="isSubmitting"
                        @click="removeImage(index)"
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                </article>
              </div>
            </div>

            <div v-else-if="step?.id === 'basics'" class="row g-3">
              <div class="col-12">
                <label class="form-label" for="found-title">Item title *</label>
                <Field name="title" :keep-value="true" v-slot="{ field, errorMessage }">
                  <input
                    id="found-title"
                    type="text"
                    class="form-control"
                    :class="{ 'is-invalid': errorMessage }"
                    placeholder="e.g. Silver MacBook Pro"
                    v-bind="field"
                    :disabled="isSubmitting"
                  />
                  <div v-if="errorMessage" class="invalid-feedback d-block">{{ errorMessage }}</div>
                </Field>
              </div>

              <div class="col-12 col-md-6">
                <label class="form-label" for="found-category">Category *</label>
                <Field name="category" :keep-value="true" v-slot="{ field, errorMessage }">
                  <select
                    id="found-category"
                    class="form-select"
                    :class="{ 'is-invalid': errorMessage }"
                    v-bind="field"
                    :disabled="isSubmitting"
                  >
                    <option value="">Select category</option>
                    <option v-for="category in categories" :key="category" :value="category">
                      {{ category }}
                    </option>
                  </select>
                  <div v-if="errorMessage" class="invalid-feedback d-block">{{ errorMessage }}</div>
                </Field>
              </div>

              <div class="col-12 col-md-6">
                <label class="form-label" for="found-brand">Brand</label>
                <Field name="brand" :keep-value="true" v-slot="{ field, errorMessage }">
                  <input
                    id="found-brand"
                    type="text"
                    class="form-control"
                    :class="{ 'is-invalid': errorMessage }"
                    placeholder="e.g. Apple, Samsonite"
                    v-bind="field"
                    :disabled="isSubmitting"
                  />
                  <div v-if="errorMessage" class="invalid-feedback d-block">{{ errorMessage }}</div>
                </Field>
              </div>

              <div class="col-12 col-md-6">
                <label class="form-label" for="found-color">Color</label>
                <Field name="color" :keep-value="true" v-slot="{ field, errorMessage }">
                  <input
                    id="found-color"
                    type="text"
                    class="form-control"
                    :class="{ 'is-invalid': errorMessage }"
                    placeholder="e.g. Navy blue"
                    v-bind="field"
                    :disabled="isSubmitting"
                  />
                  <div v-if="errorMessage" class="invalid-feedback d-block">{{ errorMessage }}</div>
                </Field>
              </div>
            </div>

            <div v-else-if="step?.id === 'location'" class="d-grid gap-3">
              <Field name="location_found" :keep-value="true" v-slot="{ field, errorMessage }">
                <div>
                  <label class="form-label" for="found-location">Where did you find the item? *</label>
                  <textarea
                    id="found-location"
                    rows="3"
                    class="form-control"
                    :class="{ 'is-invalid': errorMessage }"
                    placeholder="Be as specific as possible (e.g. Building A, Level 2 seminar room)"
                    v-bind="field"
                    :disabled="isSubmitting"
                  ></textarea>
                  <div v-if="errorMessage" class="invalid-feedback d-block">{{ errorMessage }}</div>
                  <small class="text-muted">Please give the exact location, including the building and room.</small>
                </div>
              </Field>
            </div>

            <div v-else-if="step?.id === 'details'" class="d-grid gap-3">
              <Field name="description" :keep-value="true" v-slot="{ field, errorMessage }">
                <div>
                  <label class="form-label" for="found-description">Describe the item *</label>
                  <textarea
                    id="found-description"
                    rows="4"
                    class="form-control"
                    :class="{ 'is-invalid': errorMessage }"
                    placeholder="Include condition, notable markings, or accessories."
                    v-bind="field"
                    :disabled="isSubmitting"
                  ></textarea>
                  <div v-if="errorMessage" class="invalid-feedback d-block">{{ errorMessage }}</div>
                </div>
              </Field>

              <Field name="unique_features" :keep-value="true" v-slot="{ field, errorMessage }">
                <div>
                  <label class="form-label" for="found-features">Unique identifiers</label>
                  <textarea
                    id="found-features"
                    rows="3"
                    class="form-control"
                    :class="{ 'is-invalid': errorMessage }"
                    placeholder="Optional: serial numbers, engravings, etc."
                    v-bind="field"
                    :disabled="isSubmitting"
                  ></textarea>
                  <div v-if="errorMessage" class="invalid-feedback d-block">{{ errorMessage }}</div>
                </div>
              </Field>
            </div>

            <div v-else-if="step?.id === 'timing'" class="row g-3">
              <div class="col-12 col-md-6">
                <label class="form-label" for="found-date">Date found *</label>
              <Field name="date_found" :keep-value="true" v-slot="{ field, errorMessage }">
                  <input
                    id="found-date"
                    type="date"
                    class="form-control"
                    :class="{ 'is-invalid': errorMessage }"
                    v-bind="field"
                    :disabled="isSubmitting"
                  />
                  <div v-if="errorMessage" class="invalid-feedback d-block">{{ errorMessage }}</div>
                </Field>
              </div>

              <div class="col-12 col-md-6">
                <label class="form-label" for="found-time">Time found</label>
              <Field name="time_found" :keep-value="true" v-slot="{ field, errorMessage }">
                  <input
                    id="found-time"
                    type="time"
                    class="form-control"
                    :class="{ 'is-invalid': errorMessage }"
                    v-bind="field"
                    :disabled="isSubmitting"
                  />
                  <div v-if="errorMessage" class="invalid-feedback d-block">{{ errorMessage }}</div>
                </Field>
              </div>
            </div>

            <div v-else-if="step?.id === 'security'" class="d-grid gap-3">
              <div class="alert alert-info" role="status">
                Bring the item to a campus security office as soon as possible. Select where you dropped it off and confirm the handoff so our team can notify the right officers.
              </div>

              <div v-if="officesError" class="alert alert-warning" role="alert">
                {{ officesError }} We will save your report without a specific office if needed.
              </div>

              <div class="row g-3">
                <div class="col-12 col-md-8">
                  <label class="form-label" for="security-office">Security office</label>
              <Field name="drop_off_office_id" :keep-value="true" v-slot="{ field, errorMessage }">
                    <select
                      id="security-office"
                      class="form-select"
                      :class="{ 'is-invalid': errorMessage }"
                      v-bind="field"
                      :disabled="isSubmitting || officesLoading || !securityOffices.length"
                    >
                      <option value="">Select an office</option>
                      <option v-for="office in securityOffices" :key="office.id" :value="office.id">
                        {{ office.location ? `${office.name} — ${office.location}` : office.name }}
                      </option>
                    </select>
                    <div v-if="errorMessage" class="invalid-feedback d-block">{{ errorMessage }}</div>
                  </Field>
                  <small class="text-muted">Can't find the right office? Note it in the description above.</small>
                </div>

                <div class="col-12 col-md-4 d-flex align-items-end">
                  <div class="w-100 text-md-end text-muted" v-if="officesLoading">
                    <PulseLoader size="sm" />
                    <span class="ms-2">Loading offices…</span>
                  </div>
                </div>
              </div>

              <Field name="dropOffConfirmed" :keep-value="true" v-slot="{ value, handleChange, handleBlur, errorMessage }">
                <div>
                  <div class="form-check">
                    <input
                      id="drop-off-confirmed"
                      class="form-check-input"
                      type="checkbox"
                      :checked="value"
                      :disabled="isSubmitting"
                      @change="handleChange($event.target.checked)"
                      @blur="handleBlur"
                    />
                    <label class="form-check-label" for="drop-off-confirmed">
                      I confirm I have handed this item to campus security or will do so immediately.
                    </label>
                  </div>
                  <div v-if="errorMessage" class="invalid-feedback d-block">{{ errorMessage }}</div>
                </div>
              </Field>
            </div>

            <div v-else-if="step?.id === 'review'" class="d-grid gap-3">
              <div class="row g-3">
                <div class="col-12 col-lg-8">
                  <div class="card border-0 shadow-sm h-100">
                    <div class="card-body d-grid gap-2">
                      <h2 class="h5 fw-semibold mb-2">Report summary</h2>
                      <dl class="row mb-0">
                        <dt class="col-sm-4">Title</dt>
                        <dd class="col-sm-8">{{ values.title }}</dd>
                        <dt class="col-sm-4">Category</dt>
                        <dd class="col-sm-8">{{ values.category }}</dd>
                        <dt class="col-sm-4">Brand</dt>
                        <dd class="col-sm-8">{{ values.brand || 'Not specified' }}</dd>
                        <dt class="col-sm-4">Color</dt>
                        <dd class="col-sm-8">{{ values.color || 'Not specified' }}</dd>
                        <dt class="col-sm-4">Location</dt>
                        <dd class="col-sm-8">{{ values.location_found }}</dd>
                        <dt class="col-sm-4">Found on</dt>
                        <dd class="col-sm-8">
                          {{ values.date_found }}<span v-if="values.time_found"> at {{ values.time_found }}</span>
                        </dd>
                        <dt class="col-sm-4">Security office</dt>
                        <dd class="col-sm-8">{{ getOfficeLabel(values.drop_off_office_id) }}</dd>
                        <dt class="col-sm-4">Drop-off confirmed</dt>
                        <dd class="col-sm-8">
                          <span class="badge" :class="values.dropOffConfirmed ? 'text-bg-success' : 'text-bg-warning'">
                            {{ values.dropOffConfirmed ? 'Confirmed' : 'Pending' }}
                          </span>
                        </dd>
                      </dl>
                    </div>
                  </div>
                </div>

                <div class="col-12 col-lg-4">
                  <div class="card border-0 shadow-sm h-100">
                    <div class="card-body d-grid gap-3">
                      <h2 class="h6 fw-semibold mb-0">Photos</h2>
                      <p v-if="!imageEntries.length" class="text-muted mb-0">No images attached.</p>
                      <div v-else class="d-grid gap-2">
                        <div v-for="(entry, index) in imageEntries" :key="entry.id" class="ratio ratio-4x3 rounded overflow-hidden border">
                          <img :src="entry.previewUrl" :alt="`Image ${index + 1}`" class="object-fit-cover" />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div class="card border-0 shadow-sm">
                <div class="card-body">
                  <h2 class="h6 fw-semibold">Description</h2>
                  <p class="mb-2">{{ values.description }}</p>
                  <h3 class="h6 fw-semibold">Unique identifiers</h3>
                  <p class="mb-0">{{ values.unique_features || 'None provided.' }}</p>
                </div>
              </div>

              <p v-if="submissionError" class="text-danger mb-0">{{ submissionError }}</p>
            </div>
          </template>

          <template #footer="{ isFirst, isLast, goNext, goPrevious }">
            <div class="d-flex w-100 gap-3">
              <button
                type="button"
                class="btn btn-outline-secondary"
                :disabled="isFirst || isSubmitting"
                @click="goPrevious"
              >
                Back
              </button>
              <div class="ms-auto">
                <button
                  v-if="!isLast"
                  type="button"
                  class="btn btn-primary"
                  :disabled="isSubmitting"
                  @click="goNext"
                >
                  Next step
                </button>
                <button
                  v-else
                  type="button"
                  class="btn btn-primary d-inline-flex align-items-center gap-2"
                  :disabled="isSubmitting"
                  @click="() => handleWizardComplete(handleSubmit(onSubmit))"
                >
                  <PulseLoader v-if="showSubmitLoader" size="sm" />
                  <span>{{ isSubmitting ? 'Submitting…' : 'Submit report' }}</span>
                </button>
              </div>
            </div>
          </template>
        </FormWizard>
      </template>
    </VForm>
  </section>
</template>

<style scoped>
.upload-helper {
  padding: clamp(1.75rem, 2vw + 1.25rem, 3rem);
  border-radius: var(--radius-xl);
  border: 1.6px dashed color-mix(in srgb, var(--color-border) 85%, transparent);
  background: color-mix(in srgb, var(--surface-base) 94%, transparent);
  box-shadow: 0 22px 36px -26px rgba(15, 23, 42, 0.45);
  display: grid;
  gap: var(--space-md);
  justify-items: center;
  transition: background var(--transition-medium) var(--transition-timing),
    border-color var(--transition-medium) var(--transition-timing),
    box-shadow var(--transition-medium) var(--transition-timing);
}

.upload-helper .btn {
  white-space: nowrap;
}

.upload-helper small,
.upload-helper .text-muted {
  color: var(--text-muted) !important;
}

.upload-preview {
  background: color-mix(in srgb, var(--surface-muted) 80%, transparent);
  border-radius: var(--radius-lg);
}

.upload-preview img {
  border-radius: inherit;
}

@media (prefers-reduced-motion: reduce) {
  .upload-helper {
    transition: none;
  }
}
</style>
