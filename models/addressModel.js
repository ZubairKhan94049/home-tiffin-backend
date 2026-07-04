const pool = require("../config/db");
const TABLES = require("../config/tableNames");
const COLUMNS = require("../config/tableColumns/tbladdressesColumns");

// List addresses of a user (default first)
const listByUser = async (userId) => {
  const [rows] = await pool.query(
    `SELECT * FROM ${TABLES.ADDRESSES}
     WHERE ${COLUMNS.USER_ID} = ?
     ORDER BY ${COLUMNS.IS_DEFAULT} DESC, ${COLUMNS.CREATED_AT} DESC`,
    [userId]
  );
  return rows;
};

// Get a single address by id
const getById = async (id) => {
  const [rows] = await pool.query(
    `SELECT * FROM ${TABLES.ADDRESSES} WHERE ${COLUMNS.ID} = ?`,
    [id]
  );
  return rows[0];
};

// Create an address
const createAddress = async (addressData) => {
  const {
    user_id,
    type = "home",
    label = null,
    full_name,
    phone,
    address,
    area,
    city,
    latitude = null,
    longitude = null,
    delivery_instructions = null,
    is_default = 0,
  } = addressData;

  const [result] = await pool.query(
    `INSERT INTO ${TABLES.ADDRESSES}
      (${COLUMNS.USER_ID}, ${COLUMNS.TYPE}, ${COLUMNS.LABEL}, ${COLUMNS.FULL_NAME}, ${COLUMNS.PHONE},
       ${COLUMNS.ADDRESS}, ${COLUMNS.AREA}, ${COLUMNS.CITY}, ${COLUMNS.LATITUDE}, ${COLUMNS.LONGITUDE},
       ${COLUMNS.DELIVERY_INSTRUCTIONS}, ${COLUMNS.IS_DEFAULT})
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      user_id,
      type,
      label,
      full_name,
      phone,
      address,
      area,
      city,
      latitude,
      longitude,
      delivery_instructions,
      is_default ? 1 : 0,
    ]
  );
  return result.insertId;
};

// Update an address (partial)
const updateAddress = async (id, addressData) => {
  const fields = [];
  const values = [];

  for (const [key, value] of Object.entries(addressData)) {
    fields.push(`${key} = ?`);
    values.push(value);
  }

  values.push(id);

  const [result] = await pool.query(
    `UPDATE ${TABLES.ADDRESSES} SET ${fields.join(", ")} WHERE ${COLUMNS.ID} = ?`,
    values
  );
  return result;
};

// Delete an address
const deleteAddress = async (id) => {
  const [result] = await pool.query(
    `DELETE FROM ${TABLES.ADDRESSES} WHERE ${COLUMNS.ID} = ?`,
    [id]
  );
  return result;
};

// Unset all defaults of a user
const unsetDefaults = async (userId) => {
  const [result] = await pool.query(
    `UPDATE ${TABLES.ADDRESSES} SET ${COLUMNS.IS_DEFAULT} = 0 WHERE ${COLUMNS.USER_ID} = ?`,
    [userId]
  );
  return result;
};

// Set a single address as default
const setDefault = async (id) => {
  const [result] = await pool.query(
    `UPDATE ${TABLES.ADDRESSES} SET ${COLUMNS.IS_DEFAULT} = 1 WHERE ${COLUMNS.ID} = ?`,
    [id]
  );
  return result;
};

module.exports = {
  listByUser,
  getById,
  createAddress,
  updateAddress,
  deleteAddress,
  unsetDefaults,
  setDefault,
};
