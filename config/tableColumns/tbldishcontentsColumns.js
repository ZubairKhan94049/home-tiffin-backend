const DISH_CONTENTS = {
  ID: "id", // Unique identifier for each line
  DISH_ID: "dish_id", // FK -> tbldishes.id
  NAME: "name", // What is included, e.g. Chawal
  QUANTITY: "quantity", // How much, e.g. 1/2 kg
  SORT_ORDER: "sort_order", // Display order
  CREATED_AT: "created_at", // Record creation timestamp
};

module.exports = DISH_CONTENTS;
