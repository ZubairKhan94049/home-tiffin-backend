const dishModel = require("../models/dishModel");
const favouriteModel = require("../models/favouriteModel");

// ---------------------- POPULAR DISHES ----------------------
const getPopularDishes = async (req, res) => {
  try {
    const limit = req.query.limit ? Number(req.query.limit) : 10;
    const dishes = await dishModel.listPopular(limit);
    res.status(200).json({ success: true, data: dishes });
  } catch (error) {
    console.error("Error fetching popular dishes:", error);
    res.status(500).json({
      success: false,
      message: error?.sqlMessage || error?.message || "Internal server error",
    });
  }
};

// ---------------------- SEARCH ----------------------
const searchDishes = async (req, res) => {
  try {
    const term = `${req.query.q ?? ""}`.trim();
    // One letter matches nearly everything and tells the customer nothing.
    if (term.length < 2) {
      return res.status(200).json({ success: true, data: [] });
    }
    const dishes = await dishModel.search(term.slice(0, 60));
    res.status(200).json({ success: true, data: dishes });
  } catch (error) {
    console.error("Error searching dishes:", error);
    res.status(500).json({
      success: false,
      message: error?.sqlMessage || error?.message || "Internal server error",
    });
  }
};

// ---------------------- ONE DISH ----------------------
/// A single orderable dish, for anything that links straight to one — a home
/// banner, for instance. Hidden dishes and inactive cooks are a 404, the same
/// as they are everywhere else a customer looks.
const getDishById = async (req, res) => {
  try {
    const dish = await dishModel.getVisibleById(Number(req.params.id));
    if (!dish) return fail(res, 404, "Dish not found");
    res.status(200).json({ success: true, data: dish });
  } catch (error) {
    console.error("Error fetching dish:", error);
    res.status(500).json({
      success: false,
      message: error?.sqlMessage || error?.message || "Internal server error",
    });
  }
};

// ---------------------- FAVOURITES ----------------------

const fail = (res, code, message) =>
  res.status(code).json({ success: false, message });

/// The Favourites screen, with every dish's photos and variations attached
/// the same way the menus have them.
const getFavourites = async (req, res) => {
  try {
    const rows = await favouriteModel.listForCustomer(req.user.id);
    const withChildren = rows.length
      ? await dishModel.getByIds(rows.map((row) => row.id))
      : [];
    const byId = new Map(withChildren.map((dish) => [dish.id, dish]));
    res.status(200).json({
      success: true,
      data: rows.map((row) => ({ ...row, ...byId.get(row.id), is_favourite: true })),
    });
  } catch (error) {
    console.error("Error fetching favourites:", error);
    res.status(500).json({
      success: false,
      message: error?.sqlMessage || error?.message || "Internal server error",
    });
  }
};

/// Just the ids, so any list of dishes can show which hearts are filled
/// without fetching the full favourites.
const getFavouriteIds = async (req, res) => {
  try {
    res.status(200).json({
      success: true,
      data: await favouriteModel.idsForCustomer(req.user.id),
    });
  } catch (error) {
    console.error("Error fetching favourite ids:", error);
    res.status(500).json({
      success: false,
      message: error?.sqlMessage || error?.message || "Internal server error",
    });
  }
};

const addFavourite = async (req, res) => {
  try {
    const dish = await dishModel.getById(req.params.id);
    if (!dish || dish.is_hidden) return fail(res, 404, "Dish not found");
    await favouriteModel.add(req.user.id, dish.id);
    res.status(200).json({ success: true, message: "Added to favourites" });
  } catch (error) {
    console.error("Error adding favourite:", error);
    res.status(500).json({
      success: false,
      message: error?.sqlMessage || error?.message || "Internal server error",
    });
  }
};

const removeFavourite = async (req, res) => {
  try {
    await favouriteModel.remove(req.user.id, Number(req.params.id));
    res.status(200).json({ success: true, message: "Removed from favourites" });
  } catch (error) {
    console.error("Error removing favourite:", error);
    res.status(500).json({
      success: false,
      message: error?.sqlMessage || error?.message || "Internal server error",
    });
  }
};

module.exports = {
  getPopularDishes,
  searchDishes,
  getDishById,
  getFavourites,
  getFavouriteIds,
  addFavourite,
  removeFavourite,
};
