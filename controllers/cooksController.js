const cookProfileModel = require("../models/cookProfileModel");
const dishModel = require("../models/dishModel");

// ---------------------- LIST ACTIVE COOKS (customer browse) ----------------------
const getCooks = async (req, res) => {
  try {
    const { search, area } = req.query;
    const cooks = await cookProfileModel.listActiveCooks({ search, area });
    res.status(200).json({ success: true, data: cooks });
  } catch (error) {
    console.error("Error fetching cooks:", error);
    res.status(500).json({
      success: false,
      message: error?.sqlMessage || error?.message || "Internal server error",
    });
  }
};

// ---------------------- SINGLE COOK + VISIBLE DISHES ----------------------
const getCookById = async (req, res) => {
  try {
    const { id } = req.params;
    const cook = await cookProfileModel.getActiveCookById(id);
    if (!cook) {
      return res.status(404).json({ success: false, message: "Cook not found" });
    }

    const dishes = await dishModel.listVisibleByCook(id);
    res.status(200).json({ success: true, data: { ...cook, dishes } });
  } catch (error) {
    console.error("Error fetching cook:", error);
    res.status(500).json({
      success: false,
      message: error?.sqlMessage || error?.message || "Internal server error",
    });
  }
};

module.exports = { getCooks, getCookById };
