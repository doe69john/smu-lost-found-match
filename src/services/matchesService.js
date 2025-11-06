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
    // First, fetch the matches
    const matchesResponse = await httpClient.get('/rest/v1/matches', {
      params: {
        lost_item_id: `eq.${lostItemId}`,
        select: 'id,confidence_score,status,created_at,found_item_id',
        order: 'confidence_score.desc'
      }
    })

    const matches = matchesResponse.data || []

    if (matches.length === 0) {
      return []
    }

    // Extract found_item_ids
    const foundItemIds = matches.map(m => m.found_item_id).filter(Boolean)

    if (foundItemIds.length === 0) {
      return matches
    }

    // Fetch the found items in one query with security office details
    const foundItemsResponse = await httpClient.get('/rest/v1/found_items', {
      params: {
        id: `in.(${foundItemIds.join(',')})`,
        select: 'id,description,category,brand,model,color,location_found,status,image_metadata,date_found,drop_off_office_id,security_offices:drop_off_office_id(id,name,location)'
      }
    })

    const foundItemsMap = {}
    foundItemsResponse.data.forEach(item => {
      foundItemsMap[item.id] = item
    })

    // Merge found items data into matches
    const enrichedMatches = matches.map(match => ({
      ...match,
      found_items: foundItemsMap[match.found_item_id] || null
    }))

    console.log('Enriched matches:', enrichedMatches)
    console.log('First enriched match:', enrichedMatches[0])

    return enrichedMatches
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
    // First, update the match status
    const matchResponse = await httpClient.patch(
      `/rest/v1/matches?id=eq.${matchId}`,
      { status },
      {
        headers: {
          Prefer: 'return=representation'
        }
      }
    )

    const match = matchResponse.data?.[0] || {}

    // If confirming the match, also update the lost and found items to 'claimed'
    if (status === 'confirmed' && match.lost_item_id && match.found_item_id) {
      console.log('Updating lost item status to claimed:', match.lost_item_id)

      // Update lost item status to 'claimed'
      const lostItemResponse = await httpClient.patch(
        `/rest/v1/lost_items?id=eq.${match.lost_item_id}`,
        { status: 'claimed' }
      )
      console.log('Lost item update response:', lostItemResponse.data)

      console.log('Updating found item status to claimed:', match.found_item_id)

      // Update found item status to 'claimed'
      const foundItemResponse = await httpClient.patch(
        `/rest/v1/found_items?id=eq.${match.found_item_id}`,
        { status: 'claimed' }
      )
      console.log('Found item update response:', foundItemResponse.data)
    }

    return match
  } catch (error) {
    console.error('Error updating match status:', error)
    throw new Error(error.response?.data?.message || 'Failed to update match status')
  }
}
