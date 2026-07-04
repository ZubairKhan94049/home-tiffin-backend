const pool = require("../config/db");
const TABLES = require("../config/tableNames");
const COLUMNS = require("../config/tableColumns/tblriderprofilesColumns");
const USERS = require("../config/tableColumns/tblusersColumns");

// Create a rider profile (at registration)
const createProfile = async ({
  user_id,
  city,
  vehicle_type,
  vehicle_brand = null,
  vehicle_model = null,
  license_plate,
  cnic_number,
}) => {
  const [result] = await pool.query(
    `INSERT INTO ${TABLES.RIDER_PROFILES}
      (${COLUMNS.USER_ID}, ${COLUMNS.CITY}, ${COLUMNS.VEHICLE_TYPE}, ${COLUMNS.VEHICLE_BRAND}, ${COLUMNS.VEHICLE_MODEL}, ${COLUMNS.LICENSE_PLATE}, ${COLUMNS.CNIC_NUMBER})
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [user_id, city, vehicle_type, vehicle_brand, vehicle_model, license_plate, cnic_number]
  );
  return result.insertId;
};

// Get a rider profile by user id
const getByUserId = async (userId) => {
  const [rows] = await pool.query(
    `SELECT * FROM ${TABLES.RIDER_PROFILES} WHERE ${COLUMNS.USER_ID} = ?`,
    [userId]
  );
  return rows[0];
};

// Update a rider profile by user id (partial)
const updateByUserId = async (userId, profileData) => {
  const fields = [];
  const values = [];

  for (const [key, value] of Object.entries(profileData)) {
    fields.push(`${key} = ?`);
    values.push(value);
  }

  values.push(userId);

  const [result] = await pool.query(
    `UPDATE ${TABLES.RIDER_PROFILES} SET ${fields.join(", ")} WHERE ${COLUMNS.USER_ID} = ?`,
    values
  );
  return result;
};

// Add COD amount to rider cash in hand
const incrementCashInHand = async (userId, amount) => {
  const [result] = await pool.query(
    `UPDATE ${TABLES.RIDER_PROFILES}
     SET ${COLUMNS.CASH_IN_HAND} = ${COLUMNS.CASH_IN_HAND} + ?
     WHERE ${COLUMNS.USER_ID} = ?`,
    [amount, userId]
  );
  return result;
};

// Reset rider cash in hand to zero (after deposit)
const resetCashInHand = async (userId) => {
  const [result] = await pool.query(
    `UPDATE ${TABLES.RIDER_PROFILES} SET ${COLUMNS.CASH_IN_HAND} = 0 WHERE ${COLUMNS.USER_ID} = ?`,
    [userId]
  );
  return result;
};

// Admin list of riders (any status) with profile
const listRidersForAdmin = async ({ status, search } = {}) => {
  let query = `
    SELECT u.${USERS.ID}, u.${USERS.NAME}, u.${USERS.EMAIL}, u.${USERS.PHONE}, u.${USERS.STATUS}, u.${USERS.CREATED_AT},
           rp.${COLUMNS.CITY}, rp.${COLUMNS.VEHICLE_TYPE}, rp.${COLUMNS.LICENSE_PLATE},
           rp.${COLUMNS.IS_ONLINE}, rp.${COLUMNS.CASH_IN_HAND},
           rp.${COLUMNS.REJECTION_REASON}, rp.${COLUMNS.APPROVED_AT}
    FROM ${TABLES.USERS} u
    JOIN ${TABLES.RIDER_PROFILES} rp ON rp.${COLUMNS.USER_ID} = u.${USERS.ID}
    WHERE u.${USERS.ROLE} = 'rider'`;
  const params = [];

  if (status) {
    query += ` AND u.${USERS.STATUS} = ?`;
    params.push(status);
  }
  if (search) {
    query += ` AND (u.${USERS.NAME} LIKE ? OR u.${USERS.PHONE} LIKE ? OR rp.${COLUMNS.LICENSE_PLATE} LIKE ?)`;
    params.push(`%${search}%`, `%${search}%`, `%${search}%`);
  }

  query += ` ORDER BY u.${USERS.CREATED_AT} DESC`;

  const [rows] = await pool.query(query, params);
  return rows;
};

module.exports = {
  createProfile,
  getByUserId,
  updateByUserId,
  incrementCashInHand,
  resetCashInHand,
  listRidersForAdmin,
};
