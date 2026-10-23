-- The categories cooks file items under become something the admin runs and
-- customers browse. Each gets an icon — an emoji, or an uploaded image that
-- wins when both are set — and the admin picks which ones are the "main"
-- categories on the customer home screen.
ALTER TABLE tbldishcategories
  ADD COLUMN emoji VARCHAR(16) NULL AFTER description,
  ADD COLUMN image VARCHAR(255) NULL AFTER emoji,
  ADD COLUMN show_on_home TINYINT(1) NOT NULL DEFAULT 0 AFTER is_active;

UPDATE tbldishcategories SET emoji = CASE name
  WHEN 'Biryani & Pulao' THEN '🍛'
  WHEN 'Curries & Salan' THEN '🍲'
  WHEN 'BBQ & Grill' THEN '🍢'
  WHEN 'Karahi & Handi' THEN '🥘'
  WHEN 'Daal & Sabzi' THEN '🥗'
  WHEN 'Breakfast & Nashta' THEN '🍳'
  WHEN 'Roti & Naan' THEN '🫓'
  WHEN 'Chinese' THEN '🥡'
  WHEN 'Fast Food' THEN '🍔'
  WHEN 'Soups & Starters' THEN '🥣'
  WHEN 'Salads & Raita' THEN '🥒'
  WHEN 'Desserts & Sweets' THEN '🍮'
  WHEN 'Beverages' THEN '🥤'
  WHEN 'Tiffin & Meal Deals' THEN '🍱'
  WHEN 'Healthy & Diet' THEN '🥦'
  ELSE emoji END
WHERE emoji IS NULL;

-- A sensible first set for the home row, which the admin can change.
UPDATE tbldishcategories SET show_on_home = 1
 WHERE name IN ('Biryani & Pulao', 'Curries & Salan', 'BBQ & Grill',
                'Karahi & Handi', 'Breakfast & Nashta', 'Chinese',
                'Fast Food', 'Desserts & Sweets');
