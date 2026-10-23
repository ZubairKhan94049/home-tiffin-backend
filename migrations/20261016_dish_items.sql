-- A dish becomes a proper menu item: a searchable category, up to three
-- photos, size/option variations, how many people it serves, and the days and
-- hours it is on offer.
--
-- The vegetarian flag goes unused from here on — the category already says
-- what a dish is — but the column stays so the order-item snapshots that
-- reference it keep their history.

-- 1. Categories come from the backend now, so cooks pick from one list the
--    admin controls rather than typing free text.
CREATE TABLE IF NOT EXISTS tbldishcategories (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  name VARCHAR(80) NOT NULL,
  description VARCHAR(160) NULL,
  sort_order INT UNSIGNED NOT NULL DEFAULT 0,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_dishcategories_name (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT IGNORE INTO tbldishcategories (name, description, sort_order) VALUES
  ('Biryani & Pulao', 'Biryani, pulao and rice dishes', 1),
  ('Curries & Salan', 'Gravy dishes served with roti or rice', 2),
  ('BBQ & Grill', 'Tikka, seekh kebab and grilled items', 3),
  ('Karahi & Handi', 'Karahi, handi and white karahi', 4),
  ('Daal & Sabzi', 'Lentils and vegetable dishes', 5),
  ('Breakfast & Nashta', 'Halwa puri, paratha, anda and chai', 6),
  ('Roti & Naan', 'Breads baked fresh', 7),
  ('Chinese', 'Chowmein, manchurian and Indo-Chinese', 8),
  ('Fast Food', 'Burgers, sandwiches, rolls and fries', 9),
  ('Soups & Starters', 'Soups, samosas and other starters', 10),
  ('Salads & Raita', 'Sides served with the main meal', 11),
  ('Desserts & Sweets', 'Kheer, halwa, cakes and mithai', 12),
  ('Beverages', 'Drinks, lassi, chai and juices', 13),
  ('Tiffin & Meal Deals', 'Full meal boxes and weekly tiffin plans', 14),
  ('Healthy & Diet', 'Low-oil and calorie-counted meals', 15);

-- 2. The new item fields.
ALTER TABLE tbldishes
  -- `category` stays as the denormalised name so existing reads keep working.
  ADD COLUMN category_id INT UNSIGNED NULL AFTER category,
  -- Free text rather than a number: "1 person", "2-3 people", "Family size".
  ADD COLUMN serves VARCHAR(40) NULL AFTER price,
  -- CSV of mon..sun. NULL means every day, which is what most dishes are.
  ADD COLUMN available_days VARCHAR(40) NULL AFTER prep_time_minutes,
  ADD COLUMN available_from TIME NULL AFTER available_days,
  ADD COLUMN available_to TIME NULL AFTER available_from,
  ADD KEY idx_dishes_category (category_id);

-- Match the free-text categories already in use onto the new list where we can.
UPDATE tbldishes d
  JOIN tbldishcategories c ON c.name = d.category
  SET d.category_id = c.id;

-- 3. Up to three photos per dish. `tbldishes.image` keeps the first one so
--    every existing reader (customer cards, order items) is unaffected.
CREATE TABLE IF NOT EXISTS tbldishimages (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  dish_id INT UNSIGNED NOT NULL,
  image VARCHAR(255) NOT NULL,
  sort_order TINYINT UNSIGNED NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_dishimages_dish (dish_id, sort_order),
  CONSTRAINT fk_dishimages_dish FOREIGN KEY (dish_id)
    REFERENCES tbldishes (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO tbldishimages (dish_id, image, sort_order)
  SELECT id, image, 0 FROM tbldishes
   WHERE image IS NOT NULL AND image <> ''
     AND id NOT IN (SELECT dish_id FROM tbldishimages);

-- 4. Size or option variations (Small/Medium/Large, Soup/Dry). A dish with no
--    rows here is simply sold at `tbldishes.price`.
CREATE TABLE IF NOT EXISTS tbldishvariations (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  dish_id INT UNSIGNED NOT NULL,
  name VARCHAR(80) NOT NULL,
  price INT UNSIGNED NOT NULL,
  sort_order TINYINT UNSIGNED NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_dishvariations_dish (dish_id, sort_order),
  CONSTRAINT fk_dishvariations_dish FOREIGN KEY (dish_id)
    REFERENCES tbldishes (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
