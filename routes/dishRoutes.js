const express = require("express");
const router = express.Router();
const dishController = require("../controllers/dishController");
const categoryController = require("../controllers/categoryController");
const authMiddleware = require("../middleware/authMiddleware");

// All dish browsing routes require authentication
router.use(authMiddleware);

/**
 * @route   GET /api/v1/dishes/popular
 * @desc    Top dishes across active cooks
 * @access  Private
 */
router.get("/popular", dishController.getPopularDishes);

/**
 * @route   GET /api/v1/dishes/search?q=
 * @desc    Dishes matching the name, description, category or kitchen name.
 *          Two characters minimum; only orderable dishes.
 * @access  Private
 */
router.get("/search", dishController.searchDishes);

/**
 * @route   GET /api/v1/dishes/favourites
 * @desc    My favourite dishes, newest first. Hidden dishes and inactive
 *          cooks are left out.
 * @access  Private
 */
router.get("/favourites", dishController.getFavourites);

/**
 * @route   GET /api/v1/dishes/favourites/ids
 * @desc    Just the dish ids, to fill in the hearts on any list.
 * @access  Private
 */
router.get("/favourites/ids", dishController.getFavouriteIds);

/**
 * @route   PUT /api/v1/dishes/:id/favourite
 * @desc    Heart a dish. Idempotent.
 * @access  Private
 */
router.put("/:id/favourite", dishController.addFavourite);

/**
 * @route   DELETE /api/v1/dishes/:id/favourite
 * @desc    Un-heart it.
 * @access  Private
 */
router.delete("/:id/favourite", dishController.removeFavourite);

/**
 * @route   GET /api/v1/dishes/category/:id
 * @desc    Orderable dishes filed under one category.
 * @access  Private
 */
router.get("/category/:id", categoryController.getCategoryDishes);

/**
 * @route   GET /api/v1/dishes/:id
 * @desc    One orderable dish with its kitchen. Last, so it never swallows
 *          /popular, /search or /favourites.
 * @access  Private
 */
router.get("/:id", dishController.getDishById);

module.exports = router;
