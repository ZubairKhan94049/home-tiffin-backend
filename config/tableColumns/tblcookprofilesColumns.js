const COOK_PROFILES = {
  ID: "id", // Unique identifier for each cook profile
  USER_ID: "user_id", // FK -> tblusers.id
  KITCHEN_NAME: "kitchen_name", // Display name of the kitchen
  CITY: "city", // Kitchen city
  AREA: "area", // Kitchen area / sector
  BIO: "bio", // Optional kitchen description
  RATING: "rating", // Cached average rating (recomputed on new review)
  TOTAL_REVIEWS: "total_reviews", // Cached review count
  IS_KITCHEN_OPEN: "is_kitchen_open", // 1 = accepting orders, 0 = closed
  CNIC_FRONT: "cnic_front", // Path to CNIC front image
  CNIC_BACK: "cnic_back", // Path to CNIC back image
  KITCHEN_PHOTOS: "kitchen_photos", // JSON array of kitchen photo paths
  REJECTION_REASON: "rejection_reason", // Admin rejection reason (if rejected)
  APPROVED_AT: "approved_at", // When admin approved the cook
  CREATED_AT: "created_at", // Record creation timestamp
  UPDATED_AT: "updated_at", // Record update timestamp
};

module.exports = COOK_PROFILES;
