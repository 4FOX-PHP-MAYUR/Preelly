const express = require('express');
const { body, param } = require('express-validator');
const router = express.Router();
const controller = require('../controllers/category.controller');
const { validationResultHandler } = require('../../../middlewares/error.middleware');

router.post(
  '/',
  [body('name').notEmpty().withMessage('Name is required')],
  validationResultHandler,
  controller.createCategory
);

router.get('/', controller.getCategories);

router.get(
  '/:id',
  [param('id').notEmpty().withMessage('id is required')],
  validationResultHandler,
  controller.getCategoryById
);

router.put(
  '/:id',
  [param('id').notEmpty().withMessage('id is required')],
  validationResultHandler,
  controller.updateCategory
);

router.delete(
  '/:id',
  [param('id').notEmpty().withMessage('id is required')],
  validationResultHandler,
  controller.deleteCategory
);

module.exports = router;

