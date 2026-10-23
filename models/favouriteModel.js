const pool = require("../config/db");
const TABLES = require("../config/tableNames");
const COLUMNS = require("../config/tableColumns/tblfavouritesColumns");
const DISHES = require("../config/tableColumns/tbldishesColumns");
const USERS = require("../config/tableColumns/tblusersColumns");
const COOK_PROFILES = require("../config/tableColumns/tblcookprofilesColumns");

/// Ids only — enough to light up the hearts on any list of dishes.
const idsForCustomer = async (customerId) => {
  const [rows] = await pool.query(
    `SELECT ${COLUMNS.DISH_ID} AS dish_id FROM ${TABLES.FAVOURITES}
      WHERE ${COLUMNS.CUSTOMER_ID} = ?`,
    [customerId]
  );
  return rows.map((row) => row.dish_id);
};

/// The Favourites screen: each dish with its kitchen, newest heart first.
/// Dishes an admin has hidden, or whose cook is no longer active, are left
/// out rather than shown as something that cannot be ordered.
const listForCustomer = async (customerId) => {
  const [rows] = await pool.query(
    `SELECT d.*, u.${USERS.NAME} AS cook_name,
            cp.${COOK_PROFILES.KITCHEN_NAME} AS kitchen_name,
            cp.${COOK_PROFILES.RATING} AS cook_rating,
            cp.${COOK_PROFILES.IS_KITCHEN_OPEN} AS is_kitchen_open,
            f.${COLUMNS.CREATED_AT} AS favourited_at
       FROM ${TABLES.FAVOURITES} f
       JOIN ${TABLES.DISHES} d ON d.${DISHES.ID} = f.${COLUMNS.DISH_ID}
       JOIN ${TABLES.USERS} u ON u.${USERS.ID} = d.${DISHES.COOK_ID}
       JOIN ${TABLES.COOK_PROFILES} cp ON cp.${COOK_PROFILES.USER_ID} = u.${USERS.ID}
      WHERE f.${COLUMNS.CUSTOMER_ID} = ?
        AND d.${DISHES.IS_HIDDEN} = 0
        AND u.${USERS.STATUS} = 'active'
      ORDER BY f.${COLUMNS.CREATED_AT} DESC`,
    [customerId]
  );
  return rows;
};

/// Idempotent: hearting twice leaves one row.
const add = async (customerId, dishId) => {
  await pool.query(
    `INSERT IGNORE INTO ${TABLES.FAVOURITES}
      (${COLUMNS.CUSTOMER_ID}, ${COLUMNS.DISH_ID}) VALUES (?, ?)`,
    [customerId, dishId]
  );
};

const remove = async (customerId, dishId) => {
  await pool.query(
    `DELETE FROM ${TABLES.FAVOURITES}
      WHERE ${COLUMNS.CUSTOMER_ID} = ? AND ${COLUMNS.DISH_ID} = ?`,
    [customerId, dishId]
  );
};

module.exports = { idsForCustomer, listForCustomer, add, remove };
