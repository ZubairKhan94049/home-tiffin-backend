const dishModel = require("../models/dishModel");

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

module.exports = { getPopularDishes };
