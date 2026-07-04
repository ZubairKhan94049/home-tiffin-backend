const pool = require("../config/db");
const TABLES = require("../config/tableNames");
const COLUMNS = require("../config/tableColumns/tblcookprofilesColumns");
const USERS = require("../config/tableColumns/tblusersColumns");
const DISHES = require("../config/tableColumns/tbldishesColumns");

// Create a cook profile (at registration)
const createProfile = async ({ user_id, kitchen_name, city, area, bio = null }) => {
  const [result] = await pool.query(
    `INSERT INTO ${TABLES.COOK_PROFILES}
      (${COLUMNS.USER_ID}, ${COLUMNS.KITCHEN_NAME}, ${COLUMNS.CITY}, ${COLUMNS.AREA}, ${COLUMNS.BIO})
     VALUES (?, ?, ?, ?, ?)`,
    [user_id, kitchen_name, city, area, bio]
  );
  return result.insertId;
};

// Get a cook profile by user id
const getByUserId = async (userId) => {
  const [rows] = await pool.query(
    `SELECT * FROM ${TABLES.COOK_PROFILES} WHERE ${COLUMNS.USER_ID} = ?`,
    [userId]
  );
  return rows[0];
};

// Update a cook profile by user id (partial)
const updateByUserId = async (userId, profileData) => {
  const fields = [];
  const values = [];

  for (const [key, value] of Object.entries(profileData)) {
    fields.push(`${key} = ?`);
    values.push(value);
  }

  values.push(userId);

  const [result] = await pool.query(
    `UPDATE ${TABLES.COOK_PROFILES} SET ${fields.join(", ")} WHERE ${COLUMNS.USER_ID} = ?`,
    values
  );
  return result;
};

// Recompute cached rating (avg + count) from reviews
const updateRatingCache = async (cookUserId) => {
  const [result] = await pool.query(
    `UPDATE ${TABLES.COOK_PROFILES} cp
     SET cp.${COLUMNS.RATING} = (SELECT COALESCE(ROUND(AVG(r.stars), 2), 0) FROM ${TABLES.REVIEWS} r WHERE r.cook_id = ?),
         cp.${COLUMNS.TOTAL_REVIEWS} = (SELECT COUNT(*) FROM ${TABLES.REVIEWS} r WHERE r.cook_id = ?)
     WHERE cp.${COLUMNS.USER_ID} = ?`,
    [cookUserId, cookUserId, cookUserId]
  );
  return result;
};

// Public list of active cooks with profile, rating, open flag and dish count
const listActiveCooks = async ({ search, area } = {}) => {
  let query = `
    SELECT u.${USERS.ID}, u.${USERS.NAME}, u.${USERS.PHONE}, u.${USERS.PROFILE_IMAGE},
           cp.${COLUMNS.KITCHEN_NAME}, cp.${COLUMNS.CITY}, cp.${COLUMNS.AREA}, cp.${COLUMNS.BIO},
           cp.${COLUMNS.RATING}, cp.${COLUMNS.TOTAL_REVIEWS}, cp.${COLUMNS.IS_KITCHEN_OPEN},
           (SELECT COUNT(*) FROM ${TABLES.DISHES} d
             WHERE d.${DISHES.COOK_ID} = u.${USERS.ID}
               AND d.${DISHES.IS_AVAILABLE} = 1 AND d.${DISHES.IS_HIDDEN} = 0) AS dish_count
    FROM ${TABLES.USERS} u
    JOIN ${TABLES.COOK_PROFILES} cp ON cp.${COLUMNS.USER_ID} = u.${USERS.ID}
    WHERE u.${USERS.ROLE} = 'cook' AND u.${USERS.STATUS} = 'active'`;
  const params = [];

  if (search) {
    query += ` AND (cp.${COLUMNS.KITCHEN_NAME} LIKE ? OR u.${USERS.NAME} LIKE ?)`;
    params.push(`%${search}%`, `%${search}%`);
  }
  if (area) {
    query += ` AND cp.${COLUMNS.AREA} LIKE ?`;
    params.push(`%${area}%`);
  }

  query += ` ORDER BY cp.${COLUMNS.RATING} DESC`;

  const [rows] = await pool.query(query, params);
  return rows;
};

// Public single cook (active) with profile
const getActiveCookById = async (cookUserId) => {
  const [rows] = await pool.query(
    `SELECT u.${USERS.ID}, u.${USERS.NAME}, u.${USERS.PHONE}, u.${USERS.PROFILE_IMAGE},
            cp.${COLUMNS.KITCHEN_NAME}, cp.${COLUMNS.CITY}, cp.${COLUMNS.AREA}, cp.${COLUMNS.BIO},
            cp.${COLUMNS.RATING}, cp.${COLUMNS.TOTAL_REVIEWS}, cp.${COLUMNS.IS_KITCHEN_OPEN}
     FROM ${TABLES.USERS} u
     JOIN ${TABLES.COOK_PROFILES} cp ON cp.${COLUMNS.USER_ID} = u.${USERS.ID}
     WHERE u.${USERS.ID} = ? AND u.${USERS.ROLE} = 'cook' AND u.${USERS.STATUS} = 'active'`,
    [cookUserId]
  );
  return rows[0];
};

// Admin list of cooks (any status) with profile
const listCooksForAdmin = async ({ status, search } = {}) => {
  let query = `
    SELECT u.${USERS.ID}, u.${USERS.NAME}, u.${USERS.EMAIL}, u.${USERS.PHONE}, u.${USERS.STATUS}, u.${USERS.CREATED_AT},
           cp.${COLUMNS.KITCHEN_NAME}, cp.${COLUMNS.CITY}, cp.${COLUMNS.AREA},
           cp.${COLUMNS.RATING}, cp.${COLUMNS.TOTAL_REVIEWS}, cp.${COLUMNS.IS_KITCHEN_OPEN},
           cp.${COLUMNS.REJECTION_REASON}, cp.${COLUMNS.APPROVED_AT}
    FROM ${TABLES.USERS} u
    JOIN ${TABLES.COOK_PROFILES} cp ON cp.${COLUMNS.USER_ID} = u.${USERS.ID}
    WHERE u.${USERS.ROLE} = 'cook'`;
  const params = [];

  if (status) {
    query += ` AND u.${USERS.STATUS} = ?`;
    params.push(status);
  }
  if (search) {
    query += ` AND (cp.${COLUMNS.KITCHEN_NAME} LIKE ? OR u.${USERS.NAME} LIKE ? OR u.${USERS.PHONE} LIKE ?)`;
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
  updateRatingCache,
  listActiveCooks,
  getActiveCookById,
  listCooksForAdmin,
};
