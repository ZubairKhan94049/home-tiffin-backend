-- The carousel on the customer home screen. It used to be a hard-coded
-- "25% off" card; now an admin runs it — our own offers, or an ad for
-- another company — without shipping an app release.
CREATE TABLE IF NOT EXISTS tblbanners (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  -- All text is optional: an image-only banner is a valid ad.
  eyebrow VARCHAR(40) NULL,          -- small line above the title, e.g. "Sponsored"
  title VARCHAR(80) NULL,
  subtitle VARCHAR(140) NULL,
  cta_label VARCHAR(30) NULL,        -- button text; no button when empty
  -- What tapping the slide does.
  action_type ENUM('none', 'url', 'cook', 'dish', 'search', 'explore')
    NOT NULL DEFAULT 'none',
  action_value VARCHAR(500) NULL,    -- the URL, cook id, dish id or search term
  -- Either a photo, or a solid colour when there is none.
  image VARCHAR(255) NULL,
  background_color CHAR(7) NOT NULL DEFAULT '#C8762A',
  text_color CHAR(7) NOT NULL DEFAULT '#FFFFFF',
  -- Darkens a photo so text on it stays readable.
  image_overlay TINYINT(1) NOT NULL DEFAULT 1,
  sort_order INT NOT NULL DEFAULT 0,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  -- A campaign can be scheduled ahead and end on its own.
  starts_at DATETIME NULL,
  ends_at DATETIME NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_banners_live (is_active, sort_order)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- The card that was hard-coded, so the carousel is not empty on day one.
INSERT INTO tblbanners (eyebrow, title, subtitle, cta_label, action_type, sort_order)
SELECT 'Welcome offer', 'Your first home-cooked meal',
       'Order from a kitchen near you today', 'Explore', 'explore', 0
 WHERE NOT EXISTS (SELECT 1 FROM tblbanners);
