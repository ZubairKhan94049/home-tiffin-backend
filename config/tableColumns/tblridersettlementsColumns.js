const RIDER_SETTLEMENTS = {
  ID: "id", // Unique identifier for each settlement
  RIDER_ID: "rider_id", // FK -> tblusers.id (rider)
  AMOUNT: "amount", // Cash amount deposited (Rs.)
  SETTLED_BY: "settled_by", // FK -> tblusers.id (admin who recorded it)
  SETTLED_AT: "settled_at", // When the deposit was recorded
};

module.exports = RIDER_SETTLEMENTS;
