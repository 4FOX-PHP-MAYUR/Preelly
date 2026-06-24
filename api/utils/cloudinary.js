const cloudinary = require('cloudinary').v2
const streamifier = require('streamifier')

function isCloudinaryConfigured () {
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME
  const apiKey = process.env.CLOUDINARY_API_KEY
  const apiSecret = process.env.CLOUDINARY_API_SECRET
  return !!(cloudName && apiKey && apiSecret)
}

function ensureConfigured () {
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME
  const apiKey = process.env.CLOUDINARY_API_KEY
  const apiSecret = process.env.CLOUDINARY_API_SECRET

  if (!cloudName || !apiKey || !apiSecret) {
    const err = new Error('Cloudinary is not configured')
    err.status = 500
    err.details = 'Missing CLOUDINARY_CLOUD_NAME / CLOUDINARY_API_KEY / CLOUDINARY_API_SECRET'
    throw err
  }

  cloudinary.config({
    cloud_name: cloudName,
    api_key: apiKey,
    api_secret: apiSecret,
    secure: true,
  })
}

function uploadBuffer (buffer, { folder, publicId, resourceType = 'image' } = {}) {
  ensureConfigured()
  if (!buffer || !Buffer.isBuffer(buffer)) {
    const err = new Error('Invalid file buffer')
    err.status = 400
    throw err
  }

  return new Promise((resolve, reject) => {
    const upload = cloudinary.uploader.upload_stream(
      {
        folder: folder || 'marketplace/profile-pics',
        public_id: publicId,
        resource_type: resourceType,
        transformation: [
          { width: 512, height: 512, crop: 'fill', gravity: 'face' },
          { quality: 'auto' },
          { fetch_format: 'auto' },
        ],
      },
      (error, result) => {
        if (error) return reject(error)
        resolve(result)
      },
    )

    streamifier.createReadStream(buffer).pipe(upload)
  })
}

module.exports = { uploadBuffer, isCloudinaryConfigured }

