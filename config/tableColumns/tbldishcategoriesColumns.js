const DISH_CATEGORIES = {
  ID: "id", // Unique identifier for each category
  NAME: "name", // Category name shown to cooks and customers
  DESCRIPTION: "description", // Optional one-line explanation
  EMOJI: "emoji", // Icon as an emoji, when there is no image
  IMAGE: "image", // Uploaded icon; wins over the emoji
  SHOW_ON_HOME: "show_on_home", // 1 = one of the main categories on the customer home
  SORT_ORDER: "sort_order", // Display order in the picker
  IS_ACTIVE: "is_active", // 0 hides it from the picker
  CREATED_AT: "created_at", // Record creation timestamp
};

module.exports = DISH_CATEGORIES;
