-- Payout accounts stop being self-service. A cook asks for a change and an
-- admin applies it, because the account money is sent to is exactly the
-- thing an attacker who gets into an account would want to swap.
--
-- The request holds the proposed details; nothing in tblcookbankaccounts
-- moves until an admin approves it.
CREATE TABLE IF NOT EXISTS tblcookbankrequests (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  cook_id INT UNSIGNED NOT NULL,
  -- add = a new account, update = change an existing one, remove = delete it
  type ENUM('add', 'update', 'remove') NOT NULL,
  -- The account being changed; NULL for 'add'.
  account_id INT UNSIGNED NULL,
  bank_name VARCHAR(120) NULL,
  account_title VARCHAR(120) NULL,
  account_number VARCHAR(60) NULL,
  iban VARCHAR(60) NULL,
  branch VARCHAR(120) NULL,
  -- Photo of the cheque book or bank statement proving the account is theirs.
  proof_image VARCHAR(255) NULL,
  -- Whether this should become the account payouts go to.
  make_default TINYINT(1) NOT NULL DEFAULT 0,
  cook_note VARCHAR(255) NULL,
  status ENUM('pending', 'approved', 'rejected') NOT NULL DEFAULT 'pending',
  admin_note VARCHAR(255) NULL,
  reviewed_by INT UNSIGNED NULL,
  reviewed_at DATETIME NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_bankrequests_cook (cook_id, status),
  KEY idx_bankrequests_status (status, created_at),
  CONSTRAINT fk_bankrequests_cook FOREIGN KEY (cook_id)
    REFERENCES tblusers (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Proof travels with the account too, so the admin can see it later.
ALTER TABLE tblcookbankaccounts
  ADD COLUMN proof_image VARCHAR(255) NULL AFTER branch;
