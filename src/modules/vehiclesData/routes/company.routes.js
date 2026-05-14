const express = require('express');
const { body, param } = require('express-validator');
const router = express.Router();
const controller = require('../controllers/company.controller');
const { validationResultHandler } = require('../../../middlewares/error.middleware');

router.post(
  '/',
  [body('name').notEmpty().withMessage('Name is required'), body('category').notEmpty().withMessage('Category is required')],
  validationResultHandler,
  controller.createCompany
);

router.get('/', controller.getCompanies);

router.get('/by-category/:categoryId', controller.getCompaniesByCategory);

router.get(
  '/:id',
  [param('id').notEmpty().withMessage('id is required')],
  validationResultHandler,
  controller.getCompanyById
);

router.put(
  '/:id',
  [param('id').notEmpty().withMessage('id is required')],
  validationResultHandler,
  controller.updateCompany
);

router.delete(
  '/:id',
  [param('id').notEmpty().withMessage('id is required')],
  validationResultHandler,
  controller.deleteCompany
);

module.exports = router;

