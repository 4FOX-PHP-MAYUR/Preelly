const mongoose = require('mongoose');
const VehicleTrim = require('../models/trim.model');
const VehicleCategory = require('../models/category.model');
const VehicleCompany = require('../models/company.model');
const VehicleModel = require('../models/vehicleModel.model');
const { success, error: apiError } = require('../../../utils/apiResponse');

const buildQuery = ({ search, status, category, company, model }) => {
  const q = {};
  if (typeof status !== 'undefined') {
    q.status = status === 'true' || status === true;
  }
  if (search) {
    q.name = { $regex: search, $options: 'i' };
  }
  if (category && mongoose.Types.ObjectId.isValid(category)) q.category = category;
  if (company && mongoose.Types.ObjectId.isValid(company)) q.company = company;
  if (model && mongoose.Types.ObjectId.isValid(model)) q.model = model;
  return q;
};

exports.createTrim = async (req, res, next) => {
  try {
    const { name, category, company, model, price, status } = req.body;
    if (!name || !category || !company || !model) {
      return apiError(res, 'Name, category, company and model are required', null, 400);
    }
    if (
      !mongoose.Types.ObjectId.isValid(category) ||
      !mongoose.Types.ObjectId.isValid(company) ||
      !mongoose.Types.ObjectId.isValid(model)
    ) {
      return apiError(res, 'Invalid category/company/model id', null, 400);
    }

    const [cat, comp, mod] = await Promise.all([
      VehicleCategory.findById(category),
      VehicleCompany.findById(company),
      VehicleModel.findById(model),
    ]);
    if (!cat) return apiError(res, 'Category not found', null, 404);
    if (!comp) return apiError(res, 'Company not found', null, 404);
    if (!mod) return apiError(res, 'Model not found', null, 404);

    const trim = new VehicleTrim({
      name: name.trim(),
      category,
      company,
      model,
      price,
      status,
    });
    const saved = await trim.save();
    return success(res, 'Trim created', saved, null, 201);
  } catch (err) {
    if (err.code === 11000) {
      return apiError(res, 'Trim with this name already exists in the hierarchy', null, 409);
    }
    next(err);
  }
};

exports.getTrims = async (req, res, next) => {
  try {
    const page = Math.max(1, parseInt(req.query.page || '1', 10));
    const limit = Math.max(1, parseInt(req.query.limit || '10', 10));
    const skip = (page - 1) * limit;
    const { search, sort, status, category, company, model } = req.query;

    const q = buildQuery({ search, status, category, company, model });

    const [items, total] = await Promise.all([
      VehicleTrim.find(q)
        .populate('category', 'name')
        .populate('company', 'name')
        .populate('model', 'name')
        .sort(sort || '-createdAt')
        .skip(skip)
        .limit(limit),
      VehicleTrim.countDocuments(q),
    ]);

    return success(res, 'Trims retrieved', items, { page, limit, total });
  } catch (err) {
    next(err);
  }
};

exports.filterTrims = async (req, res, next) => {
  try {
    const { category, company, model } = req.query;
    const q = buildQuery({ category, company, model, status: true });
    const items = await VehicleTrim.find(q).select('_id name price');
    return success(res, 'Filtered trims', items);
  } catch (err) {
    next(err);
  }
};

exports.getTrimById = async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return apiError(res, 'Invalid trim id', null, 400);
    }
    const trim = await VehicleTrim.findById(id).populate('category company model', 'name');
    if (!trim) {
      return apiError(res, 'Trim not found', null, 404);
    }
    return success(res, 'Trim retrieved', trim);
  } catch (err) {
    next(err);
  }
};

exports.updateTrim = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { name, category, company, model, price, status } = req.body;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return apiError(res, 'Invalid trim id', null, 400);
    }
    const update = {};
    if (typeof name !== 'undefined') update.name = name.trim();
    if (typeof price !== 'undefined') update.price = price;
    if (typeof status !== 'undefined') update.status = status;
    if (typeof category !== 'undefined') {
      if (!mongoose.Types.ObjectId.isValid(category)) return apiError(res, 'Invalid category id', null, 400);
      const cat = await VehicleCategory.findById(category);
      if (!cat) return apiError(res, 'Category not found', null, 404);
      update.category = category;
    }
    if (typeof company !== 'undefined') {
      if (!mongoose.Types.ObjectId.isValid(company)) return apiError(res, 'Invalid company id', null, 400);
      const comp = await VehicleCompany.findById(company);
      if (!comp) return apiError(res, 'Company not found', null, 404);
      update.company = company;
    }
    if (typeof model !== 'undefined') {
      if (!mongoose.Types.ObjectId.isValid(model)) return apiError(res, 'Invalid model id', null, 400);
      const mod = await VehicleModel.findById(model);
      if (!mod) return apiError(res, 'Model not found', null, 404);
      update.model = model;
    }

    const updated = await VehicleTrim.findByIdAndUpdate(id, update, { new: true, runValidators: true });
    if (!updated) {
      return apiError(res, 'Trim not found', null, 404);
    }
    return success(res, 'Trim updated', updated);
  } catch (err) {
    if (err.code === 11000) {
      return apiError(res, 'Trim with this name already exists in the hierarchy', null, 409);
    }
    next(err);
  }
};

exports.deleteTrim = async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return apiError(res, 'Invalid trim id', null, 400);
    }
    const removed = await VehicleTrim.findByIdAndDelete(id);
    if (!removed) {
      return apiError(res, 'Trim not found', null, 404);
    }
    return success(res, 'Trim deleted', removed);
  } catch (err) {
    next(err);
  }
};

