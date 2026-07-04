const DISHES = {
  ID: "id", // Unique identifier for each dish
  COOK_ID: "cook_id", // FK -> tblusers.id (cook)
  NAME: "name", // Dish name
  DESCRIPTION: "description", // Optional dish description
  CATEGORY: "category", // Category (Rice, Curry, BBQ ...)
  PRICE: "price", // Price in Rs. (integer)
  IS_VEG: "is_veg", // 1 = vegetarian
  SPICE_LEVEL: "spice_level", // 1 (mild) - 3 (hot)
  PREP_TIME_MINUTES: "prep_time_minutes", // Preparation time in minutes
  DAILY_QUANTITY: "daily_quantity", // Optional daily quantity limit
  IS_AVAILABLE: "is_available", // Cook-controlled availability toggle
  IS_HIDDEN: "is_hidden", // Admin-controlled visibility toggle
  IMAGE: "image", // Path to dish image
  CREATED_AT: "created_at", // Record creation timestamp
  UPDATED_AT: "updated_at", // Record update timestamp
};

module.exports = DISHES;
