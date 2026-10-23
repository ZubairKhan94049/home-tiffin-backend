-- When the kitchen cooks and how much it can take in a day. Both were
-- "coming soon" placeholders on the profile screen; they belong together
-- because how long you cook and how much you can take are one decision.
ALTER TABLE tblcookprofiles
  -- CSV of mon..sun. NULL means every day, matching how dishes store theirs.
  ADD COLUMN operating_days VARCHAR(40) NULL,
  ADD COLUMN opening_time TIME NULL,
  ADD COLUMN closing_time TIME NULL,
  -- Orders the kitchen will accept in a day; NULL means no self-imposed cap.
  ADD COLUMN daily_capacity INT UNSIGNED NULL;
