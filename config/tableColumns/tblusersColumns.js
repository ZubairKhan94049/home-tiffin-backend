const USERS = {
  ID: "id", // Unique identifier for each user
  NAME: "name", // User's full name
  EMAIL: "email", // User's email address (optional, unique)
  PHONE: "phone", // User's phone number (unique, used for login)
  PASSWORD: "password", // Bcrypt hashed password
  ROLE: "role", // customer | cook | rider | admin
  STATUS: "status", // pending | active | blocked
  PROFILE_IMAGE: "profile_image", // Path to profile image
  CREATED_AT: "created_at", // Record creation timestamp
  UPDATED_AT: "updated_at", // Record update timestamp
};

module.exports = USERS;
