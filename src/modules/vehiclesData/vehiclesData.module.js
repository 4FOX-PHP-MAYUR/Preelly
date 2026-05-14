const express = require('express');

const categoryRoutes = require('./routes/category.routes');
const companyRoutes = require('./routes/company.routes');
const modelRoutes = require('./routes/vehicleModel.routes');
const trimRoutes = require('./routes/trim.routes');

const basePath = '/api/admin/vehicles-data';

module.exports = {
  register: (app) => {
    const router = express.Router();

    router.use('/categories', categoryRoutes);
    router.use('/companies', companyRoutes);
    router.use('/models', modelRoutes);
    router.use('/trims', trimRoutes);

    app.use(basePath, router);
  },
  basePath,
};

