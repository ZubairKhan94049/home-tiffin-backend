const express = require("express");
const router = express.Router();
const notificationController = require("../controllers/notificationController");
const authMiddleware = require("../middleware/authMiddleware");

// All notification routes require authentication
router.use(authMiddleware);

/**
 * @route   GET /api/v1/notifications
 * @desc    My notifications (newest first)
 * @access  Private
 */
router.get("/", notificationController.getNotifications);

/**
 * @route   POST /api/v1/notifications/read-all
 * @desc    Mark all my notifications as read
 * @access  Private
 */
router.post("/read-all", notificationController.readAllNotifications);

module.exports = router;
