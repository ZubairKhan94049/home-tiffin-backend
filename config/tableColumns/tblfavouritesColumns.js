const FAVOURITES = {
  ID: "id", // Unique identifier for each favourite
  CUSTOMER_ID: "customer_id", // FK -> tblusers.id (customer)
  DISH_ID: "dish_id", // FK -> tbldishes.id
  CREATED_AT: "created_at", // When it was hearted
};

module.exports = FAVOURITES;
