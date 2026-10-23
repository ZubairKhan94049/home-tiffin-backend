const pool = require("../config/db");
const TABLES = require("../config/tableNames");
const COLUMNS = require("../config/tableColumns/tblcookbankaccountsColumns");

// All accounts for a cook, default first then newest.
const listByCook = async (cookId) => {
  const [rows] = await pool.query(
    `SELECT * FROM ${TABLES.COOK_BANK_ACCOUNTS}
     WHERE ${COLUMNS.COOK_ID} = ?
     ORDER BY ${COLUMNS.IS_DEFAULT} DESC, ${COLUMNS.ID} DESC`,
    [cookId]
  );
  return rows;
};

const getById = async (id) => {
  const [rows] = await pool.query(
    `SELECT * FROM ${TABLES.COOK_BANK_ACCOUNTS} WHERE ${COLUMNS.ID} = ?`,
    [id]
  );
  return rows[0];
};

const countForCook = async (cookId) => {
  const [rows] = await pool.query(
    `SELECT COUNT(*) AS total FROM ${TABLES.COOK_BANK_ACCOUNTS} WHERE ${COLUMNS.COOK_ID} = ?`,
    [cookId]
  );
  return Number(rows[0]?.total || 0);
};

// Exactly one default per cook — clear the rest before setting this one.
const clearDefault = async (cookId) => {
  await pool.query(
    `UPDATE ${TABLES.COOK_BANK_ACCOUNTS} SET ${COLUMNS.IS_DEFAULT} = 0 WHERE ${COLUMNS.COOK_ID} = ?`,
    [cookId]
  );
};

const setDefault = async (cookId, id) => {
  await clearDefault(cookId);
  await pool.query(
    `UPDATE ${TABLES.COOK_BANK_ACCOUNTS} SET ${COLUMNS.IS_DEFAULT} = 1
     WHERE ${COLUMNS.ID} = ? AND ${COLUMNS.COOK_ID} = ?`,
    [id, cookId]
  );
};

const createAccount = async ({
  cook_id,
  bank_name,
  account_title,
  account_number,
  iban = null,
  branch = null,
  is_default = 0,
}) => {
  if (is_default) await clearDefault(cook_id);
  const [result] = await pool.query(
    `INSERT INTO ${TABLES.COOK_BANK_ACCOUNTS}
      (${COLUMNS.COOK_ID}, ${COLUMNS.BANK_NAME}, ${COLUMNS.ACCOUNT_TITLE},
       ${COLUMNS.ACCOUNT_NUMBER}, ${COLUMNS.IBAN}, ${COLUMNS.BRANCH}, ${COLUMNS.IS_DEFAULT})
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [cook_id, bank_name, account_title, account_number, iban, branch, is_default ? 1 : 0]
  );
  return result.insertId;
};

// Partial update; pass only the columns that change.
const updateAccount = async (id, cookId, accountData) => {
  const fields = [];
  const values = [];
  for (const [key, value] of Object.entries(accountData)) {
    fields.push(`${key} = ?`);
    values.push(value);
  }
  if (!fields.length) return null;

  values.push(id, cookId);
  const [result] = await pool.query(
    `UPDATE ${TABLES.COOK_BANK_ACCOUNTS} SET ${fields.join(", ")}
     WHERE ${COLUMNS.ID} = ? AND ${COLUMNS.COOK_ID} = ?`,
    values
  );
  return result;
};

const deleteAccount = async (id, cookId) => {
  const [result] = await pool.query(
    `DELETE FROM ${TABLES.COOK_BANK_ACCOUNTS} WHERE ${COLUMNS.ID} = ? AND ${COLUMNS.COOK_ID} = ?`,
    [id, cookId]
  );
  return result;
};

module.exports = {
  listByCook,
  getById,
  countForCook,
  clearDefault,
  setDefault,
  createAccount,
  updateAccount,
  deleteAccount,
};
