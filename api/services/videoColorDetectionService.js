/**
 * Detect vehicle exterior/interior colors from a video frame using OpenAI Vision.
 * Used when transcript does not mention color (avoids wrong text-based guesses).
 */

const fs = require('fs')
const path = require('path')
const axios = require('axios')
const { ffmpeg, isFfmpegAvailable, resolveScreenshotSize } = require('./ffmpegConfig')

const MULTI_COLOR_WORDS =
  /\b(white|black|silver|grey|gray|red|blue|green|beige|maroon|brown|gold|champagne|pearl|graphite|bronze|burgundy|navy|charcoal|ivory|cream|tan|yellow|orange|purple|pink|metallic|matte)\b/i

function transcriptMentionsColor(transcript) {
  if (!transcript || typeof transcript !== 'string') return false
  return MULTI_COLOR_WORDS.test(transcript)
}

function normalizeColorName(name) {
  if (!name) return null
  const s = String(name).trim()
  if (!s || /^unknown$/i.test(s) || /^n\/?a$/i.test(s)) return null
  return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase()
}

function extractFrameToFile(videoPath, outputPath, timestampSec = 2, size = '1280x?') {
  return new Promise((resolve, reject) => {
    ffmpeg(videoPath)
      .screenshots({
        timestamps: [Math.max(0, timestampSec)],
        filename: path.basename(outputPath),
        folder: path.dirname(outputPath),
        size,
      })
      .on('end', () => resolve(outputPath))
      .on('error', reject)
  })
}

async function getVideoDurationSec(videoPath) {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(videoPath, (err, metadata) => {
      if (err) return reject(err)
      const d = Number(metadata?.format?.duration)
      resolve(Number.isFinite(d) ? d : 10)
    })
  })
}

function getColorFilterOptions(categoryFilters) {
  const list = Array.isArray(categoryFilters) ? categoryFilters : []
  const roots = list.filter((f) => !f.parentId)
  const out = { exterior: [], interior: [] }

  for (const root of roots) {
    const name = String(root.name || '').toLowerCase()
    const opts = Array.isArray(root.options) ? root.options.filter(Boolean) : []
    if (!opts.length) continue
    if (name.includes('exterior') && name.includes('color')) out.exterior = opts
    else if (name === 'color' || (name.includes('color') && !name.includes('interior'))) {
      if (!out.exterior.length) out.exterior = opts
    } else if (name.includes('interior') && name.includes('color')) {
      out.interior = opts
    }
  }
  return out
}

function matchColorToOptions(detected, options) {
  if (!detected || !options?.length) return detected
  const norm = String(detected).trim().toLowerCase()
  const exact = options.find((o) => String(o).trim().toLowerCase() === norm)
  if (exact) return exact
  const partial = options.find((o) => {
    const n = String(o).trim().toLowerCase()
    return n.length >= 3 && (norm.includes(n) || n.includes(norm))
  })
  return partial || detected
}

async function callVisionApi({ imageBase64, colorOptions }) {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) throw new Error('OpenAI API key not configured')

  const optionHint =
    colorOptions.exterior.length || colorOptions.interior.length
      ? `\nIf possible, map exterior color to one of: ${JSON.stringify(colorOptions.exterior)} and interior to one of: ${JSON.stringify(colorOptions.interior)}. Use exact option strings when they match.`
      : ''

  const response = await axios.post(
    'https://api.openai.com/v1/chat/completions',
    {
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content:
            'You identify vehicle colors from listing photos. Return JSON only. Do not guess trim or brand.',
        },
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: `Look at this vehicle listing frame. Identify:
- exteriorColor: primary body paint color (e.g. White, Black, Silver)
- interiorColor: cabin color if clearly visible, else null
- confidence: 0-100 how sure you are about exterior color
Only report colors you can see in the image, not marketing text.${optionHint}
Return JSON: {"exteriorColor":"","interiorColor":null,"confidence":0}`,
            },
            {
              type: 'image_url',
              image_url: { url: `data:image/jpeg;base64,${imageBase64}` },
            },
          ],
        },
      ],
      temperature: 0.1,
      max_tokens: 200,
      response_format: { type: 'json_object' },
    },
    {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      timeout: 60000,
    },
  )

  const content = response?.data?.choices?.[0]?.message?.content
  const parsed = JSON.parse(String(content || '{}'))
  return {
    exteriorColor: normalizeColorName(parsed.exteriorColor),
    interiorColor: normalizeColorName(parsed.interiorColor),
    confidence: Math.max(0, Math.min(100, Math.round(Number(parsed.confidence) || 0))),
  }
}

/**
 * @param {object} opts
 * @param {string} opts.videoPath
 * @param {Array} [opts.categoryFilters]
 * @param {string} [opts.transcript]
 */
async function detectVehicleColorsFromVideo({
  videoPath,
  categoryFilters = [],
  transcript = '',
} = {}) {
  if (!videoPath || !fs.existsSync(videoPath)) {
    return { exteriorColor: null, interiorColor: null, confidence: null, source: 'none' }
  }

  if (transcriptMentionsColor(transcript)) {
    return {
      exteriorColor: null,
      interiorColor: null,
      confidence: null,
      source: 'skipped_transcript_has_color',
    }
  }

  if (!isFfmpegAvailable()) {
    return { exteriorColor: null, interiorColor: null, confidence: null, source: 'ffmpeg_unavailable' }
  }

  const screenshotsDir = path.join(path.dirname(videoPath), 'color-detect')
  if (!fs.existsSync(screenshotsDir)) fs.mkdirSync(screenshotsDir, { recursive: true })

  const frameName = `color-frame-${Date.now()}.jpg`
  const framePath = path.join(screenshotsDir, frameName)

  try {
    const duration = await getVideoDurationSec(videoPath)
    const ts = Math.min(Math.max(duration * 0.35, 1), Math.max(duration - 0.5, 1))
    const screenshotSize = await resolveScreenshotSize(videoPath)
    await extractFrameToFile(videoPath, framePath, ts, screenshotSize)

    if (!fs.existsSync(framePath)) {
      return { exteriorColor: null, interiorColor: null, confidence: null, source: 'frame_failed' }
    }

    const imageBase64 = fs.readFileSync(framePath).toString('base64')
    const colorOptions = getColorFilterOptions(categoryFilters)
    const vision = await callVisionApi({ imageBase64, colorOptions })

    const exterior = matchColorToOptions(vision.exteriorColor, colorOptions.exterior)
    const interior = matchColorToOptions(vision.interiorColor, colorOptions.interior)

    console.log('[videoColorDetection] Vision result:', { exterior, interior, confidence: vision.confidence })

    return {
      exteriorColor: exterior,
      interiorColor: interior,
      confidence: vision.confidence,
      source: 'video_vision',
    }
  } catch (err) {
    console.error('[videoColorDetection] Failed:', err.message)
    return { exteriorColor: null, interiorColor: null, confidence: null, source: 'error', error: err.message }
  } finally {
    try {
      if (fs.existsSync(framePath)) fs.unlinkSync(framePath)
    } catch {
      // ignore
    }
  }
}

module.exports = {
  detectVehicleColorsFromVideo,
  transcriptMentionsColor,
  getColorFilterOptions,
}
