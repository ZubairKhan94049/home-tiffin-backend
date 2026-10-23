const DISH_AVAILABILITY = {
  ID: "id", // Unique identifier for each window
  DISH_ID: "dish_id", // FK -> tbldishes.id
  AVAILABLE_FROM: "available_from", // Window start
  AVAILABLE_TO: "available_to", // Window end
  SORT_ORDER: "sort_order", // Display order
  CREATED_AT: "created_at", // Record creation timestamp
};

module.exports = DISH_AVAILABILITY;
