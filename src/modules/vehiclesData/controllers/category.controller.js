const mongoose = require('mongoose');
const VehicleCategory = require('../models/category.model');
const { success, error: apiError } = require('../../../utils/apiResponse');

// Helpers for query building
const buildQuery = ({ search, status }) => {
  const q = {};
  if (typeof status !== 'undefined') {
    q.status = status === 'true' || status === true;
  }
  if (search) {
    q.name = { $regex: search, $options: 'i' };
  }
  return q;
};

exports.createCategory = async (req, res, next) => {
  try {
    const { name, status } = req.body;
    if (!name) {
      return apiError(res, 'Name is required', null, 400);
    }

    const category = new VehicleCategory({ name: name.trim(), status });
    const saved = await category.save();
    return success(res, 'Category created', saved, null, 201);
  } catch (err) {
    // Duplicate key handling
    if (err.code === 11000) {
      return apiError(res, 'Category with this name already exists', null, 409);
    }
    next(err);
  }
};

exports.getCategories = async (req, res, next) => {
  try {
    const page = Math.max(1, parseInt(req.query.page || '1', 10));
    const limit = Math.max(1, parseInt(req.query.limit || '10', 10));
    const skip = (page - 1) * limit;
    const { search, sort, status } = req.query;

    const q = buildQuery({ search, status });

    const [items, total] = await Promise.all([
      VehicleCategory.find(q)
        .sort(sort || '-createdAt')
        .skip(skip)
        .limit(limit),
      VehicleCategory.countDocuments(q),
    ]);

    return success(res, 'Categories retrieved', items, { page, limit, total });
  } catch (err) {
    next(err);
  }
};

exports.getCategoryById = async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return apiError(res, 'Invalid category id', null, 400);
    }
    const category = await VehicleCategory.findById(id);
    if (!category) {
      return apiError(res, 'Category not found', null, 404);
    }
    return success(res, 'Category retrieved', category);
  } catch (err) {
    next(err);
  }
};

exports.updateCategory = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { name, status } = req.body;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return apiError(res, 'Invalid category id', null, 400);
    }
    const update = {};
    if (typeof name !== 'undefined') update.name = name.trim();
    if (typeof status !== 'undefined') update.status = status;

    const updated = await VehicleCategory.findByIdAndUpdate(id, update, { new: true, runValidators: true });
    if (!updated) {
      return apiError(res, 'Category not found', null, 404);
    }
    return success(res, 'Category updated', updated);
  } catch (err) {
    if (err.code === 11000) {
      return apiError(res, 'Category with this name already exists', null, 409);
    }
    next(err);
  }
};

exports.deleteCategory = async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return apiError(res, 'Invalid category id', null, 400);
    }
    const removed = await VehicleCategory.findByIdAndDelete(id);
    if (!removed) {
      return apiError(res, 'Category not found', null, 404);
    }
    return success(res, 'Category deleted', removed);
  } catch (err) {
    next(err);
  }
};

