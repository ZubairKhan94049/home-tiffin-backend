const pool = require("../config/db");
const TABLES = require("../config/tableNames");
const COLUMNS = require("../config/tableColumns/tblreviewsColumns");

// Get review of an order (used to enforce one review per order)
const getByOrderId = async (orderId) => {
  const [rows] = await pool.query(
    `SELECT * FROM ${TABLES.REVIEWS} WHERE ${COLUMNS.ORDER_ID} = ?`,
    [orderId]
  );
  return rows[0];
};

// Create a review
const createReview = async ({ order_id, customer_id, cook_id, stars, comment = null }) => {
  const [result] = await pool.query(
    `INSERT INTO ${TABLES.REVIEWS}
      (${COLUMNS.ORDER_ID}, ${COLUMNS.CUSTOMER_ID}, ${COLUMNS.COOK_ID}, ${COLUMNS.STARS}, ${COLUMNS.COMMENT})
     VALUES (?, ?, ?, ?, ?)`,
    [order_id, customer_id, cook_id, stars, comment]
  );
  return result.insertId;
};

module.exports = { getByOrderId, createReview };
