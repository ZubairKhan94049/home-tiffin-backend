const COOK_PROFILES = {
  ID: "id", // Unique identifier for each cook profile
  USER_ID: "user_id", // FK -> tblusers.id
  KITCHEN_NAME: "kitchen_name", // Display name of the kitchen
  CITY: "city", // Kitchen city
  AREA: "area", // Kitchen area / sector
  BIO: "bio", // Optional kitchen description

  // --- Onboarding wizard ---------------------------------------------------
  ONBOARDING_STEP: "onboarding_step", // Highest step completed (0-5)
  ONBOARDING_COMPLETED_AT: "onboarding_completed_at", // All five steps done

  // Step 2 — business
  MEAL_TYPE_ID: "meal_type_id", // FK -> tblmealtypes.id
  ADDRESS_STREET: "address_street",
  ADDRESS_HOUSE: "address_house",
  ADDRESS_STATE: "address_state",
  ADDRESS_POSTAL_CODE: "address_postal_code",
  ADDRESS_EXTRA: "address_extra", // Optional directions

  // Step 3 — legal
  IS_TAX_REGISTERED: "is_tax_registered",
  SALES_TAX_NUMBER: "sales_tax_number",
  MENU_PRICE_INCLUDES_TAX: "menu_price_includes_tax",
  CNIC_NUMBER: "cnic_number", // Required when not tax registered

  // Step 4 — payment + billing address
  BANK_ACCOUNT_HOLDER: "bank_account_holder",
  BANK_NAME: "bank_name",
  BANK_IBAN: "bank_iban",
  BILLING_SAME_AS_BUSINESS: "billing_same_as_business",
  BILLING_STREET: "billing_street",
  BILLING_HOUSE: "billing_house",
  BILLING_STATE: "billing_state",
  BILLING_CITY: "billing_city",
  BILLING_AREA: "billing_area",
  BILLING_POSTAL_CODE: "billing_postal_code",
  BILLING_EXTRA: "billing_extra",

  // Step 5 — documents (CNIC images below)
  BANK_PROOF: "bank_proof", // Cheque book / bank letter
  MENU_PICTURE: "menu_picture", // Dining menu photo

  // Post-submission status screen, driven by the admin
  CONTRACT_STATUS: "contract_status", // pending | sent | completed
  DOCUMENTS_STATUS: "documents_status", // pending | under_review | approved | rejected
  PROFILE_STATUS: "profile_status", // locked | ready | completed
  ACTIVATION_STATUS: "activation_status", // locked | ready | active
  RATING: "rating", // Cached average rating (recomputed on new review)
  TOTAL_REVIEWS: "total_reviews", // Cached review count
  IS_KITCHEN_OPEN: "is_kitchen_open", // 1 = accepting orders, 0 = closed
  OPERATING_DAYS: "operating_days", // CSV of mon..sun; NULL = every day
  OPENING_TIME: "opening_time", // When the kitchen starts taking orders
  CLOSING_TIME: "closing_time", // When it stops
  DAILY_CAPACITY: "daily_capacity", // Self-imposed cap on orders per day
  CNIC_FRONT: "cnic_front", // Path to CNIC front image
  CNIC_BACK: "cnic_back", // Path to CNIC back image
  KITCHEN_PHOTOS: "kitchen_photos", // JSON array of kitchen photo paths
  REJECTION_REASON: "rejection_reason", // Admin rejection reason (if rejected)
  APPROVED_AT: "approved_at", // When admin approved the cook
  CREATED_AT: "created_at", // Record creation timestamp
  UPDATED_AT: "updated_at", // Record update timestamp
};

module.exports = COOK_PROFILES;
