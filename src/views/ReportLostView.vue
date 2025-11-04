<script setup>
import { computed, onBeforeUnmount, ref } from 'vue'
import { useRouter } from 'vue-router'
import { Form as VForm, Field } from 'vee-validate'
import { toTypedSchema } from '@vee-validate/zod'
import { z } from 'zod'
import FormWizard from '@/components/common/FormWizard.vue'
import PulseLoader from '@/components/common/PulseLoader.vue'
import { useAuth } from '../composables/useAuth'
import { pushToast } from '../composables/useToast'
import { useLoadingDelay } from '@/composables/useLoadingDelay'
import { createLostItem } from '../services/lostItemsService'
import { uploadFilesSequentially } from '../services/storageService'

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
  'Other'
]

const today = new Date()
const initialValues = {
  title: '',
  category: '',
  brand: '',
  model: '',
  color: '',
  location_lost: '',
  description: '',
  unique_features: '',
  date_lost: today.toISOString().split('T')[0],
  time_lost: ''
}

const validationSchema = toTypedSchema(
  z.object({
    title: z.string().min(3, 'Give the item a short title'),
    category: z.string().min(1, 'Select a category'),
    brand: z.string().optional().nullable(),
    model: z.string().optional().nullable(),
    color: z.string().optional().nullable(),
    location_lost: z.string().min(3, 'Where did you lose the item?'),
    description: z.string().min(20, 'Please provide at least 20 characters.'),
    unique_features: z.string().optional().nullable(),
    date_lost: z.string().min(1, 'Date is required'),
    time_lost: z.string().optional().nullable()
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

async function validateFields(fieldNames) {
  if (!formRef.value) return true
  const results = await Promise.all(fieldNames.map((field) => formRef.value?.validateField(field)))
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

const validateBasicsStep = () => validateFields(['title', 'category', 'brand', 'model', 'color'])
const validateLocationStep = () => validateFields(['location_lost'])
const validateDetailsStep = () => validateFields(['description', 'unique_features'])
const validateScheduleStep = () => validateFields(['date_lost', 'time_lost'])

const wizardSteps = computed(() => [
  {
    id: 'images',
    title: 'Add photos',
    description: 'Upload up to 3 clear images',
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
    title: 'Where it was lost',
    description: 'Share the exact place',
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
    description: 'When it went missing',
    beforeNext: validateScheduleStep
  },
  {
    id: 'review',
    title: 'Review & submit',
    description: 'Confirm everything looks right'
  }
])

function stripLegacyImageUrlFields(target) {
  if (!target || typeof target !== 'object') return
  Object.keys(target).forEach((key) => {
    const normalizedKey = key.toLowerCase().replace(/[^a-z]/g, '')
    if (normalizedKey === 'imageurl') {
      delete target[key]
    }
  })
}

async function handleWizardComplete(submitHandler) {
  if (isSubmitting.value) return
  if (typeof submitHandler !== 'function') {
    if (import.meta.env.DEV) {
      console.warn('VForm submit helper was not provided to handleWizardComplete')
    }
    return
  }

  try {
    await submitHandler()
  } catch (error) {
    if (import.meta.env.DEV) {
      console.error('Submission handler rejected', error)
    }
    throw error
  }
}

async function onSubmit(values, { resetForm }) {
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
        return `${user.value.id}/lost/${timestamp}-${index + 1}-${baseName}.${extension}`
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
    const title = submissionValues.title

    delete submissionValues.title
    stripLegacyImageUrlFields(submissionValues)

    submissionValues.model = submissionValues.model || title
    submissionValues.user_id = user.value.id
    submissionValues.image_metadata = imageMetadata

    Object.keys(submissionValues).forEach((key) => {
      if (submissionValues[key] === '') {
        submissionValues[key] = null
      }
    })

    await createLostItem(submissionValues)

    pushToast({
      title: 'Report submitted',
      message: 'Thanks! Your lost item report has been saved.',
      variant: 'success'
    })

    resetForm({ values: { ...initialValues } })
    imageEntries.value.forEach((entry) => {
      if (entry.previewUrl) {
        URL.revokeObjectURL(entry.previewUrl)
      }
    })
    imageEntries.value = []

    router.push({ name: 'browse-lost' })
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
      <h1 class="h3 fw-semibold mb-0">Report a lost item</h1>
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
                  <p class="text-muted mb-0">
                    Use your camera or photo library to add up to {{ MAX_IMAGES }} clear images.
                  </p>
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
                <label class="form-label" for="lost-title">Item title *</label>
                <Field name="title" :keep-value="true" v-slot="{ field, errorMessage }">
                  <input
                    id="lost-title"
                    type="text"
                    class="form-control"
                    :class="{ 'is-invalid': errorMessage }"
                    placeholder="e.g. Silver laptop, Blue backpack"
                    v-bind="field"
                  />
                  <div v-if="errorMessage" class="invalid-feedback d-block">{{ errorMessage }}</div>
                </Field>
              </div>

              <div class="col-12 col-md-6">
                <label class="form-label" for="lost-category">Category *</label>
                <Field name="category" :keep-value="true" v-slot="{ field, errorMessage }">
                  <select
                    id="lost-category"
                    class="form-select"
                    :class="{ 'is-invalid': errorMessage }"
                    v-bind="field"
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
                <label class="form-label" for="lost-brand">Brand</label>
                <Field name="brand" :keep-value="true" v-slot="{ field, errorMessage }">
                  <input
                    id="lost-brand"
                    type="text"
                    class="form-control"
                    :class="{ 'is-invalid': errorMessage }"
                    placeholder="e.g. Apple, Samsonite"
                    v-bind="field"
                  />
                  <div v-if="errorMessage" class="invalid-feedback d-block">{{ errorMessage }}</div>
                </Field>
              </div>

              <div class="col-12 col-md-6">
                <label class="form-label" for="lost-model">Model or variant</label>
                <Field name="model" :keep-value="true" v-slot="{ field, errorMessage }">
                  <input
                    id="lost-model"
                    type="text"
                    class="form-control"
                    :class="{ 'is-invalid': errorMessage }"
                    placeholder="e.g. MacBook Pro 14, Longchamp Le Pliage"
                    v-bind="field"
                  />
                  <div v-if="errorMessage" class="invalid-feedback d-block">{{ errorMessage }}</div>
                </Field>
              </div>

              <div class="col-12 col-md-6">
                <label class="form-label" for="lost-color">Color</label>
                <Field name="color" :keep-value="true" v-slot="{ field, errorMessage }">
                  <input
                    id="lost-color"
                    type="text"
                    class="form-control"
                    :class="{ 'is-invalid': errorMessage }"
                    placeholder="e.g. Navy blue"
                    v-bind="field"
                  />
                  <div v-if="errorMessage" class="invalid-feedback d-block">{{ errorMessage }}</div>
                </Field>
              </div>
            </div>

            <div v-else-if="step?.id === 'location'" class="row g-3">
              <div class="col-12">
                <label class="form-label" for="lost-location">Where did you lose it? *</label>
                <Field name="location_lost" :keep-value="true" v-slot="{ field, errorMessage }">
                  <textarea
                    id="lost-location"
                    class="form-control"
                    rows="3"
                    :class="{ 'is-invalid': errorMessage }"
                    placeholder="e.g. Outside LKCSB atrium near the benches"
                    v-bind="field"
                  ></textarea>
                  <div v-if="errorMessage" class="invalid-feedback d-block">{{ errorMessage }}</div>
                </Field>
              </div>
            </div>

            <div v-else-if="step?.id === 'details'" class="row g-3">
              <div class="col-12">
                <label class="form-label" for="lost-description">Description *</label>
                <Field name="description" :keep-value="true" v-slot="{ field, errorMessage }">
                  <textarea
                    id="lost-description"
                    class="form-control"
                    rows="4"
                    :class="{ 'is-invalid': errorMessage }"
                    placeholder="Describe any markings, contents or other details that make it unique"
                    v-bind="field"
                  ></textarea>
                  <div v-if="errorMessage" class="invalid-feedback d-block">{{ errorMessage }}</div>
                </Field>
              </div>

              <div class="col-12">
                <label class="form-label" for="lost-unique">Unique identifiers</label>
                <Field name="unique_features" :keep-value="true" v-slot="{ field, errorMessage }">
                  <textarea
                    id="lost-unique"
                    class="form-control"
                    rows="3"
                    :class="{ 'is-invalid': errorMessage }"
                    placeholder="Serial numbers, stickers, charms or other distinguishing features"
                    v-bind="field"
                  ></textarea>
                  <div v-if="errorMessage" class="invalid-feedback d-block">{{ errorMessage }}</div>
                </Field>
              </div>
            </div>

            <div v-else-if="step?.id === 'timing'" class="row g-3">
              <div class="col-12 col-md-6">
                <label class="form-label" for="lost-date">Date lost *</label>
                <Field name="date_lost" :keep-value="true" v-slot="{ field, errorMessage }">
                  <input
                    id="lost-date"
                    type="date"
                    class="form-control"
                    :class="{ 'is-invalid': errorMessage }"
                    v-bind="field"
                  />
                  <div v-if="errorMessage" class="invalid-feedback d-block">{{ errorMessage }}</div>
                </Field>
              </div>

              <div class="col-12 col-md-6">
                <label class="form-label" for="lost-time">Time lost</label>
                <Field name="time_lost" :keep-value="true" v-slot="{ field, errorMessage }">
                  <input
                    id="lost-time"
                    type="time"
                    class="form-control"
                    :class="{ 'is-invalid': errorMessage }"
                    v-bind="field"
                  />
                  <div v-if="errorMessage" class="invalid-feedback d-block">{{ errorMessage }}</div>
                </Field>
              </div>
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
                        <dt class="col-sm-4">Model</dt>
                        <dd class="col-sm-8">{{ values.model || values.title || 'Not specified' }}</dd>
                        <dt class="col-sm-4">Color</dt>
                        <dd class="col-sm-8">{{ values.color || 'Not specified' }}</dd>
                        <dt class="col-sm-4">Location</dt>
                        <dd class="col-sm-8">{{ values.location_lost }}</dd>
                        <dt class="col-sm-4">Lost on</dt>
                        <dd class="col-sm-8">
                          {{ values.date_lost }}<span v-if="values.time_lost"> at {{ values.time_lost }}</span>
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
