-- Home Tiffin seed data (mirrors the frontend mocks)
-- Run with: npm run db:seed  (after npm run db:schema)
-- Passwords: admin = zubair62880, everyone else = password123

SET FOREIGN_KEY_CHECKS = 0;
TRUNCATE TABLE tblsettings;
TRUNCATE TABLE tblcookpayouts;
TRUNCATE TABLE tblridersettlements;
TRUNCATE TABLE tblnotifications;
TRUNCATE TABLE tblreviews;
TRUNCATE TABLE tblorderitems;
TRUNCATE TABLE tblorders;
TRUNCATE TABLE tbldishes;
TRUNCATE TABLE tbladdresses;
TRUNCATE TABLE tblriderprofiles;
TRUNCATE TABLE tblcookprofiles;
TRUNCATE TABLE tblusers;
SET FOREIGN_KEY_CHECKS = 1;

-- ---------------------------------------------------------------------------
-- Users
-- id 1        : admin
-- id 2  - 9   : cooks (2-5 active, 6-8 pending, 9 blocked)
-- id 10 - 15  : riders (10-12 active, 13-14 pending, 15 blocked)
-- id 16 - 23  : customers
-- ---------------------------------------------------------------------------
INSERT INTO tblusers (id, name, email, phone, password, role, status) VALUES
(1,  'Admin',           'admin@hometiffin.pk', '+923000000001', '$2b$10$xBZNVgyuqGLTBrj9ab0gHuCUZBYgUU60BDvX5O/65BVQuSfAkGEam', 'admin',    'active'),
-- Cooks
(2,  'Fatima Bibi',     'fatima@hometiffin.pk', '+923011111101', '$2b$10$EYYFMRrOtZyPeYnHFXmrv.iHK5xL1bcFTWvLbyXmYfv1WtQikd6tS', 'cook',     'active'),
(3,  'Zara Aunty',      NULL,                   '+923011111102', '$2b$10$EYYFMRrOtZyPeYnHFXmrv.iHK5xL1bcFTWvLbyXmYfv1WtQikd6tS', 'cook',     'active'),
(4,  'Rashid Mahmood',  NULL,                   '+923011111103', '$2b$10$EYYFMRrOtZyPeYnHFXmrv.iHK5xL1bcFTWvLbyXmYfv1WtQikd6tS', 'cook',     'active'),
(5,  'Sadia Khan',      NULL,                   '+923011111104', '$2b$10$EYYFMRrOtZyPeYnHFXmrv.iHK5xL1bcFTWvLbyXmYfv1WtQikd6tS', 'cook',     'active'),
(6,  'Nusrat Jahan',    NULL,                   '+923011111105', '$2b$10$EYYFMRrOtZyPeYnHFXmrv.iHK5xL1bcFTWvLbyXmYfv1WtQikd6tS', 'cook',     'pending'),
(7,  'Imran Ali',       NULL,                   '+923011111106', '$2b$10$EYYFMRrOtZyPeYnHFXmrv.iHK5xL1bcFTWvLbyXmYfv1WtQikd6tS', 'cook',     'pending'),
(8,  'Salma Riaz',      NULL,                   '+923011111107', '$2b$10$EYYFMRrOtZyPeYnHFXmrv.iHK5xL1bcFTWvLbyXmYfv1WtQikd6tS', 'cook',     'pending'),
(9,  'Tariq Mehmood',   NULL,                   '+923011111108', '$2b$10$EYYFMRrOtZyPeYnHFXmrv.iHK5xL1bcFTWvLbyXmYfv1WtQikd6tS', 'cook',     'blocked'),
-- Riders
(10, 'Ahmed Khan',      NULL,                   '+923022222201', '$2b$10$EYYFMRrOtZyPeYnHFXmrv.iHK5xL1bcFTWvLbyXmYfv1WtQikd6tS', 'rider',    'active'),
(11, 'Bilal Hussain',   NULL,                   '+923022222202', '$2b$10$EYYFMRrOtZyPeYnHFXmrv.iHK5xL1bcFTWvLbyXmYfv1WtQikd6tS', 'rider',    'active'),
(12, 'Usman Tariq',     NULL,                   '+923022222203', '$2b$10$EYYFMRrOtZyPeYnHFXmrv.iHK5xL1bcFTWvLbyXmYfv1WtQikd6tS', 'rider',    'active'),
(13, 'Danish Ali',      NULL,                   '+923022222204', '$2b$10$EYYFMRrOtZyPeYnHFXmrv.iHK5xL1bcFTWvLbyXmYfv1WtQikd6tS', 'rider',    'pending'),
(14, 'Faisal Shah',     NULL,                   '+923022222205', '$2b$10$EYYFMRrOtZyPeYnHFXmrv.iHK5xL1bcFTWvLbyXmYfv1WtQikd6tS', 'rider',    'pending'),
(15, 'Kamran Butt',     NULL,                   '+923022222206', '$2b$10$EYYFMRrOtZyPeYnHFXmrv.iHK5xL1bcFTWvLbyXmYfv1WtQikd6tS', 'rider',    'blocked'),
-- Customers
(16, 'Muhammad Ahmad',  'ahmad@example.com',    '+923001234567', '$2b$10$EYYFMRrOtZyPeYnHFXmrv.iHK5xL1bcFTWvLbyXmYfv1WtQikd6tS', 'customer', 'active'),
(17, 'Ayesha Malik',    NULL,                   '+923001234568', '$2b$10$EYYFMRrOtZyPeYnHFXmrv.iHK5xL1bcFTWvLbyXmYfv1WtQikd6tS', 'customer', 'active'),
(18, 'Hassan Raza',     NULL,                   '+923001234569', '$2b$10$EYYFMRrOtZyPeYnHFXmrv.iHK5xL1bcFTWvLbyXmYfv1WtQikd6tS', 'customer', 'active'),
(19, 'Sana Tariq',      NULL,                   '+923001234570', '$2b$10$EYYFMRrOtZyPeYnHFXmrv.iHK5xL1bcFTWvLbyXmYfv1WtQikd6tS', 'customer', 'active'),
(20, 'Ali Nawaz',       NULL,                   '+923001234571', '$2b$10$EYYFMRrOtZyPeYnHFXmrv.iHK5xL1bcFTWvLbyXmYfv1WtQikd6tS', 'customer', 'active'),
(21, 'Mariam Shaikh',   NULL,                   '+923001234572', '$2b$10$EYYFMRrOtZyPeYnHFXmrv.iHK5xL1bcFTWvLbyXmYfv1WtQikd6tS', 'customer', 'active'),
(22, 'Omar Farooq',     NULL,                   '+923001234573', '$2b$10$EYYFMRrOtZyPeYnHFXmrv.iHK5xL1bcFTWvLbyXmYfv1WtQikd6tS', 'customer', 'active'),
(23, 'Zainab Iqbal',    NULL,                   '+923001234574', '$2b$10$EYYFMRrOtZyPeYnHFXmrv.iHK5xL1bcFTWvLbyXmYfv1WtQikd6tS', 'customer', 'active');

-- ---------------------------------------------------------------------------
-- Cook profiles
-- ---------------------------------------------------------------------------
INSERT INTO tblcookprofiles
(user_id, kitchen_name, city, area, bio, rating, total_reviews, is_kitchen_open, kitchen_photos, rejection_reason, approved_at) VALUES
(2, 'Fatima''s Kitchen',       'Islamabad',  'G-11',         'Authentic home-style Pakistani food cooked with love.',      4.80, 124, 1, JSON_ARRAY('/uploads/seed_kitchen_fatima_1.jpg'), NULL, DATE_SUB(NOW(), INTERVAL 90 DAY)),
(3, 'Auntie Zara''s Delights', 'Islamabad',  'F-10',         'Desi breakfast and comfort food specialist.',                4.60,  89, 1, NULL, NULL, DATE_SUB(NOW(), INTERVAL 75 DAY)),
(4, 'Lahori Zaiqa',            'Rawalpindi', 'Saddar',       'True Lahori taste in Rawalpindi. BBQ and karahi experts.',   4.50,  67, 1, NULL, NULL, DATE_SUB(NOW(), INTERVAL 60 DAY)),
(5, 'Khan''s Desi Handi',      'Islamabad',  'I-8',          'Handi and pulao made in traditional clay pots.',             4.70,  98, 0, NULL, NULL, DATE_SUB(NOW(), INTERVAL 45 DAY)),
(6, 'Nusrat''s Home Food',     'Rawalpindi', 'Bahria Town',  'Daily rotating home menu.',                                  0.00,   0, 1, NULL, NULL, NULL),
(7, 'Desi Daig',               'Islamabad',  'G-13',         'Daig specialities for families.',                            0.00,   0, 1, NULL, NULL, NULL),
(8, 'Mama''s Rasoi',           'Rawalpindi', 'DHA Phase 2',  'Ghar ka khana, roz ka menu.',                                0.00,   0, 1, NULL, NULL, NULL),
(9, 'Spice Route',             'Islamabad',  'F-7',          'Fusion desi food.',                                          3.90,  21, 0, NULL, NULL, DATE_SUB(NOW(), INTERVAL 120 DAY));

-- ---------------------------------------------------------------------------
-- Rider profiles (Ahmed Khan holds Rs. 6,250 cash)
-- ---------------------------------------------------------------------------
INSERT INTO tblriderprofiles
(user_id, city, vehicle_type, vehicle_brand, vehicle_model, license_plate, cnic_number, is_online, cash_in_hand, approved_at) VALUES
(10, 'Islamabad',  'bike', 'Honda',  'CG-125',  'ISB-1234', '61101-1111111-1', 1, 6250, DATE_SUB(NOW(), INTERVAL 80 DAY)),
(11, 'Rawalpindi', 'bike', 'Suzuki', 'GD-110',  'RWP-4567', '61101-2222222-2', 1,    0, DATE_SUB(NOW(), INTERVAL 70 DAY)),
(12, 'Islamabad',  'bike', 'Yamaha', 'YBR-125', 'ISB-7890', '61101-3333333-3', 0, 1200, DATE_SUB(NOW(), INTERVAL 55 DAY)),
(13, 'Islamabad',  'bike', NULL,     NULL,      'ISB-3210', '61101-4444444-4', 0,    0, NULL),
(14, 'Rawalpindi', 'bike', NULL,     NULL,      'RWP-6543', '61101-5555555-5', 0,    0, NULL),
(15, 'Islamabad',  'bike', 'Honda',  'CD-70',   'ISB-9876', '61101-6666666-6', 0,    0, DATE_SUB(NOW(), INTERVAL 100 DAY));

-- ---------------------------------------------------------------------------
-- Customer addresses (Islamabad / Rawalpindi)
-- ---------------------------------------------------------------------------
INSERT INTO tbladdresses
(id, user_id, type, label, full_name, phone, address, area, city, delivery_instructions, is_default) VALUES
(1,  16, 'home',  'Home',    'Muhammad Ahmad', '+923001234567', 'House 12, Street 5, G-11/1',            'G-11',           'Islamabad',  'Ring the bell twice', 1),
(2,  16, 'work',  'Office',  'Muhammad Ahmad', '+923001234567', 'Office 304, Kulsum Plaza, Blue Area',   'Blue Area',      'Islamabad',  NULL,                  0),
(3,  17, 'home',  'Home',    'Ayesha Malik',   '+923001234568', 'Flat 7B, Al-Mustafa Towers, F-10 Markaz','F-10',          'Islamabad',  NULL,                  1),
(4,  18, 'home',  'Home',    'Hassan Raza',    '+923001234569', 'House 45, Street 9, I-8/3',             'I-8',            'Islamabad',  NULL,                  1),
(5,  18, 'other', 'Hostel',  'Hassan Raza',    '+923001234569', 'Hostel 3, NUST, H-12',                  'H-12',           'Islamabad',  'Leave at reception',  0),
(6,  19, 'home',  'Home',    'Sana Tariq',     '+923001234570', 'House 23, Lane 4, Peshawar Road',       'Saddar',         'Rawalpindi', NULL,                  1),
(7,  20, 'home',  'Home',    'Ali Nawaz',      '+923001234571', 'House 88, Block B, Satellite Town',     'Satellite Town', 'Rawalpindi', NULL,                  1),
(8,  21, 'home',  'Home',    'Mariam Shaikh',  '+923001234572', 'House 5, Street 12, F-11/2',            'F-11',           'Islamabad',  NULL,                  1),
(9,  21, 'work',  'Shop',    'Mariam Shaikh',  '+923001234572', 'Shop 12, Jinnah Super, F-7 Markaz',     'F-7',            'Islamabad',  NULL,                  0),
(10, 21, 'other', 'Parents', 'Mariam Shaikh',  '+923001234572', 'House 19, Street 3, G-9/4',             'G-9',            'Islamabad',  NULL,                  0),
(11, 22, 'home',  'Home',    'Omar Farooq',    '+923001234573', 'Flat 2C, PWD Housing Society',          'PWD',            'Islamabad',  NULL,                  1),
(12, 23, 'home',  'Home',    'Zainab Iqbal',   '+923001234574', 'House 301, Phase 4, Bahria Town',       'Bahria Town',    'Rawalpindi', NULL,                  1);

-- ---------------------------------------------------------------------------
-- Dishes (active cooks only; ids 1-20)
-- ---------------------------------------------------------------------------
INSERT INTO tbldishes
(id, cook_id, name, description, category, price, is_veg, spice_level, prep_time_minutes, daily_quantity, is_available, is_hidden) VALUES
-- Fatima's Kitchen (cook 2)
(1,  2, 'Chicken Biryani',        'Fragrant basmati rice layered with spiced chicken.',        'Rice',    350, 0, 2, 45, 20, 1, 0),
(2,  2, 'Chicken Karahi',         'Wok-fried chicken in tomato and green chilli gravy.',       'Curry',   450, 0, 3, 50, 15, 1, 0),
(3,  2, 'Vegetable Pulao',        'Light pulao with seasonal vegetables.',                     'Rice',    200, 1, 1, 35, 15, 1, 0),
(4,  2, 'Daal Chawal',            'Comforting yellow daal served with steamed rice.',          'Rice',    180, 1, 1, 30, 25, 1, 0),
(5,  2, 'Zarda',                  'Sweet saffron rice with nuts and raisins.',                 'Dessert', 150, 1, 1, 25, 10, 1, 0),
(6,  2, 'Shami Kabab (6 pcs)',    'Shallow-fried beef and lentil patties.',                    'BBQ',     220, 0, 2, 30, NULL, 0, 0),
-- Auntie Zara's Delights (cook 3)
(7,  3, 'Beef Nihari',            'Slow-cooked overnight beef stew.',                          'Curry',   400, 0, 3, 60, 12, 1, 0),
(8,  3, 'Aloo Paratha',           'Stuffed potato paratha with butter.',                       'Bread',   120, 1, 1, 20, 30, 1, 0),
(9,  3, 'Haleem',                 'Wheat, lentils and beef slow-cooked to perfection.',        'Curry',   250, 0, 2, 55, 18, 1, 0),
(10, 3, 'Chicken Handi',          'Creamy boneless chicken handi.',                            'Curry',   480, 0, 2, 45, 10, 1, 0),
(11, 3, 'Kheer',                  'Creamy rice pudding with cardamom.',                        'Dessert', 160, 1, 1, 30, 12, 1, 0),
-- Lahori Zaiqa (cook 4)
(12, 4, 'Mutton Karahi',          'Premium mutton karahi, Lahori style.',                      'Curry',   650, 0, 3, 60,  8, 1, 0),
(13, 4, 'Chapli Kabab (2 pcs)',   'Peshawar-style minced beef kababs.',                        'BBQ',     300, 0, 3, 30, 20, 1, 0),
(14, 4, 'Lahori Chargha',         'Whole steam-roasted spiced chicken.',                       'BBQ',     550, 0, 2, 70,  6, 1, 0),
(15, 4, 'Palak Paneer',           'Cottage cheese in spinach gravy.',                          'Curry',   280, 1, 1, 35, 10, 1, 0),
(16, 4, 'Naan (2 pcs)',           'Tandoor-baked naan.',                                       'Bread',    40, 1, 1, 10, NULL, 1, 1),
-- Khan's Desi Handi (cook 5)
(17, 5, 'Chicken White Handi',    'Mild creamy white handi.',                                  'Curry',   500, 0, 1, 45, 10, 1, 0),
(18, 5, 'Beef Pulao',             'Beef yakhni pulao in clay pot.',                            'Rice',    320, 0, 2, 50, 14, 1, 0),
(19, 5, 'Mix Sabzi',              'Seasonal mixed vegetables.',                                'Curry',   190, 1, 1, 30, 12, 1, 0),
(20, 5, 'Gajar Halwa',            'Carrot halwa with khoya.',                                  'Dessert', 180, 1, 1, 40,  8, 1, 0);

-- ---------------------------------------------------------------------------
-- Orders (#1229+, every status; #1234 is ready + unassigned for admin testing)
-- Money: fee 50, tax 5% of item_total (rounded), discount 100 when item_total > 1000
-- ---------------------------------------------------------------------------
INSERT INTO tblorders
(id, order_number, customer_id, cook_id, rider_id, delivery_address, status, item_total, delivery_fee, discount, tax, total, payment_method, special_instructions, cancel_reason, cancelled_by, placed_at, accepted_at, ready_at, picked_up_at, delivered_at, cancelled_at) VALUES
(1, 1229, 16, 2, 10, '{"label":"Home","full_name":"Muhammad Ahmad","phone":"+923001234567","address":"House 12, Street 5, G-11/1","area":"G-11","city":"Islamabad","delivery_instructions":"Ring the bell twice"}',
 'delivered', 850, 50, 0, 43, 943, 'cod', NULL, NULL, NULL,
 DATE_SUB(NOW(), INTERVAL 3 DAY), DATE_SUB(NOW(), INTERVAL 3 DAY) + INTERVAL 5 MINUTE, DATE_SUB(NOW(), INTERVAL 3 DAY) + INTERVAL 45 MINUTE, DATE_SUB(NOW(), INTERVAL 3 DAY) + INTERVAL 55 MINUTE, DATE_SUB(NOW(), INTERVAL 3 DAY) + INTERVAL 85 MINUTE, NULL),
(2, 1230, 17, 3, 11, '{"label":"Home","full_name":"Ayesha Malik","phone":"+923001234568","address":"Flat 7B, Al-Mustafa Towers, F-10 Markaz","area":"F-10","city":"Islamabad"}',
 'delivered', 1280, 50, 100, 64, 1294, 'cod', 'Less spicy please', NULL, NULL,
 DATE_SUB(NOW(), INTERVAL 1 DAY), DATE_SUB(NOW(), INTERVAL 1 DAY) + INTERVAL 4 MINUTE, DATE_SUB(NOW(), INTERVAL 1 DAY) + INTERVAL 50 MINUTE, DATE_SUB(NOW(), INTERVAL 1 DAY) + INTERVAL 60 MINUTE, DATE_SUB(NOW(), INTERVAL 1 DAY) + INTERVAL 95 MINUTE, NULL),
(3, 1231, 18, 2, 10, '{"label":"Home","full_name":"Hassan Raza","phone":"+923001234569","address":"House 45, Street 9, I-8/3","area":"I-8","city":"Islamabad"}',
 'delivered', 630, 50, 0, 32, 712, 'cod', NULL, NULL, NULL,
 DATE_SUB(NOW(), INTERVAL 5 HOUR), DATE_SUB(NOW(), INTERVAL 5 HOUR) + INTERVAL 5 MINUTE, DATE_SUB(NOW(), INTERVAL 4 HOUR), DATE_SUB(NOW(), INTERVAL 4 HOUR) + INTERVAL 10 MINUTE, DATE_SUB(NOW(), INTERVAL 3 HOUR), NULL),
(4, 1232, 19, 4, 12, '{"label":"Home","full_name":"Sana Tariq","phone":"+923001234570","address":"House 23, Lane 4, Peshawar Road","area":"Saddar","city":"Rawalpindi"}',
 'delivered', 1300, 50, 100, 65, 1315, 'cod', NULL, NULL, NULL,
 DATE_SUB(NOW(), INTERVAL 4 HOUR), DATE_SUB(NOW(), INTERVAL 4 HOUR) + INTERVAL 6 MINUTE, DATE_SUB(NOW(), INTERVAL 3 HOUR), DATE_SUB(NOW(), INTERVAL 3 HOUR) + INTERVAL 12 MINUTE, DATE_SUB(NOW(), INTERVAL 2 HOUR), NULL),
(5, 1233, 20, 3, 11, '{"label":"Home","full_name":"Ali Nawaz","phone":"+923001234571","address":"House 88, Block B, Satellite Town","area":"Satellite Town","city":"Rawalpindi"}',
 'on_the_way', 820, 50, 0, 41, 911, 'cod', NULL, NULL, NULL,
 DATE_SUB(NOW(), INTERVAL 2 HOUR), DATE_SUB(NOW(), INTERVAL 115 MINUTE), DATE_SUB(NOW(), INTERVAL 40 MINUTE), DATE_SUB(NOW(), INTERVAL 25 MINUTE), NULL, NULL),
(6, 1234, 21, 2, NULL, '{"label":"Home","full_name":"Mariam Shaikh","phone":"+923001234572","address":"House 5, Street 12, F-11/2","area":"F-11","city":"Islamabad"}',
 'ready', 1050, 50, 100, 53, 1053, 'cod', 'Extra raita please', NULL, NULL,
 DATE_SUB(NOW(), INTERVAL 90 MINUTE), DATE_SUB(NOW(), INTERVAL 85 MINUTE), DATE_SUB(NOW(), INTERVAL 20 MINUTE), NULL, NULL, NULL),
(7, 1235, 22, 4, NULL, '{"label":"Home","full_name":"Omar Farooq","phone":"+923001234573","address":"Flat 2C, PWD Housing Society","area":"PWD","city":"Islamabad"}',
 'preparing', 880, 50, 0, 44, 974, 'cod', NULL, NULL, NULL,
 DATE_SUB(NOW(), INTERVAL 45 MINUTE), DATE_SUB(NOW(), INTERVAL 40 MINUTE), NULL, NULL, NULL, NULL),
(8, 1236, 23, 3, NULL, '{"label":"Home","full_name":"Zainab Iqbal","phone":"+923001234574","address":"House 301, Phase 4, Bahria Town","area":"Bahria Town","city":"Rawalpindi"}',
 'new', 480, 50, 0, 24, 554, 'cod', NULL, NULL, NULL,
 DATE_SUB(NOW(), INTERVAL 10 MINUTE), NULL, NULL, NULL, NULL, NULL),
(9, 1237, 16, 5, NULL, '{"label":"Office","full_name":"Muhammad Ahmad","phone":"+923001234567","address":"Office 304, Kulsum Plaza, Blue Area","area":"Blue Area","city":"Islamabad"}',
 'cancelled', 500, 50, 0, 25, 575, 'cod', NULL, 'Out of ingredients today', 'cook',
 DATE_SUB(NOW(), INTERVAL 2 DAY), NULL, NULL, NULL, NULL, DATE_SUB(NOW(), INTERVAL 2 DAY) + INTERVAL 8 MINUTE);

-- ---------------------------------------------------------------------------
-- Order items (snapshots)
-- ---------------------------------------------------------------------------
INSERT INTO tblorderitems (order_id, dish_id, name, price, quantity, is_veg) VALUES
(1, 1,  'Chicken Biryani',      350, 2, 0),
(1, 5,  'Zarda',                150, 1, 1),
(2, 7,  'Beef Nihari',          400, 2, 0),
(2, 8,  'Aloo Paratha',         120, 4, 1),
(3, 2,  'Chicken Karahi',       450, 1, 0),
(3, 4,  'Daal Chawal',          180, 1, 1),
(4, 12, 'Mutton Karahi',        650, 2, 0),
(5, 9,  'Haleem',               250, 2, 0),
(5, 11, 'Kheer',                160, 2, 1),
(6, 1,  'Chicken Biryani',      350, 3, 0),
(7, 13, 'Chapli Kabab (2 pcs)', 300, 2, 0),
(7, 15, 'Palak Paneer',         280, 1, 1),
(8, 10, 'Chicken Handi',        480, 1, 0),
(9, 17, 'Chicken White Handi',  500, 1, 0);

-- ---------------------------------------------------------------------------
-- Reviews (delivered orders)
-- ---------------------------------------------------------------------------
INSERT INTO tblreviews (order_id, customer_id, cook_id, stars, comment) VALUES
(1, 16, 2, 5, 'Amazing biryani, tasted just like home!'),
(2, 17, 3, 4, 'Nihari was great, parathas slightly oily.'),
(4, 19, 4, 5, 'Best mutton karahi in Rawalpindi.');

-- ---------------------------------------------------------------------------
-- Notifications
-- ---------------------------------------------------------------------------
INSERT INTO tblnotifications (user_id, title, body, type, is_read) VALUES
(16, 'Order #1229 delivered', 'Your order has been delivered. Enjoy your meal!', 'order', 1),
(16, 'Order #1237 cancelled', 'Your order was cancelled by the cook: Out of ingredients today', 'order', 0),
(2,  'New Order #1234', 'You have received a new order of Rs. 1053', 'order', 0),
(10, 'Cash deposit recorded', 'Your cash deposit of Rs. 8500 has been recorded', 'account', 1),
(21, 'Order #1234 is ready', 'Your order is ready and waiting for a rider', 'order', 0);

-- ---------------------------------------------------------------------------
-- Settlements & payouts
-- ---------------------------------------------------------------------------
INSERT INTO tblridersettlements (rider_id, amount, settled_by, settled_at) VALUES
(10, 8500, 1, DATE_SUB(NOW(), INTERVAL 10 DAY)),
(12, 3200, 1, DATE_SUB(NOW(), INTERVAL 6 DAY));

INSERT INTO tblcookpayouts (cook_id, amount, order_count, commission_pct, paid_by, paid_at) VALUES
(2, 500, 1, 15.00, 1, DATE_SUB(NOW(), INTERVAL 14 DAY));

-- ---------------------------------------------------------------------------
-- Settings (single row)
-- ---------------------------------------------------------------------------
INSERT INTO tblsettings
(id, delivery_fee, commission_pct, tax_pct, discount_threshold, discount_amount, service_areas, support_phone) VALUES
(1, 50, 15.00, 5.00, 1000, 100, JSON_ARRAY('Islamabad', 'Rawalpindi'), '+92 51 111 222 333');
