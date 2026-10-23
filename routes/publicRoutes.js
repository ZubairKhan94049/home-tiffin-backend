const express = require("express");
const router = express.Router();
const onboarding = require("../controllers/cookOnboardingController");
const cookController = require("../controllers/cookController");
const categoryController = require("../controllers/categoryController");

/**
 * @route   GET /api/v1/meal-types
 * @desc    Cuisine options for the cook onboarding dropdown. Public so the
 *          wizard can render step 2 without a round trip through auth.
 * @access  Public
 */
router.get("/meal-types", onboarding.getMealTypes);

/**
 * @route   GET /api/v1/dish-categories
 * @desc    Active menu categories, with their emoji or image. `?home=1`
 *          returns only the main ones the admin put on the customer home.
 *          Public: the cook picker and the customer app share it.
 * @access  Public
 */
router.get("/dish-categories", categoryController.getCategories);

/**
 * @route   GET /api/v1/legal
 * @desc    Privacy policy, terms and the partner agreement, as editable text
 *          from settings. Public — the apps show them before sign-up.
 * @access  Public
 */
router.get("/legal", onboarding.getLegalDocuments);

module.exports = router;
