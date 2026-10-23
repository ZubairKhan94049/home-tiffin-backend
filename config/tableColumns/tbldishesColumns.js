const DISHES = {
  ID: "id", // Unique identifier for each dish
  COOK_ID: "cook_id", // FK -> tblusers.id (cook)
  NAME: "name", // Dish name
  DESCRIPTION: "description", // Optional dish description
  CATEGORY: "category", // Category name, denormalised from tbldishcategories
  CATEGORY_ID: "category_id", // FK -> tbldishcategories.id
  PRICE: "price", // Base price in Rs. (integer)
  SERVES: "serves", // Optional "serves" note, e.g. "1 person", "2-3 people"
  IS_VEG: "is_veg", // Unused — kept for order-item history
  SPICE_LEVEL: "spice_level", // 1 (mild) - 3 (hot)
  PREP_TIME_MINUTES: "prep_time_minutes", // Preparation time in minutes
  AVAILABLE_DAYS: "available_days", // CSV of mon..sun; NULL = every day
  // Serving windows live in tbldishavailability — a kitchen may do both
  // breakfast and dinner.
  DAILY_QUANTITY: "daily_quantity", // Unused — no longer collected
  IS_AVAILABLE: "is_available", // Cook-controlled availability toggle
  IS_HIDDEN: "is_hidden", // Admin-controlled visibility toggle
  IMAGE: "image", // Path to the first dish image (see tbldishimages)
  CREATED_AT: "created_at", // Record creation timestamp
  UPDATED_AT: "updated_at", // Record update timestamp
};

module.exports = DISHES;
