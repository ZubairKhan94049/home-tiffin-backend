const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

// Hash a password
const hashPassword = async (password) => {
  const salt = await bcrypt.genSalt(10);
  return await bcrypt.hash(password, salt);
};

// Compare raw password with hashed
const comparePassword = async (password, hashedPassword) => {
  return await bcrypt.compare(password, hashedPassword);
};

// Generate JWT Token
const generateToken = (user) => {
  return jwt.sign(
    { id: user.id, name: user.name, phone: user.phone, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: "7d" }
  );
};

module.exports = { hashPassword, comparePassword, generateToken };
