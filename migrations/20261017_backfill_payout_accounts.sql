-- Cooks who finished registration before the payout account was created from
-- their step 4 details: their bank details sat on the profile and the Bank
-- Accounts screen showed nothing. Give each of them the account they thought
-- they had already added.
--
-- Only cooks with no accounts at all are touched, so anyone who has since
-- added their own keeps exactly what they set up.
INSERT INTO tblcookbankaccounts
  (cook_id, bank_name, account_title, account_number, iban, is_default)
SELECT cp.user_id, TRIM(cp.bank_name), TRIM(cp.bank_account_holder),
       TRIM(cp.bank_iban), TRIM(cp.bank_iban), 1
  FROM tblcookprofiles cp
 WHERE TRIM(COALESCE(cp.bank_iban, '')) <> ''
   AND TRIM(COALESCE(cp.bank_name, '')) <> ''
   AND TRIM(COALESCE(cp.bank_account_holder, '')) <> ''
   AND NOT EXISTS (
     SELECT 1 FROM tblcookbankaccounts a WHERE a.cook_id = cp.user_id
   );
