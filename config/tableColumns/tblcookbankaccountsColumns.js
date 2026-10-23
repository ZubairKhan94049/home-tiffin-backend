const COOK_BANK_ACCOUNTS = {
  ID: "id", // Unique identifier for each account
  COOK_ID: "cook_id", // FK -> tblusers.id (cook)
  BANK_NAME: "bank_name", // Bank or wallet, e.g. Meezan, JazzCash
  ACCOUNT_TITLE: "account_title", // Name on the account — must match the CNIC
  ACCOUNT_NUMBER: "account_number", // Account or wallet number
  IBAN: "iban", // Optional IBAN
  BRANCH: "branch", // Optional branch name or code
  PROOF_IMAGE: "proof_image", // Cheque book / statement photo
  IS_DEFAULT: "is_default", // 1 = the account weekly payouts go to
  CREATED_AT: "created_at", // Record creation timestamp
  UPDATED_AT: "updated_at", // Record update timestamp
};

module.exports = COOK_BANK_ACCOUNTS;
