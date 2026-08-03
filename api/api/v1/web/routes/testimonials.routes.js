const express = require('express')
const router = express.Router()
const testimonialsController = require('../controllers/testimonials.controller')

/**
 * @openapi
 * /api/v1/web/testimonials:
 *   get:
 *     tags: [Web - Testimonials]
 *     summary: List active testimonials
 *     description: Returns active, non-deleted testimonials ordered by displayOrder then latest created date. Powers the public Testimonials section.
 *     responses:
 *       200:
 *         description: Active testimonials fetched successfully
 */
router.get('/', testimonialsController.listActiveTestimonials)

module.exports = router
