const TABLES = {
  USERS: "tblusers", // All users (customer / cook / rider / admin)
  COOK_PROFILES: "tblcookprofiles", // Cook kitchen profiles
  RIDER_PROFILES: "tblriderprofiles", // Rider vehicle / document profiles
  ADDRESSES: "tbladdresses", // Customer delivery addresses
  DISHES: "tbldishes", // Dishes offered by cooks
  ORDERS: "tblorders", // Orders (lifecycle: new -> ... -> delivered | cancelled)
  ORDER_ITEMS: "tblorderitems", // Order line items (name/price snapshots)
  REVIEWS: "tblreviews", // Order reviews (one per order)
  NOTIFICATIONS: "tblnotifications", // In-app notifications
  RIDER_SETTLEMENTS: "tblridersettlements", // Rider cash deposits to admin
  COOK_PAYOUTS: "tblcookpayouts", // Payouts made to cooks
  SETTINGS: "tblsettings", // Single-row platform settings
};

module.exports = TABLES;
