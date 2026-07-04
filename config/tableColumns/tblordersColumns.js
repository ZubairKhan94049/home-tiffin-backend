const ORDERS = {
  ID: "id", // Unique identifier for each order
  ORDER_NUMBER: "order_number", // Public order number (#1229+)
  CUSTOMER_ID: "customer_id", // FK -> tblusers.id (customer)
  COOK_ID: "cook_id", // FK -> tblusers.id (cook)
  RIDER_ID: "rider_id", // FK -> tblusers.id (rider, nullable)
  DELIVERY_ADDRESS: "delivery_address", // JSON snapshot of the delivery address
  STATUS: "status", // new | accepted | preparing | ready | on_the_way | delivered | cancelled
  ITEM_TOTAL: "item_total", // Sum of item price x quantity (Rs.)
  DELIVERY_FEE: "delivery_fee", // Delivery fee snapshot (Rs.)
  DISCOUNT: "discount", // Discount applied (Rs.)
  TAX: "tax", // Tax applied (Rs.)
  TOTAL: "total", // Grand total (Rs.)
  PAYMENT_METHOD: "payment_method", // 'cod'
  SPECIAL_INSTRUCTIONS: "special_instructions", // Optional customer note
  CANCEL_REASON: "cancel_reason", // Reason when cancelled
  CANCELLED_BY: "cancelled_by", // customer | cook | admin
  PLACED_AT: "placed_at", // When order was placed
  ACCEPTED_AT: "accepted_at", // When cook accepted
  READY_AT: "ready_at", // When cook marked ready
  PICKED_UP_AT: "picked_up_at", // When rider picked up
  DELIVERED_AT: "delivered_at", // When rider delivered
  CANCELLED_AT: "cancelled_at", // When order was cancelled
};

module.exports = ORDERS;
