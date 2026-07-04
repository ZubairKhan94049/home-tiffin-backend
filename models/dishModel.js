const pool = require("../config/db");
const TABLES = require("../config/tableNames");
const COLUMNS = require("../config/tableColumns/tbldishesColumns");
const USERS = require("../config/tableColumns/tblusersColumns");
const COOK_PROFILES = require("../config/tableColumns/tblcookprofilesColumns");

// Get a dish by id
const getById = async (id) => {
  const [rows] = await pool.query(
    `SELECT * FROM ${TABLES.DISHES} WHERE ${COLUMNS.ID} = ?`,
    [id]
  );
  return rows[0];
};

// Get several dishes by ids
const getByIds = async (ids) => {
  if (!ids.length) return [];
  const [rows] = await pool.query(
    `SELECT * FROM ${TABLES.DISHES} WHERE ${COLUMNS.ID} IN (?)`,
    [ids]
  );
  return rows;
};

// All dishes of a cook (cook's own management view)
const listByCook = async (cookId) => {
  const [rows] = await pool.query(
    `SELECT * FROM ${TABLES.DISHES} WHERE ${COLUMNS.COOK_ID} = ? ORDER BY ${COLUMNS.CREATED_AT} DESC`,
    [cookId]
  );
  return rows;
};

// Customer-visible dishes of a cook (available && !hidden)
const listVisibleByCook = async (cookId) => {
  const [rows] = await pool.query(
    `SELECT * FROM ${TABLES.DISHES}
     WHERE ${COLUMNS.COOK_ID} = ? AND ${COLUMNS.IS_AVAILABLE} = 1 AND ${COLUMNS.IS_HIDDEN} = 0
     ORDER BY ${COLUMNS.CATEGORY}, ${COLUMNS.NAME}`,
    [cookId]
  );
  return rows;
};

// Popular dishes across active cooks (by times ordered)
const listPopular = async (limit = 10) => {
  const [rows] = await pool.query(
    `SELECT d.*, u.${USERS.NAME} AS cook_name, cp.${COOK_PROFILES.KITCHEN_NAME} AS kitchen_name,
            cp.${COOK_PROFILES.RATING} AS cook_rating,
            (SELECT COALESCE(SUM(oi.quantity), 0) FROM ${TABLES.ORDER_ITEMS} oi WHERE oi.dish_id = d.${COLUMNS.ID}) AS times_ordered
     FROM ${TABLES.DISHES} d
     JOIN ${TABLES.USERS} u ON u.${USERS.ID} = d.${COLUMNS.COOK_ID}
     JOIN ${TABLES.COOK_PROFILES} cp ON cp.${COOK_PROFILES.USER_ID} = u.${USERS.ID}
     WHERE u.${USERS.STATUS} = 'active'
       AND d.${COLUMNS.IS_AVAILABLE} = 1 AND d.${COLUMNS.IS_HIDDEN} = 0
     ORDER BY times_ordered DESC, cp.${COOK_PROFILES.RATING} DESC
     LIMIT ?`,
    [Number(limit)]
  );
  return rows;
};

// Create a dish
const createDish = async (dishData) => {
  const {
    cook_id,
    name,
    description = null,
    category,
    price,
    is_veg = 0,
    spice_level = 1,
    prep_time_minutes = 30,
    daily_quantity = null,
    image = null,
  } = dishData;

  const [result] = await pool.query(
    `INSERT INTO ${TABLES.DISHES}
      (${COLUMNS.COOK_ID}, ${COLUMNS.NAME}, ${COLUMNS.DESCRIPTION}, ${COLUMNS.CATEGORY}, ${COLUMNS.PRICE},
       ${COLUMNS.IS_VEG}, ${COLUMNS.SPICE_LEVEL}, ${COLUMNS.PREP_TIME_MINUTES}, ${COLUMNS.DAILY_QUANTITY}, ${COLUMNS.IMAGE})
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      cook_id,
      name,
      description,
      category,
      price,
      is_veg ? 1 : 0,
      spice_level,
      prep_time_minutes,
      daily_quantity,
      image,
    ]
  );
  return result.insertId;
};

// Update a dish (partial)
const updateDish = async (id, dishData) => {
  const fields = [];
  const values = [];

  for (const [key, value] of Object.entries(dishData)) {
    fields.push(`${key} = ?`);
    values.push(value);
  }

  values.push(id);

  const [result] = await pool.query(
    `UPDATE ${TABLES.DISHES} SET ${fields.join(", ")} WHERE ${COLUMNS.ID} = ?`,
    values
  );
  return result;
};

// Delete a dish
const deleteDish = async (id) => {
  const [result] = await pool.query(
    `DELETE FROM ${TABLES.DISHES} WHERE ${COLUMNS.ID} = ?`,
    [id]
  );
  return result;
};

// Flip cook availability toggle
const toggleAvailability = async (id) => {
  const [result] = await pool.query(
    `UPDATE ${TABLES.DISHES}
     SET ${COLUMNS.IS_AVAILABLE} = IF(${COLUMNS.IS_AVAILABLE} = 1, 0, 1)
     WHERE ${COLUMNS.ID} = ?`,
    [id]
  );
  return result;
};

// Admin hide / unhide a dish
const setHidden = async (id, hidden) => {
  const [result] = await pool.query(
    `UPDATE ${TABLES.DISHES} SET ${COLUMNS.IS_HIDDEN} = ? WHERE ${COLUMNS.ID} = ?`,
    [hidden ? 1 : 0, id]
  );
  return result;
};

// Dish counts for cook dashboard
const countsForCook = async (cookId) => {
  const [rows] = await pool.query(
    `SELECT COUNT(*) AS total_dishes,
            COALESCE(SUM(${COLUMNS.IS_AVAILABLE} = 1 AND ${COLUMNS.IS_HIDDEN} = 0), 0) AS available_dishes
     FROM ${TABLES.DISHES} WHERE ${COLUMNS.COOK_ID} = ?`,
    [cookId]
  );
  return rows[0];
};

module.exports = {
  getById,
  getByIds,
  listByCook,
  listVisibleByCook,
  listPopular,
  createDish,
  updateDish,
  deleteDish,
  toggleAvailability,
  setHidden,
  countsForCook,
};
