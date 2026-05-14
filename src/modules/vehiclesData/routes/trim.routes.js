const express = require('express');
const { body, param } = require('express-validator');
const router = express.Router();
const controller = require('../controllers/trim.controller');
const { validationResultHandler } = require('../../../middlewares/error.middleware');

router.post(
  '/',
  [
    body('name').notEmpty().withMessage('Name is required'),
    body('category').notEmpty().withMessage('Category is required'),
    body('company').notEmpty().withMessage('Company is required'),
    body('model').notEmpty().withMessage('Model is required'),
  ],
  validationResultHandler,
  controller.createTrim
);

router.get('/', controller.getTrims);

router.get('/filter', controller.filterTrims);

router.get(
  '/:id',
  [param('id').notEmpty().withMessage('id is required')],
  validationResultHandler,
  controller.getTrimById
);

router.put(
  '/:id',
  [param('id').notEmpty().withMessage('id is required')],
  validationResultHandler,
  controller.updateTrim
);

router.delete(
  '/:id',
  [param('id').notEmpty().withMessage('id is required')],
  validationResultHandler,
  controller.deleteTrim
);

module.exports = router;

