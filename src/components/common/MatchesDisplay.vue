<script setup>
import { ref, computed, onMounted } from 'vue'
import { fetchMatchesForLostItem } from '@/services/matchesService'
import PulseLoader from './PulseLoader.vue'

const props = defineProps({
  lostItemId: {
    type: String,
    required: true
  },
  autoLoad: {
    type: Boolean,
    default: true
  }
})

const matches = ref([])
const isLoading = ref(false)
const errorMessage = ref('')

const hasMatches = computed(() => matches.value.length > 0)

const getConfidenceColor = (score) => {
  if (score >= 0.7) return 'success'
  if (score >= 0.4) return 'warning'
  return 'secondary'
}

const getConfidenceLabel = (score) => {
  if (score >= 0.7) return 'High confidence'
  if (score >= 0.4) return 'Medium confidence'
  return 'Low confidence'
}

const formatDate = (value) => {
  if (!value) return 'Date unknown'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Date unknown'
  return new Intl.DateTimeFormat('en-SG', { dateStyle: 'medium' }).format(date)
}

const formatPercentage = (score) => {
  return `${Math.round(score * 100)}%`
}

const getImageUrl = (foundItem) => {
  const metadata = foundItem?.image_metadata
  if (!metadata || !Array.isArray(metadata) || metadata.length === 0) {
    return null
  }

  const firstImage = metadata[0]
  if (!firstImage?.path) return null

  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || ''
  const bucketId = firstImage.bucket_id || 'item-images'

  return `${supabaseUrl}/storage/v1/object/public/${bucketId}/${firstImage.path}`
}

const loadMatches = async () => {
  if (!props.lostItemId) {
    errorMessage.value = 'Lost item ID is required'
    return
  }

  isLoading.value = true
  errorMessage.value = ''

  try {
    const data = await fetchMatchesForLostItem(props.lostItemId)
    console.log('Fetched matches data:', data)
    console.log('First match:', data[0])
    console.log('First match keys:', data[0] ? Object.keys(data[0]) : 'no data')
    console.log('Found items data:', data[0]?.found_items)
    console.log('Full first match object:', JSON.stringify(data[0], null, 2))
    matches.value = data
  } catch (error) {
    errorMessage.value = error.message || 'Failed to load matches'
    console.error('Error loading matches:', error)
  } finally {
    isLoading.value = false
  }
}

onMounted(() => {
  if (props.autoLoad) {
    loadMatches()
  }
})

defineExpose({
  loadMatches,
  matches
})
</script>

<template>
  <div class="matches-display">
    <div v-if="isLoading" class="text-center py-4">
      <PulseLoader />
      <p class="text-muted mt-2 mb-0">Loading matches...</p>
    </div>

    <div v-else-if="errorMessage" class="alert alert-danger" role="alert">
      {{ errorMessage }}
    </div>

    <div v-else-if="!hasMatches" class="text-center py-4">
      <div class="text-muted mb-2">
        <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" fill="currentColor" class="bi bi-search" viewBox="0 0 16 16">
          <path d="M11.742 10.344a6.5 6.5 0 1 0-1.397 1.398h-.001c.03.04.062.078.098.115l3.85 3.85a1 1 0 0 0 1.415-1.414l-3.85-3.85a1.007 1.007 0 0 0-.115-.1zM12 6.5a5.5 5.5 0 1 1-11 0 5.5 5.5 0 0 1 11 0z"/>
        </svg>
      </div>
      <p class="text-muted mb-0">No matches found yet</p>
      <p class="text-muted small">The AI didn't find any similar items in the found items database.</p>
    </div>

    <div v-else class="d-grid gap-3">
      <p class="text-muted small mb-0">
        Found {{ matches.length }} potential {{ matches.length === 1 ? 'match' : 'matches' }}
      </p>

      <div
        v-for="match in matches"
        :key="match.id"
        class="card border shadow-sm"
      >
        <div class="card-body">
          <div class="row g-3">
            <!-- Image Column -->
            <div class="col-12 col-md-3">
              <div class="ratio ratio-1x1 rounded overflow-hidden bg-light">
                <img
                  v-if="getImageUrl(match.found_items)"
                  :src="getImageUrl(match.found_items)"
                  :alt="match.found_items?.description || 'Found item'"
                  class="object-fit-cover"
                />
                <div v-else class="d-flex align-items-center justify-content-center text-muted">
                  <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" fill="currentColor" class="bi bi-image" viewBox="0 0 16 16">
                    <path d="M6.002 5.5a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0z"/>
                    <path d="M2.002 1a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V3a2 2 0 0 0-2-2h-12zm12 1a1 1 0 0 1 1 1v6.5l-3.777-1.947a.5.5 0 0 0-.577.093l-3.71 3.71-2.66-1.772a.5.5 0 0 0-.63.062L1.002 12V3a1 1 0 0 1 1-1h12z"/>
                  </svg>
                </div>
              </div>
            </div>

            <!-- Details Column -->
            <div class="col-12 col-md-9">
              <div class="d-flex flex-column gap-2 h-100">
                <!-- Header with confidence -->
                <div class="d-flex justify-content-between align-items-start">
                  <div>
                    <span class="badge text-bg-primary-subtle text-primary-emphasis">
                      {{ match.found_items?.category || 'Item' }}
                    </span>
                  </div>
                  <div class="text-end">
                    <div :class="`badge bg-${getConfidenceColor(match.confidence_score)}`">
                      {{ formatPercentage(match.confidence_score) }} Match
                    </div>
                    <div class="small text-muted mt-1">
                      {{ getConfidenceLabel(match.confidence_score) }}
                    </div>
                  </div>
                </div>

                <!-- Item details -->
                <div>
                  <h3 class="h6 mb-1">
                    {{ match.found_items?.brand || match.found_items?.model || 'Found item' }}
                  </h3>
                  <p class="text-muted mb-2">
                    {{ match.found_items?.description || 'No description provided.' }}
                  </p>
                </div>

                <!-- Metadata -->
                <div class="mt-auto">
                  <div class="row g-2 small">
                    <div v-if="match.found_items?.location_found" class="col-12 col-sm-6">
                      <strong class="text-muted">Location:</strong>
                      <span class="ms-1">{{ match.found_items.location_found }}</span>
                    </div>
                    <div v-if="match.found_items?.date_found" class="col-12 col-sm-6">
                      <strong class="text-muted">Date found:</strong>
                      <span class="ms-1">{{ formatDate(match.found_items.date_found) }}</span>
                    </div>
                    <div v-if="match.found_items?.color" class="col-12 col-sm-6">
                      <strong class="text-muted">Color:</strong>
                      <span class="ms-1">{{ match.found_items.color }}</span>
                    </div>
                    <div v-if="match.found_items?.status" class="col-12 col-sm-6">
                      <strong class="text-muted">Status:</strong>
                      <span class="ms-1 text-capitalize">{{ match.found_items.status.replace('_', ' ') }}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.ratio img {
  object-fit: cover;
}
</style>
