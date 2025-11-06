<script setup>
import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import PulseLoader from '@/components/common/PulseLoader.vue'
import Modal from '@/components/ui/Modal.vue'
import { useLoadingDelay } from '@/composables/useLoadingDelay'
import { fetchFoundItems } from '../services/foundItemsService'
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

  // Filter by current user - only show items they found
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
      `location_found.ilike.${pattern}`
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
    const { data, count } = await fetchFoundItems({
      filters: buildFilterParams(),
      order: 'date_found.desc',
      limit: PAGE_SIZE,
      offset: (page.value - 1) * PAGE_SIZE,
      count: 'exact'
    })

    totalCount.value = count || 0
    const results = Array.isArray(data) ? data : []
    items.value = reset ? results : [...items.value, ...results]

    page.value += 1
  } catch (error) {
    errorMessage.value = error?.message || 'Unable to load found item reports.'
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

// Modal state for viewing item details
const showDetailsModal = ref(false)
const selectedFoundItem = ref(null)

const openDetailsModal = (item) => {
  selectedFoundItem.value = item
  showDetailsModal.value = true
}

const closeDetailsModal = () => {
  showDetailsModal.value = false
  selectedFoundItem.value = null
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
      <h1 class="h3 fw-semibold mb-1">My Found Items</h1>
      <p class="text-muted mb-0">
        View and manage the items you have found and reported.
      </p>
    </header>

    <div class="row g-3 align-items-end">
      <div class="col-12 col-lg-6">
        <label class="form-label" for="found-search">Search</label>
        <input
          id="found-search"
          v-model="filters.query"
          type="search"
          class="form-control"
          placeholder="Search by description, brand or location"
        />
      </div>
      <div class="col-12 col-sm-6 col-lg-3">
        <label class="form-label" for="found-category-filter">Category</label>
        <select id="found-category-filter" v-model="filters.category" class="form-select">
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

    <div v-if="isInitialLoad && isLoading" class="text-center py-5 text-muted">Loading found item reports...</div>

    <div v-else>
      <p class="text-muted small mb-3">
        Showing {{ items.length }} of {{ totalCount }} found item reports
      </p>

      <div v-if="items.length === 0" class="text-center py-5 text-muted">
        You haven't reported any found items yet. When you find something, report it here to help match it with the owner.
      </div>

      <div v-else class="row g-3">
        <div v-for="item in items" :key="item.id" class="col-12 col-md-6 col-lg-4">
          <article class="card h-100 border-0 shadow-sm clickable-card" @click="openDetailsModal(item)">
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
                  <span class="badge text-bg-success-subtle text-success-emphasis d-inline-flex px-3 py-2 align-self-start">
                    {{ item.category || 'Item' }}
                  </span>
                  <h2 class="h5 mb-0">{{ item.model || item.brand || 'Found item' }}</h2>
                  <p class="text-muted mb-0 flex-grow-1">
                    <span v-if="item.brand && item.model" class="fw-medium">{{ item.brand }} • </span>{{ item.description || 'No description provided.' }}
                  </p>
                </div>
              </div>
            </div>
            <div class="card-footer bg-white border-0">
              <div class="small text-muted">
                <strong>Location found:</strong> {{ item.location_found || 'Unknown location' }}
              </div>
              <div class="small text-muted">
                <strong>Date found:</strong> {{ formatDate(item.date_found) }}
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

    <!-- Item Details Modal -->
    <Modal
      v-model="showDetailsModal"
      :title="`${selectedFoundItem?.brand || selectedFoundItem?.model || 'Found Item'} Details`"
      size="lg"
      @cancel="closeDetailsModal"
    >
      <div v-if="selectedFoundItem" class="found-item-details">
        <!-- Images Section -->
        <div v-if="getItemImages(selectedFoundItem).length > 0" class="mb-4">
          <h5 class="mb-3">Photos</h5>
          <div class="modal-images-grid">
            <img
              v-for="(img, idx) in getItemImages(selectedFoundItem)"
              :key="idx"
              :src="img"
              :alt="`${selectedFoundItem.brand || ''} ${selectedFoundItem.model || 'item'} - image ${idx + 1}`"
              class="modal-image"
            />
          </div>
        </div>

        <!-- Item Information -->
        <div class="details-grid">
          <div class="detail-item">
            <strong>Category:</strong>
            <span>{{ selectedFoundItem.category || 'Not specified' }}</span>
          </div>
          <div class="detail-item" v-if="selectedFoundItem.brand">
            <strong>Brand:</strong>
            <span>{{ selectedFoundItem.brand }}</span>
          </div>
          <div class="detail-item" v-if="selectedFoundItem.model">
            <strong>Model:</strong>
            <span>{{ selectedFoundItem.model }}</span>
          </div>
          <div class="detail-item">
            <strong>Description:</strong>
            <span>{{ selectedFoundItem.description || 'No description provided' }}</span>
          </div>
          <div class="detail-item">
            <strong>Location Found:</strong>
            <span>{{ selectedFoundItem.location_found || 'Unknown location' }}</span>
          </div>
          <div class="detail-item">
            <strong>Date Found:</strong>
            <span>{{ formatDate(selectedFoundItem.date_found) }}</span>
          </div>
        </div>
      </div>
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

.image-placeholder {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #9ca3af;
  background: #f3f4f6;
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

/* Clickable card */
.clickable-card {
  cursor: pointer;
  transition: transform 0.2s, box-shadow 0.2s;
}

.clickable-card:hover {
  transform: translateY(-4px);
  box-shadow: 0 0.5rem 1rem rgba(0, 0, 0, 0.15) !important;
}

/* Modal images */
.modal-images-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 1rem;
}

.modal-image {
  width: 100%;
  height: 200px;
  object-fit: cover;
  border-radius: 8px;
  border: 1px solid #e5e7eb;
}

/* Details grid */
.details-grid {
  display: grid;
  gap: 1rem;
}

.detail-item {
  display: grid;
  grid-template-columns: 150px 1fr;
  gap: 1rem;
  padding: 0.75rem;
  background: #f9fafb;
  border-radius: 6px;
}

.detail-item strong {
  color: #374151;
}

.detail-item span {
  color: #6b7280;
}

/* Responsive adjustments */
@media (max-width: 576px) {
  .item-images {
    width: 80px;
    height: 80px;
  }

  .detail-item {
    grid-template-columns: 1fr;
    gap: 0.25rem;
  }

  .modal-images-grid {
    grid-template-columns: 1fr;
  }
}
</style>
