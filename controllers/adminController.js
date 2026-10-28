const userModel = require("../models/userModel");
const cookProfileModel = require("../models/cookProfileModel");
const riderProfileModel = require("../models/riderProfileModel");
const dishModel = require("../models/dishModel");
const orderModel = require("../models/orderModel");
const settlementModel = require("../models/settlementModel");
const settingsModel = require("../models/settingsModel");
const notificationModel = require("../models/notificationModel");
const cookBankAccountModel = require("../models/cookBankAccountModel");
const cookBankRequestModel = require("../models/cookBankRequestModel");
const BANK_REQUESTS = require("../config/tableColumns/tblcookbankrequestsColumns");
const BANK_ACCOUNTS = require("../config/tableColumns/tblcookbankaccountsColumns");
const COOK_PROFILES = require("../config/tableColumns/tblcookprofilesColumns");
const { buildState } = require("./cookOnboardingController");
const {
  riderProfileCompletion,
} = require("../helpers/riderCompletionHelper");
const authHelper = require("../helpers/authHelper");
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
    const bankAccounts = await cookBankAccountModel.listByCook(id);

    const clean = { ...user };
    delete clean[USERS.PASSWORD];

    res.status(200).json({
      success: true,
      data: {
        ...clean,
        profile,
        dishes,
        bank_accounts: bankAccounts,
        onboarding: buildState(user, profile),
      },
    });
  } catch (error) {
    console.error("Error fetching cook:", error);
    res.status(500).json({
      success: false,
      message: error?.sqlMessage || error?.message || "Internal server error",
    });
  }
};

// Helper: create a cook/rider account on the admin's behalf.
//
// Self-signup (POST /auth/register) lands `pending` and waits for approval.
// Here the admin is the approving authority and has usually vetted the person
// in an onboarding visit, so the account defaults to `active` and is stamped
// approved. Pass status: "pending" to queue it for review instead.
const createStaffAccount = async ({ role, body, buildProfile, res }) => {
  const { name, phone, email, password, status } = body;

  if (!name || !phone || !password) {
    return res.status(400).json({
      success: false,
      message: "Name, phone and password are required",
    });
  }
  if (`${password}`.length < 8) {
    return res.status(400).json({
      success: false,
      message: "Password must be at least 8 characters",
    });
  }

  const missing = buildProfile.required.filter((field) => !body[field]);
  if (missing.length) {
    return res.status(400).json({
      success: false,
      message: `Missing required ${role} details: ${missing.join(", ")}`,
    });
  }

  const existing = await userModel.findUserByPhoneOrEmail(phone, email);
  if (existing) {
    return res.status(400).json({
      success: false,
      message: "A user with this phone or email already exists",
    });
  }

  const accountStatus = status === "pending" ? "pending" : "active";
  const userId = await userModel.createUser({
    name,
    email: email || null,
    phone,
    password: await authHelper.hashPassword(password),
    role,
    status: accountStatus,
  });

  await buildProfile.create(userId);

  if (accountStatus === "active") {
    await buildProfile.model.updateByUserId(userId, {
      approved_at: new Date(),
      rejection_reason: null,
    });
    await notificationModel.createNotification({
      user_id: Number(userId),
      title: buildProfile.notification.title,
      body: buildProfile.notification.body,
      type: "account",
    });
  }

  const user = await userModel.getUserById(userId);
  const clean = { ...user };
  delete clean[USERS.PASSWORD];

  return res.status(201).json({
    success: true,
    message:
      accountStatus === "active"
        ? `${role === "cook" ? "Cook" : "Rider"} created and activated`
        : `${role === "cook" ? "Cook" : "Rider"} created and queued for approval`,
    data: clean,
  });
};

const createCook = async (req, res) => {
  try {
    const { kitchen_name, city, area, bio } = req.body;
    return await createStaffAccount({
      role: "cook",
      body: req.body,
      res,
      buildProfile: {
        required: ["kitchen_name", "city", "area"],
        model: cookProfileModel,
        create: (userId) =>
          cookProfileModel.createProfile({
            user_id: userId,
            kitchen_name,
            city,
            area,
            bio: bio || null,
          }),
        notification: {
          title: "Kitchen approved",
          body: "Your kitchen has been set up by the Home Tiffin team. You can start receiving orders.",
        },
      },
    });
  } catch (error) {
    console.error("Error creating cook:", error);
    res.status(500).json({
      success: false,
      message: error?.sqlMessage || error?.message || "Internal server error",
    });
  }
};

const createRider = async (req, res) => {
  try {
    const {
      city,
      vehicle_type,
      vehicle_brand,
      vehicle_model,
      license_plate,
      cnic_number,
    } = req.body;
    return await createStaffAccount({
      role: "rider",
      body: req.body,
      res,
      buildProfile: {
        required: ["city", "vehicle_type", "license_plate", "cnic_number"],
        model: riderProfileModel,
        create: (userId) =>
          riderProfileModel.createProfile({
            user_id: userId,
            city,
            vehicle_type,
            vehicle_brand: vehicle_brand || null,
            vehicle_model: vehicle_model || null,
            license_plate,
            cnic_number,
          }),
        notification: {
          title: "Rider account approved",
          body: "Your rider account has been set up by the Home Tiffin team. Go online to start delivering.",
        },
      },
    });
  } catch (error) {
    console.error("Error creating rider:", error);
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

    res.status(200).json({
      success: true,
      data: {
        ...clean,
        profile,
        settlements,
        // The same gate the rider app shows them, so the admin can see why a
        // rider still cannot go online.
        completion: riderProfileCompletion(profile, user),
      },
    });
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
      // Platform deposit account — shown read-only to riders so they know
      // where to bank the cash they collect.
      "payout_bank_name",
      "payout_account_title",
      "payout_account_number",
      "payout_iban",
      "payout_instructions",
      "deposit_due_day",
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

// ---------------------- COOK ONBOARDING STATUS ----------------------
// The four rows the cook sees on their status screen after submitting. The
// admin drives each one; the cook app just renders whatever is set here.

const ONBOARDING_STATUS_VALUES = {
  contract: ["pending", "sent", "completed"],
  documents: ["pending", "under_review", "approved", "rejected"],
  profile: ["locked", "ready", "completed"],
  activation: ["locked", "ready", "active"],
};

const ONBOARDING_STATUS_COLUMNS = {
  contract: COOK_PROFILES.CONTRACT_STATUS,
  documents: COOK_PROFILES.DOCUMENTS_STATUS,
  profile: COOK_PROFILES.PROFILE_STATUS,
  activation: COOK_PROFILES.ACTIVATION_STATUS,
};

const NOTIFICATIONS = {
  contract: {
    sent: ["Contract sent", "Your contract is on its way to your email."],
    completed: ["Contract complete", "Thanks — your contract is signed and filed."],
  },
  documents: {
    approved: ["Documents approved", "Your documents passed review."],
    rejected: ["Documents need attention", "Please re-upload your documents."],
  },
  profile: {
    ready: ["Create your profile", "You can now add your images, menu and hours."],
  },
  activation: {
    active: ["You are live", "Your kitchen is activated and can receive orders."],
  },
};

const updateCookOnboardingStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const user = await userModel.getUserById(id);
    if (!user || user[USERS.ROLE] !== "cook") {
      return res.status(404).json({ success: false, message: "Cook not found" });
    }

    const reason = `${req.body.note ?? ""}`.trim();

    const data = {};
    const notes = [];
    for (const [key, allowed] of Object.entries(ONBOARDING_STATUS_VALUES)) {
      const value = req.body[key];
      if (value === undefined) continue;
      if (!allowed.includes(value)) {
        return res.status(400).json({
          success: false,
          message: `${key} must be one of: ${allowed.join(", ")}`,
        });
      }
      data[ONBOARDING_STATUS_COLUMNS[key]] = value;
      const note = NOTIFICATIONS[key]?.[value];
      if (note) {
        // A rejection note replaces the generic body — it is the only thing
        // that tells the cook which upload to redo.
        notes.push(
          key === "documents" && value === "rejected" && reason
            ? [note[0], reason]
            : note
        );
      }
    }

    // The cook's status screen reads the reason from the profile, so it is
    // stored (and cleared again when the documents are accepted).
    if (data[ONBOARDING_STATUS_COLUMNS.documents] === "rejected") {
      data[COOK_PROFILES.REJECTION_REASON] = reason || null;
    } else if (data[ONBOARDING_STATUS_COLUMNS.documents] === "approved") {
      data[COOK_PROFILES.REJECTION_REASON] = null;
    }

    if (!Object.keys(data).length) {
      return res.status(400).json({
        success: false,
        message: "Send at least one of: contract, documents, profile, activation",
      });
    }

    await cookProfileModel.updateByUserId(id, data);

    // Activating the cook also makes the account usable.
    if (data[COOK_PROFILES.ACTIVATION_STATUS] === "active") {
      await setStatusForRole(id, "cook", "active");
      await cookProfileModel.updateByUserId(id, {
        [COOK_PROFILES.APPROVED_AT]: new Date(),
        [COOK_PROFILES.REJECTION_REASON]: null,
      });
    }

    for (const [title, body] of notes) {
      await notificationModel.createNotification({
        user_id: Number(id),
        title,
        body,
        type: "account",
      });
    }

    const profile = await cookProfileModel.getByUserId(id);
    res.status(200).json({
      success: true,
      message: "Onboarding status updated",
      data: buildState(await userModel.getUserById(id), profile),
    });
  } catch (error) {
    console.error("Error updating cook onboarding status:", error);
    res.status(500).json({
      success: false,
      message: error?.sqlMessage || error?.message || "Internal server error",
    });
  }
};

// ---------------------- COOK BANK REQUESTS ----------------------
//
// Cooks cannot change their own payout accounts; they ask and an admin
// applies it here. Approving is what actually writes to
// tblcookbankaccounts — until then nothing about the account has moved.

const getBankRequests = async (req, res) => {
  try {
    const status = `${req.query.status ?? ""}`.trim();
    const allowed = ["pending", "approved", "rejected"];
    const requests = await cookBankRequestModel.listForAdmin(
      allowed.includes(status) ? status : null
    );
    res.status(200).json({ success: true, data: requests });
  } catch (error) {
    console.error("Error fetching bank requests:", error);
    res.status(500).json({
      success: false,
      message: error?.sqlMessage || error?.message || "Internal server error",
    });
  }
};

const approveBankRequest = async (req, res) => {
  try {
    const request = await cookBankRequestModel.getById(req.params.id);
    if (!request) {
      return res
        .status(404)
        .json({ success: false, message: "Request not found" });
    }
    if (request[BANK_REQUESTS.STATUS] !== "pending") {
      return res
        .status(400)
        .json({ success: false, message: "That request is already decided" });
    }

    const cookId = request[BANK_REQUESTS.COOK_ID];
    const type = request[BANK_REQUESTS.TYPE];
    const details = {
      bank_name: request[BANK_REQUESTS.BANK_NAME],
      account_title: request[BANK_REQUESTS.ACCOUNT_TITLE],
      account_number: request[BANK_REQUESTS.ACCOUNT_NUMBER],
      iban: request[BANK_REQUESTS.IBAN],
      branch: request[BANK_REQUESTS.BRANCH],
      proof_image: request[BANK_REQUESTS.PROOF_IMAGE],
    };
    const makeDefault = Boolean(request[BANK_REQUESTS.MAKE_DEFAULT]);

    if (type === "add") {
      // The first account a cook has must receive payouts, whatever they asked.
      const existing = await cookBankAccountModel.countForCook(cookId);
      await cookBankAccountModel.createAccount({
        cook_id: cookId,
        ...details,
        is_default: existing === 0 || makeDefault ? 1 : 0,
      });
    } else if (type === "update") {
      await cookBankAccountModel.updateAccount(
        request[BANK_REQUESTS.ACCOUNT_ID],
        cookId,
        {
          [BANK_ACCOUNTS.BANK_NAME]: details.bank_name,
          [BANK_ACCOUNTS.ACCOUNT_TITLE]: details.account_title,
          [BANK_ACCOUNTS.ACCOUNT_NUMBER]: details.account_number,
          [BANK_ACCOUNTS.IBAN]: details.iban,
          [BANK_ACCOUNTS.BRANCH]: details.branch,
          [BANK_ACCOUNTS.PROOF_IMAGE]: details.proof_image,
        }
      );
      if (makeDefault) {
        await cookBankAccountModel.setDefault(
          cookId,
          request[BANK_REQUESTS.ACCOUNT_ID]
        );
      }
    } else {
      const account = await cookBankAccountModel.getById(
        request[BANK_REQUESTS.ACCOUNT_ID]
      );
      await cookBankAccountModel.deleteAccount(
        request[BANK_REQUESTS.ACCOUNT_ID],
        cookId
      );
      // Removing the payout account promotes another, so the cook is never
      // left with accounts but nowhere to be paid.
      if (account?.[BANK_ACCOUNTS.IS_DEFAULT]) {
        const remaining = await cookBankAccountModel.listByCook(cookId);
        if (remaining.length) {
          await cookBankAccountModel.setDefault(
            cookId,
            remaining[0][BANK_ACCOUNTS.ID]
          );
        }
      }
    }

    await cookBankRequestModel.updateRequest(request[BANK_REQUESTS.ID], {
      [BANK_REQUESTS.STATUS]: "approved",
      [BANK_REQUESTS.ADMIN_NOTE]: `${req.body.note ?? ""}`.trim() || null,
      [BANK_REQUESTS.REVIEWED_BY]: req.user.id,
      [BANK_REQUESTS.REVIEWED_AT]: new Date(),
    });

    await notificationModel.createNotification({
      user_id: cookId,
      title: "Payout account updated",
      body: "Your request was approved and your payout details are now live.",
      type: "account",
    });

    res.status(200).json({ success: true, message: "Request approved" });
  } catch (error) {
    console.error("Error approving bank request:", error);
    res.status(500).json({
      success: false,
      message: error?.sqlMessage || error?.message || "Internal server error",
    });
  }
};

const rejectBankRequest = async (req, res) => {
  try {
    const reason = `${req.body.reason ?? req.body.note ?? ""}`.trim();
    if (!reason) {
      return res.status(400).json({
        success: false,
        message: "Give a reason — the cook sees it in the app",
      });
    }

    const request = await cookBankRequestModel.getById(req.params.id);
    if (!request) {
      return res
        .status(404)
        .json({ success: false, message: "Request not found" });
    }
    if (request[BANK_REQUESTS.STATUS] !== "pending") {
      return res
        .status(400)
        .json({ success: false, message: "That request is already decided" });
    }

    await cookBankRequestModel.updateRequest(request[BANK_REQUESTS.ID], {
      [BANK_REQUESTS.STATUS]: "rejected",
      [BANK_REQUESTS.ADMIN_NOTE]: reason,
      [BANK_REQUESTS.REVIEWED_BY]: req.user.id,
      [BANK_REQUESTS.REVIEWED_AT]: new Date(),
    });

    await notificationModel.createNotification({
      user_id: request[BANK_REQUESTS.COOK_ID],
      title: "Payout account request declined",
      body: reason,
      type: "account",
    });

    res.status(200).json({ success: true, message: "Request rejected" });
  } catch (error) {
    console.error("Error rejecting bank request:", error);
    res.status(500).json({
      success: false,
      message: error?.sqlMessage || error?.message || "Internal server error",
    });
  }
};

module.exports = {
  getBankRequests,
  approveBankRequest,
  rejectBankRequest,
  getDashboard,
  getCooks,
  getCookById,
  createCook,
  updateCookOnboardingStatus,
  approveCook,
  rejectCook,
  blockCook,
  unblockCook,
  hideDish,
  unhideDish,
  getRiders,
  getRiderById,
  createRider,
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
