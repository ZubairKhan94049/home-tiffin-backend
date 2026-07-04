const express = require("express");
const router = express.Router();
const cooksController = require("../controllers/cooksController");
const authMiddleware = require("../middleware/authMiddleware");

// All cook browsing routes require authentication
router.use(authMiddleware);

/**
 * @route   GET /api/v1/cooks?search=&area=
 * @desc    Active cooks with profile, rating, open flag and dish count
 * @access  Private
 */
router.get("/", cooksController.getCooks);

/**
 * @route   GET /api/v1/cooks/:id
 * @desc    Single cook profile + visible dishes (available && !hidden)
 * @access  Private
 */
router.get("/:id", cooksController.getCookById);

module.exports = router;
