<script setup>
import { computed, onMounted, ref } from 'vue'
import { RouterLink } from 'vue-router'
import { useAuth } from '../composables/useAuth'
import { fetchLostItems } from '../services/lostItemsService'
import { fetchFoundItems } from '../services/foundItemsService'
import { pushToast } from '../composables/useToast'
import lostIcon from '../assets/lost.png'
import foundIcon from '../assets/found.png'


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
      <!-- Lost reports billboard -->
  <div class="col-12 col-lg-6">
    <div
      class="card border-0 shadow-sm overflow-hidden text-white h-100"
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
            style="width:90px;height:90px;overflow:hidden;"
            aria-hidden="true"
        >
          <img
            :src="lostIcon"
            alt="LostIcon"
            style="width:70%;height:auto;object-fit:contain;filter:brightness(0) invert(1);"
          />

</div>

      </div>
    </div>
  </div>

      <!-- Found submissions billboard -->
  <div class="col-12 col-lg-6">
    <div
      class="card border-0 shadow-sm overflow-hidden text-white h-100"
      style="border-radius: 1rem; background: linear-gradient(135deg,#059669 0%, #10b981 50%, #22c55e 100%);"
    >
      <div class="card-body d-flex align-items-center justify-content-between p-4 p-lg-5">
        <div>
          <div class="text-white-50 text-uppercase small fw-semibold mb-1">Found submissions</div>
          <div class="display-3 fw-bold lh-1">{{ isLoading ? '–' : foundCount }}</div>
          <div class="small text-white-75">Items waiting for a match.</div>
        </div>
        <div
          class="d-none d-sm-flex align-items-center justify-content-center"
          style="width:90px;height:90px;overflow:hidden;"
          aria-hidden="true"
        >
          <img
            :src="foundIcon"
            alt="Found Icon"
            style="width:70%;height:auto;object-fit:contain;filter:brightness(0) invert(1);"
          />
        </div>
      </div>
    </div>
  </div>
      <div class="col-lg-12">
        <div class="card border-0 shadow-sm h-100">
          <div class="card-body">
            <h2 class="card-title h6 text-uppercase text-muted">Quick actions</h2>
            <ul class="list-unstyled mb-0 quick-links">
              <li v-for="link in quickLinks" :key="link.label" class="mb-2">
                <RouterLink class="quick-link text-decoration-none" :to="link.to">
                  <span class="quick-icon" aria-hidden="true">
                    {{ link.emoji }}
                  </span>
                  <span>
                    <span class="link-label d-block">{{ link.label }}</span>
                    <small class="quick-description d-block small">{{ link.description }}</small>
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

</style>
