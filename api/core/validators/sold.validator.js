const { body } = require('express-validator')

const SOLD_PLATFORMS = ['friends_family', 'facebook', 'instagram', 'dubizzle', 'other']

const markSoldRules = [
  body('soldVia').isIn(['preelly', 'external']).withMessage('soldVia must be "preelly" or "external"'),

  body('buyerId')
    .if(body('soldVia').equals('preelly'))
    .isMongoId()
    .withMessage('A valid buyerId is required'),
  body('rating.responseRating').optional({ values: 'null' }).isInt({ min: 1, max: 5 }),
  body('rating.behaviourRating').optional({ values: 'null' }).isInt({ min: 1, max: 5 }),
  body('rating.overallRating').optional({ values: 'null' }).isInt({ min: 1, max: 5 }),
  body('rating.comment').optional({ values: 'null' }).isString().trim().isLength({ max: 1000 }),

  body('platform')
    .if(body('soldVia').equals('external'))
    .isIn(SOLD_PLATFORMS)
    .withMessage('A valid platform is required'),
  body('saleComment').optional({ values: 'null' }).isString().trim().isLength({ max: 1000 }),
  body('preellyRating.stars').optional({ values: 'null' }).isInt({ min: 1, max: 5 }),
  body('preellyRating.reasons').optional({ values: 'null' }).isArray(),
  body('preellyRating.reasons.*').optional().isString().trim().isLength({ max: 80 }),
  body('preellyRating.comment').optional({ values: 'null' }).isString().trim().isLength({ max: 1000 }),
]

module.exports = {
  SOLD_PLATFORMS,
  markSoldRules,
}
