import httpClient from './httpClient'

/**
 * Fetch matches for a specific lost item
 * @param {string} lostItemId - UUID of the lost item
 * @returns {Promise<Array>} Array of matches with found item details
 */
export async function fetchMatchesForLostItem(lostItemId) {
  if (!lostItemId) {
    throw new Error('Lost item ID is required')
  }

  try {
    const response = await httpClient.get('/rest/v1/matches', {
      params: {
        lost_item_id: `eq.${lostItemId}`,
        select: `
          id,
          confidence_score,
          status,
          created_at,
          found_items (
            id,
            description,
            category,
            brand,
            model,
            color,
            location_found,
            status,
            image_metadata,
            date_found
          )
        `,
        order: 'confidence_score.desc'
      }
    })

    return response.data || []
  } catch (error) {
    console.error('Error fetching matches:', error)
    throw new Error(error.response?.data?.message || 'Failed to fetch matches')
  }
}

/**
 * Fetch all matches with pagination
 * @param {Object} options - Query options
 * @param {Object} options.filters - Filter parameters
 * @param {string} options.order - Sort order
 * @param {number} options.limit - Number of items per page
 * @param {number} options.offset - Offset for pagination
 * @returns {Promise<{data: Array, count: number}>}
 */
export async function fetchMatches({ filters = {}, order = 'created_at.desc', limit = 10, offset = 0 } = {}) {
  try {
    const params = {
      select: `
        id,
        confidence_score,
        status,
        created_at,
        lost_items (
          id,
          description,
          category,
          brand,
          model
        ),
        found_items (
          id,
          description,
          category,
          brand,
          model
        )
      `,
      order,
      limit,
      offset,
      ...filters
    }

    const response = await httpClient.get('/rest/v1/matches', { params })
    const count = response.headers['content-range']?.split('/')[1] || 0

    return {
      data: response.data || [],
      count: parseInt(count, 10)
    }
  } catch (error) {
    console.error('Error fetching matches:', error)
    throw new Error(error.response?.data?.message || 'Failed to fetch matches')
  }
}

/**
 * Update match status (confirm/reject)
 * @param {string} matchId - UUID of the match
 * @param {string} status - New status ('confirmed' or 'rejected')
 * @returns {Promise<Object>}
 */
export async function updateMatchStatus(matchId, status) {
  if (!matchId || !status) {
    throw new Error('Match ID and status are required')
  }

  if (!['confirmed', 'rejected', 'pending'].includes(status)) {
    throw new Error('Invalid status. Must be one of: confirmed, rejected, pending')
  }

  try {
    const response = await httpClient.patch(
      `/rest/v1/matches?id=eq.${matchId}`,
      { status },
      {
        headers: {
          Prefer: 'return=representation'
        }
      }
    )

    return response.data?.[0] || {}
  } catch (error) {
    console.error('Error updating match status:', error)
    throw new Error(error.response?.data?.message || 'Failed to update match status')
  }
}
