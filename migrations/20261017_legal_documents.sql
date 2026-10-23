-- Privacy policy, terms, and the partner contract, held as editable text so
-- they can be corrected without shipping a release — which matters, because
-- these are the documents most likely to need a lawyer's changes.
ALTER TABLE tblsettings
  ADD COLUMN privacy_policy LONGTEXT NULL,
  ADD COLUMN terms_conditions LONGTEXT NULL,
  ADD COLUMN partner_contract LONGTEXT NULL,
  -- Shown beside each document so a cook can see which version they read.
  ADD COLUMN legal_updated_at DATETIME NULL;
