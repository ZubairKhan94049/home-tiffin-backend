const express = require("express");
const router = express.Router();
const bannerController = require("../controllers/bannerController");
const authMiddleware = require("../middleware/authMiddleware");

router.use(authMiddleware);

/**
 * @route   GET /api/v1/banners
 * @desc    The home carousel: active banners inside their schedule, in order.
 * @access  Private
 */
router.get("/", bannerController.getLiveBanners);

module.exports = router;
