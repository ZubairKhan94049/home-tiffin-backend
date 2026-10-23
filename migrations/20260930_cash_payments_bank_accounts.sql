-- Cash-first payment flow.
--
-- Customers pay the rider in cash on delivery. The rider banks the collected
-- cash into the platform's own account (weekly, by Sunday), and the platform
-- settles each cook from that pot at the end of the week.
--
-- Riders therefore never supply bank details — they only need to see where to
-- pay in. Cooks do, and may keep more than one account.

-- 1. The platform's deposit account, shown read-only to riders.
ALTER TABLE tblsettings
  ADD COLUMN payout_bank_name VARCHAR(120) NULL AFTER support_phone,
  ADD COLUMN payout_account_title VARCHAR(120) NULL AFTER payout_bank_name,
  ADD COLUMN payout_account_number VARCHAR(64) NULL AFTER payout_account_title,
  ADD COLUMN payout_iban VARCHAR(34) NULL AFTER payout_account_number,
  ADD COLUMN payout_instructions VARCHAR(255) NULL AFTER payout_iban,
  ADD COLUMN deposit_due_day VARCHAR(12) NOT NULL DEFAULT 'Sunday' AFTER payout_instructions;

-- 2. Cook bank accounts — several per cook, exactly one marked default.
CREATE TABLE IF NOT EXISTS tblcookbankaccounts (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  cook_id INT UNSIGNED NOT NULL,
  bank_name VARCHAR(120) NOT NULL,
  account_title VARCHAR(120) NOT NULL,
  account_number VARCHAR(64) NOT NULL,
  iban VARCHAR(34) NULL,
  branch VARCHAR(120) NULL,
  is_default TINYINT(1) NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_cookbankaccounts_cook (cook_id),
  CONSTRAINT fk_cookbankaccounts_cook FOREIGN KEY (cook_id) REFERENCES tblusers (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
