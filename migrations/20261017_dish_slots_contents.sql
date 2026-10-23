-- Two more things an item needs to describe itself properly.
--
-- 1. One serving window was never enough — a kitchen that does breakfast and
--    dinner needs both, so the window becomes a list.
-- 2. A platter is really several things in one item ("Chawal 1/2 kg, Gosht
--    0.5 kg"), which the description could only ever approximate.

CREATE TABLE IF NOT EXISTS tbldishavailability (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  dish_id INT UNSIGNED NOT NULL,
  available_from TIME NOT NULL,
  available_to TIME NOT NULL,
  sort_order TINYINT UNSIGNED NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_dishavailability_dish (dish_id, sort_order),
  CONSTRAINT fk_dishavailability_dish FOREIGN KEY (dish_id)
    REFERENCES tbldishes (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Carry across the single window each dish may already have.
INSERT INTO tbldishavailability (dish_id, available_from, available_to, sort_order)
  SELECT id, available_from, available_to, 0 FROM tbldishes
   WHERE available_from IS NOT NULL AND available_to IS NOT NULL
     AND id NOT IN (SELECT dish_id FROM tbldishavailability);

ALTER TABLE tbldishes
  DROP COLUMN available_from,
  DROP COLUMN available_to;

-- What the item is made up of. Empty for an ordinary single dish.
CREATE TABLE IF NOT EXISTS tbldishcontents (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  dish_id INT UNSIGNED NOT NULL,
  name VARCHAR(120) NOT NULL,
  quantity VARCHAR(60) NULL,
  sort_order TINYINT UNSIGNED NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_dishcontents_dish (dish_id, sort_order),
  CONSTRAINT fk_dishcontents_dish FOREIGN KEY (dish_id)
    REFERENCES tbldishes (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
