const userModel = require("../models/userModel");
const cookProfileModel = require("../models/cookProfileModel");
const riderProfileModel = require("../models/riderProfileModel");
const authHelper = require("../helpers/authHelper");
const COLUMNS = require("../config/tableColumns/tblusersColumns");

// Remove sensitive fields before sending a user out
const sanitizeUser = (user) => {
  if (!user) return user;
  const clean = { ...user };
  delete clean[COLUMNS.PASSWORD];
  return clean;
};

// Attach role profile (cook/rider) to a user object
const withProfile = async (user) => {
  const clean = sanitizeUser(user);
  if (!clean) return clean;
  if (clean[COLUMNS.ROLE] === "cook") {
    clean.profile = (await cookProfileModel.getByUserId(clean[COLUMNS.ID])) || null;
  } else if (clean[COLUMNS.ROLE] === "rider") {
    clean.profile = (await riderProfileModel.getByUserId(clean[COLUMNS.ID])) || null;
  }
  return clean;
};

// ---------------------- REGISTER ----------------------
const register = async (req, res) => {
  try {
    const {
      name,
      phone,
      email,
      password,
      role,
      // cook profile fields
      kitchen_name,
      city,
      area,
      bio,
      // rider profile fields
      vehicle_type,
      vehicle_brand,
      vehicle_model,
      license_plate,
      cnic_number,
    } = req.body;

    if (!name || !phone || !password) {
      return res
        .status(400)
        .json({ success: false, message: "Name, phone and password are required" });
    }

    const allowedRoles = ["customer", "cook", "rider"];
    const userRole = role || "customer";
    if (!allowedRoles.includes(userRole)) {
      return res
        .status(400)
        .json({ success: false, message: "Role must be customer, cook or rider" });
    }

    if (userRole === "cook" && (!kitchen_name || !city || !area)) {
      return res.status(400).json({
        success: false,
        message: "Kitchen name, city and area are required for cook registration",
      });
    }

    if (userRole === "rider" && (!city || !vehicle_type || !license_plate || !cnic_number)) {
      return res.status(400).json({
        success: false,
        message:
          "City, vehicle type, license plate and CNIC number are required for rider registration",
      });
    }

    // Check if user already exists
    const existingUser = await userModel.findUserByPhoneOrEmail(phone, email);
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: "A user with this phone or email already exists",
      });
    }

    // Hash password using bcrypt
    const hashedPassword = await authHelper.hashPassword(password);

    // Customers are active immediately; cooks/riders await admin approval
    const status = userRole === "customer" ? "active" : "pending";

    const userId = await userModel.createUser({
      name,
      email: email || null,
      phone,
      password: hashedPassword,
      role: userRole,
      status,
    });

    // Create role profile row
    if (userRole === "cook") {
      await cookProfileModel.createProfile({
        user_id: userId,
        kitchen_name,
        city,
        area,
        bio: bio || null,
      });
    } else if (userRole === "rider") {
      await riderProfileModel.createProfile({
        user_id: userId,
        city,
        vehicle_type,
        vehicle_brand: vehicle_brand || null,
        vehicle_model: vehicle_model || null,
        license_plate,
        cnic_number,
      });
    }

    const user = await withProfile(await userModel.getUserById(userId));
    const token = authHelper.generateToken(user);

    res.status(201).json({
      success: true,
      message:
        status === "pending"
          ? "Registration submitted. Your account is awaiting admin approval."
          : "Registration successful",
      data: user,
      token,
    });
  } catch (error) {
    console.error("Error registering user:", error);
    if (error.code === "ER_DUP_ENTRY") {
      return res.status(400).json({
        success: false,
        message: "Phone or email already exists",
      });
    }
    res.status(500).json({
      success: false,
      message: error?.sqlMessage || error?.message || "Internal server error",
    });
  }
};

// ---------------------- LOGIN ----------------------
const login = async (req, res) => {
  try {
    const { phone, email, password } = req.body;

    if ((!phone && !email) || !password) {
      return res
        .status(400)
        .json({ success: false, message: "Phone (or email) and password are required" });
    }

    const user = await userModel.findUserByPhoneOrEmail(phone, email);
    if (!user) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid credentials" });
    }

    const isMatch = await authHelper.comparePassword(
      password,
      user[COLUMNS.PASSWORD]
    );
    if (!isMatch) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid credentials" });
    }

    // Blocked users cannot log in; pending cooks/riders can (apps show pending state)
    if (user[COLUMNS.STATUS] === "blocked") {
      return res.status(403).json({
        success: false,
        message: "Your account has been blocked. Please contact support.",
      });
    }

    const userWithProfile = await withProfile(user);
    const token = authHelper.generateToken(user);

    res.status(200).json({ success: true, data: userWithProfile, token });
  } catch (error) {
    console.error("Error logging in user:", error);
    res.status(500).json({
      success: false,
      message: error?.sqlMessage || error?.message || "Internal server error",
    });
  }
};

// ---------------------- ME ----------------------
const me = async (req, res) => {
  try {
    const user = await userModel.getUserById(req.user.id);
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }
    res.status(200).json({ success: true, data: await withProfile(user) });
  } catch (error) {
    console.error("Error fetching current user:", error);
    res.status(500).json({
      success: false,
      message: error?.sqlMessage || error?.message || "Internal server error",
    });
  }
};

// ---------------------- LOGOUT ----------------------
const logout = async (req, res) => {
  try {
    // Stateless JWT - client discards the token
    res.status(200).json({ success: true, message: "Logged out successfully" });
  } catch (error) {
    console.error("Error logging out user:", error);
    res.status(500).json({
      success: false,
      message: error?.sqlMessage || error?.message || "Internal server error",
    });
  }
};

// ---------------------- DOCUMENT UPLOAD (cook / rider) ----------------------
const uploadDocuments = async (req, res) => {
  try {
    const user = await userModel.getUserById(req.user.id);
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    const files = req.files || {};
    const filePath = (file) => `/uploads/${file.filename}`;

    if (user[COLUMNS.ROLE] === "cook") {
      const profileData = {};
      if (files.cnic_front) profileData.cnic_front = filePath(files.cnic_front[0]);
      if (files.cnic_back) profileData.cnic_back = filePath(files.cnic_back[0]);
      if (files.kitchen_photos) {
        profileData.kitchen_photos = JSON.stringify(
          files.kitchen_photos.map(filePath)
        );
      }

      if (Object.keys(profileData).length === 0) {
        return res
          .status(400)
          .json({ success: false, message: "No documents uploaded" });
      }

      await cookProfileModel.updateByUserId(user[COLUMNS.ID], profileData);
    } else if (user[COLUMNS.ROLE] === "rider") {
      const profileData = {};
      if (files.cnic_front) profileData.cnic_front = filePath(files.cnic_front[0]);
      if (files.cnic_back) profileData.cnic_back = filePath(files.cnic_back[0]);
      if (files.license_photo) profileData.license_photo = filePath(files.license_photo[0]);
      if (files.vehicle_photo) profileData.vehicle_photo = filePath(files.vehicle_photo[0]);

      if (Object.keys(profileData).length === 0) {
        return res
          .status(400)
          .json({ success: false, message: "No documents uploaded" });
      }

      await riderProfileModel.updateByUserId(user[COLUMNS.ID], profileData);
    } else {
      return res.status(400).json({
        success: false,
        message: "Document upload is only for cook or rider accounts",
      });
    }

    const updated = await withProfile(await userModel.getUserById(user[COLUMNS.ID]));
    res.status(200).json({ success: true, data: updated });
  } catch (error) {
    console.error("Error uploading documents:", error);
    res.status(500).json({
      success: false,
      message: error?.sqlMessage || error?.message || "Internal server error",
    });
  }
};

module.exports = { register, login, me, logout, uploadDocuments };
