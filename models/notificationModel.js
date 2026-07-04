const pool = require("../config/db");
const TABLES = require("../config/tableNames");
const COLUMNS = require("../config/tableColumns/tblnotificationsColumns");

// List notifications of a user (newest first)
const listByUser = async (userId) => {
  const [rows] = await pool.query(
    `SELECT * FROM ${TABLES.NOTIFICATIONS}
     WHERE ${COLUMNS.USER_ID} = ?
     ORDER BY ${COLUMNS.CREATED_AT} DESC`,
    [userId]
  );
  return rows;
};

// Mark all notifications of a user as read
const markAllRead = async (userId) => {
  const [result] = await pool.query(
    `UPDATE ${TABLES.NOTIFICATIONS} SET ${COLUMNS.IS_READ} = 1 WHERE ${COLUMNS.USER_ID} = ?`,
    [userId]
  );
  return result;
};

// Create a notification (fire and forget from controllers)
const createNotification = async ({ user_id, title, body, type = "order" }) => {
  const [result] = await pool.query(
    `INSERT INTO ${TABLES.NOTIFICATIONS}
      (${COLUMNS.USER_ID}, ${COLUMNS.TITLE}, ${COLUMNS.BODY}, ${COLUMNS.TYPE})
     VALUES (?, ?, ?, ?)`,
    [user_id, title, body, type]
  );
  return result.insertId;
};

module.exports = { listByUser, markAllRead, createNotification };
