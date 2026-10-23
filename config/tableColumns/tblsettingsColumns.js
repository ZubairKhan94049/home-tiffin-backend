const SETTINGS = {
  ID: "id", // Single row id (always 1)
  DELIVERY_FEE: "delivery_fee", // Flat delivery fee (Rs.)
  COMMISSION_PCT: "commission_pct", // Platform commission % taken from cooks
  TAX_PCT: "tax_pct", // Tax % applied on item total
  DISCOUNT_THRESHOLD: "discount_threshold", // Item total above which discount applies (Rs.)
  DISCOUNT_AMOUNT: "discount_amount", // Flat discount amount (Rs.)
  SERVICE_AREAS: "service_areas", // JSON array of serviced cities/areas
  SUPPORT_PHONE: "support_phone", // Customer support phone
  PRIVACY_POLICY: "privacy_policy", // Privacy policy shown in the apps
  TERMS_CONDITIONS: "terms_conditions", // Terms and conditions
  PARTNER_CONTRACT: "partner_contract", // The cook/partner agreement
  LEGAL_UPDATED_AT: "legal_updated_at", // When those three last changed
  PAYOUT_BANK_NAME: "payout_bank_name", // Platform deposit account — bank
  PAYOUT_ACCOUNT_TITLE: "payout_account_title", // Platform account title
  PAYOUT_ACCOUNT_NUMBER: "payout_account_number", // Platform account number
  PAYOUT_IBAN: "payout_iban", // Platform IBAN
  PAYOUT_INSTRUCTIONS: "payout_instructions", // Note shown to riders
  DEPOSIT_DUE_DAY: "deposit_due_day", // Weekly deadline for rider deposits
  UPDATED_AT: "updated_at", // Record update timestamp
};

module.exports = SETTINGS;
