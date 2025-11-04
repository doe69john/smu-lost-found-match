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
        <div class="card dashboard-hero dashboard-hero--lost overflow-hidden h-100">
          <div class="card-body d-flex align-items-center justify-content-between p-4 p-lg-5">
            <div>
              <div class="dashboard-hero__eyebrow">Lost reports</div>
              <div class="display-3 fw-bold lh-1">{{ isLoading ? '–' : lostCount }}</div>
              <div class="dashboard-hero__meta">Filed by students and staff.</div>
            </div>
            <div class="dashboard-hero__icon dashboard-hero__icon--light" aria-hidden="true">
              <img :src="lostIcon" alt="" />
            </div>
          </div>
        </div>
      </div>

      <!-- Found submissions billboard -->
      <div class="col-12 col-lg-6">
        <div class="card dashboard-hero dashboard-hero--found overflow-hidden h-100">
          <div class="card-body d-flex align-items-center justify-content-between p-4 p-lg-5">
            <div>
              <div class="dashboard-hero__eyebrow">Found submissions</div>
              <div class="display-3 fw-bold lh-1">{{ isLoading ? '–' : foundCount }}</div>
              <div class="dashboard-hero__meta">Items waiting for a match.</div>
            </div>
            <div class="dashboard-hero__icon dashboard-hero__icon--dark" aria-hidden="true">
              <img :src="foundIcon" alt="" />
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
.dashboard-hero {
  position: relative;
  border: none;
  border-radius: 1.1rem;
  background: linear-gradient(135deg, #00205b 0%, #173f8f 55%, #2f66c1 100%);
  color: #f9fbff;
  box-shadow: 0 20px 40px rgba(0, 32, 91, 0.28);
  overflow: hidden;
}

.dashboard-hero::after {
  content: '';
  position: absolute;
  inset: 0;
  background: radial-gradient(circle at 85% 15%, rgba(244, 209, 132, 0.38), transparent 60%);
  pointer-events: none;
}

.dashboard-hero--found {
  background: linear-gradient(135deg, #f4d184 0%, #c6952d 55%, #8c6d2f 100%);
  color: #1f1a12;
  box-shadow: 0 20px 42px rgba(140, 109, 47, 0.32);
}

.dashboard-hero--found::after {
  background: radial-gradient(circle at 20% 25%, rgba(0, 32, 91, 0.22), transparent 65%);
}

.dashboard-hero__eyebrow {
  text-transform: uppercase;
  letter-spacing: 0.18em;
  font-size: 0.78rem;
  font-weight: 600;
  opacity: 0.75;
  margin-bottom: 0.75rem;
}

.dashboard-hero__meta {
  font-size: 0.85rem;
  opacity: 0.85;
}

.dashboard-hero--found .dashboard-hero__eyebrow {
  color: rgba(0, 32, 91, 0.7);
  opacity: 1;
}

.dashboard-hero--found .dashboard-hero__meta {
  color: rgba(17, 26, 50, 0.8);
}

.dashboard-hero__icon {
  display: none;
  width: 90px;
  height: 90px;
  border-radius: 18px;
  align-items: center;
  justify-content: center;
  background: rgba(255, 255, 255, 0.15);
  box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.28);
}

.dashboard-hero__icon img {
  width: 68%;
  height: auto;
}

.dashboard-hero__icon--light img {
  filter: brightness(0) invert(1);
}

.dashboard-hero__icon--dark {
  background: rgba(0, 32, 91, 0.12);
  box-shadow: inset 0 0 0 1px rgba(0, 32, 91, 0.18);
}

.dashboard-hero__icon--dark img {
  filter: saturate(1.1) hue-rotate(-12deg);
}

@media (min-width: 576px) {
  .dashboard-hero__icon {
    display: inline-flex;
  }
}

.quick-links {
  display: flex;
  flex-direction: column;
  gap: 0.85rem;
}

.quick-link {
  display: grid;
  grid-template-columns: auto 1fr;
  gap: 1rem;
  align-items: center;
  padding: 16px 20px;
  border-radius: 1rem;
  border: 1px solid rgba(0, 32, 91, 0.14);
  background: rgba(255, 255, 255, 0.92);
  color: var(--text-body);
  box-shadow: 0 16px 30px rgba(0, 32, 91, 0.12);
  transition: transform var(--transition-medium) var(--transition-timing),
    box-shadow var(--transition-medium) var(--transition-timing),
    border-color var(--transition-medium) var(--transition-timing),
    background var(--transition-medium) var(--transition-timing);
}

.quick-link:hover,
.quick-link:focus-visible {
  transform: translateY(-4px);
  box-shadow: 0 22px 42px rgba(0, 32, 91, 0.18);
  border-color: rgba(0, 32, 91, 0.28);
  background: linear-gradient(135deg, rgba(244, 209, 132, 0.18), rgba(255, 255, 255, 0.95));
  text-decoration: none;
}

.quick-icon {
  width: 62px;
  height: 62px;
  font-size: 2rem;
  border-radius: 50%;
  background: rgba(0, 32, 91, 0.12);
  color: #00205b;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background var(--transition-medium) var(--transition-timing),
    color var(--transition-medium) var(--transition-timing),
    transform var(--transition-medium) var(--transition-timing);
}

.quick-link:hover .quick-icon,
.quick-link:focus-visible .quick-icon {
  background: linear-gradient(135deg, #00205b, #174a99);
  color: #f9fbff;
  transform: scale(1.05);
}

.link-label {
  font-weight: 700;
  color: #00205b;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  transition: color var(--transition-medium) var(--transition-timing);
}

.quick-link:hover .link-label,
.quick-link:focus-visible .link-label {
  color: #174a99;
}

.quick-description {
  color: rgba(17, 38, 79, 0.72);
}

html.dark .dashboard-hero {
  background: linear-gradient(135deg, rgba(0, 32, 91, 0.92) 0%, rgba(13, 49, 112, 0.92) 55%, rgba(32, 96, 182, 0.86) 100%);
  color: #f2f6ff;
  box-shadow: 0 20px 44px rgba(1, 12, 36, 0.65);
}

html.dark .dashboard-hero::after {
  background: radial-gradient(circle at 85% 15%, rgba(244, 209, 132, 0.28), transparent 60%);
}

html.dark .dashboard-hero--found {
  background: linear-gradient(135deg, rgba(198, 149, 45, 0.88) 0%, rgba(140, 109, 47, 0.92) 55%, rgba(84, 60, 22, 0.95) 100%);
  color: #fff7df;
  box-shadow: 0 20px 44px rgba(0, 0, 0, 0.5);
}

html.dark .dashboard-hero--found .dashboard-hero__eyebrow {
  color: rgba(255, 255, 255, 0.85);
}

html.dark .dashboard-hero--found .dashboard-hero__meta {
  color: rgba(255, 252, 244, 0.76);
}

html.dark .dashboard-hero__icon {
  background: rgba(255, 255, 255, 0.08);
  box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.18);
}

html.dark .dashboard-hero__icon--dark {
  background: rgba(0, 32, 91, 0.4);
  box-shadow: inset 0 0 0 1px rgba(0, 32, 91, 0.4);
}

html.dark .dashboard-hero__icon--dark img {
  filter: brightness(1.05) saturate(1.2);
}

html.dark .quick-link,
.dark .quick-link {
  background: rgba(4, 15, 38, 0.85);
  border-color: rgba(88, 119, 184, 0.32);
  box-shadow: 0 18px 36px rgba(1, 12, 36, 0.55);
}

html.dark .quick-link:hover,
.dark .quick-link:hover,
html.dark .quick-link:focus-visible,
.dark .quick-link:focus-visible {
  background: linear-gradient(135deg, rgba(0, 32, 91, 0.58), rgba(4, 15, 38, 0.92));
  border-color: rgba(140, 182, 255, 0.45);
}

html.dark .quick-icon,
.dark .quick-icon {
  background: rgba(140, 182, 255, 0.18);
  color: #dce6ff;
}

html.dark .quick-link:hover .quick-icon,
.dark .quick-link:hover .quick-icon,
html.dark .quick-link:focus-visible .quick-icon,
.dark .quick-link:focus-visible .quick-icon {
  background: linear-gradient(135deg, rgba(140, 182, 255, 0.6), rgba(0, 32, 91, 0.8));
}

html.dark .link-label,
.dark .link-label {
  color: #dce6ff;
}

html.dark .quick-link:hover .link-label,
.dark .quick-link:hover .link-label,
html.dark .quick-link:focus-visible .link-label,
.dark .quick-link:focus-visible .link-label {
  color: #f4d184;
}

html.dark .quick-description,
.dark .quick-description {
  color: rgba(224, 233, 255, 0.78);
}
</style>
