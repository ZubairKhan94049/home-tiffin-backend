const DISH_VARIATIONS = {
  ID: "id", // Unique identifier for each variation
  DISH_ID: "dish_id", // FK -> tbldishes.id
  NAME: "name", // Size or option, e.g. Small, Large, Soup, Dry
  PRICE: "price", // Price in Rs. for this variation (integer)
  SERVES: "serves", // Optional override of the item's serving size
  SORT_ORDER: "sort_order", // Display order on the menu
  CREATED_AT: "created_at", // Record creation timestamp
};

module.exports = DISH_VARIATIONS;
