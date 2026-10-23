const categoryModel = require("../models/categoryModel");
const dishModel = require("../models/dishModel");

const fail = (res, code, message) =>
  res.status(code).json({ success: false, message });

const serverError = (res, label, error) => {
  console.error(`Error ${label}:`, error);
  return res.status(500).json({
    success: false,
    message: error?.sqlMessage || error?.message || "Internal server error",
  });
};

const flag = (value) =>
  value === undefined
    ? undefined
    : value === true || value === 1 || value === "1" || value === "true" ? 1 : 0;

const text = (value, max) => {
  if (value === undefined) return undefined;
  const trimmed = `${value ?? ""}`.trim();
  return trimmed ? trimmed.slice(0, max) : null;
};

/// Normalises the admin form. A category needs a name and something to show
/// as its icon — an emoji or an image.
const parseCategory = async (body, file, existing = {}) => {
  const data = {
    name: text(body.name, 80),
    description: text(body.description, 160),
    // An emoji is a handful of code points; 16 bytes is room for flags and
    // skin tones, and stops someone pasting a sentence in.
    emoji: text(body.emoji, 16),
    is_active: flag(body.is_active),
    show_on_home: flag(body.show_on_home),
  };
  if (file) data.image = `/uploads/${file.filename}`;
  else if (body.remove_image === "true" || body.remove_image === true) data.image = null;

  const merged = {
    ...existing,
    ...Object.fromEntries(Object.entries(data).filter(([, v]) => v !== undefined)),
  };
  if (!merged.name) return { error: "A category needs a name" };
  if (!merged.emoji && !merged.image) {
    return { error: "Give it an icon — an emoji or an image" };
  }
  if (data.name) {
    const clash = await categoryModel.findByName(data.name);
    if (clash && clash.id !== existing.id) {
      return { error: `There is already a category called "${clash.name}"` };
    }
  }
  return {
    data: Object.fromEntries(Object.entries(data).filter(([, v]) => v !== undefined)),
  };
};

// ---------------------- PUBLIC / CUSTOMER ----------------------

/// `?home=1` is the customer home row; without it, every active category —
/// what the cook's picker and the customer's browse list show.
const getCategories = async (req, res) => {
  try {
    const homeOnly = req.query.home === "1" || req.query.home === "true";
    res.status(200).json({
      success: true,
      data: await categoryModel.listActive({ homeOnly }),
    });
  } catch (error) {
    return serverError(res, "fetching categories", error);
  }
};

/// What a customer sees after tapping a category tile.
const getCategoryDishes = async (req, res) => {
  try {
    const category = await categoryModel.getById(Number(req.params.id));
    if (!category || !category.is_active) return fail(res, 404, "Category not found");
    const dishes = await dishModel.listVisibleByCategory(category.id);
    res.status(200).json({
      success: true,
      data: { category: { id: category.id, name: category.name }, dishes },
    });
  } catch (error) {
    return serverError(res, "fetching category dishes", error);
  }
};

// ---------------------- ADMIN ----------------------

const listCategories = async (req, res) => {
  try {
    res.status(200).json({ success: true, data: await categoryModel.listAll() });
  } catch (error) {
    return serverError(res, "listing categories", error);
  }
};

const createCategory = async (req, res) => {
  try {
    const parsed = await parseCategory(req.body, req.file);
    if (parsed.error) return fail(res, 400, parsed.error);
    const id = await categoryModel.create({
      sort_order: await categoryModel.nextSortOrder(),
      ...parsed.data,
    });
    res.status(201).json({ success: true, data: await categoryModel.getById(id) });
  } catch (error) {
    return serverError(res, "creating category", error);
  }
};

const updateCategory = async (req, res) => {
  try {
    const existing = await categoryModel.getById(Number(req.params.id));
    if (!existing) return fail(res, 404, "Category not found");
    const parsed = await parseCategory(req.body, req.file, existing);
    if (parsed.error) return fail(res, 400, parsed.error);
    await categoryModel.update(existing.id, parsed.data);
    res.status(200).json({ success: true, data: await categoryModel.getById(existing.id) });
  } catch (error) {
    return serverError(res, "updating category", error);
  }
};

/// Deleting a category that dishes use would leave them filed under nothing,
/// so it is refused with the count — hiding it is the safe way out.
const deleteCategory = async (req, res) => {
  try {
    const existing = await categoryModel.getById(Number(req.params.id));
    if (!existing) return fail(res, 404, "Category not found");
    const count = Number(existing.dish_count);
    if (count > 0) {
      return fail(
        res,
        409,
        `${count} ${count === 1 ? "dish uses" : "dishes use"} this category. Hide it instead, or move those dishes first.`
      );
    }
    await categoryModel.remove(existing.id);
    res.status(200).json({ success: true, message: "Category deleted" });
  } catch (error) {
    return serverError(res, "deleting category", error);
  }
};

const reorderCategories = async (req, res) => {
  try {
    const ids = Array.isArray(req.body.ids) ? req.body.ids.map(Number) : [];
    if (!ids.length || ids.some((id) => !Number.isInteger(id))) {
      return fail(res, 400, "Send ids as an array, first to last");
    }
    await categoryModel.reorder(ids);
    res.status(200).json({ success: true, data: await categoryModel.listAll() });
  } catch (error) {
    return serverError(res, "reordering categories", error);
  }
};

module.exports = {
  getCategories,
  getCategoryDishes,
  listCategories,
  createCategory,
  updateCategory,
  deleteCategory,
  reorderCategories,
};
