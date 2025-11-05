<script setup>
import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import PulseLoader from '@/components/common/PulseLoader.vue'
import Modal from '@/components/ui/Modal.vue'
import MatchesDisplay from '@/components/common/MatchesDisplay.vue'
import { useLoadingDelay } from '@/composables/useLoadingDelay'
import { fetchLostItems } from '../services/lostItemsService'
import { pushToast } from '../composables/useToast'

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

const getMatchingStatusBadge = (status) => {
  switch (status) {
    case 'completed':
      return { class: 'bg-success', text: 'Matches found' }
    case 'processing':
      return { class: 'bg-info', text: 'Processing...' }
    case 'failed':
      return { class: 'bg-danger', text: 'Failed' }
    case 'pending':
    default:
      return { class: 'bg-secondary', text: 'Pending' }
  }
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
      <h1 class="h3 fw-semibold mb-1">Browse lost items</h1>
      <p class="text-muted mb-0">
        Search recent reports submitted by students and staff. Use filters to narrow down the results.
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
              <div class="d-flex justify-content-between align-items-start gap-2">
                <span class="badge text-bg-primary-subtle text-primary-emphasis px-3 py-2">
                  {{ item.category || 'Item' }}
                </span>
                <span
                  v-if="item.matching_status"
                  :class="`badge ${getMatchingStatusBadge(item.matching_status).class} text-white`"
                >
                  {{ getMatchingStatusBadge(item.matching_status).text }}
                </span>
              </div>
              <h2 class="h5 mb-0">{{ item.brand || item.model || 'Lost item' }}</h2>
              <p class="text-muted mb-0 flex-grow-1">{{ item.description || 'No description provided.' }}</p>

              <button
                v-if="item.matching_status === 'completed'"
                type="button"
                class="btn btn-sm btn-outline-primary mt-2"
                @click="openMatchesModal(item)"
              >
                View Matches
              </button>
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
