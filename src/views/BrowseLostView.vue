<script setup>
import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import PulseLoader from '@/components/common/PulseLoader.vue'
import Modal from '@/components/ui/Modal.vue'
import MatchesDisplay from '@/components/common/MatchesDisplay.vue'
import { useLoadingDelay } from '@/composables/useLoadingDelay'
import { fetchLostItems } from '../services/lostItemsService'
import { fetchMatchesForLostItem } from '../services/matchesService'
import { pushToast } from '../composables/useToast'
import { useAuth } from '../composables/useAuth'

const { user } = useAuth()

const categories = [
  { label: 'All categories', value: 'all' },
  { label: 'Electronics', value: 'Electronics' },
  { label: 'Clothing', value: 'Clothing' },
  { label: 'Accessories', value: 'Accessories' },
  { label: 'Books', value: 'Books' },
  { label: 'Keys', value: 'Keys' },
  { label: 'Wallet', value: 'Wallet' },
  { label: 'Bag', value: 'Bag' },
  { label: 'Other', value: 'Other' }
]

const filters = reactive({
  query: '',
  category: 'all'
})

const items = ref([])
const totalCount = ref(0)
const page = ref(1)
const isLoading = ref(false)
const { isVisible: showLoadMoreLoader } = useLoadingDelay(isLoading)
const errorMessage = ref('')
const isInitialLoad = ref(true)
const matchCounts = ref({})

const PAGE_SIZE = 9
let searchDebounceId = null

const hasMore = computed(() => items.value.length < totalCount.value)

const formatDate = (value) => {
  if (!value) return 'Date unknown'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Date unknown'
  return new Intl.DateTimeFormat('en-SG', { dateStyle: 'medium' }).format(date)
}

const buildFilterParams = () => {
  const params = {}

  // Filter by current user - only show items they lost
  if (user.value?.id) {
    params.user_id = `eq.${user.value.id}`
  }

  if (filters.category !== 'all') {
    params.category = `eq.${filters.category}`
  }
  const search = filters.query.trim()
  if (search) {
    const sanitized = search.replace(/[%]/g, '')
    const pattern = `%${sanitized.replace(/\s+/g, '%')}%`
    params.or = [
      `description.ilike.${pattern}`,
      `brand.ilike.${pattern}`,
      `model.ilike.${pattern}`,
      `location_lost.ilike.${pattern}`
    ].join(',')
  }
  return params
}

const loadItems = async (reset = false) => {
  if (isLoading.value) return

  if (reset) {
    page.value = 1
    items.value = []
  }

  isLoading.value = true
  errorMessage.value = ''

  try {
    const { data, count } = await fetchLostItems({
      filters: buildFilterParams(),
      order: 'date_lost.desc',
      limit: PAGE_SIZE,
      offset: (page.value - 1) * PAGE_SIZE,
      count: 'exact'
    })

    totalCount.value = count || 0
    const results = Array.isArray(data) ? data : []
    items.value = reset ? results : [...items.value, ...results]

    // Fetch match counts for the new items
    for (const item of results) {
      if (item.matching_status === 'completed') {
        try {
          const matches = await fetchMatchesForLostItem(item.id)
          matchCounts.value[item.id] = matches.length
        } catch (error) {
          console.error(`Failed to fetch matches for item ${item.id}:`, error)
          matchCounts.value[item.id] = 0
        }
      } else {
        matchCounts.value[item.id] = 0
      }
    }

    page.value += 1
  } catch (error) {
    errorMessage.value = error?.message || 'Unable to load lost item reports.'
    pushToast({
      title: 'Unable to load items',
      message: errorMessage.value,
      variant: 'danger'
    })
  } finally {
    isLoading.value = false
    isInitialLoad.value = false
  }
}

const refreshItems = () => loadItems(true)

// Modal state for viewing matches
const showMatchesModal = ref(false)
const selectedLostItem = ref(null)

const openMatchesModal = (item) => {
  selectedLostItem.value = item
  showMatchesModal.value = true
}

const closeMatchesModal = () => {
  showMatchesModal.value = false
  selectedLostItem.value = null
}

const getMatchingStatusBadge = (status, matchCount = 0) => {
  switch (status) {
    case 'completed':
      // Only show "Matches Found" if there are actual matches
      if (matchCount > 0) {
        return { class: 'bg-success', text: `${matchCount} ${matchCount === 1 ? 'Match' : 'Matches'}` }
      }
      // Otherwise show "No matches found" to indicate AI finished but found nothing
      return { class: 'bg-danger', text: 'No matches found' }
    case 'processing':
      return { class: 'bg-info', text: 'Searching...' }
    case 'failed':
      return { class: 'bg-danger', text: 'Search Failed' }
    case 'pending':
    default:
      return { class: 'bg-secondary', text: 'Search Pending' }
  }
}

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

onMounted(() => {
  loadItems(true)
})

onBeforeUnmount(() => {
  if (searchDebounceId) {
    clearTimeout(searchDebounceId)
  }
})

watch(
  () => filters.category,
  () => {
    refreshItems()
  }
)

watch(
  () => filters.query,
  () => {
    if (searchDebounceId) {
      clearTimeout(searchDebounceId)
    }
    searchDebounceId = setTimeout(() => {
      refreshItems()
    }, 400)
  }
)
</script>

<template>
  <section class="d-grid gap-4">
    <header>
      <h1 class="h3 fw-semibold mb-1">My Lost Items</h1>
      <p class="text-muted mb-0">
        View and manage the items you have reported as lost.
      </p>
    </header>

    <div class="row g-3 align-items-end">
      <div class="col-12 col-lg-6">
        <label class="form-label" for="lost-search">Search</label>
        <input
          id="lost-search"
          v-model="filters.query"
          type="search"
          class="form-control"
          placeholder="Search by description, brand or location"
        />
      </div>
      <div class="col-12 col-sm-6 col-lg-3">
        <label class="form-label" for="lost-category-filter">Category</label>
        <select id="lost-category-filter" v-model="filters.category" class="form-select">
          <option v-for="option in categories" :key="option.value" :value="option.value">{{ option.label }}</option>
        </select>
      </div>
      <div class="col-12 col-sm-6 col-lg-3 text-sm-end">
        <button type="button" class="btn btn-outline-secondary w-100 w-sm-auto" @click="refreshItems">
          Refresh results
        </button>
      </div>
    </div>

    <div v-if="errorMessage" class="alert alert-warning" role="alert">
      {{ errorMessage }}
    </div>

    <div v-if="isInitialLoad && isLoading" class="text-center py-5 text-muted">Loading lost item reports...</div>

    <div v-else>
      <p class="text-muted small mb-3">
        Showing {{ items.length }} of {{ totalCount }} lost item reports
      </p>

      <div v-if="items.length === 0" class="text-center py-5 text-muted">
        No reports match your filters yet. Try adjusting your search or check back later.
      </div>

      <div v-else class="row g-3">
        <div v-for="item in items" :key="item.id" class="col-12 col-md-6 col-lg-4">
          <article class="card h-100 border-0 shadow-sm">
            <div class="card-body d-flex flex-column gap-2">
              <div class="d-flex gap-3">
                <!-- Image Display -->
                <div class="item-images flex-shrink-0">
                  <div v-if="getItemImages(item).length === 0" class="image-placeholder">
                    <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                      <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                      <circle cx="8.5" cy="8.5" r="1.5"></circle>
                      <polyline points="21 15 16 10 5 21"></polyline>
                    </svg>
                  </div>
                  <div v-else-if="getItemImages(item).length === 1" class="single-image">
                    <img :src="getItemImages(item)[0]" :alt="`${item.brand || ''} ${item.model || 'item'}`" />
                  </div>
                  <div v-else class="multi-images">
                    <img
                      v-for="(img, idx) in getItemImages(item)"
                      :key="idx"
                      :src="img"
                      :alt="`${item.brand || ''} ${item.model || 'item'} - image ${idx + 1}`"
                    />
                  </div>
                </div>

                <!-- Content -->
                <div class="flex-grow-1 d-flex flex-column gap-2">
                  <div class="d-flex justify-content-between align-items-start gap-2">
                    <span class="badge text-bg-primary-subtle text-primary-emphasis px-3 py-2">
                      {{ item.category || 'Item' }}
                    </span>
                    <span
                      v-if="item.matching_status"
                      :class="`badge ${getMatchingStatusBadge(item.matching_status, matchCounts[item.id] || 0).class} text-white`"
                    >
                      {{ getMatchingStatusBadge(item.matching_status, matchCounts[item.id] || 0).text }}
                    </span>
                  </div>
                  <h2 class="h5 mb-0">{{ item.model || item.brand || 'Lost item' }}</h2>
                  <p class="text-muted mb-0 flex-grow-1">
                    <span v-if="item.brand && item.model" class="fw-medium">{{ item.brand }} • </span>{{ item.description || 'No description provided.' }}
                  </p>

                  <button
                    v-if="item.matching_status === 'completed' && matchCounts[item.id] > 0"
                    type="button"
                    class="btn btn-sm btn-outline-primary mt-2"
                    @click="openMatchesModal(item)"
                  >
                    View {{ matchCounts[item.id] === 1 ? 'Match' : 'Matches' }}
                  </button>
                </div>
              </div>
            </div>
            <div class="card-footer bg-white border-0">
              <div class="small text-muted">
                <strong>Location:</strong> {{ item.location_lost || 'Unknown location' }}
              </div>
              <div class="small text-muted">
                <strong>Date lost:</strong> {{ formatDate(item.date_lost) }}
              </div>
            </div>
          </article>
        </div>
      </div>

      <div class="d-flex justify-content-center mt-4" v-if="hasMore">
        <button type="button" class="btn btn-outline-primary" :disabled="isLoading" @click="loadItems()">
          <PulseLoader v-if="showLoadMoreLoader" size="sm" class="me-2" aria-hidden="true" />
          {{ isLoading ? 'Loading more…' : 'Load more results' }}
        </button>
      </div>
    </div>

    <!-- Matches Modal -->
    <Modal
      v-model="showMatchesModal"
      :title="`Potential Matches for ${selectedLostItem?.brand || selectedLostItem?.model || 'Lost Item'}`"
      size="lg"
      @cancel="closeMatchesModal"
    >
      <MatchesDisplay
        v-if="selectedLostItem"
        :lost-item-id="selectedLostItem.id"
      />
    </Modal>
  </section>
</template>

<style scoped>
/* Image display styles */
.item-images {
  width: 100px;
  height: 100px;
  border-radius: 8px;
  overflow: hidden;
  background: #f3f4f6;
  flex-shrink: 0;
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
  background: #f3f4f6;
}

html.dark .image-placeholder,
.dark .image-placeholder {
  color: #6b7280;
  background: #374151;
}

.single-image {
  width: 100%;
  height: 100%;
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

/* Dark mode card footer */
html.dark .card-footer.bg-white,
.dark .card-footer.bg-white {
  background-color: #1f2937 !important;
}

/* Make category badges more visible in dark mode */
html.dark .badge.text-bg-primary-subtle,
.dark .badge.text-bg-primary-subtle {
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
