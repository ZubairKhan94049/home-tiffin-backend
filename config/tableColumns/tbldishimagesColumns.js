const DISH_IMAGES = {
  ID: "id", // Unique identifier for each image
  DISH_ID: "dish_id", // FK -> tbldishes.id
  IMAGE: "image", // Path to the uploaded photo
  SORT_ORDER: "sort_order", // 0 = the cover photo
  CREATED_AT: "created_at", // Record creation timestamp
};

module.exports = DISH_IMAGES;
