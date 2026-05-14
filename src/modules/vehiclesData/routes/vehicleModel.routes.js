const express = require('express');
const { body, param, query } = require('express-validator');
const router = express.Router();
const controller = require('../controllers/vehicleModel.controller');
const { validationResultHandler } = require('../../../middlewares/error.middleware');

router.post(
  '/',
  [
    body('name').notEmpty().withMessage('Name is required'),
    body('category').notEmpty().withMessage('Category is required'),
    body('company').notEmpty().withMessage('Company is required'),
  ],
  validationResultHandler,
  controller.createModel
);

router.get('/', controller.getModels);

router.get('/by-company/:companyId', controller.getModelsByCompany);

router.get('/filter', controller.filterModels);

router.get(
  '/:id',
  [param('id').notEmpty().withMessage('id is required')],
  validationResultHandler,
  controller.getModelById
);

router.put(
  '/:id',
  [param('id').notEmpty().withMessage('id is required')],
  validationResultHandler,
  controller.updateModel
);

router.delete(
  '/:id',
  [param('id').notEmpty().withMessage('id is required')],
  validationResultHandler,
  controller.deleteModel
);

module.exports = router;

