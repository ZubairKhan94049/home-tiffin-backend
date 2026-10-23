const express = require("express");
const router = express.Router();
const adminController = require("../controllers/adminController");
const authMiddleware = require("../middleware/authMiddleware");
const roleMiddleware = require("../middleware/roleMiddleware");
const bannerController = require("../controllers/bannerController");
const categoryController = require("../controllers/categoryController");
const upload = require("../config/multerConfig");

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
 * @route   GET /api/v1/admin/bank-requests?status=pending|approved|rejected
 * @desc    Cooks asking to add, change or remove a payout account.
 * @access  Admin only
 */
// ============================================================================
// CATEGORIES
// ============================================================================

/**
 * @route   GET|POST /api/v1/admin/categories · PUT /reorder · PUT|DELETE /:id
 * @desc    The menu categories cooks file items under and customers browse.
 *          Multipart with an optional `image`; needs a name and an emoji or
 *          image. Deleting one that dishes use is refused (409).
 * @access  Admin only
 */
router.get("/categories", categoryController.listCategories);
router.post("/categories", upload.single("image"), categoryController.createCategory);
router.put("/categories/reorder", categoryController.reorderCategories);
router.put("/categories/:id", upload.single("image"), categoryController.updateCategory);
router.delete("/categories/:id", categoryController.deleteCategory);

// ============================================================================
// HOME BANNERS
// ============================================================================

/**
 * @route   GET|POST /api/v1/admin/banners · PUT|DELETE /api/v1/admin/banners/:id
 * @desc    The customer home carousel. Multipart with an optional `image`;
 *          a banner needs a title, an image, or both.
 * @access  Admin only
 */
router.get("/banners", bannerController.listBanners);
const bannerImages = upload.fields([{ name: "image", maxCount: 1 }, { name: "image_original", maxCount: 1 }]);
router.post("/banners", bannerImages, bannerController.createBanner);
router.put("/banners/reorder", bannerController.reorderBanners);
router.put("/banners/:id", bannerImages, bannerController.updateBanner);
router.delete("/banners/:id", bannerController.deleteBanner);

router.get("/bank-requests", adminController.getBankRequests);

/**
 * @route   POST /api/v1/admin/bank-requests/:id/approve
 * @desc    Apply the requested change to the cook's payout accounts.
 * @access  Admin only
 */
router.post("/bank-requests/:id/approve", adminController.approveBankRequest);

/**
 * @route   POST /api/v1/admin/bank-requests/:id/reject
 * @desc    Decline it with a reason, which the cook sees in the app.
 * @access  Admin only
 */
router.post("/bank-requests/:id/reject", adminController.rejectBankRequest);

/**
 * @route   GET /api/v1/admin/cooks/:id
 * @desc    Cook detail with documents + dishes
 * @access  Admin only
 */
router.get("/cooks/:id", adminController.getCookById);

/**
 * @route   POST /api/v1/admin/cooks
 * @desc    Create a cook account on the admin's behalf (active by default)
 * @access  Admin only
 * @body    { name, phone, password, email?, kitchen_name, city, area, bio?, status? }
 */
router.post("/cooks", adminController.createCook);

/**
 * @route   POST /api/v1/admin/cooks/:id/onboarding
 * @desc    Drive the four rows on the cook's status screen
 * @access  Admin only
 * @body    { contract?, documents?, profile?, activation? }
 */
router.post("/cooks/:id/onboarding", adminController.updateCookOnboardingStatus);

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
 * @route   POST /api/v1/admin/riders
 * @desc    Create a rider account on the admin's behalf (active by default)
 * @access  Admin only
 * @body    { name, phone, password, email?, city, vehicle_type, license_plate,
 *            cnic_number, vehicle_brand?, vehicle_model?, status? }
 */
router.post("/riders", adminController.createRider);

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
