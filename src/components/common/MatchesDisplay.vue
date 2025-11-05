<script setup>
import { ref, computed, onMounted } from 'vue'
import { fetchMatchesForLostItem, updateMatchStatus } from '@/services/matchesService'
import { pushToast } from '@/composables/useToast'
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

const emit = defineEmits(['matchClaimed'])

const matches = ref([])
const isLoading = ref(false)
const errorMessage = ref('')
const claimingMatchId = ref(null)
const verifiedMatches = ref(new Set())
const verificationData = ref({})

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

const getImageUrl = (match) => {
  const foundItem = match?.found_items || match?.found_item_id
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

const getFoundItem = (match) => {
  return match?.found_items || match?.found_item_id
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

const claimMatch = async (match) => {
  if (!match?.id) return

  // Confirm with user
  if (!confirm('Are you sure this is your item? Claiming will mark this match as confirmed and you\'ll receive instructions to collect it.')) {
    return
  }

  claimingMatchId.value = match.id

  try {
    await updateMatchStatus(match.id, 'confirmed')

    // Update the local match status
    const matchIndex = matches.value.findIndex(m => m.id === match.id)
    if (matchIndex !== -1) {
      matches.value[matchIndex].status = 'confirmed'
    }

    // Emit event to parent to refresh dashboard
    emit('matchClaimed', props.lostItemId)

    pushToast({
      type: 'success',
      message: 'Match confirmed! Check the security office details below to collect your item.'
    })
  } catch (error) {
    console.error('Error claiming match:', error)
    pushToast({
      type: 'error',
      message: error.message || 'Failed to claim match. Please try again.'
    })
  } finally {
    claimingMatchId.value = null
  }
}

const getSecurityOffice = (match) => {
  const foundItem = getFoundItem(match)
  return foundItem?.security_offices || null
}

// Calculate word overlap between two strings
const calculateWordOverlap = (str1, str2) => {
  if (!str1 || !str2) return 0

  const words1 = str1.toLowerCase().trim().split(/\s+/).filter(w => w.length > 2)
  const words2 = str2.toLowerCase().trim().split(/\s+/).filter(w => w.length > 2)

  if (words1.length === 0 || words2.length === 0) return 0

  const commonWords = words1.filter(w => words2.includes(w))
  const overlap = commonWords.length / Math.max(words1.length, words2.length)

  return overlap
}

// Initialize verification data for a match
const initVerificationData = (matchId) => {
  if (!verificationData.value[matchId]) {
    verificationData.value[matchId] = { location: '', uniqueIdentifier: '' }
  }
  return verificationData.value[matchId]
}

// Verify user's answers and calculate adjusted confidence
const verifyMatch = (match) => {
  const matchId = match.id
  const foundItem = getFoundItem(match)

  if (!verificationData.value[matchId]) {
    verificationData.value[matchId] = { location: '', uniqueIdentifier: '' }
  }

  const userLocation = verificationData.value[matchId].location || ''
  const userIdentifier = verificationData.value[matchId].uniqueIdentifier || ''

  // Calculate location overlap with found item's location
  const locationMatch = calculateWordOverlap(userLocation, foundItem?.location_found || '')

  // Calculate identifier overlap with description
  const identifierMatch = calculateWordOverlap(userIdentifier, foundItem?.description || '')

  // Adjust confidence score based on verification
  // Base score + bonus from verification (max +20%)
  const baseScore = match.confidence_score
  const verificationBonus = (locationMatch * 0.1) + (identifierMatch * 0.1)
  const adjustedScore = Math.min(1.0, baseScore + verificationBonus)

  // Mark as verified
  verifiedMatches.value.add(matchId)

  // Update the match confidence score locally
  const matchIndex = matches.value.findIndex(m => m.id === matchId)
  if (matchIndex !== -1) {
    matches.value[matchIndex].confidence_score = adjustedScore
  }

  // Show feedback
  if (locationMatch > 0.5 || identifierMatch > 0.5) {
    pushToast({
      type: 'success',
      message: 'Your answers match! This appears to be your item.'
    })
  } else if (locationMatch > 0.2 || identifierMatch > 0.2) {
    pushToast({
      type: 'info',
      message: 'Some details match. Please review carefully before claiming.'
    })
  } else {
    pushToast({
      type: 'warning',
      message: 'Your answers don\'t match well. This might not be your item.'
    })
  }
}

const isVerified = (matchId) => {
  return verifiedMatches.value.has(matchId)
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
                  v-if="getImageUrl(match)"
                  :src="getImageUrl(match)"
                  :alt="getFoundItem(match)?.description || 'Found item'"
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
                      {{ getFoundItem(match)?.category || 'Item' }}
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

                <!-- Verification Form (shown if not verified) -->
                <div v-if="!isVerified(match.id) && match.status === 'pending'" class="mt-2">
                  <div class="alert alert-info mb-3" role="alert">
                    <strong>Verify this is your item:</strong>
                    <p class="mb-0 small mt-1">Answer these questions to see full details and claim this item.</p>
                  </div>

                  <div class="mb-3">
                    <label class="form-label small fw-semibold">1. Where did you lose it?</label>
                    <input
                      type="text"
                      class="form-control form-control-sm"
                      v-model="initVerificationData(match.id).location"
                      placeholder="e.g., School of Economics SR 3-2"
                    />
                  </div>

                  <div class="mb-3">
                    <label class="form-label small fw-semibold">2. Any unique identifiers? (scratches, stickers, serial numbers, etc.)</label>
                    <textarea
                      class="form-control form-control-sm"
                      rows="2"
                      v-model="initVerificationData(match.id).uniqueIdentifier"
                      placeholder="e.g., Visible scratches at the side, blue sticker on back"
                    ></textarea>
                  </div>

                  <button
                    type="button"
                    class="btn btn-primary btn-sm"
                    @click="verifyMatch(match)"
                    :disabled="!verificationData[match.id]?.location || !verificationData[match.id]?.uniqueIdentifier"
                  >
                    Verify & View Details
                  </button>
                </div>

                <!-- Verification Success Indicator (shown after verification) -->
                <div v-if="isVerified(match.id) && match.status === 'pending'" class="alert alert-success mb-3" role="alert">
                  <div class="d-flex align-items-center">
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="currentColor" class="bi bi-check-circle-fill me-2" viewBox="0 0 16 16">
                      <path d="M16 8A8 8 0 1 1 0 8a8 8 0 0 1 16 0zm-3.97-3.03a.75.75 0 0 0-1.08.022L7.477 9.417 5.384 7.323a.75.75 0 0 0-1.06 1.06L6.97 11.03a.75.75 0 0 0 1.079-.02l3.992-4.99a.75.75 0 0 0-.01-1.05z"/>
                    </svg>
                    <strong class="mb-0">Verification successful</strong>
                  </div>
                </div>

                <!-- Item details (shown after verification or if already confirmed) -->
                <div v-if="isVerified(match.id) || match.status === 'confirmed'">
                  <h3 class="h6 mb-1">
                    {{ getFoundItem(match)?.model || getFoundItem(match)?.brand || 'Found item' }}
                  </h3>
                  <p class="text-muted mb-2">
                    {{ getFoundItem(match)?.description || 'No description provided.' }}
                  </p>

                  <!-- Metadata -->
                  <div class="mt-2">
                    <div class="row g-2 small">
                      <div v-if="getFoundItem(match)?.location_found" class="col-12 col-sm-6">
                        <strong class="text-muted">Location:</strong>
                        <span class="ms-1">{{ getFoundItem(match).location_found }}</span>
                      </div>
                      <div v-if="getFoundItem(match)?.date_found" class="col-12 col-sm-6">
                        <strong class="text-muted">Date found:</strong>
                        <span class="ms-1">{{ formatDate(getFoundItem(match).date_found) }}</span>
                      </div>
                      <div v-if="getFoundItem(match)?.color" class="col-12 col-sm-6">
                        <strong class="text-muted">Color:</strong>
                        <span class="ms-1">{{ getFoundItem(match).color }}</span>
                      </div>
                      <div v-if="getFoundItem(match)?.status" class="col-12 col-sm-6">
                        <strong class="text-muted">Status:</strong>
                        <span class="ms-1 text-capitalize">{{ getFoundItem(match).status.replace('_', ' ') }}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- Claim Button (shown only after verification) -->
          <div v-if="match.status === 'pending' && isVerified(match.id)" class="mt-3 pt-3 border-top">
            <div class="d-flex gap-2 align-items-center justify-content-between">
              <p class="text-muted small mb-0">
                Is this your item?
              </p>
              <button
                type="button"
                class="btn btn-success btn-sm"
                :disabled="claimingMatchId === match.id"
                @click="claimMatch(match)"
              >
                <span v-if="claimingMatchId === match.id" class="spinner-border spinner-border-sm me-1" role="status" aria-hidden="true"></span>
                {{ claimingMatchId === match.id ? 'Claiming...' : 'Claim This Item' }}
              </button>
            </div>
          </div>

          <!-- Claimed Status (shown when confirmed) -->
          <div v-else-if="match.status === 'confirmed'" class="mt-3 pt-3 border-top">
            <!-- Claimed Badge -->
            <div class="mb-3">
              <span class="badge bg-success fs-6 px-3 py-2">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-check-circle-fill me-2" viewBox="0 0 16 16">
                  <path d="M16 8A8 8 0 1 1 0 8a8 8 0 0 1 16 0zm-3.97-3.03a.75.75 0 0 0-1.08.022L7.477 9.417 5.384 7.323a.75.75 0 0 0-1.06 1.06L6.97 11.03a.75.75 0 0 0 1.079-.02l3.992-4.99a.75.75 0 0 0-.01-1.05z"/>
                </svg>
                Claimed
              </span>
            </div>

            <!-- Security Office Information -->
            <div class="alert alert-info mb-0" role="alert">
              <div class="d-flex align-items-start gap-2">
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="currentColor" class="bi bi-info-circle-fill flex-shrink-0 mt-1" viewBox="0 0 16 16">
                  <path d="M8 16A8 8 0 1 0 8 0a8 8 0 0 0 0 16zm.93-9.412-1 4.705c-.07.34.029.533.304.533.194 0 .487-.07.686-.246l-.088.416c-.287.346-.92.598-1.465.598-.703 0-1.002-.422-.808-1.319l.738-3.468c.064-.293.006-.399-.287-.47l-.451-.081.082-.381 2.29-.287zM8 5.5a1 1 0 1 1 0-2 1 1 0 0 1 0 2z"/>
                </svg>
                <div class="flex-grow-1">
                  <h6 class="alert-heading mb-2">Collection Instructions</h6>
                  <p class="mb-2">You've confirmed this is your item. Please collect it from the security office.</p>
                  <div v-if="getSecurityOffice(match)" class="mt-2">
                    <strong>Collection Point:</strong>
                    <div class="ms-2 mt-1">
                      <div>{{ getSecurityOffice(match).name }}</div>
                      <div class="text-muted small">{{ getSecurityOffice(match).location }}</div>
                    </div>
                  </div>
                  <div v-else class="mt-2 text-muted small">
                    Security office location information not available. Please contact the finder.
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
