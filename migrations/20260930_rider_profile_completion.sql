-- Riders may not go online or accept deliveries until their profile is
-- complete: personal details, vehicle + documents, CNIC address, emergency
-- contact, and an acknowledged read of the safety guidelines.
--
-- Address and emergency contact previously had nowhere to live server-side,
-- so the rider app kept them on the device. A gate can't be enforced against
-- device-local data, so they move here.

ALTER TABLE tblriderprofiles
  ADD COLUMN address_line VARCHAR(255) NULL AFTER cnic_number,
  ADD COLUMN address_area VARCHAR(120) NULL AFTER address_line,
  ADD COLUMN address_city VARCHAR(80) NULL AFTER address_area,
  ADD COLUMN emergency_name VARCHAR(120) NULL AFTER address_city,
  ADD COLUMN emergency_relationship VARCHAR(60) NULL AFTER emergency_name,
  ADD COLUMN emergency_phone VARCHAR(30) NULL AFTER emergency_relationship,
  ADD COLUMN emergency_alt_phone VARCHAR(30) NULL AFTER emergency_phone,
  ADD COLUMN safety_accepted_at DATETIME NULL AFTER emergency_alt_phone;
