const SETTINGS = {
  ID: "id", // Single row id (always 1)
  DELIVERY_FEE: "delivery_fee", // Flat delivery fee (Rs.)
  COMMISSION_PCT: "commission_pct", // Platform commission % taken from cooks
  TAX_PCT: "tax_pct", // Tax % applied on item total
  DISCOUNT_THRESHOLD: "discount_threshold", // Item total above which discount applies (Rs.)
  DISCOUNT_AMOUNT: "discount_amount", // Flat discount amount (Rs.)
  SERVICE_AREAS: "service_areas", // JSON array of serviced cities/areas
  SUPPORT_PHONE: "support_phone", // Customer support phone
  UPDATED_AT: "updated_at", // Record update timestamp
};

module.exports = SETTINGS;
