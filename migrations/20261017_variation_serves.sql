-- A variation can say how many it feeds. Small and Large differ in serving
-- size far more often than they differ in anything else, so the item-level
-- `serves` becomes the default and a variation may override it.
ALTER TABLE tbldishvariations
  ADD COLUMN serves VARCHAR(40) NULL AFTER price;
