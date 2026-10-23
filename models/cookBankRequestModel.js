const pool = require("../config/db");
const TABLES = require("../config/tableNames");
const COLUMNS = require("../config/tableColumns/tblcookbankrequestsColumns");
const USERS = require("../config/tableColumns/tblusersColumns");
const ACCOUNTS = require("../config/tableColumns/tblcookbankaccountsColumns");
const COOK_PROFILES = require("../config/tableColumns/tblcookprofilesColumns");

// A cook's own requests, newest first.
const listByCook = async (cookId) => {
  const [rows] = await pool.query(
    `SELECT * FROM ${TABLES.COOK_BANK_REQUESTS}
      WHERE ${COLUMNS.COOK_ID} = ?
      ORDER BY ${COLUMNS.CREATED_AT} DESC`,
    [cookId]
  );
  return rows;
};

// Only one request may be open at a time, so the cook cannot queue up
// conflicting changes to the same account.
const pendingForCook = async (cookId) => {
  const [rows] = await pool.query(
    `SELECT * FROM ${TABLES.COOK_BANK_REQUESTS}
      WHERE ${COLUMNS.COOK_ID} = ? AND ${COLUMNS.STATUS} = 'pending'
      LIMIT 1`,
    [cookId]
  );
  return rows[0];
};

const getById = async (id) => {
  const [rows] = await pool.query(
    `SELECT * FROM ${TABLES.COOK_BANK_REQUESTS} WHERE ${COLUMNS.ID} = ?`,
    [id]
  );
  return rows[0];
};

// Admin queue, with the cook and the account the request is about.
const listForAdmin = async (status) => {
  const params = [];
  let where = "";
  if (status) {
    where = `WHERE r.${COLUMNS.STATUS} = ?`;
    params.push(status);
  }
  const [rows] = await pool.query(
    `SELECT r.*, u.${USERS.NAME} AS cook_name, u.${USERS.PHONE} AS cook_phone,
            cp.${COOK_PROFILES.KITCHEN_NAME} AS kitchen_name,
            a.${ACCOUNTS.BANK_NAME} AS current_bank_name,
            a.${ACCOUNTS.ACCOUNT_TITLE} AS current_account_title,
            a.${ACCOUNTS.ACCOUNT_NUMBER} AS current_account_number,
            a.${ACCOUNTS.IBAN} AS current_iban
       FROM ${TABLES.COOK_BANK_REQUESTS} r
       JOIN ${TABLES.USERS} u ON u.${USERS.ID} = r.${COLUMNS.COOK_ID}
       LEFT JOIN ${TABLES.COOK_PROFILES} cp
              ON cp.${COOK_PROFILES.USER_ID} = r.${COLUMNS.COOK_ID}
       LEFT JOIN ${TABLES.COOK_BANK_ACCOUNTS} a
              ON a.${ACCOUNTS.ID} = r.${COLUMNS.ACCOUNT_ID}
       ${where}
      ORDER BY r.${COLUMNS.STATUS} = 'pending' DESC, r.${COLUMNS.CREATED_AT} DESC`,
    params
  );
  return rows;
};

const createRequest = async (data) => {
  const fields = Object.keys(data);
  const [result] = await pool.query(
    `INSERT INTO ${TABLES.COOK_BANK_REQUESTS} (${fields.join(", ")})
     VALUES (${fields.map(() => "?").join(", ")})`,
    fields.map((field) => data[field])
  );
  return result.insertId;
};

const updateRequest = async (id, data) => {
  const fields = Object.keys(data);
  if (!fields.length) return null;
  const [result] = await pool.query(
    `UPDATE ${TABLES.COOK_BANK_REQUESTS}
        SET ${fields.map((field) => `${field} = ?`).join(", ")}
      WHERE ${COLUMNS.ID} = ?`,
    [...fields.map((field) => data[field]), id]
  );
  return result;
};

const deleteRequest = async (id, cookId) => {
  const [result] = await pool.query(
    `DELETE FROM ${TABLES.COOK_BANK_REQUESTS}
      WHERE ${COLUMNS.ID} = ? AND ${COLUMNS.COOK_ID} = ?`,
    [id, cookId]
  );
  return result;
};

const countPending = async () => {
  const [rows] = await pool.query(
    `SELECT COUNT(*) AS total FROM ${TABLES.COOK_BANK_REQUESTS}
      WHERE ${COLUMNS.STATUS} = 'pending'`
  );
  return Number(rows[0]?.total || 0);
};

module.exports = {
  listByCook,
  pendingForCook,
  getById,
  listForAdmin,
  createRequest,
  updateRequest,
  deleteRequest,
  countPending,
};
