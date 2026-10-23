-- Admins choose which part of a large photo the banner shows. The cropped
-- image is what customers download (`image`); the full upload and where the
-- frame sat are kept so the crop can be moved later without re-uploading.
ALTER TABLE tblbanners
  ADD COLUMN image_original VARCHAR(255) NULL AFTER image,
  -- { x, y, width, height } as fractions of the original, 0..1.
  ADD COLUMN image_crop JSON NULL AFTER image_original;
