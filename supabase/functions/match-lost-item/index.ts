// Supabase Edge Function for AI-powered Lost & Found Matching
// This function compares a newly reported lost item against all found items using Google Cloud Vision API

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4'

// Google Cloud Vision API types
interface ImageAnnotation {
  webDetection?: {
    webEntities?: Array<{ description: string; score: number }>
    visuallySimilarImages?: Array<{ url: string; score: number }>
  }
  labelAnnotations?: Array<{ description: string; score: number }>
  imagePropertiesAnnotation?: {
    dominantColors?: {
      colors: Array<{
        color: { red: number; green: number; blue: number }
        score: number
        pixelFraction: number
      }>
    }
  }
}

interface VisionApiResponse {
  responses: ImageAnnotation[]
}

interface ImageMetadata {
  path: string
  original_filename?: string
  bucket_id?: string
  mime_type?: string
  size?: number
}

interface LostItem {
  id: string
  user_id: string
  category: string
  brand?: string
  model?: string
  color?: string
  description: string
  date_lost?: string
  location_lost?: string
  image_metadata: ImageMetadata[]
  matching_status?: string
}

interface FoundItem {
  id: string
  category: string
  brand?: string
  model?: string
  color?: string
  description: string
  date_found?: string
  location_found?: string
  image_metadata: ImageMetadata[]
}

interface Match {
  lost_item_id: string
  found_item_id: string
  confidence_score: number
  status: string
}

// Analyze image using Google Cloud Vision API
async function analyzeImage(
  imageUrl: string,
  visionApiKey: string
): Promise<ImageAnnotation> {
  const visionApiUrl = `https://vision.googleapis.com/v1/images:annotate?key=${visionApiKey}`

  const requestBody = {
    requests: [
      {
        image: { source: { imageUri: imageUrl } },
        features: [
          { type: 'WEB_DETECTION', maxResults: 20 },
          { type: 'LABEL_DETECTION', maxResults: 20 },
          { type: 'IMAGE_PROPERTIES', maxResults: 10 },
        ],
      },
    ],
  }

  const response = await fetch(visionApiUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(requestBody),
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Vision API error: ${response.status} - ${error}`)
  }

  const data: VisionApiResponse = await response.json()
  return data.responses[0] || {}
}

// Calculate similarity between two images based on their Vision API analysis
function calculateImageSimilarity(
  lostAnnotation: ImageAnnotation,
  foundAnnotation: ImageAnnotation
): number {
  let totalScore = 0
  let weights = 0

  // Compare web entities (objects detected in the image)
  const lostEntities = lostAnnotation.webDetection?.webEntities || []
  const foundEntities = foundAnnotation.webDetection?.webEntities || []

  if (lostEntities.length > 0 && foundEntities.length > 0) {
    const lostSet = new Set(lostEntities.map((e) => e.description?.toLowerCase()))
    const foundSet = new Set(foundEntities.map((e) => e.description?.toLowerCase()))
    const intersection = [...lostSet].filter((x) => foundSet.has(x)).length
    const union = new Set([...lostSet, ...foundSet]).size
    const entityScore = union > 0 ? intersection / union : 0
    totalScore += entityScore * 0.4
    weights += 0.4
  }

  // Compare labels
  const lostLabels = lostAnnotation.labelAnnotations || []
  const foundLabels = foundAnnotation.labelAnnotations || []

  if (lostLabels.length > 0 && foundLabels.length > 0) {
    const lostLabelSet = new Set(lostLabels.map((l) => l.description?.toLowerCase()))
    const foundLabelSet = new Set(foundLabels.map((l) => l.description?.toLowerCase()))
    const labelIntersection = [...lostLabelSet].filter((x) => foundLabelSet.has(x)).length
    const labelUnion = new Set([...lostLabelSet, ...foundLabelSet]).size
    const labelScore = labelUnion > 0 ? labelIntersection / labelUnion : 0
    totalScore += labelScore * 0.4
    weights += 0.4
  }

  // Compare dominant colors
  const lostColors = lostAnnotation.imagePropertiesAnnotation?.dominantColors?.colors || []
  const foundColors = foundAnnotation.imagePropertiesAnnotation?.dominantColors?.colors || []

  if (lostColors.length > 0 && foundColors.length > 0) {
    // Get top 3 dominant colors from each
    const topLostColors = lostColors.slice(0, 3)
    const topFoundColors = foundColors.slice(0, 3)

    let colorSimilarity = 0
    for (const lostColor of topLostColors) {
      for (const foundColor of topFoundColors) {
        const rDiff = Math.abs((lostColor.color.red || 0) - (foundColor.color.red || 0))
        const gDiff = Math.abs((lostColor.color.green || 0) - (foundColor.color.green || 0))
        const bDiff = Math.abs((lostColor.color.blue || 0) - (foundColor.color.blue || 0))
        const colorDistance = Math.sqrt(rDiff ** 2 + gDiff ** 2 + bDiff ** 2)
        const maxDistance = Math.sqrt(255 ** 2 + 255 ** 2 + 255 ** 2)
        const similarity = 1 - colorDistance / maxDistance
        colorSimilarity = Math.max(colorSimilarity, similarity)
      }
    }
    totalScore += colorSimilarity * 0.2
    weights += 0.2
  }

  return weights > 0 ? totalScore / weights : 0
}

// Calculate days between two dates
function daysBetween(date1: Date, date2: Date): number {
  const msPerDay = 1000 * 60 * 60 * 24
  const utc1 = Date.UTC(date1.getFullYear(), date1.getMonth(), date1.getDate())
  const utc2 = Date.UTC(date2.getFullYear(), date2.getMonth(), date2.getDate())
  return Math.abs(Math.floor((utc2 - utc1) / msPerDay))
}

// Calculate location similarity (simple string matching)
function calculateLocationSimilarity(location1: string, location2: string): number {
  if (!location1 || !location2) return 0

  const loc1 = location1.toLowerCase().trim()
  const loc2 = location2.toLowerCase().trim()

  // Exact match
  if (loc1 === loc2) return 1.0

  // One contains the other
  if (loc1.includes(loc2) || loc2.includes(loc1)) return 0.7

  // Check for common words (building names, floor numbers, etc.)
  const words1 = loc1.split(/\s+/)
  const words2 = loc2.split(/\s+/)
  const commonWords = words1.filter(w => w.length > 2 && words2.includes(w))

  if (commonWords.length > 0) {
    return Math.min(0.5, commonWords.length * 0.2)
  }

  return 0
}

// Calculate text-based similarity between metadata
function calculateMetadataSimilarity(lostItem: LostItem, foundItem: FoundItem): number {
  // Use weighted scoring with emphasis on time, location, and unique identifiers
  let totalScore = 0
  const weights = {
    dateProximity: 4.0,   // MOST IMPORTANT - items lost and found around same time
    location: 3.5,        // VERY IMPORTANT - items lost and found in same area
    model: 2.5,          // Important - identifies the specific item type
    category: 2.0,       // Important - but many items share categories
    color: 1.0,          // Supporting evidence
    brand: 0.3,          // MINIMAL - many items share brands (Apple, Samsung, etc.)
  }
  let totalWeight = 0

  // Date proximity (CRITICAL - if dates are far apart, unlikely to be same item)
  if (lostItem.date_lost && foundItem.date_found) {
    try {
      const lostDate = new Date(lostItem.date_lost)
      const foundDate = new Date(foundItem.date_found)
      const daysDiff = daysBetween(lostDate, foundDate)

      let dateScore = 0
      if (daysDiff === 0) {
        dateScore = 1.0  // Same day - very likely
      } else if (daysDiff === 1) {
        dateScore = 0.9  // Next day - still very likely
      } else if (daysDiff <= 3) {
        dateScore = 0.7  // Within 3 days - possible
      } else if (daysDiff <= 7) {
        dateScore = 0.4  // Within a week - less likely
      } else if (daysDiff <= 14) {
        dateScore = 0.2  // Within 2 weeks - unlikely
      } else {
        dateScore = 0.05 // More than 2 weeks - very unlikely
      }

      totalScore += weights.dateProximity * dateScore
      totalWeight += weights.dateProximity
    } catch (e) {
      console.error('Error parsing dates:', e)
    }
  }

  // Location proximity (VERY IMPORTANT)
  if (lostItem.location_lost && foundItem.location_found) {
    const locationScore = calculateLocationSimilarity(
      lostItem.location_lost,
      foundItem.location_found
    )
    totalScore += weights.location * locationScore
    totalWeight += weights.location
  }

  // Model match (identifies the specific item type)
  if (lostItem.model && foundItem.model) {
    const lostModelLower = lostItem.model.toLowerCase()
    const foundModelLower = foundItem.model.toLowerCase()

    if (lostModelLower === foundModelLower) {
      totalScore += weights.model * 1.0
    } else if (
      lostModelLower.includes(foundModelLower) ||
      foundModelLower.includes(lostModelLower)
    ) {
      totalScore += weights.model * 0.6
    }
    totalWeight += weights.model
  }

  // Category match
  if (lostItem.category && foundItem.category) {
    if (lostItem.category.toLowerCase() === foundItem.category.toLowerCase()) {
      totalScore += weights.category * 1.0
    }
    totalWeight += weights.category
  }

  // Color match (supporting evidence)
  if (lostItem.color && foundItem.color) {
    const lostColorLower = lostItem.color.toLowerCase()
    const foundColorLower = foundItem.color.toLowerCase()

    if (lostColorLower === foundColorLower) {
      totalScore += weights.color * 1.0
    } else if (
      lostColorLower.includes(foundColorLower) ||
      foundColorLower.includes(lostColorLower)
    ) {
      totalScore += weights.color * 0.5
    }
    totalWeight += weights.color
  }

  // Brand match (MINIMAL weight - many items share brands)
  if (lostItem.brand && foundItem.brand) {
    const lostBrandLower = lostItem.brand.toLowerCase()
    const foundBrandLower = foundItem.brand.toLowerCase()

    if (lostBrandLower === foundBrandLower) {
      totalScore += weights.brand * 1.0
    } else if (
      lostBrandLower.includes(foundBrandLower) ||
      foundBrandLower.includes(lostBrandLower)
    ) {
      totalScore += weights.brand * 0.5
    }
    totalWeight += weights.brand
  }

  // Return normalized score (0-1 range)
  return totalWeight > 0 ? totalScore / totalWeight : 0
}

serve(async (req) => {
  try {
    // Only allow POST requests
    if (req.method !== 'POST') {
      return new Response(JSON.stringify({ error: 'Method not allowed' }), {
        status: 405,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    // Parse request body
    const { lostItemId } = await req.json()

    if (!lostItemId) {
      return new Response(JSON.stringify({ error: 'lostItemId is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    // Get environment variables
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const visionCredentials = Deno.env.get('GOOGLE_CLOUD_VISION_CREDENTIALS')

    if (!visionCredentials) {
      throw new Error('Google Cloud Vision credentials not configured')
    }

    // Parse Vision API credentials to get the API key or use service account
    const credentials = JSON.parse(visionCredentials)

    // For this implementation, we'll use the Vision API with a service account
    // In production, you should use proper OAuth2 authentication
    // For now, we'll construct a simple API key or use the service account
    // Note: You may need to enable the Vision API and create an API key in Google Cloud Console
    const visionApiKey = Deno.env.get('GOOGLE_CLOUD_VISION_API_KEY')

    if (!visionApiKey) {
      console.warn('GOOGLE_CLOUD_VISION_API_KEY not set. Image matching will be limited.')
    }

    // Create Supabase client
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Update matching status to 'processing'
    await supabase
      .from('lost_items')
      .update({ matching_status: 'processing' })
      .eq('id', lostItemId)

    // Fetch the lost item with date and location
    const { data: lostItem, error: lostError } = await supabase
      .from('lost_items')
      .select('id,user_id,category,brand,model,color,description,date_lost,location_lost,image_metadata,matching_status')
      .eq('id', lostItemId)
      .single()

    if (lostError || !lostItem) {
      throw new Error(`Failed to fetch lost item: ${lostError?.message}`)
    }

    const lostItemTyped = lostItem as LostItem

    // Check if lost item has images
    if (!lostItemTyped.image_metadata || lostItemTyped.image_metadata.length === 0) {
      console.log('No images found for lost item, skipping matching')
      await supabase
        .from('lost_items')
        .update({ matching_status: 'completed' })
        .eq('id', lostItemId)

      return new Response(
        JSON.stringify({ message: 'No images to match', matches: [] }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      )
    }

    // Fetch all found items with images and location/date (any status except 'claimed')
    const { data: foundItems, error: foundError } = await supabase
      .from('found_items')
      .select('id,category,brand,model,color,description,date_found,location_found,image_metadata,status')
      .neq('status', 'claimed')
      .not('image_metadata', 'eq', '[]')

    if (foundError) {
      throw new Error(`Failed to fetch found items: ${foundError.message}`)
    }

    const foundItemsTyped = (foundItems || []) as FoundItem[]

    if (foundItemsTyped.length === 0) {
      console.log('No found items with images to compare against')
      await supabase
        .from('lost_items')
        .update({ matching_status: 'completed' })
        .eq('id', lostItemId)

      return new Response(
        JSON.stringify({ message: 'No found items to match', matches: [] }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      )
    }

    console.log(`Matching lost item ${lostItemId} against ${foundItemsTyped.length} found items`)

    // Get the first image from lost item for comparison
    const lostImagePath = lostItemTyped.image_metadata[0].path
    const lostImageUrl = `${supabaseUrl}/storage/v1/object/public/item-images/${lostImagePath}`

    // Analyze lost item image (only if Vision API key is available)
    let lostAnnotation: ImageAnnotation = {}
    if (visionApiKey) {
      try {
        lostAnnotation = await analyzeImage(lostImageUrl, visionApiKey)
        console.log('Lost item image analyzed successfully')
      } catch (error) {
        console.error('Failed to analyze lost item image:', error)
      }
    }

    // Compare against all found items
    const matches: Array<{ foundItem: FoundItem; score: number }> = []

    for (const foundItem of foundItemsTyped) {
      if (!foundItem.image_metadata || foundItem.image_metadata.length === 0) {
        continue
      }

      // Calculate metadata similarity (always available)
      const metadataScore = calculateMetadataSimilarity(lostItemTyped, foundItem)

      let imageScore = 0
      if (visionApiKey && Object.keys(lostAnnotation).length > 0) {
        // Get first image from found item
        const foundImagePath = foundItem.image_metadata[0].path
        const foundImageUrl = `${supabaseUrl}/storage/v1/object/public/item-images/${foundImagePath}`

        try {
          const foundAnnotation = await analyzeImage(foundImageUrl, visionApiKey)
          imageScore = calculateImageSimilarity(lostAnnotation, foundAnnotation)
        } catch (error) {
          console.error(`Failed to analyze found item ${foundItem.id}:`, error)
        }
      }

      // Weighted combination: 60% image similarity, 40% metadata similarity
      const finalScore = visionApiKey
        ? imageScore * 0.6 + metadataScore * 0.4
        : metadataScore

      // IMPORTANT: If models are provided and completely different, this is likely not a match
      // Require at least 40% similarity for matches to be considered
      const hasModelMismatch = lostItemTyped.model && foundItem.model &&
        !lostItemTyped.model.toLowerCase().includes(foundItem.model.toLowerCase()) &&
        !foundItem.model.toLowerCase().includes(lostItemTyped.model.toLowerCase())

      // Increase threshold to 40% and reject if models completely mismatch
      if (finalScore > 0.4 && !hasModelMismatch) {
        matches.push({ foundItem, score: finalScore })
      } else if (finalScore > 0.6 && hasModelMismatch) {
        // Only include model mismatches if they have VERY high confidence (60%+)
        // This handles cases where model names might be entered differently
        matches.push({ foundItem, score: finalScore })
      }
    }

    // Sort by score descending and take top 5
    matches.sort((a, b) => b.score - a.score)
    const topMatches = matches.slice(0, 5)

    console.log(`Found ${topMatches.length} potential matches`)

    // Insert matches into database
    const matchRecords: Match[] = topMatches.map((match) => ({
      lost_item_id: lostItemId,
      found_item_id: match.foundItem.id,
      confidence_score: parseFloat(match.score.toFixed(2)),
      status: 'pending',
    }))

    if (matchRecords.length > 0) {
      const { error: insertError } = await supabase.from('matches').insert(matchRecords)

      if (insertError) {
        console.error('Failed to insert matches:', insertError)
        throw new Error(`Failed to insert matches: ${insertError.message}`)
      }
    }

    // Update matching status to 'completed'
    await supabase
      .from('lost_items')
      .update({ matching_status: 'completed' })
      .eq('id', lostItemId)

    return new Response(
      JSON.stringify({
        message: 'Matching completed successfully',
        matchesFound: topMatches.length,
        matches: matchRecords,
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }
    )
  } catch (error) {
    console.error('Error in matching service:', error)

    // Try to update status to failed if we have the lost item ID
    try {
      const { lostItemId } = await req.json()
      if (lostItemId) {
        const supabaseUrl = Deno.env.get('SUPABASE_URL')!
        const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
        const supabase = createClient(supabaseUrl, supabaseServiceKey)

        await supabase
          .from('lost_items')
          .update({ matching_status: 'failed' })
          .eq('id', lostItemId)
      }
    } catch (updateError) {
      console.error('Failed to update error status:', updateError)
    }

    return new Response(
      JSON.stringify({
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error',
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    )
  }
})
