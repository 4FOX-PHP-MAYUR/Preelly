const fs = require('fs')
const path = require('path')
const { ffmpeg, isFfmpegAvailable } = require('./ffmpegConfig')

// Matches the floor enforced by the upload middleware — trimming below it would
// only fail later, when the listing is submitted.
const MIN_TRIM_SECONDS = 15

class TrimError extends Error {
  constructor(message, code) {
    super(message)
    this.code = code
  }
}

function probe(inputPath) {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(inputPath, (err, metadata) => {
      if (err) return reject(err)
      const duration = Number(metadata?.format?.duration || 0)
      if (!duration) return reject(new TrimError('Unable to read video duration', 'UNREADABLE'))
      resolve({ duration, size: Number(metadata?.format?.size || 0) })
    })
  })
}

/**
 * Two ways to cut:
 *
 *  copy     — no re-encode at all, so the picture and sound are bit-for-bit the
 *             source. Fast, and always smaller than the original because it is
 *             strictly fewer seconds of the same bitrate. The catch is that the cut
 *             can only land on a keyframe, so the real start may sit slightly
 *             before the requested one.
 *  reencode — frame-accurate and still visually near-identical (CRF 20), used only
 *             when a stream copy fails or somehow does not come out smaller.
 */
function runTrim({ inputPath, outputPath, start, duration, mode }) {
  return new Promise((resolve, reject) => {
    const cmd = ffmpeg(inputPath)
      // -ss before the input: seek by keyframe index instead of decoding up to the
      // cut point, which is what makes a copy-mode trim near-instant.
      .seekInput(start)
      .duration(duration)

    if (mode === 'copy') {
      cmd.outputOptions(['-c copy', '-avoid_negative_ts make_zero', '-movflags +faststart'])
    } else {
      cmd.outputOptions([
        '-c:v libx264',
        '-crf 20',
        '-preset veryfast',
        '-pix_fmt yuv420p',
        '-profile:v high',
        '-level 4.1',
        '-c:a aac',
        '-b:a 128k',
        '-movflags +faststart',
      ])
    }

    cmd.on('end', resolve).on('error', reject).save(outputPath)
  })
}

function safeUnlink(filePath) {
  try {
    if (filePath && fs.existsSync(filePath)) fs.unlinkSync(filePath)
  } catch {
    // best-effort
  }
}

/**
 * Trim `inputPath` down to [startTime, endTime] and write the result into
 * `outputDir`. Resolves with the winning candidate's path, size and mode.
 */
async function trimVideo({ inputPath, startTime, endTime, outputDir }) {
  if (!isFfmpegAvailable()) {
    throw new TrimError('FFmpeg is not installed on this server.', 'FFMPEG_MISSING')
  }

  const start = Number(startTime)
  const end = Number(endTime)
  if (!Number.isFinite(start) || !Number.isFinite(end)) {
    throw new TrimError('startTime and endTime must be numbers', 'INVALID_RANGE')
  }

  const { duration: sourceDuration, size: sourceSize } = await probe(inputPath)

  // A fractional overshoot past the real duration is normal (browsers and ffprobe
  // disagree in the last frame), so clamp rather than reject.
  const clampedEnd = Math.min(end, sourceDuration)
  const clampedStart = Math.max(0, start)
  const selected = clampedEnd - clampedStart

  if (selected <= 0) {
    throw new TrimError('endTime must be greater than startTime', 'INVALID_RANGE')
  }
  if (sourceDuration >= MIN_TRIM_SECONDS && selected < MIN_TRIM_SECONDS - 0.05) {
    throw new TrimError(`The trimmed video must be at least ${MIN_TRIM_SECONDS} seconds long.`, 'TOO_SHORT')
  }

  if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true })

  const stamp = `${Date.now()}-${Math.round(Math.random() * 1e9)}`
  const candidates = []

  for (const mode of ['copy', 'reencode']) {
    const outputPath = path.join(outputDir, `trimmed-${stamp}-${mode}.mp4`)
    try {
      // eslint-disable-next-line no-await-in-loop
      await runTrim({ inputPath, outputPath, start: clampedStart, duration: selected, mode })
      // eslint-disable-next-line no-await-in-loop
      const { duration: outDuration, size: outSize } = await probe(outputPath)
      if (!outSize || !outDuration) throw new TrimError('Trim produced an empty file', 'EMPTY_OUTPUT')
      candidates.push({ mode, outputPath, size: outSize, duration: outDuration })
      // A stream copy that already shrank the file is the best possible result —
      // no reason to spend CPU re-encoding as well.
      if (!sourceSize || outSize < sourceSize) break
    } catch (error) {
      safeUnlink(outputPath)
      if (mode === 'reencode' && !candidates.length) {
        throw error instanceof TrimError ? error : new TrimError(error.message || 'Failed to trim video', 'FFMPEG_FAILED')
      }
    }
  }

  if (!candidates.length) {
    throw new TrimError('Failed to trim video', 'FFMPEG_FAILED')
  }

  // Whichever came out smallest wins; the losers are deleted so temp files from a
  // fallback attempt do not pile up on disk.
  candidates.sort((a, b) => a.size - b.size)
  const [winner, ...rejected] = candidates
  rejected.forEach((c) => safeUnlink(c.outputPath))

  return {
    ...winner,
    name: path.basename(winner.outputPath),
    sourceSize,
    sourceDuration,
    startTime: clampedStart,
    endTime: clampedEnd,
    smallerThanSource: Boolean(sourceSize) && winner.size < sourceSize,
  }
}

module.exports = { trimVideo, TrimError, MIN_TRIM_SECONDS }
