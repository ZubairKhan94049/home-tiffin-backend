const express = require("express");
const router = express.Router();
const riderController = require("../controllers/riderController");
const authMiddleware = require("../middleware/authMiddleware");
const roleMiddleware = require("../middleware/roleMiddleware");
const upload = require("../config/multerConfig");

// Apply authentication and rider authorization to all rider routes
router.use(authMiddleware);
router.use(roleMiddleware("rider"));

/**
 * @route   POST /api/v1/rider/status/toggle
 * @desc    Go online / offline
 * @access  Rider only
 */
router.post("/status/toggle", riderController.toggleStatus);

/**
 * @route   GET /api/v1/rider/orders/available
 * @desc    Ready orders without an assigned rider
 * @access  Rider only
 */
router.get("/orders/available", riderController.getAvailableOrders);

/**
 * @route   GET /api/v1/rider/orders?status=ongoing|completed
 * @desc    My deliveries grouped by tab
 * @access  Rider only
 */
router.get("/orders", riderController.getOrders);

/**
 * @route   POST /api/v1/rider/orders/:id/accept
 * @desc    Self-assign a ready, unassigned order
 * @access  Rider only
 */
router.post("/orders/:id/accept", riderController.acceptOrder);

/**
 * @route   POST /api/v1/rider/orders/:id/pickup
 * @desc    Pick up my assigned ready order (on_the_way)
 * @access  Rider only
 */
router.post("/orders/:id/pickup", riderController.pickupOrder);

/**
 * @route   POST /api/v1/rider/orders/:id/deliver
 * @desc    Deliver my on_the_way order (COD adds to cash in hand)
 * @access  Rider only
 */
router.post("/orders/:id/deliver", riderController.deliverOrder);

/**
 * @route   GET /api/v1/rider/earnings
 * @desc    Period delivery summaries, cash in hand and settlement history
 * @access  Rider only
 */
router.get("/earnings", riderController.getEarnings);

/**
 * @route   GET /api/v1/rider/profile
 * @desc    My rider profile
 * @access  Rider only
 */
router.get("/profile", riderController.getProfile);

/**
 * @route   PUT /api/v1/rider/profile
 * @desc    Update my rider profile
 * @access  Rider only
 */
router.put("/profile", riderController.updateProfile);

/**
 * @route   POST /api/v1/rider/documents
 * @desc    Upload rider verification documents (multipart)
 * @access  Rider only
 */
router.post(
  "/documents",
  upload.fields([
    { name: "cnic_front", maxCount: 1 },
    { name: "cnic_back", maxCount: 1 },
    { name: "license_photo", maxCount: 1 },
    { name: "vehicle_photo", maxCount: 1 },
  ]),
  riderController.uploadDocuments
);

/**
 * @route   GET /api/v1/rider/deposit-account
 * @desc    The platform account the rider banks collected cash into, plus
 *          their current cash in hand and the weekly deadline
 * @access  Rider only
 */
router.get("/deposit-account", riderController.getDepositAccount);

/**
 * @route   POST /api/v1/rider/safety/accept
 * @desc    Record that the rider has read the safety guidelines — one of the
 *          five sections required before they may go online
 * @access  Rider only
 */
router.post("/safety/accept", riderController.acceptSafetyGuidelines);

module.exports = router;
