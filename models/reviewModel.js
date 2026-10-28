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

const listByCustomer = async (customerId) => {
  const [rows] = await pool.query(
    `SELECT r.id,r.order_id,r.stars,r.comment,r.created_at,
            o.order_number,cp.kitchen_name
       FROM ${TABLES.REVIEWS} r
       JOIN ${TABLES.ORDERS} o ON o.id = r.order_id
       LEFT JOIN ${TABLES.COOK_PROFILES} cp ON cp.user_id = r.cook_id
      WHERE r.customer_id = ? ORDER BY r.created_at DESC`, [customerId]);
  return rows;
};
module.exports = { getByOrderId, createReview, listByCustomer };
