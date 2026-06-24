const { param } = require('express-validator')

const categoryIdParamRules = [
  param('categoryId')
    .exists({ checkFalsy: true })
    .withMessage('categoryId is required')
    .bail()
    .isMongoId()
    .withMessage('categoryId must be a valid MongoDB ObjectId'),
]

module.exports = {
  categoryIdParamRules,
}
