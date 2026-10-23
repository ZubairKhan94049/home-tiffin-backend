const pool = require("../config/db");
const TABLES = require("../config/tableNames");
const COLUMNS = require("../config/tableColumns/tblusersColumns");

// Create a new user
const createUser = async (userData) => {
  const {
    [COLUMNS.NAME]: name,
    [COLUMNS.EMAIL]: email = null,
    // Either may be absent now: an email-only sign-up has no phone, and a
    // social account has no password.
    [COLUMNS.PHONE]: phone = null,
    [COLUMNS.PASSWORD]: password = null,
    [COLUMNS.ROLE]: role = "customer",
    [COLUMNS.STATUS]: status = "active",
    [COLUMNS.AUTH_PROVIDER]: authProvider = "password",
    [COLUMNS.PROVIDER_USER_ID]: providerUserId = null,
  } = userData;

  const [result] = await pool.query(
    `INSERT INTO ${TABLES.USERS}
      (${COLUMNS.NAME}, ${COLUMNS.EMAIL}, ${COLUMNS.PHONE}, ${COLUMNS.PASSWORD},
       ${COLUMNS.ROLE}, ${COLUMNS.STATUS}, ${COLUMNS.AUTH_PROVIDER},
       ${COLUMNS.PROVIDER_USER_ID})
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [name, email, phone || null, password, role, status, authProvider, providerUserId]
  );

  return result.insertId;
};

// The same person signing in again through Google, Apple or Facebook.
const findUserByProvider = async (provider, providerUserId) => {
  if (!provider || !providerUserId) return undefined;
  const [rows] = await pool.query(
    `SELECT * FROM ${TABLES.USERS}
      WHERE ${COLUMNS.AUTH_PROVIDER} = ? AND ${COLUMNS.PROVIDER_USER_ID} = ?
      LIMIT 1`,
    [provider, providerUserId]
  );
  return rows[0];
};

// Get a single user by ID
const getUserById = async (id) => {
  const [rows] = await pool.query(
    `SELECT * FROM ${TABLES.USERS} WHERE ${COLUMNS.ID} = ?`,
    [id]
  );
  return rows[0];
};

// Find a user by phone or email (login identifier)
const findUserByPhoneOrEmail = async (phone, email) => {
  let query = `SELECT * FROM ${TABLES.USERS} WHERE `;
  const params = [];

  if (phone && email) {
    query += `${COLUMNS.PHONE} = ? OR ${COLUMNS.EMAIL} = ? LIMIT 1`;
    params.push(phone, email);
  } else if (phone) {
    query += `${COLUMNS.PHONE} = ? OR ${COLUMNS.EMAIL} = ? LIMIT 1`;
    params.push(phone, phone);
  } else if (email) {
    query += `${COLUMNS.EMAIL} = ? LIMIT 1`;
    params.push(email);
  } else {
    return null; // Neither provided
  }

  const [rows] = await pool.query(query, params);
  return rows[0];
};

// Update user (partial)
const updateUser = async (id, userData) => {
  const fields = [];
  const values = [];

  const columnMap = {
    name: COLUMNS.NAME,
    email: COLUMNS.EMAIL,
    phone: COLUMNS.PHONE,
    password: COLUMNS.PASSWORD,
    role: COLUMNS.ROLE,
    status: COLUMNS.STATUS,
    profile_image: COLUMNS.PROFILE_IMAGE,
  };

  for (const [key, value] of Object.entries(userData)) {
    const columnName = columnMap[key] || key;
    fields.push(`${columnName} = ?`);
    values.push(value);
  }

  values.push(id);

  const query = `
    UPDATE ${TABLES.USERS}
    SET ${fields.join(", ")}
    WHERE ${COLUMNS.ID} = ?
  `;

  const [result] = await pool.query(query, values);
  return result;
};

// Set user status (pending | active | blocked)
const setUserStatus = async (id, status) => {
  const [result] = await pool.query(
    `UPDATE ${TABLES.USERS} SET ${COLUMNS.STATUS} = ? WHERE ${COLUMNS.ID} = ?`,
    [status, id]
  );
  return result;
};

// List users by role with optional status filter and search
const listUsersByRole = async (role, { status, search } = {}) => {
  let query = `SELECT ${COLUMNS.ID}, ${COLUMNS.NAME}, ${COLUMNS.EMAIL}, ${COLUMNS.PHONE}, ${COLUMNS.ROLE}, ${COLUMNS.STATUS}, ${COLUMNS.PROFILE_IMAGE}, ${COLUMNS.CREATED_AT}
    FROM ${TABLES.USERS} WHERE ${COLUMNS.ROLE} = ?`;
  const params = [role];

  if (status) {
    query += ` AND ${COLUMNS.STATUS} = ?`;
    params.push(status);
  }
  if (search) {
    query += ` AND (${COLUMNS.NAME} LIKE ? OR ${COLUMNS.PHONE} LIKE ? OR ${COLUMNS.EMAIL} LIKE ?)`;
    params.push(`%${search}%`, `%${search}%`, `%${search}%`);
  }

  query += ` ORDER BY ${COLUMNS.CREATED_AT} DESC`;

  const [rows] = await pool.query(query, params);
  return rows;
};

module.exports = {
  createUser,
  getUserById,
  findUserByPhoneOrEmail,
  findUserByProvider,
  updateUser,
  setUserStatus,
  listUsersByRole,
};
