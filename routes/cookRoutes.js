const express = require("express");
const router = express.Router();
const cookController = require("../controllers/cookController");
const authMiddleware = require("../middleware/authMiddleware");
const roleMiddleware = require("../middleware/roleMiddleware");
const upload = require("../config/multerConfig");

// Apply authentication and cook authorization to all cook routes
router.use(authMiddleware);
router.use(roleMiddleware("cook"));

/**
 * @route   GET /api/v1/cook/dashboard
 * @desc    Today's orders, earnings, pending count, rating, dish counts
 * @access  Cook only
 */
router.get("/dashboard", cookController.getDashboard);

/**
 * @route   POST /api/v1/cook/kitchen/toggle
 * @desc    Open / close the kitchen
 * @access  Cook only
 */
router.post("/kitchen/toggle", cookController.toggleKitchen);

/**
 * @route   GET /api/v1/cook/dishes
 * @desc    All my dishes
 * @access  Cook only
 */
router.get("/dishes", cookController.getDishes);

/**
 * @route   POST /api/v1/cook/dishes
 * @desc    Create a dish (multipart with optional image)
 * @access  Cook only
 */
router.post("/dishes", upload.single("image"), cookController.createDish);

/**
 * @route   PUT /api/v1/cook/dishes/:id
 * @desc    Update my dish (multipart with optional image)
 * @access  Cook only
 */
router.put("/dishes/:id", upload.single("image"), cookController.updateDish);

/**
 * @route   DELETE /api/v1/cook/dishes/:id
 * @desc    Delete my dish
 * @access  Cook only
 */
router.delete("/dishes/:id", cookController.deleteDish);

/**
 * @route   POST /api/v1/cook/dishes/:id/toggle-availability
 * @desc    Toggle availability of my dish
 * @access  Cook only
 */
router.post(
  "/dishes/:id/toggle-availability",
  cookController.toggleDishAvailability
);

/**
 * @route   GET /api/v1/cook/orders?status=new|active|history
 * @desc    My kitchen orders grouped by tab
 * @access  Cook only
 */
router.get("/orders", cookController.getOrders);

/**
 * @route   POST /api/v1/cook/orders/:id/accept
 * @desc    Accept a new order (accepted + preparing together)
 * @access  Cook only
 */
router.post("/orders/:id/accept", cookController.acceptOrder);

/**
 * @route   POST /api/v1/cook/orders/:id/reject
 * @desc    Reject a new order with a reason (cancelled)
 * @access  Cook only
 */
router.post("/orders/:id/reject", cookController.rejectOrder);

/**
 * @route   POST /api/v1/cook/orders/:id/ready
 * @desc    Mark a preparing order as ready
 * @access  Cook only
 */
router.post("/orders/:id/ready", cookController.readyOrder);

/**
 * @route   GET /api/v1/cook/earnings
 * @desc    Period earning summaries + payout history
 * @access  Cook only
 */
router.get("/earnings", cookController.getEarnings);

module.exports = router;
