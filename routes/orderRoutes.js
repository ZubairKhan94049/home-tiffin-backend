const express = require("express");
const router = express.Router();
const orderController = require("../controllers/orderController");
const authMiddleware = require("../middleware/authMiddleware");

// All order routes require authentication
router.use(authMiddleware, require("../middleware/roleMiddleware")("customer"));

// A read-only, authoritative checkout preview using the same pricing as placement.
router.post("/quote", orderController.quoteOrder);

/**
 * @route   POST /api/v1/orders
 * @desc    Place an order (totals computed server-side, status "new")
 * @access  Private (customer)
 * @body    { cook_id, items: [{ dish_id, quantity }], address_id, special_instructions? }
 */
router.post("/", orderController.createOrder);

/**
 * @route   GET /api/v1/orders
 * @desc    My orders (newest first)
 * @access  Private (customer)
 */
router.get("/", orderController.getMyOrders);

/**
 * @route   GET /api/v1/orders/:id
 * @desc    Order detail with items + timeline timestamps
 * @access  Private (customer, own order)
 */
router.get("/:id", orderController.getOrderById);

/**
 * @route   POST /api/v1/orders/:id/rate
 * @desc    Rate a delivered, unrated order (updates cook rating cache)
 * @access  Private (customer, own order)
 * @body    { stars, comment? }
 */
router.post("/:id/rate", orderController.rateOrder);

/**
 * @route   POST /api/v1/orders/:id/cancel
 * @desc    Cancel my order before rider pickup (idempotent; conflict includes current order)
 * @access  Private (customer, own order)
 */
router.post("/:id/cancel", require("../middleware/roleMiddleware")("customer"), orderController.cancelOrder);

module.exports = router;
