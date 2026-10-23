const TABLES = {
  USERS: "tblusers", // All users (customer / cook / rider / admin)
  COOK_PROFILES: "tblcookprofiles", // Cook kitchen profiles
  RIDER_PROFILES: "tblriderprofiles", // Rider vehicle / document profiles
  ADDRESSES: "tbladdresses", // Customer delivery addresses
  DISHES: "tbldishes", // Dishes offered by cooks
  DISH_CATEGORIES: "tbldishcategories", // Menu categories cooks pick from
  DISH_IMAGES: "tbldishimages", // Up to 3 photos per dish
  DISH_VARIATIONS: "tbldishvariations", // Size / option variations per dish
  DISH_AVAILABILITY: "tbldishavailability", // Serving windows per dish
  DISH_CONTENTS: "tbldishcontents", // What a platter / deal is made up of
  ORDERS: "tblorders", // Orders (lifecycle: new -> ... -> delivered | cancelled)
  ORDER_ITEMS: "tblorderitems", // Order line items (name/price snapshots)
  REVIEWS: "tblreviews", // Order reviews (one per order)
  NOTIFICATIONS: "tblnotifications", // In-app notifications
  FAVOURITES: "tblfavourites", // Dishes a customer has hearted
  BANNERS: "tblbanners", // Customer home carousel, run from the admin panel
  RIDER_SETTLEMENTS: "tblridersettlements", // Rider cash deposits to admin
  COOK_PAYOUTS: "tblcookpayouts", // Payouts made to cooks
  COOK_BANK_ACCOUNTS: "tblcookbankaccounts", // Cook bank accounts for payouts
  COOK_BANK_REQUESTS: "tblcookbankrequests", // Admin-approved changes to those accounts
  MEAL_TYPES: "tblmealtypes", // Cuisine options for cook onboarding
  SETTINGS: "tblsettings", // Single-row platform settings
};

module.exports = TABLES;
