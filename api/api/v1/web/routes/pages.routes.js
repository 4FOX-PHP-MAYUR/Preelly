const express = require('express')
const router = express.Router()
const pagesController = require('../controllers/pages.controller')

/**
 * @openapi
 * /api/v1/web/pages/{slug}:
 *   get:
 *     tags: [Web - Pages]
 *     summary: Get an active page by slug
 *     description: Returns an active, non-deleted static content page by its slug. Powers the dynamic `/pages/:slug` route on the public site. 404 when unknown or inactive.
 *     parameters:
 *       - in: path
 *         name: slug
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Page fetched successfully
 *       404:
 *         description: Page not found
 */
router.get('/:slug', pagesController.getPageBySlug)

module.exports = router
