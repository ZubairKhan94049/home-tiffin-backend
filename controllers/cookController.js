const orderModel = require("../models/orderModel");
const dishModel = require("../models/dishModel");
const cookProfileModel = require("../models/cookProfileModel");
const settingsModel = require("../models/settingsModel");
const settlementModel = require("../models/settlementModel");
const notificationModel = require("../models/notificationModel");
const ORDERS = require("../config/tableColumns/tblordersColumns");
const DISHES = require("../config/tableColumns/tbldishesColumns");
const COOK_PROFILES = require("../config/tableColumns/tblcookprofilesColumns");

// ---------------------- DASHBOARD ----------------------
const getDashboard = async (req, res) => {
  try {
    const profile = await cookProfileModel.getByUserId(req.user.id);
    if (!profile) {
      return res
        .status(404)
        .json({ success: false, message: "Cook profile not found" });
    }

    const settings = await settingsModel.getSettings();
    const todayStats = await orderModel.cookTodayStats(
      req.user.id,
      Number(settings.commission_pct)
    );
    const dishCounts = await dishModel.countsForCook(req.user.id);

    res.status(200).json({
      success: true,
      data: {
        orders_today: Number(todayStats.orders_today),
        earnings_today: Number(todayStats.earnings_today),
        pending_orders: Number(todayStats.pending_orders),
        rating: Number(profile[COOK_PROFILES.RATING]),
        total_reviews: profile[COOK_PROFILES.TOTAL_REVIEWS],
        is_kitchen_open: profile[COOK_PROFILES.IS_KITCHEN_OPEN],
        available_dishes: Number(dishCounts.available_dishes),
        total_dishes: Number(dishCounts.total_dishes),
      },
    });
  } catch (error) {
    console.error("Error fetching cook dashboard:", error);
    res.status(500).json({
      success: false,
      message: error?.sqlMessage || error?.message || "Internal server error",
    });
  }
};

// ---------------------- TOGGLE KITCHEN ----------------------
const toggleKitchen = async (req, res) => {
  try {
    const profile = await cookProfileModel.getByUserId(req.user.id);
    if (!profile) {
      return res
        .status(404)
        .json({ success: false, message: "Cook profile not found" });
    }

    const newState = profile[COOK_PROFILES.IS_KITCHEN_OPEN] ? 0 : 1;
    await cookProfileModel.updateByUserId(req.user.id, {
      [COOK_PROFILES.IS_KITCHEN_OPEN]: newState,
    });

    res.status(200).json({
      success: true,
      message: newState ? "Kitchen is now open" : "Kitchen is now closed",
      data: { is_kitchen_open: newState },
    });
  } catch (error) {
    console.error("Error toggling kitchen:", error);
    res.status(500).json({
      success: false,
      message: error?.sqlMessage || error?.message || "Internal server error",
    });
  }
};

// ---------------------- MY DISHES ----------------------
const getDishes = async (req, res) => {
  try {
    const dishes = await dishModel.listByCook(req.user.id);
    res.status(200).json({ success: true, data: dishes });
  } catch (error) {
    console.error("Error fetching dishes:", error);
    res.status(500).json({
      success: false,
      message: error?.sqlMessage || error?.message || "Internal server error",
    });
  }
};

// ---------------------- CREATE DISH ----------------------
const createDish = async (req, res) => {
  try {
    const {
      name,
      description,
      category,
      price,
      is_veg,
      spice_level,
      prep_time_minutes,
      daily_quantity,
    } = req.body;

    if (!name || !category || !price) {
      return res.status(400).json({
        success: false,
        message: "Name, category and price are required",
      });
    }

    if (Number(price) <= 0) {
      return res
        .status(400)
        .json({ success: false, message: "Price must be greater than zero" });
    }

    const image = req.file ? `/uploads/${req.file.filename}` : null;

    const dishId = await dishModel.createDish({
      cook_id: req.user.id,
      name,
      description,
      category,
      price: Number(price),
      is_veg: is_veg === "1" || is_veg === 1 || is_veg === true || is_veg === "true" ? 1 : 0,
      spice_level: spice_level ? Number(spice_level) : 1,
      prep_time_minutes: prep_time_minutes ? Number(prep_time_minutes) : 30,
      daily_quantity: daily_quantity ? Number(daily_quantity) : null,
      image,
    });

    const dish = await dishModel.getById(dishId);
    res.status(201).json({ success: true, data: dish });
  } catch (error) {
    console.error("Error creating dish:", error);
    res.status(500).json({
      success: false,
      message: error?.sqlMessage || error?.message || "Internal server error",
    });
  }
};

// ---------------------- UPDATE DISH ----------------------
const updateDish = async (req, res) => {
  try {
    const { id } = req.params;

    const dish = await dishModel.getById(id);
    if (!dish || dish[DISHES.COOK_ID] !== req.user.id) {
      return res.status(404).json({ success: false, message: "Dish not found" });
    }

    const allowedFields = [
      "name",
      "description",
      "category",
      "price",
      "is_veg",
      "spice_level",
      "prep_time_minutes",
      "daily_quantity",
      "is_available",
    ];
    const dishData = {};
    for (const field of allowedFields) {
      if (req.body[field] !== undefined) dishData[field] = req.body[field];
    }
    if (req.file) {
      dishData.image = `/uploads/${req.file.filename}`;
    }

    if (Object.keys(dishData).length === 0) {
      return res
        .status(400)
        .json({ success: false, message: "No fields to update" });
    }

    await dishModel.updateDish(id, dishData);
    const updated = await dishModel.getById(id);
    res.status(200).json({ success: true, data: updated });
  } catch (error) {
    console.error("Error updating dish:", error);
    res.status(500).json({
      success: false,
      message: error?.sqlMessage || error?.message || "Internal server error",
    });
  }
};

// ---------------------- DELETE DISH ----------------------
const deleteDish = async (req, res) => {
  try {
    const { id } = req.params;

    const dish = await dishModel.getById(id);
    if (!dish || dish[DISHES.COOK_ID] !== req.user.id) {
      return res.status(404).json({ success: false, message: "Dish not found" });
    }

    await dishModel.deleteDish(id);
    res.status(200).json({ success: true, message: "Dish deleted successfully" });
  } catch (error) {
    console.error("Error deleting dish:", error);
    res.status(500).json({
      success: false,
      message: error?.sqlMessage || error?.message || "Internal server error",
    });
  }
};

// ---------------------- TOGGLE DISH AVAILABILITY ----------------------
const toggleDishAvailability = async (req, res) => {
  try {
    const { id } = req.params;

    const dish = await dishModel.getById(id);
    if (!dish || dish[DISHES.COOK_ID] !== req.user.id) {
      return res.status(404).json({ success: false, message: "Dish not found" });
    }

    await dishModel.toggleAvailability(id);
    const updated = await dishModel.getById(id);
    res.status(200).json({ success: true, data: updated });
  } catch (error) {
    console.error("Error toggling dish availability:", error);
    res.status(500).json({
      success: false,
      message: error?.sqlMessage || error?.message || "Internal server error",
    });
  }
};

// ---------------------- MY ORDERS (new | active | history) ----------------------
const getOrders = async (req, res) => {
  try {
    const { status } = req.query;
    const orders = await orderModel.listByCook(req.user.id, status);
    for (const order of orders) {
      order.items = await orderModel.getItems(order[ORDERS.ID]);
    }
    res.status(200).json({ success: true, data: orders });
  } catch (error) {
    console.error("Error fetching cook orders:", error);
    res.status(500).json({
      success: false,
      message: error?.sqlMessage || error?.message || "Internal server error",
    });
  }
};

// ---------------------- ACCEPT ORDER (new -> accepted + preparing) ----------------------
const acceptOrder = async (req, res) => {
  try {
    const { id } = req.params;

    const result = await orderModel.acceptByCook(id, req.user.id);
    if (result.affectedRows === 0) {
      return res.status(400).json({
        success: false,
        message: "Order cannot be accepted. Only new orders of your kitchen can be accepted.",
      });
    }

    const order = await orderModel.getById(id);
    await notificationModel.createNotification({
      user_id: order[ORDERS.CUSTOMER_ID],
      title: `Order #${order[ORDERS.ORDER_NUMBER]} accepted`,
      body: "Your order has been accepted and is being prepared",
      type: "order",
    });

    res.status(200).json({ success: true, data: order });
  } catch (error) {
    console.error("Error accepting order:", error);
    res.status(500).json({
      success: false,
      message: error?.sqlMessage || error?.message || "Internal server error",
    });
  }
};

// ---------------------- REJECT ORDER (new -> cancelled) ----------------------
const rejectOrder = async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;

    if (!reason) {
      return res
        .status(400)
        .json({ success: false, message: "Rejection reason is required" });
    }

    const result = await orderModel.rejectByCook(id, req.user.id, reason);
    if (result.affectedRows === 0) {
      return res.status(400).json({
        success: false,
        message: "Order cannot be rejected. Only new orders of your kitchen can be rejected.",
      });
    }

    const order = await orderModel.getById(id);
    await notificationModel.createNotification({
      user_id: order[ORDERS.CUSTOMER_ID],
      title: `Order #${order[ORDERS.ORDER_NUMBER]} cancelled`,
      body: `Your order was cancelled by the cook: ${reason}`,
      type: "order",
    });

    res.status(200).json({ success: true, data: order });
  } catch (error) {
    console.error("Error rejecting order:", error);
    res.status(500).json({
      success: false,
      message: error?.sqlMessage || error?.message || "Internal server error",
    });
  }
};

// ---------------------- MARK READY (preparing -> ready) ----------------------
const readyOrder = async (req, res) => {
  try {
    const { id } = req.params;

    const result = await orderModel.markReadyByCook(id, req.user.id);
    if (result.affectedRows === 0) {
      return res.status(400).json({
        success: false,
        message: "Order cannot be marked ready. Only preparing orders of your kitchen can be marked ready.",
      });
    }

    const order = await orderModel.getById(id);
    await notificationModel.createNotification({
      user_id: order[ORDERS.CUSTOMER_ID],
      title: `Order #${order[ORDERS.ORDER_NUMBER]} is ready`,
      body: "Your order is ready and waiting for a rider",
      type: "order",
    });

    res.status(200).json({ success: true, data: order });
  } catch (error) {
    console.error("Error marking order ready:", error);
    res.status(500).json({
      success: false,
      message: error?.sqlMessage || error?.message || "Internal server error",
    });
  }
};

// ---------------------- EARNINGS ----------------------
const getEarnings = async (req, res) => {
  try {
    const settings = await settingsModel.getSettings();
    const commissionPct = Number(settings.commission_pct);

    const [today, week, month, allTime] = [
      await orderModel.cookEarnings(req.user.id, commissionPct, "today"),
      await orderModel.cookEarnings(req.user.id, commissionPct, "week"),
      await orderModel.cookEarnings(req.user.id, commissionPct, "month"),
      await orderModel.cookEarnings(req.user.id, commissionPct, "all"),
    ];

    const payouts = await settlementModel.cookPayoutHistory(req.user.id);
    const owed = await settlementModel.cookOwedSummary(req.user.id, commissionPct);

    res.status(200).json({
      success: true,
      data: {
        commission_pct: commissionPct,
        today,
        week,
        month,
        all_time: allTime,
        outstanding: Number(owed.earned) - Number(owed.total_paid),
        payouts,
      },
    });
  } catch (error) {
    console.error("Error fetching cook earnings:", error);
    res.status(500).json({
      success: false,
      message: error?.sqlMessage || error?.message || "Internal server error",
    });
  }
};

module.exports = {
  getDashboard,
  toggleKitchen,
  getDishes,
  createDish,
  updateDish,
  deleteDish,
  toggleDishAvailability,
  getOrders,
  acceptOrder,
  rejectOrder,
  readyOrder,
  getEarnings,
};
