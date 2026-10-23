const orderModel = require("../models/orderModel");
const riderProfileModel = require("../models/riderProfileModel");
const settlementModel = require("../models/settlementModel");
const notificationModel = require("../models/notificationModel");
const ORDERS = require("../config/tableColumns/tblordersColumns");
const RIDER_PROFILES = require("../config/tableColumns/tblriderprofilesColumns");
const settingsModel = require("../models/settingsModel");
const userModel = require("../models/userModel");
const { riderProfileCompletion } = require("../helpers/riderCompletionHelper");

// ---------------------- TOGGLE ONLINE STATUS ----------------------
const toggleStatus = async (req, res) => {
  try {
    const profile = await riderProfileModel.getByUserId(req.user.id);
    if (!profile) {
      return res
        .status(404)
        .json({ success: false, message: "Rider profile not found" });
    }

    const newState = profile[RIDER_PROFILES.IS_ONLINE] ? 0 : 1;

    // Going offline is always allowed; going online is not until the profile
    // is complete. Enforced here so the rule holds whatever the client does.
    if (newState === 1) {
      const user = await userModel.getUserById(req.user.id);
      const completion = riderProfileCompletion(profile, user);
      if (!completion.is_complete) {
        return res.status(403).json({
          success: false,
          message: `Complete your profile before going online. Still needed: ${completion.missing.join(", ")}.`,
          data: { completion },
        });
      }
    }

    await riderProfileModel.updateByUserId(req.user.id, {
      [RIDER_PROFILES.IS_ONLINE]: newState,
    });

    res.status(200).json({
      success: true,
      message: newState ? "You are now online" : "You are now offline",
      data: { is_online: newState },
    });
  } catch (error) {
    console.error("Error toggling rider status:", error);
    res.status(500).json({
      success: false,
      message: error?.sqlMessage || error?.message || "Internal server error",
    });
  }
};

// ---------------------- AVAILABLE ORDERS (ready + unassigned) ----------------------
const getAvailableOrders = async (req, res) => {
  try {
    const orders = await orderModel.listAvailableForRiders();
    res.status(200).json({ success: true, data: orders });
  } catch (error) {
    console.error("Error fetching available orders:", error);
    res.status(500).json({
      success: false,
      message: error?.sqlMessage || error?.message || "Internal server error",
    });
  }
};

// ---------------------- MY ORDERS (ongoing | completed) ----------------------
const getOrders = async (req, res) => {
  try {
    const { status } = req.query;
    const orders = await orderModel.listByRider(req.user.id, status);
    res.status(200).json({ success: true, data: orders });
  } catch (error) {
    console.error("Error fetching rider orders:", error);
    res.status(500).json({
      success: false,
      message: error?.sqlMessage || error?.message || "Internal server error",
    });
  }
};

// ---------------------- ACCEPT (self-assign a ready order) ----------------------
const acceptOrder = async (req, res) => {
  try {
    const { id } = req.params;

    // Second gate: a rider with an incomplete profile must not end up holding
    // an order, even if they were online before a field was cleared.
    const profile = await riderProfileModel.getByUserId(req.user.id);
    const user = await userModel.getUserById(req.user.id);
    const completion = riderProfileCompletion(profile, user);
    if (!completion.is_complete) {
      return res.status(403).json({
        success: false,
        message: `Complete your profile before accepting deliveries. Still needed: ${completion.missing.join(", ")}.`,
        data: { completion },
      });
    }

    const result = await orderModel.assignRider(id, req.user.id);
    if (result.affectedRows === 0) {
      return res.status(400).json({
        success: false,
        message: "Order is not available. It may already be assigned or not ready.",
      });
    }

    const order = await orderModel.getById(id);
    res.status(200).json({ success: true, data: order });
  } catch (error) {
    console.error("Error accepting order:", error);
    res.status(500).json({
      success: false,
      message: error?.sqlMessage || error?.message || "Internal server error",
    });
  }
};

// ---------------------- PICKUP (ready -> on_the_way) ----------------------
const pickupOrder = async (req, res) => {
  try {
    const { id } = req.params;

    const result = await orderModel.pickupByRider(id, req.user.id);
    if (result.affectedRows === 0) {
      return res.status(400).json({
        success: false,
        message: "Order cannot be picked up. It must be ready and assigned to you.",
      });
    }

    const order = await orderModel.getById(id);
    await notificationModel.createNotification({
      user_id: order[ORDERS.CUSTOMER_ID],
      title: `Order #${order[ORDERS.ORDER_NUMBER]} on the way`,
      body: "Your rider has picked up your order",
      type: "order",
    });

    res.status(200).json({ success: true, data: order });
  } catch (error) {
    console.error("Error picking up order:", error);
    res.status(500).json({
      success: false,
      message: error?.sqlMessage || error?.message || "Internal server error",
    });
  }
};

// ---------------------- DELIVER (on_the_way -> delivered, COD cash) ----------------------
const deliverOrder = async (req, res) => {
  try {
    const { id } = req.params;

    const result = await orderModel.deliverByRider(id, req.user.id);
    if (result.affectedRows === 0) {
      return res.status(400).json({
        success: false,
        message: "Order cannot be delivered. It must be on the way and assigned to you.",
      });
    }

    const order = await orderModel.getById(id);

    // COD: order total adds to rider cash in hand
    if (order[ORDERS.PAYMENT_METHOD] === "cod") {
      await riderProfileModel.incrementCashInHand(
        req.user.id,
        order[ORDERS.TOTAL]
      );
    }

    await notificationModel.createNotification({
      user_id: order[ORDERS.CUSTOMER_ID],
      title: `Order #${order[ORDERS.ORDER_NUMBER]} delivered`,
      body: "Your order has been delivered. Enjoy your meal!",
      type: "order",
    });

    res.status(200).json({ success: true, data: order });
  } catch (error) {
    console.error("Error delivering order:", error);
    res.status(500).json({
      success: false,
      message: error?.sqlMessage || error?.message || "Internal server error",
    });
  }
};

// ---------------------- EARNINGS ----------------------
const getEarnings = async (req, res) => {
  try {
    const profile = await riderProfileModel.getByUserId(req.user.id);
    if (!profile) {
      return res
        .status(404)
        .json({ success: false, message: "Rider profile not found" });
    }

    const [today, week, month, allTime] = [
      await orderModel.riderEarnings(req.user.id, "today"),
      await orderModel.riderEarnings(req.user.id, "week"),
      await orderModel.riderEarnings(req.user.id, "month"),
      await orderModel.riderEarnings(req.user.id, "all"),
    ];

    const settlements = await settlementModel.riderSettlementHistory(req.user.id);

    res.status(200).json({
      success: true,
      data: {
        cash_in_hand: Number(profile[RIDER_PROFILES.CASH_IN_HAND]),
        today,
        week,
        month,
        all_time: allTime,
        settlements,
      },
    });
  } catch (error) {
    console.error("Error fetching rider earnings:", error);
    res.status(500).json({
      success: false,
      message: error?.sqlMessage || error?.message || "Internal server error",
    });
  }
};

// ---------------------- PROFILE ----------------------
const getProfile = async (req, res) => {
  try {
    const profile = await riderProfileModel.getByUserId(req.user.id);
    if (!profile) {
      return res
        .status(404)
        .json({ success: false, message: "Rider profile not found" });
    }
    const user = await userModel.getUserById(req.user.id);
    res.status(200).json({
      success: true,
      data: { ...profile, completion: riderProfileCompletion(profile, user) },
    });
  } catch (error) {
    console.error("Error fetching rider profile:", error);
    res.status(500).json({
      success: false,
      message: error?.sqlMessage || error?.message || "Internal server error",
    });
  }
};

const updateProfile = async (req, res) => {
  try {
    const allowedFields = [
      "city",
      "vehicle_type",
      "vehicle_brand",
      "vehicle_model",
      "license_plate",
      "cnic_number",
      // CNIC address + emergency contact — required before a rider may work.
      "address_line",
      "address_area",
      "address_city",
      "emergency_name",
      "emergency_relationship",
      "emergency_phone",
      "emergency_alt_phone",
    ];
    const profileData = {};
    for (const field of allowedFields) {
      if (req.body[field] !== undefined) profileData[field] = req.body[field];
    }

    if (Object.keys(profileData).length === 0) {
      return res
        .status(400)
        .json({ success: false, message: "No fields to update" });
    }

    await riderProfileModel.updateByUserId(req.user.id, profileData);
    const profile = await riderProfileModel.getByUserId(req.user.id);
    res.status(200).json({ success: true, data: profile });
  } catch (error) {
    console.error("Error updating rider profile:", error);
    res.status(500).json({
      success: false,
      message: error?.sqlMessage || error?.message || "Internal server error",
    });
  }
};

// ---------------------- DOCUMENT UPLOAD ----------------------
const uploadDocuments = async (req, res) => {
  try {
    const files = req.files || {};
    const filePath = (file) => `/uploads/${file.filename}`;

    const profileData = {};
    if (files.cnic_front) profileData.cnic_front = filePath(files.cnic_front[0]);
    if (files.cnic_back) profileData.cnic_back = filePath(files.cnic_back[0]);
    if (files.license_photo) profileData.license_photo = filePath(files.license_photo[0]);
    if (files.vehicle_photo) profileData.vehicle_photo = filePath(files.vehicle_photo[0]);

    if (Object.keys(profileData).length === 0) {
      return res
        .status(400)
        .json({ success: false, message: "No documents uploaded" });
    }

    await riderProfileModel.updateByUserId(req.user.id, profileData);
    const profile = await riderProfileModel.getByUserId(req.user.id);
    res.status(200).json({ success: true, data: profile });
  } catch (error) {
    console.error("Error uploading rider documents:", error);
    res.status(500).json({
      success: false,
      message: error?.sqlMessage || error?.message || "Internal server error",
    });
  }
};

// Where the rider banks the cash they have collected. Read-only: riders never
// supply their own account under the cash-first flow, they pay into ours.
const getDepositAccount = async (req, res) => {
  try {
    const settings = await settingsModel.getSettings();
    const profile = await riderProfileModel.getByUserId(req.user.id);
    res.status(200).json({
      success: true,
      data: {
        bank_name: settings?.payout_bank_name || null,
        account_title: settings?.payout_account_title || null,
        account_number: settings?.payout_account_number || null,
        iban: settings?.payout_iban || null,
        instructions: settings?.payout_instructions || null,
        deposit_due_day: settings?.deposit_due_day || "Sunday",
        support_phone: settings?.support_phone || null,
        cash_in_hand: Number(profile?.cash_in_hand || 0),
      },
    });
  } catch (error) {
    console.error("Error fetching deposit account:", error);
    res.status(500).json({
      success: false,
      message: error?.sqlMessage || error?.message || "Internal server error",
    });
  }
};

// The rider confirms they have read the safety guidelines. Stamped once —
// re-accepting is harmless and simply refreshes the date.
const acceptSafetyGuidelines = async (req, res) => {
  try {
    const profile = await riderProfileModel.getByUserId(req.user.id);
    if (!profile) {
      return res
        .status(404)
        .json({ success: false, message: "Rider profile not found" });
    }

    await riderProfileModel.updateByUserId(req.user.id, {
      [RIDER_PROFILES.SAFETY_ACCEPTED_AT]: new Date(),
    });

    const updated = await riderProfileModel.getByUserId(req.user.id);
    const user = await userModel.getUserById(req.user.id);
    res.status(200).json({
      success: true,
      message: "Safety guidelines accepted",
      data: { completion: riderProfileCompletion(updated, user) },
    });
  } catch (error) {
    console.error("Error accepting safety guidelines:", error);
    res.status(500).json({
      success: false,
      message: error?.sqlMessage || error?.message || "Internal server error",
    });
  }
};

module.exports = {
  acceptSafetyGuidelines,
  getDepositAccount,
  toggleStatus,
  getAvailableOrders,
  getOrders,
  acceptOrder,
  pickupOrder,
  deliverOrder,
  getEarnings,
  getProfile,
  updateProfile,
  uploadDocuments,
};
