const express = require("express");
const router = express.Router();
const dishController = require("../controllers/dishController");
const authMiddleware = require("../middleware/authMiddleware");

// All dish browsing routes require authentication
router.use(authMiddleware);

/**
 * @route   GET /api/v1/dishes/popular
 * @desc    Top dishes across active cooks
 * @access  Private
 */
router.get("/popular", dishController.getPopularDishes);

module.exports = router;
