const COOK_PAYOUTS = {
  ID: "id", // Unique identifier for each payout
  COOK_ID: "cook_id", // FK -> tblusers.id (cook)
  AMOUNT: "amount", // Amount paid to the cook (Rs.)
  ORDER_COUNT: "order_count", // Delivered orders covered by this payout
  COMMISSION_PCT: "commission_pct", // Commission % snapshot at payout time
  PAID_BY: "paid_by", // FK -> tblusers.id (admin who paid)
  PAID_AT: "paid_at", // When the payout was made
};

module.exports = COOK_PAYOUTS;
