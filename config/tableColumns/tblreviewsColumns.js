const REVIEWS = {
  ID: "id", // Unique identifier for each review
  ORDER_ID: "order_id", // FK -> tblorders.id (unique - one review per order)
  CUSTOMER_ID: "customer_id", // FK -> tblusers.id (customer)
  COOK_ID: "cook_id", // FK -> tblusers.id (cook)
  STARS: "stars", // 1 - 5
  COMMENT: "comment", // Optional review text
  CREATED_AT: "created_at", // Record creation timestamp
};

module.exports = REVIEWS;
