const mongoose = require('mongoose');
const VehicleModel = require('../models/vehicleModel.model');
const VehicleCategory = require('../models/category.model');
const VehicleCompany = require('../models/company.model');
const { success, error: apiError } = require('../../../utils/apiResponse');

const buildQuery = ({ search, status, category, company }) => {
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
  if (company && mongoose.Types.ObjectId.isValid(company)) {
    q.company = company;
  }
  return q;
};

exports.createModel = async (req, res, next) => {
  try {
    const { name, category, company, status } = req.body;
    if (!name || !category || !company) {
      return apiError(res, 'Name, category and company are required', null, 400);
    }
    if (!mongoose.Types.ObjectId.isValid(category) || !mongoose.Types.ObjectId.isValid(company)) {
      return apiError(res, 'Invalid category or company id', null, 400);
    }
    const [cat, comp] = await Promise.all([VehicleCategory.findById(category), VehicleCompany.findById(company)]);
    if (!cat) return apiError(res, 'Category not found', null, 404);
    if (!comp) return apiError(res, 'Company not found', null, 404);

    const model = new VehicleModel({
      name: name.trim(),
      category,
      company,
      status,
    });
    const saved = await model.save();
    return success(res, 'Vehicle model created', saved, null, 201);
  } catch (err) {
    if (err.code === 11000) {
      return apiError(res, 'Model with this name already exists under the company/category', null, 409);
    }
    next(err);
  }
};

exports.getModels = async (req, res, next) => {
  try {
    const page = Math.max(1, parseInt(req.query.page || '1', 10));
    const limit = Math.max(1, parseInt(req.query.limit || '10', 10));
    const skip = (page - 1) * limit;
    const { search, sort, status, category, company } = req.query;

    const q = buildQuery({ search, status, category, company });

    const [items, total] = await Promise.all([
      VehicleModel.find(q)
        .populate('company', 'name')
        .populate('category', 'name')
        .sort(sort || '-createdAt')
        .skip(skip)
        .limit(limit),
      VehicleModel.countDocuments(q),
    ]);

    return success(res, 'Vehicle models retrieved', items, { page, limit, total });
  } catch (err) {
    next(err);
  }
};

exports.getModelsByCompany = async (req, res, next) => {
  try {
    const { companyId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(companyId)) {
      return apiError(res, 'Invalid company id', null, 400);
    }
    const items = await VehicleModel.find({ company: companyId, status: true }).select('_id name');
    return success(res, 'Models by company', items);
  } catch (err) {
    next(err);
  }
};

exports.filterModels = async (req, res, next) => {
  try {
    const { category, company } = req.query;
    const q = buildQuery({ category, company, status: true });
    const items = await VehicleModel.find(q).select('_id name');
    return success(res, 'Filtered models', items);
  } catch (err) {
    next(err);
  }
};

exports.getModelById = async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return apiError(res, 'Invalid model id', null, 400);
    }
    const model = await VehicleModel.findById(id).populate('company', 'name').populate('category', 'name');
    if (!model) {
      return apiError(res, 'Model not found', null, 404);
    }
    return success(res, 'Model retrieved', model);
  } catch (err) {
    next(err);
  }
};

exports.updateModel = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { name, category, company, status } = req.body;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return apiError(res, 'Invalid model id', null, 400);
    }
    const update = {};
    if (typeof name !== 'undefined') update.name = name.trim();
    if (typeof status !== 'undefined') update.status = status;
    if (typeof category !== 'undefined') {
      if (!mongoose.Types.ObjectId.isValid(category)) {
        return apiError(res, 'Invalid category id', null, 400);
      }
      const cat = await VehicleCategory.findById(category);
      if (!cat) return apiError(res, 'Category not found', null, 404);
      update.category = category;
    }
    if (typeof company !== 'undefined') {
      if (!mongoose.Types.ObjectId.isValid(company)) {
        return apiError(res, 'Invalid company id', null, 400);
      }
      const comp = await VehicleCompany.findById(company);
      if (!comp) return apiError(res, 'Company not found', null, 404);
      update.company = company;
    }

    const updated = await VehicleModel.findByIdAndUpdate(id, update, { new: true, runValidators: true });
    if (!updated) {
      return apiError(res, 'Model not found', null, 404);
    }
    return success(res, 'Model updated', updated);
  } catch (err) {
    if (err.code === 11000) {
      return apiError(res, 'Model with this name already exists under the company/category', null, 409);
    }
    next(err);
  }
};

exports.deleteModel = async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return apiError(res, 'Invalid model id', null, 400);
    }
    const removed = await VehicleModel.findByIdAndDelete(id);
    if (!removed) {
      return apiError(res, 'Model not found', null, 404);
    }
    return success(res, 'Model deleted', removed);
  } catch (err) {
    next(err);
  }
};

