const express = require("express");
const router = express.Router();
const authController = require("../controllers/authController");
const authMiddleware = require("../middleware/authMiddleware");
const upload = require("../config/multerConfig");

/**
 * @route   POST /api/v1/auth/register
 * @desc    Register a customer, cook or rider (cook/rider start as pending)
 * @access  Public
 * @body    { name, phone, email?, password, role, ...role profile fields }
 */
router.post("/register", authController.register);

/**
 * @route   POST /api/v1/auth/login
 * @desc    Login with phone (or email) + password
 * @access  Public
 */
router.post("/login", authController.login);

/**
 * @route   GET /api/v1/auth/me
 * @desc    Current authenticated user (+role profile)
 * @access  Private
 */
router.get("/me", authMiddleware, authController.me);

/**
 * @route   POST /api/v1/auth/logout
 * @desc    Logout (stateless - client discards token)
 * @access  Private
 */
router.post("/logout", authMiddleware, authController.logout);

/**
 * @route   POST /api/v1/auth/documents
 * @desc    Upload verification documents for pending cook/rider (multipart)
 * @access  Private (cook / rider)
 */
router.post(
  "/documents",
  authMiddleware,
  upload.fields([
    { name: "cnic_front", maxCount: 1 },
    { name: "cnic_back", maxCount: 1 },
    { name: "kitchen_photos", maxCount: 5 },
    { name: "license_photo", maxCount: 1 },
    { name: "vehicle_photo", maxCount: 1 },
  ]),
  authController.uploadDocuments
);

module.exports = router;
