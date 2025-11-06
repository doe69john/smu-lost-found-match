<script setup>
import { computed, onMounted, ref } from 'vue'
import { RouterLink } from 'vue-router'
import { useAuth } from '../composables/useAuth'
import { fetchLostItems } from '../services/lostItemsService'
import { fetchFoundItems } from '../services/foundItemsService'
import { fetchMatchesForLostItem } from '../services/matchesService'
import Modal from '@/components/ui/Modal.vue'
import MatchesDisplay from '@/components/common/MatchesDisplay.vue'
import { pushToast } from '../composables/useToast'
import lostIcon from '../assets/lost.png'
import foundIcon from '../assets/found.png'


const { user } = useAuth()

const lostCount = ref(0)
const foundCount = ref(0)
const myLostItems = ref([])
const matchCounts = ref({})
const isLoading = ref(false)
const isLoadingMyItems = ref(false)
const errorMessage = ref('')

// Modal state
const showMatchesModal = ref(false)
const selectedLostItem = ref(null)

const displayName = computed(() => {
  if (!user.value) return 'there'
  return (
    user.value.user_metadata?.full_name ||
    user.value.full_name ||
    user.value.email?.split('@')[0] ||
    'there'
  )
})

// Get Supabase storage URL for images
const getImageUrl = (imagePath) => {
  if (!imagePath) return null
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
  return `${supabaseUrl}/storage/v1/object/public/item-images/${imagePath}`
}

// Get up to 3 images for display
const getItemImages = (item) => {
  if (!item.image_metadata || !Array.isArray(item.image_metadata)) return []
  return item.image_metadata.slice(0, 3).map(img => getImageUrl(img.path))
}

const formatDate = (value) => {
  if (!value) return 'Date unknown'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Date unknown'
  return new Intl.DateTimeFormat('en-SG', { dateStyle: 'medium' }).format(date)
}

const getMatchingStatusBadge = (status, matchCount = 0) => {
  switch (status) {
    case 'completed':
      // Only show "Matches Found" if there are actual matches
      if (matchCount > 0) {
        return { class: 'bg-success', text: `${matchCount} ${matchCount === 1 ? 'Match' : 'Matches'} Found`, icon: '✓' }
      }
      // Otherwise show "No matches found" to indicate AI finished but found nothing
      return { class: 'bg-danger', text: 'No matches found', icon: '✗' }
    case 'processing':
      return { class: 'bg-info', text: 'Searching...', icon: '⏳' }
    case 'failed':
      return { class: 'bg-danger', text: 'Search Failed', icon: '✗' }
    case 'pending':
    default:
      return { class: 'bg-secondary', text: 'Search Pending', icon: '⏱' }
  }
}

const openMatchesModal = (item) => {
  selectedLostItem.value = item
  showMatchesModal.value = true
}

const closeMatchesModal = () => {
  showMatchesModal.value = false
  selectedLostItem.value = null
}

const handleMatchClaimed = async () => {
  // Close the modal
  closeMatchesModal()

  // Refresh the lost items list to show updated status
  await loadMyLostItems()

  // Show a success message
  pushToast({
    title: 'Item claimed!',
    message: 'The dashboard has been updated to reflect your claimed item.',
    variant: 'success'
  })
}

// Load user's own lost items with matching status
const loadMyLostItems = async () => {
  if (!user.value?.id) return

  isLoadingMyItems.value = true

  try {
    const response = await fetchLostItems({
      select: 'id,category,brand,model,description,location_lost,date_lost,matching_status,status,image_metadata',
      filters: {
        user_id: `eq.${user.value.id}`
      },
      order: 'created_at.desc',
      limit: 5
    })

    myLostItems.value = Array.isArray(response.data) ? response.data : []

    // Fetch match counts for all items to determine correct badge display
    for (const item of myLostItems.value) {
      try {
        const matches = await fetchMatchesForLostItem(item.id)
        matchCounts.value[item.id] = matches.length
      } catch (error) {
        console.error(`Failed to fetch matches for item ${item.id}:`, error)
        matchCounts.value[item.id] = 0
      }
    }
  } catch (error) {
    console.error('Error loading my lost items:', error)
  } finally {
    isLoadingMyItems.value = false
  }
}

const loadDashboard = async () => {
  isLoading.value = true
  errorMessage.value = ''

  try {
    const [lostResponse, foundResponse] = await Promise.all([
      fetchLostItems({
        count: 'exact'
      }),
      fetchFoundItems({
        count: 'exact'
      })
    ])

    lostCount.value = lostResponse.count || 0
    foundCount.value = foundResponse.count || 0
  } catch (error) {
    errorMessage.value = error?.message || 'Unable to load dashboard data.'
    pushToast({
      title: 'Dashboard error',
      message: errorMessage.value,
      variant: 'danger'
    })
  } finally {
    isLoading.value = false
  }
}

onMounted(() => {
  loadDashboard()
  loadMyLostItems()
})
</script>

<template>
  <section class="d-grid gap-4">
    <header class="d-grid gap-1">
      <h1 class="h3 fw-semibold mb-0">Welcome back, {{ displayName }}.</h1>
      <p class="text-muted mb-0">
        Track reports, review matches and keep the Lost &amp; Found ecosystem moving.
      </p>
    </header>

    <!-- My Lost Items Section -->
    <div v-if="myLostItems.length > 0" class="card border-0 shadow-sm purple-gradient-card" style="border-radius: 1rem; background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%);">
      <div class="card-body text-white p-4">
        <div class="d-flex align-items-center justify-content-between mb-3">
          <h2 class="h5 mb-0 fw-semibold">
            <span class="me-2">🔍</span>
            My Lost Items
          </h2>
          <RouterLink
            class="btn btn-sm btn-light"
            :to="{ name: 'browse-lost' }"
          >
            View All
          </RouterLink>
        </div>

        <div v-if="isLoadingMyItems" class="text-center py-3">
          <div class="spinner-border spinner-border-sm text-white" role="status">
            <span class="visually-hidden">Loading...</span>
          </div>
        </div>

        <div v-else class="d-grid gap-2">
          <div
            v-for="item in myLostItems"
            :key="item.id"
            class="card position-relative"
            :class="{ 'item-claimed': item.status === 'claimed' }"
            style="background: rgba(255, 255, 255, 0.95); backdrop-filter: blur(10px);"
          >
            <div class="card-body">
              <div class="d-flex gap-3">
                <!-- Image Section -->
                <div class="item-images flex-shrink-0 position-relative">
                  <div v-if="getItemImages(item).length === 0" class="image-placeholder">
                    <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" fill="currentColor" viewBox="0 0 16 16">
                      <path d="M6.002 5.5a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0z"/>
                      <path d="M2.002 1a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V3a2 2 0 0 0-2-2h-12zm12 1a1 1 0 0 1 1 1v6.5l-3.777-1.947a.5.5 0 0 0-.577.093l-3.71 3.71-2.66-1.772a.5.5 0 0 0-.63.062L1.002 12V3a1 1 0 0 1 1-1h12z"/>
                    </svg>
                  </div>
                  <div v-else-if="getItemImages(item).length === 1" class="single-image">
                    <img :src="getItemImages(item)[0]" :alt="item.model || item.brand || 'Lost item'" />
                  </div>
                  <div v-else class="multi-images">
                    <img v-for="(img, idx) in getItemImages(item)" :key="idx" :src="img" :alt="`${item.model || item.brand || 'Lost item'} ${idx + 1}`" />
                  </div>

                  <!-- Claimed Overlay Badge -->
                  <div v-if="item.status === 'claimed'" class="claimed-overlay">
                    <span class="claimed-badge">
                      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="currentColor" viewBox="0 0 16 16">
                        <path d="M16 8A8 8 0 1 1 0 8a8 8 0 0 1 16 0zm-3.97-3.03a.75.75 0 0 0-1.08.022L7.477 9.417 5.384 7.323a.75.75 0 0 0-1.06 1.06L6.97 11.03a.75.75 0 0 0 1.079-.02l3.992-4.99a.75.75 0 0 0-.01-1.05z"/>
                      </svg>
                      Claimed
                    </span>
                  </div>
                </div>

                <!-- Content Section -->
                <div class="flex-grow-1 d-flex flex-column flex-sm-row gap-3">
                  <div class="flex-grow-1">
                    <div class="d-flex flex-wrap align-items-center gap-2 mb-2">
                      <span class="badge bg-primary-subtle text-primary">
                        {{ item.category || 'Item' }}
                      </span>
                      <span
                        v-if="item.status === 'claimed'"
                        class="badge bg-success text-white"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" fill="currentColor" class="bi bi-check-circle-fill me-1" viewBox="0 0 16 16" style="margin-bottom: 2px;">
                          <path d="M16 8A8 8 0 1 1 0 8a8 8 0 0 1 16 0zm-3.97-3.03a.75.75 0 0 0-1.08.022L7.477 9.417 5.384 7.323a.75.75 0 0 0-1.06 1.06L6.97 11.03a.75.75 0 0 0 1.079-.02l3.992-4.99a.75.75 0 0 0-.01-1.05z"/>
                        </svg>
                        Claimed
                      </span>
                      <span
                        v-else-if="item.matching_status"
                        :class="`badge ${getMatchingStatusBadge(item.matching_status, matchCounts[item.id] || 0).class} text-white`"
                      >
                        {{ getMatchingStatusBadge(item.matching_status, matchCounts[item.id] || 0).icon }}
                        {{ getMatchingStatusBadge(item.matching_status, matchCounts[item.id] || 0).text }}
                      </span>
                    </div>

                    <h3 class="h6 fw-semibold mb-1 text-dark">
                      {{ item.model || item.brand || 'Lost item' }}
                    </h3>
                    <p class="text-muted small mb-2">
                      <span v-if="item.brand && item.model" class="fw-medium">{{ item.brand }}</span>
                      <span v-if="item.brand && item.model"> • </span>
                      {{ item.description || 'No description provided.' }}
                    </p>

                    <div class="d-flex flex-wrap gap-3 small text-muted">
                      <span>
                        <span class="me-1">📍</span>
                        {{ item.location_lost || 'Unknown location' }}
                      </span>
                      <span>
                        <span class="me-1">🗓</span>
                        {{ formatDate(item.date_lost) }}
                      </span>
                    </div>
                  </div>

                  <!-- View Matches/Details Button -->
                  <div v-if="item.matching_status === 'completed' && (matchCounts[item.id] > 0 || item.status === 'claimed')" class="d-flex align-items-start">
                    <button
                      v-if="item.status === 'claimed'"
                      type="button"
                      class="btn btn-sm btn-success"
                      disabled
                      style="white-space: nowrap; opacity: 0.7; cursor: not-allowed;"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" fill="currentColor" class="bi bi-check-circle-fill me-1" viewBox="0 0 16 16" style="margin-bottom: 2px;">
                        <path d="M16 8A8 8 0 1 1 0 8a8 8 0 0 1 16 0zm-3.97-3.03a.75.75 0 0 0-1.08.022L7.477 9.417 5.384 7.323a.75.75 0 0 0-1.06 1.06L6.97 11.03a.75.75 0 0 0 1.079-.02l3.992-4.99a.75.75 0 0 0-.01-1.05z"/>
                      </svg>
                      Claimed
                    </button>
                    <button
                      v-else
                      type="button"
                      class="btn btn-sm btn-primary"
                      @click="openMatchesModal(item)"
                      style="white-space: nowrap;"
                    >
                      Matches
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div class="row g-3">
      <!-- Lost reports billboard -->
      <div class="col-12 col-lg-6">
        <div
          class="card billboard-card border-0 shadow-sm overflow-hidden text-white h-100"
          style="border-radius: 1rem; background: linear-gradient(135deg, #dc2626 0%, #ef4444 50%, #f87171 100%);"
        >
          <div class="card-body d-flex align-items-center justify-content-between p-4 p-lg-5">
            <div>
              <div class="text-white-50 text-uppercase small fw-semibold mb-1">Lost reports</div>
              <div class="display-3 fw-bold lh-1">{{ isLoading ? '–' : lostCount }}</div>
              <div class="small text-white-75">Filed by students and staff.</div>
            </div>
            <div
              class="d-none d-sm-flex align-items-center justify-content-center"
              style="width: 90px; height: 90px; overflow: hidden;"
              aria-hidden="true"
            >
              <img
                :src="lostIcon"
                alt="Lost icon"
                style="width: 70%; height: auto; object-fit: contain; filter: brightness(0) invert(1);"
              />
            </div>
          </div>
        </div>
      </div>

      <!-- Found submissions billboard -->
      <div class="col-12 col-lg-6">
        <div
          class="card billboard-card border-0 shadow-sm overflow-hidden text-white h-100"
          style="border-radius: 1rem; background: linear-gradient(135deg, #059669 0%, #10b981 50%, #22c55e 100%);"
        >
          <div class="card-body d-flex align-items-center justify-content-between p-4 p-lg-5">
            <div>
              <div class="text-white-50 text-uppercase small fw-semibold mb-1">Found submissions</div>
              <div class="display-3 fw-bold lh-1">{{ isLoading ? '–' : foundCount }}</div>
              <div class="small text-white-75">Items waiting for a match.</div>
            </div>
            <div
              class="d-none d-sm-flex align-items-center justify-content-center"
              style="width: 90px; height: 90px; overflow: hidden;"
              aria-hidden="true"
            >
              <img
                :src="foundIcon"
                alt="Found icon"
                style="width: 70%; height: auto; object-fit: contain; filter: brightness(0) invert(1);"
              />
            </div>
          </div>
        </div>
      </div>
    </div>

    <div v-if="errorMessage" class="alert alert-warning" role="alert">
      {{ errorMessage }}
    </div>

    <!-- Matches Modal -->
    <Modal
      v-model="showMatchesModal"
      :title="`Potential Matches for ${selectedLostItem?.model || selectedLostItem?.brand || 'Lost Item'}`"
      size="lg"
      @cancel="closeMatchesModal"
    >
      <MatchesDisplay
        v-if="selectedLostItem"
        :lost-item-id="selectedLostItem.id"
        @match-claimed="handleMatchClaimed"
      />
    </Modal>
  </section>
</template>

<style>
.quick-links {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.quick-link {
  display: grid;
  grid-template-columns: auto 1fr;
  gap: 1rem;
  align-items: center;
  padding: 14px 18px;
  border-radius: 12px;
  border: 1px solid var(--color-border);
  background: var(--surface-base);
  color: var(--text-body);
  box-shadow: var(--shadow-xs);
  transition: background var(--transition-medium) var(--transition-timing),
    box-shadow var(--transition-medium) var(--transition-timing),
    transform var(--transition-medium) var(--transition-timing);
}

.quick-link:hover,
.quick-link:focus-visible {
  background: var(--surface-soft);
  box-shadow: var(--shadow-sm);
  transform: translateY(-2px);
  text-decoration: none;
}

.quick-icon {
  width: 60px;
  height: 60px;
  font-size: 2rem;
  border-radius: 50%;
  background: color-mix(in srgb, var(--color-primary-500) 12%, transparent);
  color: var(--color-primary-600);
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background var(--transition-medium) var(--transition-timing),
    color var(--transition-medium) var(--transition-timing);
}

.quick-link:hover .quick-icon,
.quick-link:focus-visible .quick-icon {
  background: var(--color-primary-600);
  color: var(--text-inverse);
}

.link-label {
  font-weight: 600;
  color: var(--color-primary-600);
  transition: color var(--transition-medium) var(--transition-timing);
}

.quick-link:hover .link-label,
.quick-link:focus-visible .link-label {
  color: var(--color-primary-500);
}

.quick-description {
  color: var(--text-muted);
}

html.dark .quick-link,
.dark .quick-link {
  background: rgba(15, 23, 42, 0.75);
  box-shadow: var(--shadow-sm);
}

html.dark .quick-link:hover,
.dark .quick-link:hover,
html.dark .quick-link:focus-visible,
.dark .quick-link:focus-visible {
  background: rgba(79, 70, 229, 0.18);
}

html.dark .link-label,
.dark .link-label {
  color: var(--color-primary-300);
}

html.dark .quick-link:hover .link-label,
.dark .quick-link:hover .link-label,
html.dark .quick-link:focus-visible .link-label,
.dark .quick-link:focus-visible .link-label {
  color: var(--color-primary-200);
}

html.dark .quick-description,
.dark .quick-description {
  color: color-mix(in srgb, var(--text-muted) 82%, var(--text-body) 18%);
}

/* Item images styling */
.item-images {
  width: 100px;
  height: 100px;
  border-radius: 8px;
  overflow: hidden;
  background: #f3f4f6;
}

html.dark .item-images,
.dark .item-images {
  background: #374151;
}

.image-placeholder {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #9ca3af;
}

html.dark .image-placeholder,
.dark .image-placeholder {
  color: #6b7280;
  background: #374151;
}

.single-image img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.multi-images {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  grid-template-rows: repeat(2, 1fr);
  gap: 2px;
  width: 100%;
  height: 100%;
}

.multi-images img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.multi-images img:first-child {
  grid-column: 1 / -1;
  grid-row: 1;
}

.multi-images img:nth-child(2) {
  grid-column: 1;
  grid-row: 2;
}

.multi-images img:nth-child(3) {
  grid-column: 2;
  grid-row: 2;
}

/* Claimed item styling - no blur, just visual indicator */
.item-claimed {
  opacity: 0.85;
}

/* Claimed overlay badge on images */
.claimed-overlay {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.75);
  backdrop-filter: blur(3px);
  border-radius: 8px;
  z-index: 10;
}

.claimed-badge {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 8px 16px;
  background: linear-gradient(135deg, #10b981 0%, #059669 100%);
  color: white;
  font-size: 0.8rem;
  font-weight: 700;
  border-radius: 8px;
  box-shadow: 0 4px 12px rgba(16, 185, 129, 0.5), 0 2px 4px rgba(0, 0, 0, 0.3);
  text-transform: uppercase;
  letter-spacing: 0.75px;
  border: 2px solid rgba(255, 255, 255, 0.3);
  animation: pulse-claimed 2s infinite;
}

.claimed-badge svg {
  flex-shrink: 0;
}

@keyframes pulse-claimed {
  0%, 100% {
    transform: scale(1);
    box-shadow: 0 4px 12px rgba(16, 185, 129, 0.5), 0 2px 4px rgba(0, 0, 0, 0.3);
  }
  50% {
    transform: scale(1.05);
    box-shadow: 0 6px 16px rgba(16, 185, 129, 0.7), 0 2px 4px rgba(0, 0, 0, 0.3);
  }
}

/* Dark mode card backgrounds (except billboards and purple section) */
html.dark .card:not(.billboard-card):not(.purple-gradient-card),
.dark .card:not(.billboard-card):not(.purple-gradient-card) {
  background: rgba(31, 41, 55, 0.95) !important;
  backdrop-filter: blur(10px);
}

/* Keep purple gradient in dark mode for My Lost Items section */
html.dark .purple-gradient-card,
.dark .purple-gradient-card {
  background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%) !important;
}

html.dark .card:not(.billboard-card) .text-dark,
.dark .card:not(.billboard-card) .text-dark {
  color: #e5e7eb !important;
}

/* View All button dark mode */
html.dark .btn-light,
.dark .btn-light {
  background-color: rgba(55, 65, 81, 0.8);
  border-color: #4b5563;
  color: #e5e7eb;
}

html.dark .btn-light:hover,
.dark .btn-light:hover {
  background-color: rgba(75, 85, 99, 0.9);
  border-color: #6b7280;
  color: #f3f4f6;
}

/* Make category badges more visible in dark mode */
html.dark .badge.bg-primary-subtle,
.dark .badge.bg-primary-subtle {
  background-color: rgba(99, 102, 241, 0.3) !important;
  color: #c7d2fe !important;
  font-weight: 600;
}

/* Responsive adjustments */
@media (max-width: 576px) {
  .item-images {
    width: 80px;
    height: 80px;
  }
}

</style>
