const multer = require("multer");
const path = require("path");
const fs = require("fs");

const storageRoot =
  process.env.STORAGE_ROOT || path.join(__dirname, "../uploads");
if (!fs.existsSync(storageRoot)) {
  fs.mkdirSync(storageRoot, { recursive: true });
}

// Configure storage
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, storageRoot);
  },
  filename: (req, file, cb) => {
    // Generate unique filename: fieldname_userid_timestamp-random_originalname
    const userId = (req.user && req.user.id) || "temp";
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    const sanitizedFilename = file.originalname.replace(/\s+/g, "_");
    const uniqueFilename = `${file.fieldname}_${userId}_${uniqueSuffix}_${sanitizedFilename}`;
    cb(null, uniqueFilename);
  },
});

// File filter - accept images only
const fileFilter = (req, file, cb) => {
  const allowedTypes = /jpeg|jpg|png|gif|webp/;
  const extname = allowedTypes.test(
    path.extname(file.originalname).toLowerCase()
  );
  const mimetype = allowedTypes.test(file.mimetype);

  if (mimetype && extname) {
    return cb(null, true);
  } else {
    cb(
      new Error(
        "Invalid file type. Only JPEG, PNG, GIF and WEBP images are allowed."
      )
    );
  }
};

// Multer configuration
const upload = multer({
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB max file size
  },
  fileFilter: fileFilter,
});

module.exports = upload;
