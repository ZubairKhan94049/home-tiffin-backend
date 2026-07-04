const notificationModel = require("../models/notificationModel");

// ---------------------- MY NOTIFICATIONS ----------------------
const getNotifications = async (req, res) => {
  try {
    const notifications = await notificationModel.listByUser(req.user.id);
    res.status(200).json({ success: true, data: notifications });
  } catch (error) {
    console.error("Error fetching notifications:", error);
    res.status(500).json({
      success: false,
      message: error?.sqlMessage || error?.message || "Internal server error",
    });
  }
};

// ---------------------- MARK ALL READ ----------------------
const readAllNotifications = async (req, res) => {
  try {
    await notificationModel.markAllRead(req.user.id);
    res
      .status(200)
      .json({ success: true, message: "All notifications marked as read" });
  } catch (error) {
    console.error("Error marking notifications read:", error);
    res.status(500).json({
      success: false,
      message: error?.sqlMessage || error?.message || "Internal server error",
    });
  }
};

module.exports = { getNotifications, readAllNotifications };
