-- Cook onboarding becomes a resumable five-step wizard.
--
-- Registration (step 1) now only takes name/email/phone/password, so the
-- business fields it used to demand move to step 2 and become nullable. Each
-- step writes straight into the cook's profile row, so progress survives the
-- app being closed with no separate draft table to reconcile.

-- 1. Collected at step 2 now, not at registration.
ALTER TABLE tblcookprofiles
  MODIFY kitchen_name VARCHAR(120) NULL,
  MODIFY city VARCHAR(80) NULL,
  MODIFY area VARCHAR(120) NULL;

-- 2. Wizard progress + everything the five steps collect.
ALTER TABLE tblcookprofiles
  -- Highest step the cook has completed; 0 = nothing past registration.
  ADD COLUMN onboarding_step TINYINT UNSIGNED NOT NULL DEFAULT 0 AFTER user_id,
  ADD COLUMN onboarding_completed_at DATETIME NULL AFTER onboarding_step,

  -- Step 2 — business
  ADD COLUMN meal_type_id INT UNSIGNED NULL,
  ADD COLUMN address_street VARCHAR(160) NULL,
  ADD COLUMN address_house VARCHAR(60) NULL,
  ADD COLUMN address_state VARCHAR(80) NULL,
  ADD COLUMN address_postal_code VARCHAR(20) NULL,
  ADD COLUMN address_extra VARCHAR(255) NULL,

  -- Step 3 — legal
  ADD COLUMN is_tax_registered TINYINT(1) NULL,
  ADD COLUMN sales_tax_number VARCHAR(60) NULL,
  ADD COLUMN menu_price_includes_tax TINYINT(1) NULL,
  ADD COLUMN cnic_number VARCHAR(20) NULL,

  -- Step 4 — payment + billing address
  ADD COLUMN bank_account_holder VARCHAR(120) NULL,
  ADD COLUMN bank_name VARCHAR(120) NULL,
  ADD COLUMN bank_iban VARCHAR(34) NULL,
  ADD COLUMN billing_same_as_business TINYINT(1) NOT NULL DEFAULT 1,
  ADD COLUMN billing_street VARCHAR(160) NULL,
  ADD COLUMN billing_house VARCHAR(60) NULL,
  ADD COLUMN billing_state VARCHAR(80) NULL,
  ADD COLUMN billing_city VARCHAR(80) NULL,
  ADD COLUMN billing_area VARCHAR(120) NULL,
  ADD COLUMN billing_postal_code VARCHAR(20) NULL,
  ADD COLUMN billing_extra VARCHAR(255) NULL,

  -- Step 5 — documents (cnic_front / cnic_back already exist)
  ADD COLUMN bank_proof VARCHAR(255) NULL,
  ADD COLUMN menu_picture VARCHAR(255) NULL,

  -- Post-submission status screen. Each row is admin-driven.
  ADD COLUMN contract_status ENUM('pending','sent','completed')
    NOT NULL DEFAULT 'pending',
  ADD COLUMN documents_status ENUM('pending','under_review','approved','rejected')
    NOT NULL DEFAULT 'pending',
  ADD COLUMN profile_status ENUM('locked','ready','completed')
    NOT NULL DEFAULT 'locked',
  ADD COLUMN activation_status ENUM('locked','ready','active')
    NOT NULL DEFAULT 'locked';

-- 3. Email verification, with a skip option at step 1.
ALTER TABLE tblusers
  ADD COLUMN email_verified_at DATETIME NULL AFTER email;

-- 4. Meal types for the step 2 dropdown.
CREATE TABLE IF NOT EXISTS tblmealtypes (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  name VARCHAR(80) NOT NULL,
  description VARCHAR(160) NULL,
  sort_order INT UNSIGNED NOT NULL DEFAULT 0,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_mealtypes_name (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT IGNORE INTO tblmealtypes (name, description, sort_order) VALUES
  ('Desi / Pakistani', 'Everyday home-style Pakistani food', 1),
  ('BBQ & Grill', 'Tikka, seekh kebab, grilled items', 2),
  ('Biryani & Rice', 'Biryani, pulao and rice dishes', 3),
  ('Fast Food', 'Burgers, sandwiches, fries', 4),
  ('Chinese', 'Chinese and Indo-Chinese dishes', 5),
  ('Healthy / Diet', 'Low-oil, calorie-counted meals', 6),
  ('Breakfast', 'Halwa puri, paratha, nashta', 7),
  ('Desserts & Bakery', 'Sweets, cakes and baked goods', 8);
