-- A customer's favourite dishes, so the Favourites screen has something to
-- show and the heart on a dish card remembers being tapped.
CREATE TABLE IF NOT EXISTS tblfavourites (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  customer_id INT UNSIGNED NOT NULL,
  dish_id INT UNSIGNED NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  -- Tapping the heart twice must not leave two rows.
  UNIQUE KEY uq_favourites_customer_dish (customer_id, dish_id),
  KEY idx_favourites_dish (dish_id),
  CONSTRAINT fk_favourites_customer FOREIGN KEY (customer_id)
    REFERENCES tblusers (id) ON DELETE CASCADE,
  -- A deleted dish takes its hearts with it, rather than leaving a blank row.
  CONSTRAINT fk_favourites_dish FOREIGN KEY (dish_id)
    REFERENCES tbldishes (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
