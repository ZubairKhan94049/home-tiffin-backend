-- Customers sign up with one field that takes a phone number OR an email, and
-- may sign in with Google, Apple or Facebook instead. Either way one of the
-- two identifiers exists, never neither.
--
-- `phone` was NOT NULL, which made an email-only account impossible. It stays
-- UNIQUE, and MySQL allows many NULLs in a unique index, so email-only and
-- phone-only accounts coexist.
ALTER TABLE tblusers
  MODIFY phone VARCHAR(20) NULL;

-- Who vouched for this account. 'password' is the ordinary sign-up.
ALTER TABLE tblusers
  ADD COLUMN auth_provider ENUM('password', 'google', 'apple', 'facebook')
    NOT NULL DEFAULT 'password' AFTER password,
  -- The provider's own id for this person; unique per provider.
  ADD COLUMN provider_user_id VARCHAR(191) NULL AFTER auth_provider,
  ADD UNIQUE KEY uq_users_provider (auth_provider, provider_user_id);

-- A social account has no password of its own.
ALTER TABLE tblusers
  MODIFY password VARCHAR(255) NULL;
