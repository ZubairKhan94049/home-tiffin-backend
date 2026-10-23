const userModel = require("../models/userModel");
const cookProfileModel = require("../models/cookProfileModel");
const riderProfileModel = require("../models/riderProfileModel");
const authHelper = require("../helpers/authHelper");
const socialAuthHelper = require("../helpers/socialAuthHelper");
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
/// Customers sign up with one field that takes either a phone number or an
/// email address, so `identifier` is split into whichever it is. Cooks and
/// riders still send `phone` and `email` separately.
const splitIdentifier = (body) => {
  const identifier = `${body.identifier ?? ""}`.trim();
  if (!identifier) return { phone: body.phone, email: body.email };
  return identifier.includes("@")
    ? { phone: body.phone ?? null, email: identifier }
    : { phone: identifier, email: body.email ?? null };
};

const register = async (req, res) => {
  try {
    const { phone, email } = splitIdentifier(req.body);
    const {
      name,
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

    // A customer may have signed up with an email instead, so one of the two
    // is enough — but never neither, or there is no way to sign back in.
    if (!name || !password || (!phone && !email)) {
      return res.status(400).json({
        success: false,
        message: "Name, password and a phone number or email are required",
      });
    }

    const allowedRoles = ["customer", "cook", "rider"];
    const userRole = role || "customer";
    if (!allowedRoles.includes(userRole)) {
      return res
        .status(400)
        .json({ success: false, message: "Role must be customer, cook or rider" });
    }

    // Cooks register with just their account details; the onboarding wizard
    // collects the business name, city and area at step 2. Admin-created
    // cooks still pass them, and they are saved when present.
    const isAdminCreated = Boolean(req.user && req.user.role === "admin");
    if (userRole === "cook" && isAdminCreated &&
        (!kitchen_name || !city || !area)) {
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
        kitchen_name: kitchen_name || null,
        city: city || null,
        area: area || null,
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

// ---------------------- SOCIAL SIGN-IN ----------------------
//
// One endpoint for Google, Apple and Facebook. The app hands over the token
// it got from the provider and the server asks that provider who it belongs
// to — a client can claim any email it likes, so nothing it sends is trusted.
//
// Only customers sign in this way: cooks and riders are vetted accounts that
// the admin approves, and a social button would let anyone create one.
const socialSignIn = async (req, res) => {
  try {
    const provider = `${req.body.provider ?? ""}`.trim().toLowerCase();
    const token = req.body.token ?? req.body.id_token ?? req.body.access_token;

    const identity = await socialAuthHelper.verifySocialToken(
      provider,
      token,
      `${req.body.name ?? ""}`.trim() || null
    );

    // Same person signing in again.
    let user = await userModel.findUserByProvider(
      provider,
      identity.provider_user_id
    );

    // Or someone who already has an account under this email — link the two
    // rather than creating a second account they cannot reach.
    if (!user && identity.email) {
      user = await userModel.findUserByPhoneOrEmail(null, identity.email);
      if (user) {
        await userModel.updateUser(user[COLUMNS.ID], {
          [COLUMNS.AUTH_PROVIDER]: provider,
          [COLUMNS.PROVIDER_USER_ID]: identity.provider_user_id,
        });
        user = await userModel.getUserById(user[COLUMNS.ID]);
      }
    }

    let isNew = false;
    if (!user) {
      if (!identity.email) {
        return res.status(400).json({
          success: false,
          message:
            "That account has no email address we can use. Sign up with your phone number instead.",
        });
      }
      const userId = await userModel.createUser({
        [COLUMNS.NAME]: identity.name || identity.email.split("@")[0],
        [COLUMNS.EMAIL]: identity.email,
        // Social accounts have no phone until the customer adds one, and no
        // password at all — they sign in through the provider every time.
        [COLUMNS.PHONE]: null,
        [COLUMNS.PASSWORD]: null,
        [COLUMNS.ROLE]: "customer",
        [COLUMNS.STATUS]: "active",
        [COLUMNS.AUTH_PROVIDER]: provider,
        [COLUMNS.PROVIDER_USER_ID]: identity.provider_user_id,
      });
      user = await userModel.getUserById(userId);
      isNew = true;
    }

    if (user[COLUMNS.STATUS] === "blocked") {
      return res.status(403).json({
        success: false,
        message: "Your account has been blocked. Please contact support.",
      });
    }

    res.status(isNew ? 201 : 200).json({
      success: true,
      data: await withProfile(user),
      token: authHelper.generateToken(user),
      is_new: isNew,
    });
  } catch (error) {
    if (error instanceof socialAuthHelper.SocialAuthError) {
      return res
        .status(error.status)
        .json({ success: false, message: error.message });
    }
    console.error("Error with social sign-in:", error);
    res.status(500).json({
      success: false,
      message: error?.sqlMessage || error?.message || "Internal server error",
    });
  }
};

/// Which buttons the app should show — a provider without server credentials
/// would only fail when tapped.
const getAuthProviders = async (req, res) => {
  res.status(200).json({
    success: true,
    data: { providers: socialAuthHelper.availableProviders() },
  });
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

module.exports = {
  register,
  login,
  socialSignIn,
  getAuthProviders,
  me,
  logout,
  uploadDocuments,
};
