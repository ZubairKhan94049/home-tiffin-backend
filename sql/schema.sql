-- Home Tiffin schema (destructive: DROP + CREATE)
-- Run with: npm run db:schema

SET FOREIGN_KEY_CHECKS = 0;

DROP TABLE IF EXISTS tblsettings;
DROP TABLE IF EXISTS tblcookpayouts;
DROP TABLE IF EXISTS tblridersettlements;
DROP TABLE IF EXISTS tblnotifications;
DROP TABLE IF EXISTS tblreviews;
DROP TABLE IF EXISTS tblorderitems;
DROP TABLE IF EXISTS tblorders;
DROP TABLE IF EXISTS tbldishes;
DROP TABLE IF EXISTS tbladdresses;
DROP TABLE IF EXISTS tblriderprofiles;
DROP TABLE IF EXISTS tblcookprofiles;
DROP TABLE IF EXISTS tblusers;

SET FOREIGN_KEY_CHECKS = 1;

-- ---------------------------------------------------------------------------
-- Users (customer / cook / rider / admin)
-- ---------------------------------------------------------------------------
CREATE TABLE tblusers (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  name VARCHAR(100) NOT NULL,
  email VARCHAR(150) NULL,
  phone VARCHAR(20) NOT NULL,
  password VARCHAR(255) NOT NULL,
  role ENUM('customer', 'cook', 'rider', 'admin') NOT NULL DEFAULT 'customer',
  status ENUM('pending', 'active', 'blocked') NOT NULL DEFAULT 'active',
  profile_image VARCHAR(255) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_users_phone (phone),
  UNIQUE KEY uq_users_email (email),
  KEY idx_users_role_status (role, status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- Cook profiles
-- ---------------------------------------------------------------------------
CREATE TABLE tblcookprofiles (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id INT UNSIGNED NOT NULL,
  kitchen_name VARCHAR(120) NOT NULL,
  city VARCHAR(80) NOT NULL,
  area VARCHAR(120) NOT NULL,
  bio TEXT NULL,
  rating DECIMAL(3,2) NOT NULL DEFAULT 0,
  total_reviews INT UNSIGNED NOT NULL DEFAULT 0,
  is_kitchen_open TINYINT(1) NOT NULL DEFAULT 1,
  cnic_front VARCHAR(255) NULL,
  cnic_back VARCHAR(255) NULL,
  kitchen_photos JSON NULL,
  rejection_reason VARCHAR(255) NULL,
  approved_at DATETIME NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_cookprofiles_user (user_id),
  KEY idx_cookprofiles_city_area (city, area),
  CONSTRAINT fk_cookprofiles_user FOREIGN KEY (user_id) REFERENCES tblusers (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- Rider profiles
-- ---------------------------------------------------------------------------
CREATE TABLE tblriderprofiles (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id INT UNSIGNED NOT NULL,
  city VARCHAR(80) NOT NULL,
  vehicle_type VARCHAR(30) NOT NULL,
  vehicle_brand VARCHAR(60) NULL,
  vehicle_model VARCHAR(60) NULL,
  license_plate VARCHAR(30) NOT NULL,
  cnic_number VARCHAR(30) NOT NULL,
  cnic_front VARCHAR(255) NULL,
  cnic_back VARCHAR(255) NULL,
  license_photo VARCHAR(255) NULL,
  vehicle_photo VARCHAR(255) NULL,
  is_online TINYINT(1) NOT NULL DEFAULT 0,
  cash_in_hand INT NOT NULL DEFAULT 0,
  rejection_reason VARCHAR(255) NULL,
  approved_at DATETIME NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_riderprofiles_user (user_id),
  KEY idx_riderprofiles_online (is_online),
  CONSTRAINT fk_riderprofiles_user FOREIGN KEY (user_id) REFERENCES tblusers (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- Addresses
-- ---------------------------------------------------------------------------
CREATE TABLE tbladdresses (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id INT UNSIGNED NOT NULL,
  type ENUM('home', 'work', 'other') NOT NULL DEFAULT 'home',
  label VARCHAR(60) NULL,
  full_name VARCHAR(100) NOT NULL,
  phone VARCHAR(20) NOT NULL,
  address VARCHAR(255) NOT NULL,
  area VARCHAR(120) NOT NULL,
  city VARCHAR(80) NOT NULL,
  latitude DECIMAL(10,7) NULL,
  longitude DECIMAL(10,7) NULL,
  delivery_instructions VARCHAR(255) NULL,
  is_default TINYINT(1) NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_addresses_user (user_id),
  CONSTRAINT fk_addresses_user FOREIGN KEY (user_id) REFERENCES tblusers (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- Dishes
-- ---------------------------------------------------------------------------
CREATE TABLE tbldishes (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  cook_id INT UNSIGNED NOT NULL,
  name VARCHAR(120) NOT NULL,
  description TEXT NULL,
  category VARCHAR(60) NOT NULL,
  price INT UNSIGNED NOT NULL,
  is_veg TINYINT(1) NOT NULL DEFAULT 0,
  spice_level TINYINT UNSIGNED NOT NULL DEFAULT 1,
  prep_time_minutes INT UNSIGNED NOT NULL DEFAULT 30,
  daily_quantity INT UNSIGNED NULL,
  is_available TINYINT(1) NOT NULL DEFAULT 1,
  is_hidden TINYINT(1) NOT NULL DEFAULT 0,
  image VARCHAR(255) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_dishes_cook (cook_id),
  KEY idx_dishes_visibility (is_available, is_hidden),
  CONSTRAINT fk_dishes_cook FOREIGN KEY (cook_id) REFERENCES tblusers (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- Orders
-- ---------------------------------------------------------------------------
CREATE TABLE tblorders (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  order_number INT UNSIGNED NOT NULL,
  customer_id INT UNSIGNED NOT NULL,
  cook_id INT UNSIGNED NOT NULL,
  rider_id INT UNSIGNED NULL,
  delivery_address JSON NOT NULL,
  status ENUM('new', 'accepted', 'preparing', 'ready', 'on_the_way', 'delivered', 'cancelled') NOT NULL DEFAULT 'new',
  item_total INT UNSIGNED NOT NULL,
  delivery_fee INT UNSIGNED NOT NULL DEFAULT 0,
  discount INT UNSIGNED NOT NULL DEFAULT 0,
  tax INT UNSIGNED NOT NULL DEFAULT 0,
  total INT UNSIGNED NOT NULL,
  payment_method VARCHAR(20) NOT NULL DEFAULT 'cod',
  special_instructions VARCHAR(255) NULL,
  cancel_reason VARCHAR(255) NULL,
  cancelled_by ENUM('customer', 'cook', 'admin') NULL,
  placed_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  accepted_at DATETIME NULL,
  ready_at DATETIME NULL,
  picked_up_at DATETIME NULL,
  delivered_at DATETIME NULL,
  cancelled_at DATETIME NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_orders_number (order_number),
  KEY idx_orders_status (status),
  KEY idx_orders_customer (customer_id),
  KEY idx_orders_cook (cook_id),
  KEY idx_orders_rider (rider_id),
  KEY idx_orders_placed_at (placed_at),
  CONSTRAINT fk_orders_customer FOREIGN KEY (customer_id) REFERENCES tblusers (id),
  CONSTRAINT fk_orders_cook FOREIGN KEY (cook_id) REFERENCES tblusers (id),
  CONSTRAINT fk_orders_rider FOREIGN KEY (rider_id) REFERENCES tblusers (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- Order items (name/price snapshots)
-- ---------------------------------------------------------------------------
CREATE TABLE tblorderitems (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  order_id INT UNSIGNED NOT NULL,
  dish_id INT UNSIGNED NULL,
  name VARCHAR(120) NOT NULL,
  price INT UNSIGNED NOT NULL,
  quantity INT UNSIGNED NOT NULL DEFAULT 1,
  is_veg TINYINT(1) NOT NULL DEFAULT 0,
  PRIMARY KEY (id),
  KEY idx_orderitems_order (order_id),
  KEY idx_orderitems_dish (dish_id),
  CONSTRAINT fk_orderitems_order FOREIGN KEY (order_id) REFERENCES tblorders (id) ON DELETE CASCADE,
  CONSTRAINT fk_orderitems_dish FOREIGN KEY (dish_id) REFERENCES tbldishes (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- Reviews (one per order)
-- ---------------------------------------------------------------------------
CREATE TABLE tblreviews (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  order_id INT UNSIGNED NOT NULL,
  customer_id INT UNSIGNED NOT NULL,
  cook_id INT UNSIGNED NOT NULL,
  stars TINYINT UNSIGNED NOT NULL,
  comment TEXT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_reviews_order (order_id),
  KEY idx_reviews_cook (cook_id),
  CONSTRAINT fk_reviews_order FOREIGN KEY (order_id) REFERENCES tblorders (id) ON DELETE CASCADE,
  CONSTRAINT fk_reviews_customer FOREIGN KEY (customer_id) REFERENCES tblusers (id) ON DELETE CASCADE,
  CONSTRAINT fk_reviews_cook FOREIGN KEY (cook_id) REFERENCES tblusers (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- Notifications
-- ---------------------------------------------------------------------------
CREATE TABLE tblnotifications (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id INT UNSIGNED NOT NULL,
  title VARCHAR(150) NOT NULL,
  body VARCHAR(500) NOT NULL,
  type VARCHAR(30) NOT NULL DEFAULT 'order',
  is_read TINYINT(1) NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_notifications_user (user_id, is_read),
  CONSTRAINT fk_notifications_user FOREIGN KEY (user_id) REFERENCES tblusers (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- Rider settlements (cash deposits)
-- ---------------------------------------------------------------------------
CREATE TABLE tblridersettlements (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  rider_id INT UNSIGNED NOT NULL,
  amount INT UNSIGNED NOT NULL,
  settled_by INT UNSIGNED NULL,
  settled_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_ridersettlements_rider (rider_id),
  CONSTRAINT fk_ridersettlements_rider FOREIGN KEY (rider_id) REFERENCES tblusers (id) ON DELETE CASCADE,
  CONSTRAINT fk_ridersettlements_admin FOREIGN KEY (settled_by) REFERENCES tblusers (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- Cook payouts
-- ---------------------------------------------------------------------------
CREATE TABLE tblcookpayouts (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  cook_id INT UNSIGNED NOT NULL,
  amount INT UNSIGNED NOT NULL,
  order_count INT UNSIGNED NOT NULL DEFAULT 0,
  commission_pct DECIMAL(5,2) NOT NULL,
  paid_by INT UNSIGNED NULL,
  paid_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_cookpayouts_cook (cook_id),
  CONSTRAINT fk_cookpayouts_cook FOREIGN KEY (cook_id) REFERENCES tblusers (id) ON DELETE CASCADE,
  CONSTRAINT fk_cookpayouts_admin FOREIGN KEY (paid_by) REFERENCES tblusers (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- Settings (single row)
-- ---------------------------------------------------------------------------
CREATE TABLE tblsettings (
  id INT UNSIGNED NOT NULL,
  delivery_fee INT UNSIGNED NOT NULL DEFAULT 50,
  commission_pct DECIMAL(5,2) NOT NULL DEFAULT 15.00,
  tax_pct DECIMAL(5,2) NOT NULL DEFAULT 5.00,
  discount_threshold INT UNSIGNED NOT NULL DEFAULT 1000,
  discount_amount INT UNSIGNED NOT NULL DEFAULT 100,
  service_areas JSON NULL,
  support_phone VARCHAR(30) NULL,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
