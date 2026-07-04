const express = require("express");
const router = express.Router();
const adminController = require("../controllers/adminController");
const authMiddleware = require("../middleware/authMiddleware");
const roleMiddleware = require("../middleware/roleMiddleware");

// Apply authentication and admin authorization to all admin routes
router.use(authMiddleware);
router.use(roleMiddleware("admin"));

// ============================================================================
// DASHBOARD
// ============================================================================

/**
 * @route   GET /api/v1/admin/dashboard
 * @desc    Today's orders, GMV, pending cooks/riders, online riders, counts by status, recent orders
 * @access  Admin only
 */
router.get("/dashboard", adminController.getDashboard);

// ============================================================================
// COOK MANAGEMENT
// ============================================================================

/**
 * @route   GET /api/v1/admin/cooks?status=pending|active|blocked&search=
 * @desc    List cooks with profiles
 * @access  Admin only
 */
router.get("/cooks", adminController.getCooks);

/**
 * @route   GET /api/v1/admin/cooks/:id
 * @desc    Cook detail with documents + dishes
 * @access  Admin only
 */
router.get("/cooks/:id", adminController.getCookById);

/**
 * @route   POST /api/v1/admin/cooks/:id/approve
 * @desc    Approve a pending cook
 * @access  Admin only
 */
router.post("/cooks/:id/approve", adminController.approveCook);

/**
 * @route   POST /api/v1/admin/cooks/:id/reject
 * @desc    Reject a pending cook with a reason
 * @access  Admin only
 */
router.post("/cooks/:id/reject", adminController.rejectCook);

/**
 * @route   POST /api/v1/admin/cooks/:id/block
 * @desc    Block a cook
 * @access  Admin only
 */
router.post("/cooks/:id/block", adminController.blockCook);

/**
 * @route   POST /api/v1/admin/cooks/:id/unblock
 * @desc    Unblock a cook
 * @access  Admin only
 */
router.post("/cooks/:id/unblock", adminController.unblockCook);

// ============================================================================
// DISH MODERATION
// ============================================================================

/**
 * @route   POST /api/v1/admin/dishes/:id/hide
 * @desc    Hide a dish from customers
 * @access  Admin only
 */
router.post("/dishes/:id/hide", adminController.hideDish);

/**
 * @route   POST /api/v1/admin/dishes/:id/unhide
 * @desc    Unhide a dish
 * @access  Admin only
 */
router.post("/dishes/:id/unhide", adminController.unhideDish);

// ============================================================================
// RIDER MANAGEMENT
// ============================================================================

/**
 * @route   GET /api/v1/admin/riders?status=pending|active|blocked&search=
 * @desc    List riders with profiles
 * @access  Admin only
 */
router.get("/riders", adminController.getRiders);

/**
 * @route   GET /api/v1/admin/riders/:id
 * @desc    Rider detail with documents + settlement history
 * @access  Admin only
 */
router.get("/riders/:id", adminController.getRiderById);

/**
 * @route   POST /api/v1/admin/riders/:id/approve
 * @desc    Approve a pending rider
 * @access  Admin only
 */
router.post("/riders/:id/approve", adminController.approveRider);

/**
 * @route   POST /api/v1/admin/riders/:id/reject
 * @desc    Reject a pending rider with a reason
 * @access  Admin only
 */
router.post("/riders/:id/reject", adminController.rejectRider);

/**
 * @route   POST /api/v1/admin/riders/:id/block
 * @desc    Block a rider
 * @access  Admin only
 */
router.post("/riders/:id/block", adminController.blockRider);

/**
 * @route   POST /api/v1/admin/riders/:id/unblock
 * @desc    Unblock a rider
 * @access  Admin only
 */
router.post("/riders/:id/unblock", adminController.unblockRider);

// ============================================================================
// CUSTOMER MANAGEMENT
// ============================================================================

/**
 * @route   GET /api/v1/admin/customers?search=
 * @desc    List customers
 * @access  Admin only
 */
router.get("/customers", adminController.getCustomers);

/**
 * @route   POST /api/v1/admin/customers/:id/block
 * @desc    Block a customer
 * @access  Admin only
 */
router.post("/customers/:id/block", adminController.blockCustomer);

/**
 * @route   POST /api/v1/admin/customers/:id/unblock
 * @desc    Unblock a customer
 * @access  Admin only
 */
router.post("/customers/:id/unblock", adminController.unblockCustomer);

// ============================================================================
// ORDER MANAGEMENT
// ============================================================================

/**
 * @route   GET /api/v1/admin/orders?status=&search=
 * @desc    List orders
 * @access  Admin only
 */
router.get("/orders", adminController.getOrders);

/**
 * @route   GET /api/v1/admin/orders/:id
 * @desc    Order detail with items
 * @access  Admin only
 */
router.get("/orders/:id", adminController.getOrderById);

/**
 * @route   POST /api/v1/admin/orders/:id/assign-rider
 * @desc    Assign a rider to a ready, unassigned order
 * @access  Admin only
 * @body    { rider_id }
 */
router.post("/orders/:id/assign-rider", adminController.assignRiderToOrder);

/**
 * @route   POST /api/v1/admin/orders/:id/cancel
 * @desc    Force-cancel an order with a reason
 * @access  Admin only
 * @body    { reason }
 */
router.post("/orders/:id/cancel", adminController.cancelOrder);

// ============================================================================
// SETTLEMENTS
// ============================================================================

/**
 * @route   GET /api/v1/admin/settlements/riders
 * @desc    Per-rider cash in hand + settlement history
 * @access  Admin only
 */
router.get("/settlements/riders", adminController.getRiderSettlements);

/**
 * @route   POST /api/v1/admin/settlements/riders/:rider_id/deposit
 * @desc    Record a rider cash deposit (zeroes cash in hand)
 * @access  Admin only
 */
router.post(
  "/settlements/riders/:rider_id/deposit",
  adminController.depositRiderCash
);

/**
 * @route   GET /api/v1/admin/settlements/cooks
 * @desc    Per-cook owed = delivered totals x (1 - commission) - paid
 * @access  Admin only
 */
router.get("/settlements/cooks", adminController.getCookSettlements);

/**
 * @route   POST /api/v1/admin/settlements/cooks/:cook_id/pay
 * @desc    Pay a cook the owed amount (records payout)
 * @access  Admin only
 */
router.post("/settlements/cooks/:cook_id/pay", adminController.payCook);

// ============================================================================
// SETTINGS
// ============================================================================

/**
 * @route   GET /api/v1/admin/settings
 * @desc    Platform settings
 * @access  Admin only
 */
router.get("/settings", adminController.getSettings);

/**
 * @route   PUT /api/v1/admin/settings
 * @desc    Update platform settings
 * @access  Admin only
 */
router.put("/settings", adminController.updateSettings);

module.exports = router;
