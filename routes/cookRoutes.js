const express = require("express");
const router = express.Router();
const cookController = require("../controllers/cookController");
const onboarding = require("../controllers/cookOnboardingController");
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
 * @route   GET /api/v1/cook/profile
 * @desc    The profile screen: the person, the kitchen, its operating hours
 *          and capacity, the documents on file and the application status.
 * @access  Cook only
 */
router.get("/profile", cookController.getProfile);

/**
 * @route   PUT /api/v1/cook/profile
 * @desc    Partial update. Personal (name, phone, email), kitchen
 *          (kitchen_name, bio, city, area, address_*), and hours
 *          (operating_days CSV of mon..sun, opening_time, closing_time,
 *          daily_capacity).
 * @access  Cook only
 */
router.put("/profile", cookController.updateProfile);

/**
 * @route   POST /api/v1/cook/kitchen/toggle
 * @desc    Open / close the kitchen
 * @access  Cook only
 */
router.post("/kitchen/toggle", cookController.toggleKitchen);

/**
 * @route   GET /api/v1/cook/insights?range=7d|30d|prev_month
 * @desc    The dashboard: sales over the window with a change against the
 *          matching window before it, a daily series, orders by hour,
 *          rejections with reasons, new vs returning customers, top items,
 *          menu health and today's snapshot.
 * @access  Cook only
 */
router.get("/insights", cookController.getInsights);

/**
 * @route   GET /api/v1/cook/dishes
 * @desc    All my dishes
 * @access  Cook only
 */
router.get("/dishes", cookController.getDishes);

/**
 * @route   POST /api/v1/cook/dishes
 * @desc    Create a dish. Multipart: up to 3 `images`, plus `variations` as a
 *          JSON array of { name, price }.
 * @access  Cook only
 */
router.post("/dishes", upload.array("images", 3), cookController.createDish);

/**
 * @route   PUT /api/v1/cook/dishes/:id
 * @desc    Update my dish. Send `kept_images` (CSV of the hosted paths to
 *          keep) alongside any new `images` files.
 * @access  Cook only
 */
router.put("/dishes/:id", upload.array("images", 3), cookController.updateDish);

/**
 * @route   GET /api/v1/cook/dishes/:id/analytics
 * @desc    How this item has sold: totals, last 7/30 days, its rank on my
 *          menu, and a 30-day daily series. Delivered orders only.
 * @access  Cook only
 */
router.get("/dishes/:id/analytics", cookController.getDishAnalytics);

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

// ============================================================================
// BANK ACCOUNTS (payout destinations)
// ============================================================================

/**
 * @route   GET /api/v1/cook/bank-accounts
 * @desc    List this cook's payout accounts, default first
 * @access  Cook only
 */
router.get("/bank-accounts", cookController.getBankAccounts);

/**
 * @route   GET /api/v1/cook/bank-requests
 * @desc    My payout account requests, newest first.
 * @access  Cook only
 */
router.get("/bank-requests", cookController.getBankRequests);

/**
 * @route   POST /api/v1/cook/bank-requests
 * @desc    Ask an admin to add, change or remove a payout account. Multipart:
 *          `type` (add|update|remove), `account_id` for update/remove, the
 *          proposed details, and a `proof` photo of the cheque book or bank
 *          statement for add/update. One open request at a time.
 * @access  Cook only
 */
router.post(
  "/bank-requests",
  upload.single("proof"),
  cookController.createBankRequest
);

/**
 * @route   DELETE /api/v1/cook/bank-requests/:id
 * @desc    Take back a request an admin has not decided on yet.
 * @access  Cook only
 */
router.delete("/bank-requests/:id", cookController.cancelBankRequest);

// ============================================================================
// ONBOARDING WIZARD (five steps, resumable)
// ============================================================================

/**
 * @route   GET /api/v1/cook/onboarding
 * @desc    Where the cook is up to, every answer they have saved, their
 *          uploaded documents and the four status rows. Drives both the
 *          wizard and the post-submission status screen.
 * @access  Cook only
 */
router.get("/onboarding", onboarding.getOnboarding);

/**
 * @route   PUT /api/v1/cook/onboarding/step/:step
 * @desc    Save one step (2 = business, 3 = legal, 4 = payment/billing).
 *          Step 1 is registration; step 5 is the document upload below.
 * @access  Cook only
 */
router.put("/onboarding/step/:step", onboarding.saveStep);

/**
 * @route   POST /api/v1/cook/onboarding/documents
 * @desc    Step 5 uploads: cnic_front, cnic_back, bank_proof, menu_picture
 * @access  Cook only
 */
router.post(
  "/onboarding/documents",
  upload.fields([
    { name: "cnic_front", maxCount: 1 },
    { name: "cnic_back", maxCount: 1 },
    { name: "bank_proof", maxCount: 1 },
    { name: "menu_picture", maxCount: 1 },
  ]),
  onboarding.uploadDocuments
);

/**
 * @route   POST /api/v1/cook/onboarding/submit
 * @desc    Finish the wizard — documents move to "under review" and the cook
 *          lands on the status screen.
 * @access  Cook only
 */
router.post("/onboarding/submit", onboarding.submitOnboarding);

module.exports = router;
