const express = require("express");
const router = express.Router();
const addressController = require("../controllers/addressController");
const authMiddleware = require("../middleware/authMiddleware");

// All address routes require authentication
router.use(authMiddleware);

/**
 * @route   GET /api/v1/addresses
 * @desc    List my addresses (default first)
 * @access  Private
 */
router.get("/", addressController.getAddresses);

/**
 * @route   POST /api/v1/addresses
 * @desc    Create an address (first one becomes default)
 * @access  Private
 */
router.post("/", addressController.createAddress);

/**
 * @route   PUT /api/v1/addresses/:id
 * @desc    Update my address
 * @access  Private
 */
router.put("/:id", addressController.updateAddress);

/**
 * @route   DELETE /api/v1/addresses/:id
 * @desc    Delete my address
 * @access  Private
 */
router.delete("/:id", addressController.deleteAddress);

/**
 * @route   POST /api/v1/addresses/:id/default
 * @desc    Set my address as default
 * @access  Private
 */
router.post("/:id/default", addressController.setDefaultAddress);

module.exports = router;
