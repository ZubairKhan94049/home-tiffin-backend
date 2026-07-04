const userModel = require("../models/userModel");
const cookProfileModel = require("../models/cookProfileModel");
const riderProfileModel = require("../models/riderProfileModel");
const dishModel = require("../models/dishModel");
const orderModel = require("../models/orderModel");
const settlementModel = require("../models/settlementModel");
const settingsModel = require("../models/settingsModel");
const notificationModel = require("../models/notificationModel");
const pool = require("../config/db");
const TABLES = require("../config/tableNames");
const USERS = require("../config/tableColumns/tblusersColumns");
const ORDERS = require("../config/tableColumns/tblordersColumns");
const RIDER_PROFILES = require("../config/tableColumns/tblriderprofilesColumns");

// Helper: set status of a user, guarded by role
const setStatusForRole = async (id, role, status) => {
  const user = await userModel.getUserById(id);
  if (!user || user[USERS.ROLE] !== role) return null;
  await userModel.setUserStatus(id, status);
  return await userModel.getUserById(id);
};

// ---------------------- DASHBOARD ----------------------
const getDashboard = async (req, res) => {
  try {
    const today = await orderModel.todayStats();
    const statusRows = await orderModel.countsByStatus();
    const ordersByStatus = {};
    for (const row of statusRows) {
      ordersByStatus[row.status] = Number(row.count);
    }

    const [pendingRows] = await pool.query(
      `SELECT
        (SELECT COUNT(*) FROM ${TABLES.USERS} WHERE ${USERS.ROLE} = 'cook' AND ${USERS.STATUS} = 'pending') AS pending_cooks,
        (SELECT COUNT(*) FROM ${TABLES.USERS} WHERE ${USERS.ROLE} = 'rider' AND ${USERS.STATUS} = 'pending') AS pending_riders,
        (SELECT COUNT(*) FROM ${TABLES.RIDER_PROFILES} rp
           JOIN ${TABLES.USERS} u ON u.${USERS.ID} = rp.${RIDER_PROFILES.USER_ID}
          WHERE rp.${RIDER_PROFILES.IS_ONLINE} = 1 AND u.${USERS.STATUS} = 'active') AS online_riders`
    );

    const recent = await orderModel.recentOrders(5);

    res.status(200).json({
      success: true,
      data: {
        orders_today: Number(today.orders_today),
        gmv_today: Number(today.gmv_today),
        pending_cooks: Number(pendingRows[0].pending_cooks),
        pending_riders: Number(pendingRows[0].pending_riders),
        online_riders: Number(pendingRows[0].online_riders),
        orders_by_status: ordersByStatus,
        recent_orders: recent,
      },
    });
  } catch (error) {
    console.error("Error fetching admin dashboard:", error);
    res.status(500).json({
      success: false,
      message: error?.sqlMessage || error?.message || "Internal server error",
    });
  }
};

// ---------------------- COOKS ----------------------
const getCooks = async (req, res) => {
  try {
    const { status, search } = req.query;
    const cooks = await cookProfileModel.listCooksForAdmin({ status, search });
    res.status(200).json({ success: true, data: cooks });
  } catch (error) {
    console.error("Error fetching cooks:", error);
    res.status(500).json({
      success: false,
      message: error?.sqlMessage || error?.message || "Internal server error",
    });
  }
};

const getCookById = async (req, res) => {
  try {
    const { id } = req.params;
    const user = await userModel.getUserById(id);
    if (!user || user[USERS.ROLE] !== "cook") {
      return res.status(404).json({ success: false, message: "Cook not found" });
    }

    const profile = await cookProfileModel.getByUserId(id);
    const dishes = await dishModel.listByCook(id);

    const clean = { ...user };
    delete clean[USERS.PASSWORD];

    res
      .status(200)
      .json({ success: true, data: { ...clean, profile, dishes } });
  } catch (error) {
    console.error("Error fetching cook:", error);
    res.status(500).json({
      success: false,
      message: error?.sqlMessage || error?.message || "Internal server error",
    });
  }
};

const approveCook = async (req, res) => {
  try {
    const { id } = req.params;
    const user = await setStatusForRole(id, "cook", "active");
    if (!user) {
      return res.status(404).json({ success: false, message: "Cook not found" });
    }

    await cookProfileModel.updateByUserId(id, {
      approved_at: new Date(),
      rejection_reason: null,
    });

    await notificationModel.createNotification({
      user_id: Number(id),
      title: "Kitchen approved",
      body: "Congratulations! Your kitchen has been approved. You can start receiving orders.",
      type: "account",
    });

    res.status(200).json({ success: true, message: "Cook approved successfully" });
  } catch (error) {
    console.error("Error approving cook:", error);
    res.status(500).json({
      success: false,
      message: error?.sqlMessage || error?.message || "Internal server error",
    });
  }
};

const rejectCook = async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;

    if (!reason) {
      return res
        .status(400)
        .json({ success: false, message: "Rejection reason is required" });
    }

    const user = await userModel.getUserById(id);
    if (!user || user[USERS.ROLE] !== "cook") {
      return res.status(404).json({ success: false, message: "Cook not found" });
    }

    await cookProfileModel.updateByUserId(id, { rejection_reason: reason });

    await notificationModel.createNotification({
      user_id: Number(id),
      title: "Kitchen application rejected",
      body: `Your kitchen application was rejected: ${reason}`,
      type: "account",
    });

    res.status(200).json({ success: true, message: "Cook rejected" });
  } catch (error) {
    console.error("Error rejecting cook:", error);
    res.status(500).json({
      success: false,
      message: error?.sqlMessage || error?.message || "Internal server error",
    });
  }
};

const blockCook = async (req, res) => {
  try {
    const user = await setStatusForRole(req.params.id, "cook", "blocked");
    if (!user) {
      return res.status(404).json({ success: false, message: "Cook not found" });
    }
    res.status(200).json({ success: true, message: "Cook blocked" });
  } catch (error) {
    console.error("Error blocking cook:", error);
    res.status(500).json({
      success: false,
      message: error?.sqlMessage || error?.message || "Internal server error",
    });
  }
};

const unblockCook = async (req, res) => {
  try {
    const user = await setStatusForRole(req.params.id, "cook", "active");
    if (!user) {
      return res.status(404).json({ success: false, message: "Cook not found" });
    }
    res.status(200).json({ success: true, message: "Cook unblocked" });
  } catch (error) {
    console.error("Error unblocking cook:", error);
    res.status(500).json({
      success: false,
      message: error?.sqlMessage || error?.message || "Internal server error",
    });
  }
};

// ---------------------- DISHES (hide / unhide) ----------------------
const hideDish = async (req, res) => {
  try {
    const result = await dishModel.setHidden(req.params.id, true);
    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, message: "Dish not found" });
    }
    res.status(200).json({ success: true, message: "Dish hidden" });
  } catch (error) {
    console.error("Error hiding dish:", error);
    res.status(500).json({
      success: false,
      message: error?.sqlMessage || error?.message || "Internal server error",
    });
  }
};

const unhideDish = async (req, res) => {
  try {
    const result = await dishModel.setHidden(req.params.id, false);
    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, message: "Dish not found" });
    }
    res.status(200).json({ success: true, message: "Dish unhidden" });
  } catch (error) {
    console.error("Error unhiding dish:", error);
    res.status(500).json({
      success: false,
      message: error?.sqlMessage || error?.message || "Internal server error",
    });
  }
};

// ---------------------- RIDERS ----------------------
const getRiders = async (req, res) => {
  try {
    const { status, search } = req.query;
    const riders = await riderProfileModel.listRidersForAdmin({ status, search });
    res.status(200).json({ success: true, data: riders });
  } catch (error) {
    console.error("Error fetching riders:", error);
    res.status(500).json({
      success: false,
      message: error?.sqlMessage || error?.message || "Internal server error",
    });
  }
};

const getRiderById = async (req, res) => {
  try {
    const { id } = req.params;
    const user = await userModel.getUserById(id);
    if (!user || user[USERS.ROLE] !== "rider") {
      return res.status(404).json({ success: false, message: "Rider not found" });
    }

    const profile = await riderProfileModel.getByUserId(id);
    const settlements = await settlementModel.riderSettlementHistory(id);

    const clean = { ...user };
    delete clean[USERS.PASSWORD];

    res
      .status(200)
      .json({ success: true, data: { ...clean, profile, settlements } });
  } catch (error) {
    console.error("Error fetching rider:", error);
    res.status(500).json({
      success: false,
      message: error?.sqlMessage || error?.message || "Internal server error",
    });
  }
};

const approveRider = async (req, res) => {
  try {
    const { id } = req.params;
    const user = await setStatusForRole(id, "rider", "active");
    if (!user) {
      return res.status(404).json({ success: false, message: "Rider not found" });
    }

    await riderProfileModel.updateByUserId(id, {
      approved_at: new Date(),
      rejection_reason: null,
    });

    await notificationModel.createNotification({
      user_id: Number(id),
      title: "Rider account approved",
      body: "Congratulations! Your rider account has been approved. Go online to start delivering.",
      type: "account",
    });

    res.status(200).json({ success: true, message: "Rider approved successfully" });
  } catch (error) {
    console.error("Error approving rider:", error);
    res.status(500).json({
      success: false,
      message: error?.sqlMessage || error?.message || "Internal server error",
    });
  }
};

const rejectRider = async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;

    if (!reason) {
      return res
        .status(400)
        .json({ success: false, message: "Rejection reason is required" });
    }

    const user = await userModel.getUserById(id);
    if (!user || user[USERS.ROLE] !== "rider") {
      return res.status(404).json({ success: false, message: "Rider not found" });
    }

    await riderProfileModel.updateByUserId(id, { rejection_reason: reason });

    await notificationModel.createNotification({
      user_id: Number(id),
      title: "Rider application rejected",
      body: `Your rider application was rejected: ${reason}`,
      type: "account",
    });

    res.status(200).json({ success: true, message: "Rider rejected" });
  } catch (error) {
    console.error("Error rejecting rider:", error);
    res.status(500).json({
      success: false,
      message: error?.sqlMessage || error?.message || "Internal server error",
    });
  }
};

const blockRider = async (req, res) => {
  try {
    const user = await setStatusForRole(req.params.id, "rider", "blocked");
    if (!user) {
      return res.status(404).json({ success: false, message: "Rider not found" });
    }
    res.status(200).json({ success: true, message: "Rider blocked" });
  } catch (error) {
    console.error("Error blocking rider:", error);
    res.status(500).json({
      success: false,
      message: error?.sqlMessage || error?.message || "Internal server error",
    });
  }
};

const unblockRider = async (req, res) => {
  try {
    const user = await setStatusForRole(req.params.id, "rider", "active");
    if (!user) {
      return res.status(404).json({ success: false, message: "Rider not found" });
    }
    res.status(200).json({ success: true, message: "Rider unblocked" });
  } catch (error) {
    console.error("Error unblocking rider:", error);
    res.status(500).json({
      success: false,
      message: error?.sqlMessage || error?.message || "Internal server error",
    });
  }
};

// ---------------------- CUSTOMERS ----------------------
const getCustomers = async (req, res) => {
  try {
    const { search } = req.query;
    const customers = await userModel.listUsersByRole("customer", { search });
    res.status(200).json({ success: true, data: customers });
  } catch (error) {
    console.error("Error fetching customers:", error);
    res.status(500).json({
      success: false,
      message: error?.sqlMessage || error?.message || "Internal server error",
    });
  }
};

const blockCustomer = async (req, res) => {
  try {
    const user = await setStatusForRole(req.params.id, "customer", "blocked");
    if (!user) {
      return res
        .status(404)
        .json({ success: false, message: "Customer not found" });
    }
    res.status(200).json({ success: true, message: "Customer blocked" });
  } catch (error) {
    console.error("Error blocking customer:", error);
    res.status(500).json({
      success: false,
      message: error?.sqlMessage || error?.message || "Internal server error",
    });
  }
};

const unblockCustomer = async (req, res) => {
  try {
    const user = await setStatusForRole(req.params.id, "customer", "active");
    if (!user) {
      return res
        .status(404)
        .json({ success: false, message: "Customer not found" });
    }
    res.status(200).json({ success: true, message: "Customer unblocked" });
  } catch (error) {
    console.error("Error unblocking customer:", error);
    res.status(500).json({
      success: false,
      message: error?.sqlMessage || error?.message || "Internal server error",
    });
  }
};

// ---------------------- ORDERS ----------------------
const getOrders = async (req, res) => {
  try {
    const { status, search } = req.query;
    const orders = await orderModel.listForAdmin({ status, search });
    res.status(200).json({ success: true, data: orders });
  } catch (error) {
    console.error("Error fetching orders:", error);
    res.status(500).json({
      success: false,
      message: error?.sqlMessage || error?.message || "Internal server error",
    });
  }
};

const getOrderById = async (req, res) => {
  try {
    const { id } = req.params;
    const order = await orderModel.getById(id);
    if (!order) {
      return res.status(404).json({ success: false, message: "Order not found" });
    }

    order.items = await orderModel.getItems(id);
    res.status(200).json({ success: true, data: order });
  } catch (error) {
    console.error("Error fetching order:", error);
    res.status(500).json({
      success: false,
      message: error?.sqlMessage || error?.message || "Internal server error",
    });
  }
};

const assignRiderToOrder = async (req, res) => {
  try {
    const { id } = req.params;
    const { rider_id } = req.body;

    if (!rider_id) {
      return res
        .status(400)
        .json({ success: false, message: "Rider is required" });
    }

    const rider = await userModel.getUserById(rider_id);
    if (!rider || rider[USERS.ROLE] !== "rider" || rider[USERS.STATUS] !== "active") {
      return res
        .status(400)
        .json({ success: false, message: "Rider is not available" });
    }

    const result = await orderModel.assignRider(id, rider_id);
    if (result.affectedRows === 0) {
      return res.status(400).json({
        success: false,
        message: "Rider can only be assigned to a ready, unassigned order",
      });
    }

    const order = await orderModel.getById(id);
    await notificationModel.createNotification({
      user_id: Number(rider_id),
      title: `New delivery assigned - Order #${order[ORDERS.ORDER_NUMBER]}`,
      body: "Admin assigned you a delivery. Please pick up the order.",
      type: "order",
    });

    res.status(200).json({ success: true, data: order });
  } catch (error) {
    console.error("Error assigning rider:", error);
    res.status(500).json({
      success: false,
      message: error?.sqlMessage || error?.message || "Internal server error",
    });
  }
};

const cancelOrder = async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;

    if (!reason) {
      return res
        .status(400)
        .json({ success: false, message: "Cancellation reason is required" });
    }

    const result = await orderModel.cancelByAdmin(id, reason);
    if (result.affectedRows === 0) {
      return res.status(400).json({
        success: false,
        message: "Order cannot be cancelled. It may already be delivered or cancelled.",
      });
    }

    const order = await orderModel.getById(id);
    await notificationModel.createNotification({
      user_id: order[ORDERS.CUSTOMER_ID],
      title: `Order #${order[ORDERS.ORDER_NUMBER]} cancelled`,
      body: `Your order was cancelled by admin: ${reason}`,
      type: "order",
    });

    res.status(200).json({ success: true, data: order });
  } catch (error) {
    console.error("Error cancelling order:", error);
    res.status(500).json({
      success: false,
      message: error?.sqlMessage || error?.message || "Internal server error",
    });
  }
};

// ---------------------- RIDER SETTLEMENTS ----------------------
const getRiderSettlements = async (req, res) => {
  try {
    const riders = await settlementModel.riderSettlementOverview();
    for (const rider of riders) {
      rider.history = await settlementModel.riderSettlementHistory(rider[USERS.ID]);
    }
    res.status(200).json({ success: true, data: riders });
  } catch (error) {
    console.error("Error fetching rider settlements:", error);
    res.status(500).json({
      success: false,
      message: error?.sqlMessage || error?.message || "Internal server error",
    });
  }
};

const depositRiderCash = async (req, res) => {
  try {
    const { rider_id } = req.params;

    const profile = await riderProfileModel.getByUserId(rider_id);
    if (!profile) {
      return res.status(404).json({ success: false, message: "Rider not found" });
    }

    const amount = Number(profile[RIDER_PROFILES.CASH_IN_HAND]);
    if (amount <= 0) {
      return res
        .status(400)
        .json({ success: false, message: "Rider has no cash to deposit" });
    }

    await settlementModel.createRiderSettlement({
      rider_id: Number(rider_id),
      amount,
      settled_by: req.user.id,
    });
    await riderProfileModel.resetCashInHand(rider_id);

    await notificationModel.createNotification({
      user_id: Number(rider_id),
      title: "Cash deposit recorded",
      body: `Your cash deposit of Rs. ${amount} has been recorded`,
      type: "account",
    });

    res.status(200).json({
      success: true,
      message: `Deposit of Rs. ${amount} recorded successfully`,
    });
  } catch (error) {
    console.error("Error recording rider deposit:", error);
    res.status(500).json({
      success: false,
      message: error?.sqlMessage || error?.message || "Internal server error",
    });
  }
};

// ---------------------- COOK SETTLEMENTS ----------------------
const getCookSettlements = async (req, res) => {
  try {
    const settings = await settingsModel.getSettings();
    const cooks = await settlementModel.cookSettlementOverview(
      Number(settings.commission_pct)
    );
    res.status(200).json({ success: true, data: cooks });
  } catch (error) {
    console.error("Error fetching cook settlements:", error);
    res.status(500).json({
      success: false,
      message: error?.sqlMessage || error?.message || "Internal server error",
    });
  }
};

const payCook = async (req, res) => {
  try {
    const { cook_id } = req.params;

    const cook = await userModel.getUserById(cook_id);
    if (!cook || cook[USERS.ROLE] !== "cook") {
      return res.status(404).json({ success: false, message: "Cook not found" });
    }

    const settings = await settingsModel.getSettings();
    const commissionPct = Number(settings.commission_pct);
    const summary = await settlementModel.cookOwedSummary(cook_id, commissionPct);
    const owed = Number(summary.earned) - Number(summary.total_paid);

    if (owed <= 0) {
      return res
        .status(400)
        .json({ success: false, message: "Nothing is owed to this cook" });
    }

    await settlementModel.createCookPayout({
      cook_id: Number(cook_id),
      amount: owed,
      order_count: Number(summary.delivered_count),
      commission_pct: commissionPct,
      paid_by: req.user.id,
    });

    await notificationModel.createNotification({
      user_id: Number(cook_id),
      title: "Payout processed",
      body: `A payout of Rs. ${owed} has been processed to you`,
      type: "account",
    });

    res.status(200).json({
      success: true,
      message: `Payout of Rs. ${owed} recorded successfully`,
    });
  } catch (error) {
    console.error("Error paying cook:", error);
    res.status(500).json({
      success: false,
      message: error?.sqlMessage || error?.message || "Internal server error",
    });
  }
};

// ---------------------- SETTINGS ----------------------
const getSettings = async (req, res) => {
  try {
    const settings = await settingsModel.getSettings();
    res.status(200).json({ success: true, data: settings });
  } catch (error) {
    console.error("Error fetching settings:", error);
    res.status(500).json({
      success: false,
      message: error?.sqlMessage || error?.message || "Internal server error",
    });
  }
};

const updateSettings = async (req, res) => {
  try {
    const allowedFields = [
      "delivery_fee",
      "commission_pct",
      "tax_pct",
      "discount_threshold",
      "discount_amount",
      "service_areas",
      "support_phone",
    ];
    const settingsData = {};
    for (const field of allowedFields) {
      if (req.body[field] !== undefined) settingsData[field] = req.body[field];
    }

    if (Object.keys(settingsData).length === 0) {
      return res
        .status(400)
        .json({ success: false, message: "No fields to update" });
    }

    await settingsModel.updateSettings(settingsData);
    const settings = await settingsModel.getSettings();
    res.status(200).json({ success: true, data: settings });
  } catch (error) {
    console.error("Error updating settings:", error);
    res.status(500).json({
      success: false,
      message: error?.sqlMessage || error?.message || "Internal server error",
    });
  }
};

module.exports = {
  getDashboard,
  getCooks,
  getCookById,
  approveCook,
  rejectCook,
  blockCook,
  unblockCook,
  hideDish,
  unhideDish,
  getRiders,
  getRiderById,
  approveRider,
  rejectRider,
  blockRider,
  unblockRider,
  getCustomers,
  blockCustomer,
  unblockCustomer,
  getOrders,
  getOrderById,
  assignRiderToOrder,
  cancelOrder,
  getRiderSettlements,
  depositRiderCash,
  getCookSettlements,
  payCook,
  getSettings,
  updateSettings,
};
