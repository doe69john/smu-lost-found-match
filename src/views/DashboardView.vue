<script setup>
import { computed, onMounted, ref } from 'vue'
import { RouterLink } from 'vue-router'
import { useAuth } from '../composables/useAuth'
import { fetchLostItems } from '../services/lostItemsService'
import { fetchFoundItems } from '../services/foundItemsService'
import { pushToast } from '../composables/useToast'

const { user } = useAuth()

const lostCount = ref(0)
const foundCount = ref(0)
const recentLost = ref([])
const recentFound = ref([])
const isLoading = ref(false)
const errorMessage = ref('')

const displayName = computed(() => {
  if (!user.value) return 'there'
  return (
    user.value.user_metadata?.full_name ||
    user.value.full_name ||
    user.value.email?.split('@')[0] ||
    'there'
  )
})

const formatDate = (value) => {
  if (!value) return 'Date unknown'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Date unknown'
  return new Intl.DateTimeFormat('en-SG', { dateStyle: 'medium' }).format(date)
}

const loadDashboard = async () => {
  isLoading.value = true
  errorMessage.value = ''

  try {
    const [lostResponse, foundResponse] = await Promise.all([
      fetchLostItems({
        select:
          'id,category,brand,model,color,description,location_lost,date_lost',
        order: 'date_lost.desc',
        limit: 4,
        count: 'exact'
      }),
      fetchFoundItems({
        select:
          'id,category,brand,model,color,description,location_found,date_found',
        order: 'date_found.desc',
        limit: 4,
        count: 'exact'
      })
    ])

    lostCount.value = lostResponse.count || 0
    foundCount.value = foundResponse.count || 0

    recentLost.value = Array.isArray(lostResponse.data) ? lostResponse.data : []
    recentFound.value = Array.isArray(foundResponse.data) ? foundResponse.data : []
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
})

const quickLinks = [
  {
    label: 'Report a lost item',
    description: 'Submit details about something you misplaced on campus.',
    to: { name: 'report-lost' },
    emoji: '🧳'
  },
  {
    label: 'Report a found item',
    description: 'Let others know what you have found so we can match it quickly.',
    to: { name: 'report-found' },
    emoji: '📦'
  },
  {
    label: 'Browse lost reports',
    description: 'Search active reports and look for potential matches.',
    to: { name: 'browse-lost' },
    emoji: '🔍'
  },
  {
    label: 'Browse found submissions',
    description: 'Review items others have handed in recently.',
    to: { name: 'browse-found' },
    emoji: '🤝'
  }
]
</script>

<template>
  <section class="d-grid gap-4">
    <header class="d-grid gap-1">
      <h1 class="h3 fw-semibold mb-0">Welcome back, {{ displayName }}.</h1>
      <p class="text-muted mb-0">
        Track reports, review matches and keep the Lost &amp; Found ecosystem moving.
      </p>
    </header>

    <div class="row g-3">
      <div class="col-md-6 col-lg-3">
        <div class="card border-0 shadow-sm h-100">
          <div class="card-body">
            <h2 class="card-title h6 text-uppercase text-muted">Lost reports</h2>
            <p class="display-6 fw-bold mb-0">{{ isLoading ? '–' : lostCount }}</p>
            <p class="text-muted small mb-0">Filed by students and staff.</p>
          </div>
        </div>
      </div>
      <div class="col-md-6 col-lg-3">
        <div class="card border-0 shadow-sm h-100">
          <div class="card-body">
            <h2 class="card-title h6 text-uppercase text-muted">Found submissions</h2>
            <p class="display-6 fw-bold mb-0">{{ isLoading ? '–' : foundCount }}</p>
            <p class="text-muted small mb-0">Items waiting for a match.</p>
          </div>
        </div>
      </div>
      <div class="col-lg-6">
        <div class="card border-0 shadow-sm h-100">
          <div class="card-body">
            <h2 class="card-title h6 text-uppercase text-muted">Quick actions</h2>
            <ul class="list-unstyled mb-0">
              <li v-for="link in quickLinks" :key="link.label" class="mb-2">
                <RouterLink class="d-flex align-items-start gap-3 text-decoration-none" :to="link.to">
                  <span
                    class="rounded-circle bg-primary-subtle text-primary-emphasis d-inline-flex align-items-center justify-content-center fs-5"
                    style="width: 40px; height: 40px;"
                    aria-hidden="true"
                  >
                    {{ link.emoji }}
                  </span>
                  <span>
                    <span class="fw-semibold d-block">{{ link.label }}</span>
                    <small class="text-muted">{{ link.description }}</small>
                  </span>
                </RouterLink>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>

    <div v-if="errorMessage" class="alert alert-warning" role="alert">
      {{ errorMessage }}
    </div>

    <div class="row g-3">
      <div class="col-lg-6">
        <div class="card border-0 shadow-sm h-100">
          <div class="card-body">
            <div class="d-flex justify-content-between align-items-center mb-3">
              <h2 class="h5 mb-0">Recent lost reports</h2>
              <RouterLink class="btn btn-sm btn-outline-primary" :to="{ name: 'browse-lost' }">
                View all
              </RouterLink>
            </div>

            <div v-if="isLoading" class="text-center py-4 text-muted">Loading data...</div>
            <div v-else-if="recentLost.length === 0" class="text-center py-4 text-muted">
              No lost items have been reported yet.
            </div>
            <ul v-else class="list-group list-group-flush">
              <li v-for="item in recentLost" :key="item.id" class="list-group-item">
                <div class="fw-semibold">
                  {{ item.brand || item.model || item.category || 'Item' }}
                </div>
                <div class="text-muted small">
                  {{ item.description || 'No description provided.' }}
                </div>
                <div class="d-flex flex-wrap gap-3 small text-muted mt-2">
                  <span>
                    <span class="me-1" aria-hidden="true">📍</span>
                    {{ item.location_lost || 'Unknown location' }}
                  </span>
                  <span>
                    <span class="me-1" aria-hidden="true">🗓</span>
                    {{ formatDate(item.date_lost) }}
                  </span>
                </div>
              </li>
            </ul>
          </div>
        </div>
      </div>

      <div class="col-lg-6">
        <div class="card border-0 shadow-sm h-100">
          <div class="card-body">
            <div class="d-flex justify-content-between align-items-center mb-3">
              <h2 class="h5 mb-0">Recent found submissions</h2>
              <RouterLink class="btn btn-sm btn-outline-primary" :to="{ name: 'browse-found' }">
                View all
              </RouterLink>
            </div>

            <div v-if="isLoading" class="text-center py-4 text-muted">Loading data...</div>
            <div v-else-if="recentFound.length === 0" class="text-center py-4 text-muted">
              No found items have been logged yet.
            </div>
            <ul v-else class="list-group list-group-flush">
              <li v-for="item in recentFound" :key="item.id" class="list-group-item">
                <div class="fw-semibold">
                  {{ item.brand || item.model || item.category || 'Item' }}
                </div>
                <div class="text-muted small">
                  {{ item.description || 'No description provided.' }}
                </div>
                <div class="d-flex flex-wrap gap-3 small text-muted mt-2">
                  <span>
                    <span class="me-1" aria-hidden="true">📍</span>
                    {{ item.location_found || 'Unknown location' }}
                  </span>
                  <span>
                    <span class="me-1" aria-hidden="true">🗓</span>
                    {{ formatDate(item.date_found) }}
                  </span>
                </div>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  </section>
</template>
