const orderModel = require("../models/orderModel");
const dishModel = require("../models/dishModel");
const addressModel = require("../models/addressModel");
const userModel = require("../models/userModel");
const settingsModel = require("../models/settingsModel");
const reviewModel = require("../models/reviewModel");
const cookProfileModel = require("../models/cookProfileModel");
const notificationModel = require("../models/notificationModel");
const ORDERS = require("../config/tableColumns/tblordersColumns");
const DISHES = require("../config/tableColumns/tbldishesColumns");
const ADDRESSES = require("../config/tableColumns/tbladdressesColumns");
const USERS = require("../config/tableColumns/tblusersColumns");

// ---------------------- PLACE ORDER ----------------------
const createOrder = async (req, res) => {
  try {
    const { cook_id, items, address_id, special_instructions } = req.body;

    if (!cook_id || !address_id || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Cook, address and at least one item are required",
      });
    }

    for (const item of items) {
      if (!item.dish_id || !item.quantity || Number(item.quantity) < 1) {
        return res.status(400).json({
          success: false,
          message: "Each item needs a dish_id and a quantity of at least 1",
        });
      }
    }

    // Cook must exist, be a cook and be active
    const cook = await userModel.getUserById(cook_id);
    if (!cook || cook[USERS.ROLE] !== "cook" || cook[USERS.STATUS] !== "active") {
      return res
        .status(400)
        .json({ success: false, message: "Cook is not available" });
    }

    // Address must belong to the customer
    const address = await addressModel.getById(address_id);
    if (!address || address[ADDRESSES.USER_ID] !== req.user.id) {
      return res
        .status(400)
        .json({ success: false, message: "Address not found" });
    }

    // All dishes must exist, belong to this cook and be visible
    const dishIds = items.map((item) => item.dish_id);
    const dishes = await dishModel.getByIds(dishIds);
    const dishMap = new Map(dishes.map((dish) => [dish[DISHES.ID], dish]));

    for (const item of items) {
      const dish = dishMap.get(Number(item.dish_id));
      if (!dish) {
        return res.status(400).json({
          success: false,
          message: `Dish ${item.dish_id} not found`,
        });
      }
      if (dish[DISHES.COOK_ID] !== Number(cook_id)) {
        return res.status(400).json({
          success: false,
          message: "All dishes must belong to the same cook",
        });
      }
      if (!dish[DISHES.IS_AVAILABLE] || dish[DISHES.IS_HIDDEN]) {
        return res.status(400).json({
          success: false,
          message: `${dish[DISHES.NAME]} is currently not available`,
        });
      }
    }

    // Money computed server-side from settings
    const settings = await settingsModel.getSettings();
    const deliveryFee = Number(settings.delivery_fee);
    const taxPct = Number(settings.tax_pct);
    const discountThreshold = Number(settings.discount_threshold);
    const discountAmount = Number(settings.discount_amount);

    let itemTotal = 0;
    const orderItems = items.map((item) => {
      const dish = dishMap.get(Number(item.dish_id));
      const quantity = Number(item.quantity);
      itemTotal += dish[DISHES.PRICE] * quantity;
      return {
        dish_id: dish[DISHES.ID],
        name: dish[DISHES.NAME],
        price: dish[DISHES.PRICE],
        quantity,
        is_veg: dish[DISHES.IS_VEG],
      };
    });

    const tax = Math.round((itemTotal * taxPct) / 100);
    const discount = itemTotal > discountThreshold ? discountAmount : 0;
    const total = itemTotal + deliveryFee + tax - discount;

    const orderNumber = await orderModel.getNextOrderNumber();

    const deliveryAddress = {
      label: address[ADDRESSES.LABEL],
      full_name: address[ADDRESSES.FULL_NAME],
      phone: address[ADDRESSES.PHONE],
      address: address[ADDRESSES.ADDRESS],
      area: address[ADDRESSES.AREA],
      city: address[ADDRESSES.CITY],
      latitude: address[ADDRESSES.LATITUDE],
      longitude: address[ADDRESSES.LONGITUDE],
      delivery_instructions: address[ADDRESSES.DELIVERY_INSTRUCTIONS],
    };

    const orderId = await orderModel.createOrder(
      {
        order_number: orderNumber,
        customer_id: req.user.id,
        cook_id: Number(cook_id),
        delivery_address: deliveryAddress,
        item_total: itemTotal,
        delivery_fee: deliveryFee,
        discount,
        tax,
        total,
        payment_method: "cod",
        special_instructions,
      },
      orderItems
    );

    // Notify the cook
    await notificationModel.createNotification({
      user_id: Number(cook_id),
      title: `New Order #${orderNumber}`,
      body: `You have received a new order of Rs. ${total}`,
      type: "order",
    });

    const order = await orderModel.getById(orderId);
    order.items = await orderModel.getItems(orderId);

    res.status(201).json({ success: true, data: order });
  } catch (error) {
    console.error("Error creating order:", error);
    res.status(500).json({
      success: false,
      message: error?.sqlMessage || error?.message || "Internal server error",
    });
  }
};

// ---------------------- MY ORDERS ----------------------
const getMyOrders = async (req, res) => {
  try {
    const orders = await orderModel.listByCustomer(req.user.id);
    res.status(200).json({ success: true, data: orders });
  } catch (error) {
    console.error("Error fetching orders:", error);
    res.status(500).json({
      success: false,
      message: error?.sqlMessage || error?.message || "Internal server error",
    });
  }
};

// ---------------------- ORDER DETAIL ----------------------
const getOrderById = async (req, res) => {
  try {
    const { id } = req.params;
    const order = await orderModel.getById(id);
    if (!order || order[ORDERS.CUSTOMER_ID] !== req.user.id) {
      return res
        .status(404)
        .json({ success: false, message: "Order not found" });
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

// ---------------------- RATE ORDER ----------------------
const rateOrder = async (req, res) => {
  try {
    const { id } = req.params;
    const { stars, comment } = req.body;

    if (!stars || Number(stars) < 1 || Number(stars) > 5) {
      return res
        .status(400)
        .json({ success: false, message: "Stars must be between 1 and 5" });
    }

    const order = await orderModel.getById(id);
    if (!order || order[ORDERS.CUSTOMER_ID] !== req.user.id) {
      return res
        .status(404)
        .json({ success: false, message: "Order not found" });
    }

    if (order[ORDERS.STATUS] !== "delivered") {
      return res.status(400).json({
        success: false,
        message: "Only delivered orders can be rated",
      });
    }

    const existingReview = await reviewModel.getByOrderId(id);
    if (existingReview) {
      return res.status(400).json({
        success: false,
        message: "This order has already been rated",
      });
    }

    await reviewModel.createReview({
      order_id: Number(id),
      customer_id: req.user.id,
      cook_id: order[ORDERS.COOK_ID],
      stars: Number(stars),
      comment: comment || null,
    });

    // Recompute cook rating cache (avg + count)
    await cookProfileModel.updateRatingCache(order[ORDERS.COOK_ID]);

    res
      .status(201)
      .json({ success: true, message: "Thank you for your review" });
  } catch (error) {
    console.error("Error rating order:", error);
    res.status(500).json({
      success: false,
      message: error?.sqlMessage || error?.message || "Internal server error",
    });
  }
};

module.exports = { createOrder, getMyOrders, getOrderById, rateOrder };
