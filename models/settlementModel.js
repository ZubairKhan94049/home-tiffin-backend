const pool = require("../config/db");
const TABLES = require("../config/tableNames");
const RIDER_SETTLEMENTS = require("../config/tableColumns/tblridersettlementsColumns");
const COOK_PAYOUTS = require("../config/tableColumns/tblcookpayoutsColumns");
const RIDER_PROFILES = require("../config/tableColumns/tblriderprofilesColumns");
const ORDERS = require("../config/tableColumns/tblordersColumns");
const USERS = require("../config/tableColumns/tblusersColumns");
const COOK_PROFILES = require("../config/tableColumns/tblcookprofilesColumns");

// Per-rider cash in hand overview (active riders)
const riderSettlementOverview = async () => {
  const [rows] = await pool.query(
    `SELECT u.${USERS.ID}, u.${USERS.NAME}, u.${USERS.PHONE},
            rp.${RIDER_PROFILES.CASH_IN_HAND}, rp.${RIDER_PROFILES.IS_ONLINE},
            (SELECT COALESCE(SUM(rs.${RIDER_SETTLEMENTS.AMOUNT}), 0)
               FROM ${TABLES.RIDER_SETTLEMENTS} rs
              WHERE rs.${RIDER_SETTLEMENTS.RIDER_ID} = u.${USERS.ID}) AS total_settled
     FROM ${TABLES.USERS} u
     JOIN ${TABLES.RIDER_PROFILES} rp ON rp.${RIDER_PROFILES.USER_ID} = u.${USERS.ID}
     WHERE u.${USERS.ROLE} = 'rider' AND u.${USERS.STATUS} = 'active'
     ORDER BY rp.${RIDER_PROFILES.CASH_IN_HAND} DESC`
  );
  return rows;
};

// Settlement history of a rider
const riderSettlementHistory = async (riderId) => {
  const [rows] = await pool.query(
    `SELECT rs.*, a.${USERS.NAME} AS settled_by_name
     FROM ${TABLES.RIDER_SETTLEMENTS} rs
     LEFT JOIN ${TABLES.USERS} a ON a.${USERS.ID} = rs.${RIDER_SETTLEMENTS.SETTLED_BY}
     WHERE rs.${RIDER_SETTLEMENTS.RIDER_ID} = ?
     ORDER BY rs.${RIDER_SETTLEMENTS.SETTLED_AT} DESC`,
    [riderId]
  );
  return rows;
};

// Insert a rider cash deposit record
const createRiderSettlement = async ({ rider_id, amount, settled_by }) => {
  const [result] = await pool.query(
    `INSERT INTO ${TABLES.RIDER_SETTLEMENTS}
      (${RIDER_SETTLEMENTS.RIDER_ID}, ${RIDER_SETTLEMENTS.AMOUNT}, ${RIDER_SETTLEMENTS.SETTLED_BY})
     VALUES (?, ?, ?)`,
    [rider_id, amount, settled_by]
  );
  return result.insertId;
};

// Per-cook owed overview: delivered totals x (1 - commission) - paid
const cookSettlementOverview = async (commissionPct) => {
  const [rows] = await pool.query(
    `SELECT u.${USERS.ID}, u.${USERS.NAME}, cp.${COOK_PROFILES.KITCHEN_NAME},
            COALESCE(d.delivered_count, 0) AS delivered_count,
            COALESCE(d.gross_sales, 0) AS gross_sales,
            COALESCE(ROUND(d.gross_sales * (1 - ? / 100)), 0) AS earned,
            COALESCE(p.total_paid, 0) AS total_paid,
            COALESCE(ROUND(d.gross_sales * (1 - ? / 100)), 0) - COALESCE(p.total_paid, 0) AS owed
     FROM ${TABLES.USERS} u
     JOIN ${TABLES.COOK_PROFILES} cp ON cp.${COOK_PROFILES.USER_ID} = u.${USERS.ID}
     LEFT JOIN (
       SELECT ${ORDERS.COOK_ID} AS cook_id, COUNT(*) AS delivered_count, SUM(${ORDERS.ITEM_TOTAL}) AS gross_sales
       FROM ${TABLES.ORDERS}
       WHERE ${ORDERS.STATUS} = 'delivered'
       GROUP BY ${ORDERS.COOK_ID}
     ) d ON d.cook_id = u.${USERS.ID}
     LEFT JOIN (
       SELECT ${COOK_PAYOUTS.COOK_ID} AS cook_id, SUM(${COOK_PAYOUTS.AMOUNT}) AS total_paid
       FROM ${TABLES.COOK_PAYOUTS}
       GROUP BY ${COOK_PAYOUTS.COOK_ID}
     ) p ON p.cook_id = u.${USERS.ID}
     WHERE u.${USERS.ROLE} = 'cook' AND u.${USERS.STATUS} = 'active'
     ORDER BY owed DESC`,
    [commissionPct, commissionPct]
  );
  return rows;
};

// Owed summary for a single cook
const cookOwedSummary = async (cookId, commissionPct) => {
  const [rows] = await pool.query(
    `SELECT
       (SELECT COUNT(*) FROM ${TABLES.ORDERS}
         WHERE ${ORDERS.COOK_ID} = ? AND ${ORDERS.STATUS} = 'delivered') AS delivered_count,
       (SELECT COALESCE(ROUND(SUM(${ORDERS.ITEM_TOTAL} * (1 - ? / 100))), 0) FROM ${TABLES.ORDERS}
         WHERE ${ORDERS.COOK_ID} = ? AND ${ORDERS.STATUS} = 'delivered') AS earned,
       (SELECT COALESCE(SUM(${COOK_PAYOUTS.AMOUNT}), 0) FROM ${TABLES.COOK_PAYOUTS}
         WHERE ${COOK_PAYOUTS.COOK_ID} = ?) AS total_paid`,
    [cookId, commissionPct, cookId, cookId]
  );
  return rows[0];
};

// Payout history of a cook
const cookPayoutHistory = async (cookId) => {
  const [rows] = await pool.query(
    `SELECT cpay.*, a.${USERS.NAME} AS paid_by_name
     FROM ${TABLES.COOK_PAYOUTS} cpay
     LEFT JOIN ${TABLES.USERS} a ON a.${USERS.ID} = cpay.${COOK_PAYOUTS.PAID_BY}
     WHERE cpay.${COOK_PAYOUTS.COOK_ID} = ?
     ORDER BY cpay.${COOK_PAYOUTS.PAID_AT} DESC`,
    [cookId]
  );
  return rows;
};

// Insert a cook payout record
const createCookPayout = async ({ cook_id, amount, order_count, commission_pct, paid_by }) => {
  const [result] = await pool.query(
    `INSERT INTO ${TABLES.COOK_PAYOUTS}
      (${COOK_PAYOUTS.COOK_ID}, ${COOK_PAYOUTS.AMOUNT}, ${COOK_PAYOUTS.ORDER_COUNT}, ${COOK_PAYOUTS.COMMISSION_PCT}, ${COOK_PAYOUTS.PAID_BY})
     VALUES (?, ?, ?, ?, ?)`,
    [cook_id, amount, order_count, commission_pct, paid_by]
  );
  return result.insertId;
};

module.exports = {
  riderSettlementOverview,
  riderSettlementHistory,
  createRiderSettlement,
  cookSettlementOverview,
  cookOwedSummary,
  cookPayoutHistory,
  createCookPayout,
};
