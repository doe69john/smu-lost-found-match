<script setup>
import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import { fetchFoundItems } from '../services/foundItemsService'
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
      <h1 class="h3 fw-semibold mb-1">Browse found items</h1>
      <p class="text-muted mb-0">
        Review items that have been handed in so you can connect them with potential owners.
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
        No found items match your filters yet. Try a different search or check back soon.
      </div>

      <div v-else class="row g-3">
        <div v-for="item in items" :key="item.id" class="col-12 col-md-6 col-lg-4">
          <article class="card h-100 border-0 shadow-sm">
            <div class="card-body d-grid gap-2">
              <span class="badge text-bg-success-subtle text-success-emphasis d-inline-flex px-3 py-2">
                {{ item.category || 'Item' }}
              </span>
              <h2 class="h5 mb-0">{{ item.brand || item.model || 'Found item' }}</h2>
              <p class="text-muted mb-0">{{ item.description || 'No description provided.' }}</p>
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
          <span
            v-if="isLoading"
            class="spinner-border spinner-border-sm me-2"
            role="status"
            aria-hidden="true"
          ></span>
          {{ isLoading ? 'Loading more…' : 'Load more results' }}
        </button>
      </div>
    </div>
  </section>
</template>
