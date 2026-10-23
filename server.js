// npm i dependency name
const express = require("express");
const colors = require("colors");
const morgan = require("morgan");
const dotenv = require("dotenv");

const cors = require("cors");
const pool = require("./config/db");

dotenv.config();
const app = express();
const port = process.env.PORT || 8080;

const allowedOrigins = process.env.FRONTEND_URL
  ? process.env.FRONTEND_URL.split(",").map((o) => o.trim())
  : ["*"];

// Any localhost/127.0.0.1 origin is allowed in addition to FRONTEND_URL
// entries, so the Flutter web admin panel works on its random dev port.
const isLocalhostOrigin = (origin) =>
  /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin);

app.use(
  cors({
    origin: (origin, callback) => {
      if (
        !origin ||
        allowedOrigins.includes("*") ||
        allowedOrigins.includes(origin) ||
        isLocalhostOrigin(origin)
      ) {
        return callback(null, true);
      }
      return callback(new Error("Not allowed by CORS"));
    },
    credentials: true,
  }),
);

app.use(express.json());
app.use(morgan("dev"));

const path = require("path");
const fs = require("fs");
const uploadsDir = process.env.STORAGE_ROOT || path.join(__dirname, "uploads");
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}
app.use("/uploads", express.static(uploadsDir));

app.get("/", (req, res) => {
  res.json({ status: "ok", message: "Home Tiffin API is running" });
});
app.get("/health", (req, res) => {
  res.json({ status: "healthy", timestamp: new Date().toISOString() });
});

//Routes
app.use("/api/v1", require("./routes/publicRoutes"));
app.use("/api/v1/auth", require("./routes/authRoutes"));
app.use("/api/v1/cooks", require("./routes/cooksRoutes"));
app.use("/api/v1/dishes", require("./routes/dishRoutes"));
app.use("/api/v1/banners", require("./routes/bannerRoutes"));
app.use("/api/v1/addresses", require("./routes/addressRoutes"));
app.use("/api/v1/orders", require("./routes/orderRoutes"));
app.use("/api/v1/cook", require("./routes/cookRoutes"));
app.use("/api/v1/rider", require("./routes/riderRoutes"));
app.use("/api/v1/admin", require("./routes/adminRoutes"));
app.use("/api/v1/notifications", require("./routes/notificationRoutes"));

// Central error handler (multer / upload errors -> JSON envelope)
app.use((err, req, res, next) => {
  console.error("Unhandled error:", err.message);
  const isUploadError =
    err.name === "MulterError" ||
    (err.message && err.message.startsWith("Invalid file type"));
  const status = isUploadError ? 400 : err.status || 500;
  res.status(status).json({
    success: false,
    message: err?.sqlMessage || err?.message || "Internal server error",
  });
});

app.listen(port, () => {
  console.log(`Server is running on port ${port}`.bgMagenta.white);
});

pool
  .query("SELECT 1")
  .then(() => {
    console.log("MySQL connected successfully".bgGreen.white);
  })
  .catch((err) => {
    console.error("Unable to connect to the database:", err.message);
  });
