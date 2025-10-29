<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { Form as VForm, Field } from 'vee-validate'
import { toTypedSchema } from '@vee-validate/zod'
import { z } from 'zod'
import PulseLoader from '@/components/common/PulseLoader.vue'
import { useAuth } from '../composables/useAuth'
import { pushToast } from '../composables/useToast'
import { useLoadingDelay } from '@/composables/useLoadingDelay'
import { createLostItem } from '../services/lostItemsService'
import { createSignedUploadUrl } from '../services/storageService'

const categories = [
  'Electronics',
  'Clothing',
  'Accessories',
  'Books',
  'Keys',
  'Wallet',
  'Bag',
  'Other'
]

const validationSchema = toTypedSchema(
  z.object({
    category: z.string().min(1, 'Select a category'),
    brand: z.string().optional(),
    model: z.string().optional(),
    color: z.string().optional(),
    description: z.string().min(10, 'Description must be at least 10 characters'),
    location_lost: z.string().min(3, 'Location is required'),
    date_lost: z.string().min(1, 'Date is required'),
    time_lost: z.string().optional(),
    unique_features: z.string().optional()
  })
)

const initialValues = {
  category: '',
  brand: '',
  model: '',
  color: '',
  description: '',
  location_lost: '',
  date_lost: '',
  time_lost: '',
  unique_features: ''
}

const isSubmitting = ref(false)
const { isVisible: showSubmitLoader } = useLoadingDelay(isSubmitting)
const uploadProgress = ref(0)
const uploadError = ref('')
const selectedFile = ref(null)
const fileName = ref('')

const router = useRouter()
const { user } = useAuth()

const onFileChange = (event) => {
  const [file] = event.target.files || []
  selectedFile.value = file || null
  fileName.value = file ? file.name : ''
  uploadProgress.value = 0
  uploadError.value = ''
}

const uploadFileWithProgress = (signedUrl, file) =>
  new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) {
        uploadProgress.value = Math.round((event.loaded / event.total) * 100)
      }
    }
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        uploadProgress.value = 100
        resolve()
      } else {
        reject(new Error(xhr.responseText || 'Upload failed.'))
      }
    }
    xhr.onerror = () => reject(new Error('Upload failed. Please try again.'))
    xhr.open('PUT', signedUrl, true)
    xhr.setRequestHeader('Content-Type', file.type || 'application/octet-stream')
    xhr.send(file)
  })

const normalizeValues = (values) => {
  const normalized = { ...values }
  Object.keys(normalized).forEach((key) => {
    if (normalized[key] === '') {
      normalized[key] = null
    }
  })
  return normalized
}

const onSubmit = async (values, { resetForm }) => {
  if (!user.value?.id) {
    pushToast({
      title: 'Authentication required',
      message: 'Please sign in again before submitting a report.',
      variant: 'warning'
    })
    router.push({ name: 'auth', query: { redirect: router.currentRoute.value.fullPath } })
    return
  }

  isSubmitting.value = true
  uploadProgress.value = 0
  uploadError.value = ''

  try {
    let imagePath = null
    if (selectedFile.value) {
      const extension = selectedFile.value.name.split('.').pop() || 'jpg'
      const storagePath = `${user.value.id}/lost/${Date.now()}.${extension}`
      const { signedUrl, path } = await createSignedUploadUrl({ path: storagePath, upsert: true })
      await uploadFileWithProgress(signedUrl, selectedFile.value)
      imagePath = path
    }

    const payload = normalizeValues(values)
    payload.user_id = user.value.id
    if (imagePath) {
      payload.image_path = imagePath
      payload.image_filename = selectedFile.value?.name || null
    }

    await createLostItem(payload)

    pushToast({
      title: 'Report submitted',
      message: 'Thank you. Your lost item report has been saved.',
      variant: 'success'
    })

    resetForm({ values: { ...initialValues } })
    selectedFile.value = null
    fileName.value = ''
    uploadProgress.value = 0

    router.push({ name: 'browse-lost' })
  } catch (error) {
    uploadError.value = error?.message || 'Unable to submit the report. Please try again.'
    pushToast({
      title: 'Submission failed',
      message: uploadError.value,
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
      <h1 class="h3 fw-semibold mb-1">Report a lost item</h1>
      <p class="text-muted mb-0">Provide as much detail as possible to help us locate your belongings.</p>
    </header>

    <VForm :validation-schema="validationSchema" :initial-values="initialValues" @submit="onSubmit">
      <template #default>
        <div class="row g-3">
          <div class="col-12 col-md-6">
            <label class="form-label" for="lost-category">Category *</label>
            <Field name="category" v-slot="{ field, errorMessage }">
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
            <Field name="brand" v-slot="{ field, errorMessage }">
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
            <label class="form-label" for="lost-model">Model</label>
            <Field name="model" v-slot="{ field, errorMessage }">
              <input
                id="lost-model"
                type="text"
                class="form-control"
                :class="{ 'is-invalid': errorMessage }"
                placeholder="e.g. iPhone 15, AirPods"
                v-bind="field"
              />
              <div v-if="errorMessage" class="invalid-feedback d-block">{{ errorMessage }}</div>
            </Field>
          </div>

          <div class="col-12 col-md-6">
            <label class="form-label" for="lost-color">Colour</label>
            <Field name="color" v-slot="{ field, errorMessage }">
              <input
                id="lost-color"
                type="text"
                class="form-control"
                :class="{ 'is-invalid': errorMessage }"
                placeholder="e.g. Black, Blue"
                v-bind="field"
              />
              <div v-if="errorMessage" class="invalid-feedback d-block">{{ errorMessage }}</div>
            </Field>
          </div>

          <div class="col-12">
            <label class="form-label" for="lost-description">Description *</label>
            <Field name="description" v-slot="{ field, errorMessage }">
              <textarea
                id="lost-description"
                rows="4"
                class="form-control"
                :class="{ 'is-invalid': errorMessage }"
                placeholder="Share details that can help someone recognise your item."
                v-bind="field"
              ></textarea>
              <div v-if="errorMessage" class="invalid-feedback d-block">{{ errorMessage }}</div>
            </Field>
          </div>

          <div class="col-12 col-md-6">
            <label class="form-label" for="lost-location">Where was it lost? *</label>
            <Field name="location_lost" v-slot="{ field, errorMessage }">
              <input
                id="lost-location"
                type="text"
                class="form-control"
                :class="{ 'is-invalid': errorMessage }"
                placeholder="e.g. Li Ka Shing Library Level 3"
                v-bind="field"
              />
              <div v-if="errorMessage" class="invalid-feedback d-block">{{ errorMessage }}</div>
            </Field>
          </div>

          <div class="col-12 col-md-3">
            <label class="form-label" for="lost-date">Date lost *</label>
            <Field name="date_lost" v-slot="{ field, errorMessage }">
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

          <div class="col-12 col-md-3">
            <label class="form-label" for="lost-time">Approximate time</label>
            <Field name="time_lost" v-slot="{ field, errorMessage }">
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

          <div class="col-12">
            <label class="form-label" for="lost-unique">Unique features</label>
            <Field name="unique_features" v-slot="{ field, errorMessage }">
              <textarea
                id="lost-unique"
                rows="3"
                class="form-control"
                :class="{ 'is-invalid': errorMessage }"
                placeholder="Stickers, engravings or other identifying marks"
                v-bind="field"
              ></textarea>
              <div v-if="errorMessage" class="invalid-feedback d-block">{{ errorMessage }}</div>
            </Field>
          </div>

          <div class="col-12">
            <label class="form-label" for="lost-photo">Upload a photo (optional)</label>
            <div class="file-input">
              <input
                id="lost-photo"
                type="file"
                accept="image/*"
                class="file-input__native"
                :disabled="isSubmitting"
                @change="onFileChange"
              />
              <label
                class="file-input__trigger"
                :class="{ 'is-disabled': isSubmitting }"
                for="lost-photo"
                :aria-disabled="isSubmitting ? 'true' : 'false'"
              >
                <i class="bi bi-upload" aria-hidden="true"></i>
                <span>{{ fileName ? 'Change photo' : 'Choose file' }}</span>
              </label>
              <span class="file-input__name" :class="{ 'is-empty': !fileName }">
                {{ fileName || 'No file selected yet' }}
              </span>
            </div>
            <small class="text-muted d-block mt-2">Clear photos speed up the matching process.</small>
            <div v-if="selectedFile && uploadProgress > 0" class="progress mt-2" style="height: 8px;">
              <div
                class="progress-bar"
                role="progressbar"
                :style="{ width: `${uploadProgress}%` }"
                :aria-valuenow="uploadProgress"
                aria-valuemin="0"
                aria-valuemax="100"
              ></div>
            </div>
            <div v-if="uploadError" class="text-danger small mt-2">{{ uploadError }}</div>
          </div>
        </div>

        <div class="d-flex justify-content-end mt-4">
          <button type="submit" class="btn btn-primary" :disabled="isSubmitting">
            <PulseLoader
              v-if="showSubmitLoader"
              size="sm"
              contrast="inverted"
              class="me-2"
              aria-hidden="true"
            />
            {{ isSubmitting ? 'Submitting report...' : 'Submit report' }}
          </button>
        </div>
      </template>
    </VForm>
  </section>
</template>
