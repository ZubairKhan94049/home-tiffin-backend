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

const { createOrderPricing } = require('../services/orderPricing');
const priceOrder = createOrderPricing({users:userModel,addresses:addressModel,dishes:dishModel,settings:settingsModel,kitchens:cookProfileModel});
const orderFailure = (res, error) => res.status(error.status || 500).json({success:false,
  message: error.status ? error.message : 'Could not confirm your order. Check your order history before trying again.'});
const attachReview = async order => {
  const review = await reviewModel.getByOrderId(order.id);
  order.review = review ? {stars:review.stars,comment:review.comment,created_at:review.created_at} : null;
  order.has_review = Boolean(review);
  return order;
};

// Quote has no writes, and placement re-runs exactly the same validations/pricing.
const quoteOrder = async (req, res) => {
  try {
    const quote = await priceOrder(req.user.id, req.body);
    const {customer_id,...data} = quote;
    return res.json({success:true,data});
  } catch (error) { return orderFailure(res,error); }
};

const createOrder = async (req, res) => {
  try {
    const priced = await priceOrder(req.user.id, req.body);
    if (req.body.expected_total !== undefined && (!Number.isFinite(Number(req.body.expected_total)) || Number(req.body.expected_total) !== priced.total)) {
      return res.status(409).json({success:false,message:'Your total has changed. Review the updated checkout total before placing your order.'});
    }
    const {items,...orderData} = priced;
    const orderId = await orderModel.createOrder(orderData, items);
    const order = await orderModel.getById(orderId);
    order.items = await orderModel.getItems(orderId);
    order.review = null;
    order.has_review = false;
    return res.status(201).json({success:true,data:order});
  } catch (error) { return orderFailure(res,error); }
};

// ---------------------- MY ORDERS ----------------------
const getMyOrders = async (req, res) => {
  try {
    const orders = await orderModel.listByCustomer(req.user.id);
    const [items, reviews] = await Promise.all([
      orderModel.getItemsForOrders(orders.map(order => order.id)), reviewModel.listByCustomer(req.user.id),
    ]);
    const reviewsByOrder = new Map(reviews.map(review => [Number(review.order_id), review]));
    for (const order of orders) {
      order.items = items.filter(item => Number(item.order_id) === Number(order.id));
      const review = reviewsByOrder.get(Number(order.id));
      order.review = review ? {stars:review.stars,comment:review.comment,created_at:review.created_at} : null;
      order.has_review = Boolean(review);
    }
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
    await attachReview(order);
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

    if (!Number.isInteger(Number(stars)) || Number(stars) < 1 || Number(stars) > 5 || (comment != null && (typeof comment !== 'string' || comment.length > 1000))) {
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
      .json({ success: true, message: "Thank you for your review", data: {stars:Number(stars),comment:comment?.trim() || null} });
  } catch (error) {
    console.error("Error rating order:", error);
    res.status(500).json({
      success: false,
      message: error?.sqlMessage || error?.message || "Internal server error",
    });
  }
};

const cancelOrder = async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isSafeInteger(id) || id < 1) {
      return res.status(400).json({ success: false, message: "Invalid order id" });
    }
    const outcome = await orderModel.cancelByCustomer(id, req.user.id);
    if (outcome === "not_found") {
      return res.status(404).json({ success: false, message: "Order not found" });
    }
    const order = await orderModel.getById(id);
    order.items = await orderModel.getItems(id);
    if (outcome === "conflict") {
      return res.status(409).json({
        success: false,
        message: "This order can no longer be cancelled. Cancellation is available until pickup.",
        data: order,
      });
    }
    return res.status(200).json({ success: true, data: order, message: "Your order is cancelled" });
  } catch (error) {
    console.error("Error cancelling order:", error);
    return res.status(500).json({ success: false, message: "Could not confirm cancellation. Refresh order status before trying again." });
  }
};

module.exports = { quoteOrder, cancelOrder, createOrder, getMyOrders, getOrderById, rateOrder };
