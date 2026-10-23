const COOK_BANK_REQUESTS = {
  ID: "id", // Unique identifier for each request
  COOK_ID: "cook_id", // FK -> tblusers.id (cook)
  TYPE: "type", // add | update | remove
  ACCOUNT_ID: "account_id", // FK -> tblcookbankaccounts.id; NULL when adding
  BANK_NAME: "bank_name", // Proposed bank or wallet
  ACCOUNT_TITLE: "account_title", // Proposed name on the account
  ACCOUNT_NUMBER: "account_number", // Proposed account or wallet number
  IBAN: "iban", // Proposed IBAN
  BRANCH: "branch", // Proposed branch
  PROOF_IMAGE: "proof_image", // Cheque book / statement photo
  MAKE_DEFAULT: "make_default", // 1 = should receive payouts once applied
  COOK_NOTE: "cook_note", // Why the cook is asking
  STATUS: "status", // pending | approved | rejected
  ADMIN_NOTE: "admin_note", // Admin's reason, shown to the cook
  REVIEWED_BY: "reviewed_by", // FK -> tblusers.id (admin)
  REVIEWED_AT: "reviewed_at", // When it was decided
  CREATED_AT: "created_at", // When the cook asked
};

module.exports = COOK_BANK_REQUESTS;
