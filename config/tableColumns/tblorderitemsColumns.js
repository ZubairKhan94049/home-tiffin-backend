const ORDER_ITEMS = {
  ID: "id", // Unique identifier for each order item
  ORDER_ID: "order_id", // FK -> tblorders.id
  DISH_ID: "dish_id", // FK -> tbldishes.id
  NAME: "name", // Dish name snapshot at order time
  PRICE: "price", // Dish price snapshot at order time (Rs.)
  QUANTITY: "quantity", // Quantity ordered
  IS_VEG: "is_veg", // Vegetarian snapshot
};

module.exports = ORDER_ITEMS;
