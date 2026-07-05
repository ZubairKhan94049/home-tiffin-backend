-- Reset: empty every table but keep the admin account and platform settings.
-- Usage: npm run db:reset

SET FOREIGN_KEY_CHECKS = 0;

TRUNCATE TABLE tblorderitems;
TRUNCATE TABLE tblreviews;
TRUNCATE TABLE tblnotifications;
TRUNCATE TABLE tblridersettlements;
TRUNCATE TABLE tblcookpayouts;
TRUNCATE TABLE tblorders;
TRUNCATE TABLE tbldishes;
TRUNCATE TABLE tbladdresses;
TRUNCATE TABLE tblcookprofiles;
TRUNCATE TABLE tblriderprofiles;
TRUNCATE TABLE tblusers;
TRUNCATE TABLE tblsettings;

SET FOREIGN_KEY_CHECKS = 1;

-- Admin account (admin@hometiffin.pk / zubair62880)
INSERT INTO tblusers (id, name, email, phone, password, role, status) VALUES
(1, 'Admin', 'admin@hometiffin.pk', '+923000000001', '$2b$10$xBZNVgyuqGLTBrj9ab0gHuCUZBYgUU60BDvX5O/65BVQuSfAkGEam', 'admin', 'active');

-- Platform settings (required for order total computation)
INSERT INTO tblsettings
(id, delivery_fee, commission_pct, tax_pct, discount_threshold, discount_amount, service_areas, support_phone) VALUES
(1, 50, 15.00, 5.00, 1000, 100, JSON_ARRAY('Islamabad', 'Rawalpindi'), '+92 51 111 222 333');
