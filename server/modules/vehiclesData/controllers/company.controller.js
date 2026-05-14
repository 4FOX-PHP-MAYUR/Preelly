const mongoose = require('mongoose');
const VehicleCompany = require('../models/company.model');
const VehicleCategory = require('../models/category.model');
const { success, error: apiError } = require('../../../utils/apiResponse');

const buildQuery = ({ search, status, category }) => {
  const q = {};
  if (typeof status !== 'undefined') {
    q.status = status === 'true' || status === true;
  }
  if (search) {
    q.name = { $regex: search, $options: 'i' };
  }
  if (category && mongoose.Types.ObjectId.isValid(category)) {
    q.category = category;
  }
  return q;
};

exports.createCompany = async (req, res, next) => {
  try {
    const { name, category, logo, status } = req.body;
    if (!name || !category) {
      return apiError(res, 'Name and category are required', null, 400);
    }
    if (!mongoose.Types.ObjectId.isValid(category)) {
      return apiError(res, 'Invalid category id', null, 400);
    }
    const categoryExists = await VehicleCategory.findById(category);
    if (!categoryExists) {
      return apiError(res, 'Category not found', null, 404);
    }

    const company = new VehicleCompany({
      name: name.trim(),
      category,
      logo,
      status,
    });
    const saved = await company.save();
    return success(res, 'Company created', saved, null, 201);
  } catch (err) {
    if (err.code === 11000) {
      return apiError(res, 'Company with this name already exists in the category', null, 409);
    }
    next(err);
  }
};

exports.getCompanies = async (req, res, next) => {
  try {
    const page = Math.max(1, parseInt(req.query.page || '1', 10));
    const limit = Math.max(1, parseInt(req.query.limit || '10', 10));
    const skip = (page - 1) * limit;
    const { search, sort, status, category } = req.query;

    const q = buildQuery({ search, status, category });

    const [items, total] = await Promise.all([
      VehicleCompany.find(q)
        .populate('category', 'name')
        .sort(sort || '-createdAt')
        .skip(skip)
        .limit(limit),
      VehicleCompany.countDocuments(q),
    ]);

    return success(res, 'Companies retrieved', items, { page, limit, total });
  } catch (err) {
    next(err);
  }
};

exports.getCompaniesByCategory = async (req, res, next) => {
  try {
    const { categoryId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(categoryId)) {
      return apiError(res, 'Invalid category id', null, 400);
    }
    const items = await VehicleCompany.find({ category: categoryId, status: true }).select('_id name');
    return success(res, 'Companies by category', items);
  } catch (err) {
    next(err);
  }
};

exports.getCompanyById = async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return apiError(res, 'Invalid company id', null, 400);
    }
    const company = await VehicleCompany.findById(id).populate('category', 'name');
    if (!company) {
      return apiError(res, 'Company not found', null, 404);
    }
    return success(res, 'Company retrieved', company);
  } catch (err) {
    next(err);
  }
};

exports.updateCompany = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { name, category, logo, status } = req.body;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return apiError(res, 'Invalid company id', null, 400);
    }
    const update = {};
    if (typeof name !== 'undefined') update.name = name.trim();
    if (typeof logo !== 'undefined') update.logo = logo;
    if (typeof status !== 'undefined') update.status = status;
    if (typeof category !== 'undefined') {
      if (!mongoose.Types.ObjectId.isValid(category)) {
        return apiError(res, 'Invalid category id', null, 400);
      }
      const cat = await VehicleCategory.findById(category);
      if (!cat) {
        return apiError(res, 'Category not found', null, 404);
      }
      update.category = category;
    }

    const updated = await VehicleCompany.findByIdAndUpdate(id, update, { new: true, runValidators: true });
    if (!updated) {
      return apiError(res, 'Company not found', null, 404);
    }
    return success(res, 'Company updated', updated);
  } catch (err) {
    if (err.code === 11000) {
      return apiError(res, 'Company with this name already exists in the category', null, 409);
    }
    next(err);
  }
};

exports.deleteCompany = async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return apiError(res, 'Invalid company id', null, 400);
    }
    const removed = await VehicleCompany.findByIdAndDelete(id);
    if (!removed) {
      return apiError(res, 'Company not found', null, 404);
    }
    return success(res, 'Company deleted', removed);
  } catch (err) {
    next(err);
  }
};

