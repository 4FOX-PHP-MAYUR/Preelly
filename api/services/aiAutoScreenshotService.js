/**
 * AI-guided cinematic screenshot capture from listing videos.
 * Uses OpenAI Vision to select optimal timestamps for 10 professional shot angles.
 */

const fs = require('fs')
const path = require('path')
const axios = require('axios')
const { ffmpeg, isFfmpegAvailable, resolveScreenshotSize } = require('./ffmpegConfig')

const SHOT_TYPES = [
  'Wide Establishing Shot',
  'Front Perspective Shot',
  'Front Left 45° Angle',
  'Front Right 45° Angle',
  'Side Profile Shot',
  'Rear Perspective Shot',
  'Low-Angle Hero Shot',
  'Eye-Level Commercial Shot',
  'Close-Up Detail Shot',
  'Premium Marketplace Listing Shot',
]

const CANDIDATE_FRAME_COUNT = 24
const SCREENSHOT_COUNT = SHOT_TYPES.length

function getOpenAiKey() {
  return process.env.OPENAI_API_KEY || ''
}

function buildAutoScreenshotPrompt() {
  return `You are a world-class professional photographer, cinematographer, drone operator, and commercial visual artist specializing in automotive, real-estate, product, and marketplace photography.

Your task is to analyze the provided video and capture high-quality screenshots from multiple cinematic camera angles while preserving the original subject's proportions, geometry, and aspect ratio.

CRITICAL REQUIREMENTS:

* Use the provided video as the source of truth.
* Extract frames only from realistic camera perspectives that could naturally exist in the scene.
* Maintain the original aspect ratio of all subjects and objects.
* Never stretch, squash, warp, distort, resize, deform, or alter proportions.
* Preserve accurate perspective and physical dimensions.
* Preserve original colors, textures, branding, reflections, shadows, and details.
* Do not hallucinate missing features.
* Keep all objects geometrically correct.
* Maintain realistic scale relationships between foreground and background elements.

PHOTOGRAPHER ROLE:

Act as a professional photographer capturing the best possible screenshots from the video.

Choose visually appealing moments with:

* Sharp focus
* Proper framing
* Balanced composition
* Natural perspective
* Cinematic depth
* Professional lighting
* High visual impact

CAPTURE THE FOLLOWING SHOTS:

1. Wide Establishing Shot
2. Front Perspective Shot
3. Front Left 45° Angle
4. Front Right 45° Angle
5. Side Profile Shot
6. Rear Perspective Shot
7. Low-Angle Hero Shot
8. Eye-Level Commercial Shot
9. Close-Up Detail Shot
10. Premium Marketplace Listing Shot

VISUAL QUALITY:

* DSLR quality
* Ultra-high resolution
* Commercial photography standard
* Sharp details
* Accurate colors
* Realistic shadows
* Natural depth of field
* Premium marketplace appearance
* Clean and professional composition

FRAMING RULES:

* Do not crop important content.
* Keep the entire subject visible whenever possible.
* Use intelligent framing.
* Maintain visual balance.
* Avoid excessive zoom.

OUTPUT:

Generate 10 screenshot variations from different camera angles and moments within the video while preserving the original geometry, scale, proportions, and aspect ratio of every object in the scene.

The final screenshots should look like they were captured by a professional photographer during a commercial photo shoot, not artificially stretched or manipulated.

You will receive numbered candidate frames sampled from the video. Select the best frame for each required shot type.

Return STRICT JSON only with this structure:
{
  "screenshots": [
    {
      "shotType": "<exact shot type name from the list above>",
      "frameIndex": <0-based index of the selected candidate frame>,
      "timestampSeconds": <timestamp in seconds from the candidate frame metadata>,
      "confidence": <0-100 integer>
    }
  ]
}

Rules for JSON output:
- Include exactly ${SCREENSHOT_COUNT} entries, one per shot type.
- Use each shot type exactly once.
- frameIndex must reference one of the provided candidate frames.
- Prefer frames with sharp focus, full subject visibility, and natural perspective.
- If an ideal angle is not present in the video, choose the closest realistic alternative and lower confidence.`
}

function getVideoDurationSec(videoPath) {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(videoPath, (err, metadata) => {
      if (err) return reject(err)
      const duration = Number(metadata?.format?.duration)
      if (!Number.isFinite(duration) || duration <= 0) {
        return reject(new Error('Unable to read video duration'))
      }
      resolve(duration)
    })
  })
}

function extractFrameToFile(videoPath, outputPath, timestampSec, size) {
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

function extractScreenshotsAtTimestamps({ videoPath, timestamps, outputDir, filenamePrefix, size }) {
  const uniqueTimestamps = [...new Set(timestamps.map((t) => Number(t)).filter((t) => Number.isFinite(t) && t >= 0))]
  if (!uniqueTimestamps.length) return Promise.resolve([])

  return new Promise((resolve, reject) => {
    ffmpeg(videoPath)
      .screenshots({
        timestamps: uniqueTimestamps,
        filename: `${filenamePrefix}-%03d.jpg`,
        folder: outputDir,
        size,
      })
      .on('end', () => {
        const files = fs
          .readdirSync(outputDir)
          .filter((fn) => fn.startsWith(`${filenamePrefix}-`) && fn.endsWith('.jpg'))
          .sort()
        resolve(
          files.slice(0, uniqueTimestamps.length).map((fn, idx) => ({
            filename: fn,
            path: path.join(outputDir, fn),
            timestamp: uniqueTimestamps[idx],
          })),
        )
      })
      .on('error', reject)
  })
}

async function extractCandidateFrames({ videoPath, workDir, count = CANDIDATE_FRAME_COUNT, size }) {
  if (!fs.existsSync(workDir)) fs.mkdirSync(workDir, { recursive: true })

  const duration = await getVideoDurationSec(videoPath)
  const frameCount = Math.max(8, Math.min(count, 30))
  const timestamps = Array.from({ length: frameCount }, (_, i) => {
    const ratio = (i + 1) / (frameCount + 1)
    return Math.max(0, duration * ratio)
  })

  const frames = []
  for (let i = 0; i < timestamps.length; i += 1) {
    const frameName = `candidate-${String(i).padStart(3, '0')}.jpg`
    const framePath = path.join(workDir, frameName)
    await extractFrameToFile(videoPath, framePath, timestamps[i], size)
    const base64 = fs.readFileSync(framePath, { encoding: 'base64' })
    frames.push({
      index: i,
      timestamp: timestamps[i],
      path: framePath,
      base64,
    })
  }

  return { duration, frames }
}

async function selectScreenshotTimestampsWithAi({ frames, duration }) {
  const apiKey = getOpenAiKey()
  if (!apiKey) throw new Error('OpenAI API key not configured')

  const frameSummary = frames
    .map((f) => `Frame ${f.index}: timestamp=${f.timestamp.toFixed(2)}s`)
    .join('\n')

  const imageContent = frames.flatMap((frame) => [
    {
      type: 'text',
      text: `Candidate frame ${frame.index} at ${frame.timestamp.toFixed(2)}s`,
    },
    {
      type: 'image_url',
      image_url: { url: `data:image/jpeg;base64,${frame.base64}` },
    },
  ])

  const response = await axios.post(
    'https://api.openai.com/v1/chat/completions',
    {
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: buildAutoScreenshotPrompt() },
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: `Video duration: ${duration.toFixed(2)} seconds.\nCandidate frames:\n${frameSummary}\n\nSelect the best frame for each required shot type.`,
            },
            ...imageContent,
          ],
        },
      ],
      temperature: 0.2,
      max_tokens: 1200,
      response_format: { type: 'json_object' },
    },
    {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      timeout: 180000,
    },
  )

  const content = response?.data?.choices?.[0]?.message?.content
  const parsed = JSON.parse(String(content || '{}'))
  const selections = Array.isArray(parsed.screenshots) ? parsed.screenshots : []

  return selections
    .map((item) => {
      const frameIndex = Number(item.frameIndex)
      const frame = frames.find((f) => f.index === frameIndex)
      const timestampSeconds = Number.isFinite(Number(item.timestampSeconds))
        ? Number(item.timestampSeconds)
        : frame?.timestamp

      return {
        shotType: String(item.shotType || '').trim(),
        frameIndex: Number.isFinite(frameIndex) ? frameIndex : null,
        timestamp: Number.isFinite(timestampSeconds) ? timestampSeconds : null,
        confidence: Math.max(0, Math.min(100, Math.round(Number(item.confidence) || 0))),
      }
    })
    .filter((item) => item.timestamp != null)
}

function buildEvenlySpacedFallbackSelections(duration, count = SCREENSHOT_COUNT) {
  return Array.from({ length: count }, (_, i) => {
    const ratio = (i + 1) / (count + 1)
    return {
      shotType: SHOT_TYPES[i] || `Shot ${i + 1}`,
      frameIndex: null,
      timestamp: Math.max(0, duration * ratio),
      confidence: 0,
      source: 'fallback_even_spacing',
    }
  })
}

function cleanupDir(dirPath) {
  try {
    if (!dirPath || !fs.existsSync(dirPath)) return
    fs.rmSync(dirPath, { recursive: true, force: true })
  } catch {
    // best-effort
  }
}

/**
 * Analyze a listing video with AI and extract 10 cinematic marketplace screenshots.
 *
 * @param {object} opts
 * @param {string} opts.videoPath
 * @param {string} opts.outputDir
 * @param {string} [opts.filenamePrefix]
 * @param {string} [opts.urlPrefix]
 */
async function captureAutoScreenshotsFromVideo({
  videoPath,
  outputDir,
  filenamePrefix = `auto-shot-${Date.now()}`,
  urlPrefix = '/uploads/videos/screenshots',
} = {}) {
  if (!videoPath || !fs.existsSync(videoPath)) {
    throw new Error('Video file not found')
  }
  if (!isFfmpegAvailable()) {
    throw new Error('FFmpeg is not available on this server')
  }
  if (!outputDir) throw new Error('outputDir is required')
  if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true })

  const workDir = path.join(outputDir, `${filenamePrefix}-candidates`)
  let selections = []
  let source = 'ai'
  const screenshotSize = await resolveScreenshotSize(videoPath)

  try {
    const { duration, frames } = await extractCandidateFrames({
      videoPath,
      workDir,
      size: screenshotSize,
    })

    if (getOpenAiKey()) {
      try {
        selections = await selectScreenshotTimestampsWithAi({ frames, duration })
      } catch (aiErr) {
        console.error('[aiAutoScreenshot] AI selection failed, using fallback spacing:', aiErr.message)
        selections = buildEvenlySpacedFallbackSelections(duration)
        source = 'fallback_even_spacing'
      }
    } else {
      selections = buildEvenlySpacedFallbackSelections(duration)
      source = 'fallback_even_spacing'
    }

    if (selections.length < SCREENSHOT_COUNT) {
      const fallback = buildEvenlySpacedFallbackSelections(duration)
      const usedTimestamps = new Set(selections.map((s) => s.timestamp))
      for (const item of fallback) {
        if (selections.length >= SCREENSHOT_COUNT) break
        if (!usedTimestamps.has(item.timestamp)) {
          selections.push(item)
          usedTimestamps.add(item.timestamp)
        }
      }
    }

    selections = selections.slice(0, SCREENSHOT_COUNT)
    const extracted = await extractScreenshotsAtTimestamps({
      videoPath,
      timestamps: selections.map((s) => s.timestamp),
      outputDir,
      filenamePrefix,
      size: screenshotSize,
    })

    return extracted.map((file, idx) => ({
      url: `${urlPrefix}/${file.filename}`,
      path: file.path,
      timestamp: file.timestamp,
      shotType: selections[idx]?.shotType || SHOT_TYPES[idx] || null,
      confidence: selections[idx]?.confidence ?? null,
      source: 'auto',
      captureSource: source,
    }))
  } finally {
    cleanupDir(workDir)
  }
}

module.exports = {
  SHOT_TYPES,
  SCREENSHOT_COUNT,
  buildAutoScreenshotPrompt,
  captureAutoScreenshotsFromVideo,
}
