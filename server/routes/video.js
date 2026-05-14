const express = require('express')
const router = express.Router()
const multer = require('multer')
const path = require('path')
const fs = require('fs')
const FormData = require('form-data')
const axios = require('axios')
const ffmpeg = require('fluent-ffmpeg')
// Try to detect ffmpeg/ffprobe binary locations and configure fluent-ffmpeg.
let ffmpegAvailable = true
try {
  const which = require('which')
  const ffmpegPath = which.sync('ffmpeg')
  const ffprobePath = which.sync('ffprobe')
  ffmpeg.setFfmpegPath(ffmpegPath)
  ffmpeg.setFfprobePath(ffprobePath)
  console.log('ffmpeg detected at:', ffmpegPath)
} catch (err) {
  ffmpegAvailable = false
  console.warn('ffmpeg/ffprobe not detected on the server. Video processing features (compression, screenshots) will be disabled. Please install ffmpeg. See https://ffmpeg.org/download.html')
}
const mongoose = require('mongoose')
const authMiddleware = require('../middleware/auth')
const { resolveFiltersFromProductData } = require('../services/filterMatchingService')
const Filter = require('../models/Filter')
const Category = require('../models/Category')
const CategoryFilter = require('../models/CategoryFilter')

// Configure multer for video uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadPath = path.join(__dirname, '../uploads/videos/temp')
    if (!fs.existsSync(uploadPath)) {
      fs.mkdirSync(uploadPath, { recursive: true })
    }
    cb(null, uploadPath)
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9)
    cb(null, `video-${uniqueSuffix}${path.extname(file.originalname)}`)
  }
})

const upload = multer({
  storage: storage,
  limits: { fileSize: 500 * 1024 * 1024 }, // 500MB
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('video/')) {
      cb(null, true)
    } else {
      cb(new Error('Only video files are allowed'))
    }
  }
})

// Helper function to transcribe video using OpenAI Whisper API
async function transcribeVideo(videoPath) {
  try {
    // const apiKey = process.env.OPENAI_API_KEY
    const apiKey ="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"
    if (!apiKey) {
      throw new Error('OpenAI API key not configured. Please set OPENAI_API_KEY in your .env file')
    }

    console.log('Reading video file from:', videoPath)
    console.log('Video file exists:', fs.existsSync(videoPath))
    if (fs.existsSync(videoPath)) {
      const stats = fs.statSync(videoPath)
      console.log('Video file size:', stats.size, 'bytes')
    }

    // Read the video file
    const videoFile = fs.createReadStream(videoPath)
    
    // Create form data for OpenAI API
    const formData = new FormData()
    formData.append('file', videoFile)
    formData.append('model', 'whisper-1')
    formData.append('language', 'en') // Optional: specify language

    console.log('Sending request to OpenAI Whisper API...')
    // Call OpenAI Whisper API
    const response = await axios.post(
      'https://api.openai.com/v1/audio/transcriptions',
      formData,
      {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          ...formData.getHeaders()
        },
        maxContentLength: Infinity,
        maxBodyLength: Infinity,
        timeout: 300000 // 5 minutes timeout for large videos
      }
    )

    console.log('OpenAI API response status:', response.status)
    const transcript = response.data.text
    console.log('Transcript received, length:', transcript ? transcript.length : 0)
    
    if (!transcript || transcript.trim() === '') {
      console.warn('Warning: Transcript is empty')
    }
    
    return transcript || ''
  } catch (error) {
    console.error('Error transcribing video:', error)
    if (error.response) {
      console.error('OpenAI API error response:', error.response.data)
      throw new Error(`OpenAI API error: ${error.response.data.error?.message || error.message}`)
    }
    if (error.code === 'ECONNABORTED') {
      throw new Error('Request timeout - video file may be too large')
    }
    throw error
  }
}

// Helper function to extract screenshots from video
async function extractScreenshots(videoPath, outputDir) {
  return new Promise((resolve, reject) => {
    if (!ffmpegAvailable) {
      const msg = 'ffmpeg/ffprobe not available on server; cannot extract screenshots. Install ffmpeg to enable this feature.'
      console.error(msg)
      return reject(new Error(msg))
    }
    const screenshots = []
    const screenshotCount = 5 // Extract 5 screenshots evenly spaced throughout the video
    
    // Get video duration first
    ffmpeg.ffprobe(videoPath, (err, metadata) => {
      if (err) {
        console.error('Error getting video metadata:', err)
        return reject(err)
      }
      
      const duration = metadata.format.duration || 10 // Default to 10 seconds if duration unknown
      const interval = duration / (screenshotCount + 1) // Space screenshots evenly
      
      let completed = 0
      const screenshotPromises = []
      
      for (let i = 1; i <= screenshotCount; i++) {
        const timestamp = interval * i
        const screenshotPath = path.join(outputDir, `screenshot-${i}-${Date.now()}.jpg`)
        
        const promise = new Promise((resolveScreenshot, rejectScreenshot) => {
          ffmpeg(videoPath)
            .screenshots({
              timestamps: [timestamp],
              filename: path.basename(screenshotPath),
              folder: outputDir,
              size: '1280x720' // Standard HD size
            })
            .on('end', () => {
              screenshots.push({
                path: screenshotPath,
                url: `/uploads/videos/screenshots/${path.basename(screenshotPath)}`,
                timestamp: timestamp
              })
              completed++
              resolveScreenshot()
            })
            .on('error', (err) => {
              console.error(`Error extracting screenshot ${i}:`, err)
              completed++
              // Don't reject, just skip this screenshot
              resolveScreenshot()
            })
        })
        
        screenshotPromises.push(promise)
      }
      
      Promise.all(screenshotPromises).then(() => {
        resolve(screenshots)
      }).catch(reject)
    })
  })
}

/**
 * Fetch filters for the selected category scope from the database.
 * Returns an array of root filters with their children/options populated.
 */
async function fetchCategoryFiltersFromDB(categoryId, subcategoryId, childCategoryId) {
  const scopeId = childCategoryId || subcategoryId || categoryId
  if (!scopeId || !mongoose.Types.ObjectId.isValid(String(scopeId))) return []

  try {
    const selectedLevelObjId = new mongoose.Types.ObjectId(String(scopeId))
    const scopedCategories = await Category.find({
      isDeleted: false,
      $or: [{ _id: selectedLevelObjId }, { path: selectedLevelObjId }],
    }).select('_id').lean()
    const scopedCategoryIds = scopedCategories.map((c) => c._id)

    const links = await CategoryFilter.find({ categoryId: { $in: scopedCategoryIds } })
      .select('filterId').lean()
    if (!links.length) return []

    const linkedFilterIds = [...new Set(links.map((l) => String(l.filterId)))]
    const allFilters = await Filter.find({
      isDeleted: false,
      $or: [
        { _id: { $in: linkedFilterIds.map((id) => new mongoose.Types.ObjectId(id)) } },
        { parentId: { $in: linkedFilterIds.map((id) => new mongoose.Types.ObjectId(id)) } },
      ],
    }).lean()

    const byId = new Map(allFilters.map((f) => [String(f._id), f]))
    const childrenByParent = new Map()
    allFilters.forEach((f) => {
      const pid = f.parentId ? String(f.parentId) : null
      if (!childrenByParent.has(pid)) childrenByParent.set(pid, [])
      childrenByParent.get(pid).push(f)
    })

    const roots = allFilters.filter((f) => linkedFilterIds.includes(String(f._id)) && !f.parentId)

    return roots.map((root) => {
      const rootId = String(root._id)
      const children = childrenByParent.get(rootId) || []
      const explicitOptions = Array.isArray(root.options) ? root.options.filter(Boolean) : []
      return {
        _id: rootId,
        name: root.name,
        slug: root.slug,
        options: explicitOptions,
        children: children.map((c) => ({
          _id: String(c._id),
          name: c.name,
          slug: c.slug,
          children: (childrenByParent.get(String(c._id)) || []).map((gc) => ({
            _id: String(gc._id),
            name: gc.name,
            slug: gc.slug,
          })),
        })),
      }
    })
  } catch (err) {
    console.error('[Transcribe] Error fetching category filters from DB:', err)
    return []
  }
}

/**
 * Build the category-specific filter section for the GPT prompt.
 * Tells GPT exactly which filter values to look for based on the DB.
 */
function buildFilterPromptSection(dbFilters) {
  if (!dbFilters || !dbFilters.length) return ''

  const lines = ['\n\nCATEGORY-SPECIFIC FILTERS (extract values matching these filters from the transcript):']
  for (const filter of dbFilters) {
    if (filter.options && filter.options.length) {
      lines.push(`- filter_${filter.slug}: Pick EXACTLY one of: ${JSON.stringify(filter.options)}`)
    } else if (filter.children && filter.children.length) {
      const childNames = filter.children.map((c) => c.name)
      lines.push(`- filter_${filter.slug}: Pick EXACTLY one of: ${JSON.stringify(childNames)}`)
      for (const child of filter.children) {
        if (child.children && child.children.length) {
          const gcNames = child.children.map((gc) => gc.name)
          lines.push(`  - If "${child.name}" is selected, also pick sub-value from: ${JSON.stringify(gcNames)}`)
        }
      }
    }
  }
  lines.push('\nFor each category filter above, return a key like "filter_<slug>" with the matched value.')
  lines.push('If the transcript does not mention information for a filter, omit that key.\n')
  return lines.join('\n')
}

// Helper function to extract structured data from transcript using GPT
async function extractDataFromTranscript(transcript, category, subcategory, dbFilters) {
  try {
    const apiKey = "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"
    if (!apiKey) {
      throw new Error('OpenAI API key not configured')
    }

    const filterSection = buildFilterPromptSection(dbFilters)

    const prompt = `You are an expert at extracting product information from video descriptions. 
Analyze the following transcript from a product video and extract relevant information.

Transcript: "${transcript}"

Category: ${category || 'Not specified'}
Subcategory: ${subcategory || 'Not specified'}

IMPORTANT EXTRACTION RULES:
1. Extract currency from the transcript (USD, AED, EUR, GBP, INR, etc.). If no currency mentioned, default to "USD"
2. Extract price as a NUMBER ONLY (no commas, no currency symbols)
3. For condition, match EXACTLY one of these values: "Brand New", "Like New", "Good", "Fair", "Poor"
   - Map similar terms: "new" -> "Brand New", "excellent" -> "Like New", "used" -> "Good", "worn" -> "Fair", "damaged" -> "Poor"
4. For brand, extract the exact brand name as mentioned
5. Extract all other fields exactly as mentioned in the transcript

Extract the following information if mentioned:
- title: Product name/title (10-100 characters, make it compelling and descriptive)
- description: Detailed product description (30-2500 characters, be comprehensive)
- price: Price as a NUMBER ONLY (extract the numeric value)
- currency: Currency code (USD, AED, EUR, GBP, INR, SAR, etc.) - extract from transcript or default to "USD"
- condition: EXACTLY one of: "Brand New", "Like New", "Good", "Fair", "Poor" (map similar terms)
- brand: Brand name exactly as mentioned
- color: Color name exactly as mentioned
- material: Material exactly as mentioned
- model: Model number/name exactly as mentioned
- year: Year as a number (for vehicles, electronics, etc.)
- mileage: Mileage as a number (for vehicles)
- country: Country exactly as mentioned in the transcript
- city: City exactly as mentioned in the transcript
- area: Locality / area / neighborhood exactly as mentioned in the transcript
- purchaseYear: The year the item was purchased (as a number)
- usageDuration: If mentioned, return an object like { "value": <number>, "unit": "months"|"years" }
- reasonForSelling: Reason for selling / selling motivation (string)
- storageCapacity: Storage capacity exactly as mentioned (e.g., "256GB", "512GB", "1TB")
- size: Size exactly as mentioned (for clothing, furniture, etc.)
- make: Make/manufacturer if mentioned (for vehicles)
- warranty: Warranty information if mentioned
- any other relevant product details
${filterSection}
Return ONLY a valid JSON object with the extracted fields. If a field is not mentioned, omit it or set to null.
Example format:
{
  "title": "iPhone 13 Pro Max 256GB",
  "description": "Excellent condition iPhone 13 Pro Max with 256GB storage. Barely used, comes with original box and charger...",
  "price": 800,
  "currency": "AED",
  "condition": "Like New",
  "brand": "Apple",
  "color": "Graphite",
  "model": "A2483",
  "storageCapacity": "256GB"
}`

    const response = await axios.post(
      'https://api.openai.com/v1/chat/completions',
      {
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: 'You are a helpful assistant that extracts structured product information from video transcripts. Always return valid JSON only.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.3,
        max_tokens: 1500
      },
      {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        }
      }
    )

    const content = response.data.choices[0].message.content.trim()
    
    // Extract JSON from response (handle cases where GPT adds markdown formatting)
    let jsonStr = content
    if (content.startsWith('```json')) {
      jsonStr = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
    } else if (content.startsWith('```')) {
      jsonStr = content.replace(/```\n?/g, '').trim()
    }

    const extractedData = JSON.parse(jsonStr)
    return extractedData
  } catch (error) {
    console.error('Error extracting data from transcript:', error)
    if (error.response) {
      throw new Error(`OpenAI API error: ${error.response.data.error?.message || error.message}`)
    }
    throw error
  }
}

/**
 * Match GPT-extracted filter_* values back to actual DB filter IDs.
 * Returns { filterSelections: { filter_<slug>: id }, filterData: { slug: { filterId, value } } }
 */
function matchExtractedFiltersToDBIds(extractedData, dbFilters) {
  const filterSelections = {}
  const filterData = {}
  if (!extractedData || !dbFilters || !dbFilters.length) return { filterSelections, filterData }

  const normalize = (s) => String(s || '').trim().toLowerCase().replace(/[\s\-_]+/g, ' ')

  for (const filter of dbFilters) {
    const key = `filter_${filter.slug}`
    const rawVal = extractedData[key]
    if (!rawVal) continue

    const normalizedVal = normalize(rawVal)

    // Explicit options: match against root.options
    if (filter.options && filter.options.length) {
      const match = filter.options.find((opt) => normalize(opt) === normalizedVal)
      if (match) {
        filterSelections[key] = match
        filterData[filter.slug] = { value: match }
        console.log(`[Transcribe] Matched filter ${filter.name}: "${match}" (explicit option)`)
      }
      continue
    }

    // Cascade children: match against child names
    if (filter.children && filter.children.length) {
      const matchedChild = filter.children.find((c) => normalize(c.name) === normalizedVal)
      if (matchedChild) {
        filterSelections[key] = matchedChild._id
        filterData[filter.slug] = { filterId: matchedChild._id, value: matchedChild.name }
        console.log(`[Transcribe] Matched filter ${filter.name}: "${matchedChild.name}" (child ID: ${matchedChild._id})`)

        // Also check grandchildren if GPT extracted a sub-value
        const subKey = `filter_${filter.slug}_sub`
        const subVal = extractedData[subKey]
        if (subVal && matchedChild.children && matchedChild.children.length) {
          const matchedGC = matchedChild.children.find((gc) => normalize(gc.name) === normalize(subVal))
          if (matchedGC) {
            filterSelections[key] = matchedGC._id
            filterData[filter.slug] = { filterId: matchedGC._id, value: matchedGC.name, parentId: matchedChild._id }
          }
        }
      }
    }
  }

  return { filterSelections, filterData }
}

// @route   POST /api/video/transcribe
// @desc    Upload video, transcribe it, and extract product information
// @access  Private
router.post('/transcribe', authMiddleware, upload.single('video'), async (req, res) => {
  let videoPath = null
  
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No video file uploaded' })
    }

    videoPath = req.file.path
    const { category, subcategory, categoryId, subcategoryId, childCategoryId } = req.body

    // Step 1: Validate selected categories exist in the database
    let validatedCategory = null
    let validatedSubcategory = null
    if (categoryId && mongoose.Types.ObjectId.isValid(categoryId)) {
      validatedCategory = await Category.findOne({ _id: categoryId, isDeleted: false }).select('_id name slug').lean()
      if (!validatedCategory) {
        console.warn(`[Transcribe] Category ${categoryId} not found in DB`)
      } else {
        console.log(`[Transcribe] Validated category: ${validatedCategory.name} (${validatedCategory._id})`)
      }
    }
    if (subcategoryId && mongoose.Types.ObjectId.isValid(subcategoryId)) {
      validatedSubcategory = await Category.findOne({ _id: subcategoryId, isDeleted: false }).select('_id name slug').lean()
      if (validatedSubcategory) {
        console.log(`[Transcribe] Validated subcategory: ${validatedSubcategory.name} (${validatedSubcategory._id})`)
      }
    }

    // Step 2: Fetch category-scoped filters from the database
    let dbFilters = []
    if (categoryId || subcategoryId || childCategoryId) {
      dbFilters = await fetchCategoryFiltersFromDB(categoryId, subcategoryId, childCategoryId)
      console.log(`[Transcribe] Found ${dbFilters.length} category filters:`, dbFilters.map((f) => f.name))
    }

    // Step 3: Transcribe the video
    console.log('Starting video transcription...')
    let transcript = ''
    let transcriptionError = null
    try {
      transcript = await transcribeVideo(videoPath)
      console.log('Transcript received:', transcript ? `Length: ${transcript.length} characters` : 'Empty')
      if (transcript) {
        console.log('Transcript preview:', transcript.substring(0, 200))
      }
    } catch (error) {
      console.error('Error transcribing video:', error)
      transcriptionError = error.message || 'Failed to transcribe video'
    }

    // Step 4: Extract structured data from transcript (GPT prompt includes DB filters)
    let extractedData = null
    let extractionError = null
    if (transcript && transcript.trim()) {
      try {
        console.log('Extracting data from transcript (with category filters)...')
        extractedData = await extractDataFromTranscript(
          transcript,
          category || validatedCategory?.name || '',
          subcategory || validatedSubcategory?.name || '',
          dbFilters
        )
        console.log('Extracted data:', JSON.stringify(extractedData, null, 2))
      } catch (error) {
        console.error('Error extracting data from transcript:', error)
        extractionError = error.message || 'Failed to extract data from transcript'
      }
    } else {
      console.log('Skipping data extraction - no transcript available')
    }

    // Step 5: Match GPT-extracted filter values to actual DB filter IDs
    let suggestedFilters = null
    if (extractedData && dbFilters.length) {
      try {
        const { filterSelections, filterData } = matchExtractedFiltersToDBIds(extractedData, dbFilters)

        // Also run the generic heuristic matcher as a fallback for filters GPT missed
        const { filterSelections: heuristicSelections, matchDetails } = await resolveFiltersFromProductData({
          productData: extractedData,
          categoryId: categoryId || null,
          subcategoryId: subcategoryId || null,
          childCategoryId: childCategoryId || null,
          models: { Filter, Category, CategoryFilter },
        })

        // Merge: GPT-extracted values take priority, heuristic fills gaps
        const mergedSelections = { ...heuristicSelections, ...filterSelections }

        if (Object.keys(mergedSelections).length) {
          suggestedFilters = {
            selections: mergedSelections,
            filterData,
            details: matchDetails || [],
          }
          console.log('[Transcribe] Suggested filter selections:', JSON.stringify(mergedSelections, null, 2))
        }
      } catch (filterErr) {
        console.error('[Transcribe] Error matching filters:', filterErr)
      }
    } else if (extractedData && (categoryId || subcategoryId || childCategoryId)) {
      // Fallback: heuristic matching only (no DB filters found)
      try {
        const { filterSelections, matchDetails } = await resolveFiltersFromProductData({
          productData: extractedData,
          categoryId: categoryId || null,
          subcategoryId: subcategoryId || null,
          childCategoryId: childCategoryId || null,
          models: { Filter, Category, CategoryFilter },
        })
        if (Object.keys(filterSelections).length) {
          suggestedFilters = { selections: filterSelections, details: matchDetails }
          console.log('[Transcribe] Heuristic filter selections:', JSON.stringify(filterSelections, null, 2))
        }
      } catch (filterErr) {
        console.error('[Transcribe] Error resolving heuristic filter suggestions:', filterErr)
      }
    }

    res.json({
      success: true,
      transcript: transcript || '',
      extractedData: extractedData || null,
      suggestedFilters: suggestedFilters || null,
      categoryValidation: {
        category: validatedCategory ? { id: String(validatedCategory._id), name: validatedCategory.name } : null,
        subcategory: validatedSubcategory ? { id: String(validatedSubcategory._id), name: validatedSubcategory.name } : null,
        filtersAvailable: dbFilters.length,
      },
      errors: {
        transcription: transcriptionError || null,
        extraction: extractionError || null
      }
    })
  } catch (error) {
    console.error('Error processing video:', error)
    
    if (videoPath && fs.existsSync(videoPath)) {
      fs.unlinkSync(videoPath)
    }

    res.status(500).json({
      message: error.message || 'Error processing video',
      error: process.env.NODE_ENV === 'development' ? error.stack : undefined
    })
  }
})

// @route   POST /api/video/screenshot
// @desc    Extract a screenshot from uploaded video at specific timestamp
// @access  Private
router.post('/screenshot', authMiddleware, upload.single('video'), async (req, res) => {
  let videoPath = null
  
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No video file uploaded' })
    }

    videoPath = req.file.path
    const { timestamp } = req.body
    
    if (!timestamp && timestamp !== 0) {
      return res.status(400).json({ message: 'Timestamp is required' })
    }

    const timestampNum = parseFloat(timestamp)
    if (isNaN(timestampNum) || timestampNum < 0) {
      return res.status(400).json({ message: 'Invalid timestamp' })
    }

    // Create screenshots directory
    const screenshotsDir = path.join(__dirname, '../uploads/videos/screenshots')
    if (!fs.existsSync(screenshotsDir)) {
      fs.mkdirSync(screenshotsDir, { recursive: true })
    }

    const screenshotName = `screenshot-${Date.now()}-${Math.round(timestampNum)}.jpg`
    const screenshotPath = path.join(screenshotsDir, screenshotName)

    // Extract screenshot at specific timestamp
    await new Promise((resolve, reject) => {
      ffmpeg(videoPath)
        .screenshots({
          timestamps: [timestampNum],
          filename: screenshotName,
          folder: screenshotsDir,
          size: '1280x720'
        })
        .on('end', () => {
          resolve()
        })
        .on('error', (err) => {
          console.error('Error extracting screenshot:', err)
          reject(err)
        })
    })

    // Note: Don't delete video file here - it will be handled by the product upload route

    res.json({
      success: true,
      screenshot: {
        url: `/uploads/videos/screenshots/${screenshotName}`,
        path: screenshotPath,
        timestamp: timestampNum
      }
    })
  } catch (error) {
    console.error('Error extracting screenshot:', error)
    
    // Clean up temporary video file on error
    if (videoPath && fs.existsSync(videoPath)) {
      fs.unlinkSync(videoPath)
    }

    res.status(500).json({
      message: error.message || 'Error extracting screenshot',
      error: process.env.NODE_ENV === 'development' ? error.stack : undefined
    })
  }
})

module.exports = router


