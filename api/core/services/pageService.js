const AppError = require('../errors/AppError')
const pageRepository = require('../repositories/pageRepository')
const Page = require('../../models/Page')

const TITLE_MIN = 2
const TITLE_MAX = 150
const HEADING_MAX = 200
const META_TITLE_MAX = 70
const META_DESCRIPTION_MAX = 160

const slugify = Page.slugify

function parseBoolean(value, defaultValue = false) {
  if (value === undefined || value === null || value === '') return defaultValue
  return value !== false && value !== 'false' && value !== 0 && value !== '0'
}

function parseNumber(value, fallback = null) {
  if (value === undefined || value === null || value === '') return fallback
  const num = Number(value)
  return Number.isFinite(num) ? num : fallback
}

function assertPageTitle(value) {
  const title = String(value ?? '').trim()
  if (!title) {
    throw new AppError('Page title is required', 400, 'VALIDATION_ERROR')
  }
  if (title.length < TITLE_MIN || title.length > TITLE_MAX) {
    throw new AppError(`Page title must be between ${TITLE_MIN} and ${TITLE_MAX} characters`, 400, 'VALIDATION_ERROR')
  }
  return title
}

function assertHeading(value) {
  const heading = String(value ?? '').trim()
  if (!heading) {
    throw new AppError('Heading is required', 400, 'VALIDATION_ERROR')
  }
  if (heading.length > HEADING_MAX) {
    throw new AppError(`Heading cannot exceed ${HEADING_MAX} characters`, 400, 'VALIDATION_ERROR')
  }
  return heading
}

function assertDescription(value) {
  // Rich-text HTML — strip tags to check for actual content.
  const text = String(value ?? '').trim()
  const plain = text.replace(/<[^>]*>/g, '').trim()
  if (!plain) {
    throw new AppError('Description is required', 400, 'VALIDATION_ERROR')
  }
  return text
}

function assertDisplayOrder(value) {
  const order = parseNumber(value, 0) ?? 0
  if (order < 0) {
    throw new AppError('Display order cannot be negative', 400, 'VALIDATION_ERROR')
  }
  return order
}

function normalizeMetaTitle(value) {
  const text = String(value ?? '').trim()
  if (text.length > META_TITLE_MAX) {
    throw new AppError(`Meta title should not exceed ${META_TITLE_MAX} characters`, 400, 'VALIDATION_ERROR')
  }
  return text
}

function normalizeMetaDescription(value) {
  const text = String(value ?? '').trim()
  if (text.length > META_DESCRIPTION_MAX) {
    throw new AppError(`Meta description should not exceed ${META_DESCRIPTION_MAX} characters`, 400, 'VALIDATION_ERROR')
  }
  return text
}

/** Derives a unique slug from the title (or an explicit custom slug), appending -2, -3, … on collision. */
async function assertUniqueSlug(candidateSlug, title, excludeId = null) {
  const base = slugify(candidateSlug || title)
  if (!base) {
    throw new AppError('Unable to generate a page slug — provide a valid page title', 400, 'VALIDATION_ERROR')
  }

  // Explicit manual slugs must be unique as-is (surface a clear error) rather than silently suffixed.
  if (candidateSlug) {
    const existing = await pageRepository.findBySlug(base, excludeId)
    if (existing) {
      throw new AppError('A page with this slug already exists', 400, 'DUPLICATE_SLUG')
    }
    return base
  }

  // Auto-derived from title: find the next free slug (title, title-2, title-3, …).
  let candidate = base
  let suffix = 2
  // eslint-disable-next-line no-await-in-loop
  while (await pageRepository.findBySlug(candidate, excludeId)) {
    candidate = `${base}-${suffix}`
    suffix += 1
  }
  return candidate
}

async function assertUniqueTitle(title, excludeId = null) {
  const existing = await pageRepository.findByTitle(title, excludeId)
  if (existing) {
    throw new AppError('A page with this title already exists', 400, 'DUPLICATE_TITLE')
  }
}

async function listPages(params) {
  return pageRepository.findPaginated(params)
}

async function listPagesForExport(params) {
  return pageRepository.findAllForExport(params)
}

async function getPageById(id) {
  const page = await pageRepository.findById(id)
  if (!page) {
    throw new AppError('Page not found', 404, 'PAGE_NOT_FOUND')
  }
  return page
}

/** Public reader used by the dynamic frontend `/pages/:slug` route. */
async function getActivePageBySlug(slug) {
  const page = await pageRepository.findActiveBySlug(slugify(slug))
  if (!page) {
    throw new AppError('Page not found', 404, 'PAGE_NOT_FOUND')
  }
  return page
}

async function createPage(payload, actorId = null) {
  const pageTitle = assertPageTitle(payload.pageTitle)
  await assertUniqueTitle(pageTitle)
  const pageSlug = await assertUniqueSlug(payload.pageSlug, pageTitle)

  return pageRepository.create({
    pageTitle,
    pageSlug,
    heading: assertHeading(payload.heading),
    description: assertDescription(payload.description),
    pageBannerImage: payload.pageBannerImage || null,
    metaTitle: normalizeMetaTitle(payload.metaTitle),
    metaDescription: normalizeMetaDescription(payload.metaDescription),
    metaKeywords: String(payload.metaKeywords ?? '').trim(),
    displayOrder: assertDisplayOrder(payload.displayOrder),
    status: parseBoolean(payload.status, true),
    createdBy: actorId,
    updatedBy: actorId,
  })
}

async function updatePage(id, payload, actorId = null) {
  const existing = await pageRepository.findById(id)
  if (!existing) {
    throw new AppError('Page not found', 404, 'PAGE_NOT_FOUND')
  }

  const updates = {}

  if (payload.pageTitle !== undefined) {
    updates.pageTitle = assertPageTitle(payload.pageTitle)
    await assertUniqueTitle(updates.pageTitle, id)
  }

  if (payload.pageSlug !== undefined || payload.pageTitle !== undefined) {
    updates.pageSlug = await assertUniqueSlug(
      payload.pageSlug !== undefined ? payload.pageSlug : null,
      updates.pageTitle || existing.pageTitle,
      id
    )
  }

  if (payload.heading !== undefined) updates.heading = assertHeading(payload.heading)
  if (payload.description !== undefined) updates.description = assertDescription(payload.description)
  if (payload.metaTitle !== undefined) updates.metaTitle = normalizeMetaTitle(payload.metaTitle)
  if (payload.metaDescription !== undefined) updates.metaDescription = normalizeMetaDescription(payload.metaDescription)
  if (payload.metaKeywords !== undefined) updates.metaKeywords = String(payload.metaKeywords ?? '').trim()
  if (payload.displayOrder !== undefined) updates.displayOrder = assertDisplayOrder(payload.displayOrder)
  if (payload.status !== undefined) updates.status = parseBoolean(payload.status, existing.status)

  // A newly uploaded banner wins; otherwise an explicit clear removes the existing one.
  if (payload.pageBannerImage) {
    updates.pageBannerImage = payload.pageBannerImage
  } else if (parseBoolean(payload.clearPageBannerImage, false)) {
    updates.pageBannerImage = null
  }

  if (!Object.keys(updates).length) {
    return existing
  }

  updates.updatedBy = actorId

  const updated = await pageRepository.updateById(id, updates)
  if (!updated) {
    throw new AppError('Page not found', 404, 'PAGE_NOT_FOUND')
  }
  return updated
}

async function deletePage(id, actorId = null) {
  const deleted = await pageRepository.softDeleteById(id, actorId)
  if (!deleted) {
    throw new AppError('Page not found', 404, 'PAGE_NOT_FOUND')
  }
  return deleted
}

async function setPageStatus(id, status, actorId = null) {
  const updated = await pageRepository.updateStatusById(id, parseBoolean(status, true), actorId)
  if (!updated) {
    throw new AppError('Page not found', 404, 'PAGE_NOT_FOUND')
  }
  return updated
}

module.exports = {
  TITLE_MIN,
  TITLE_MAX,
  HEADING_MAX,
  META_TITLE_MAX,
  META_DESCRIPTION_MAX,
  listPages,
  listPagesForExport,
  getPageById,
  getActivePageBySlug,
  createPage,
  updatePage,
  deletePage,
  setPageStatus,
}
