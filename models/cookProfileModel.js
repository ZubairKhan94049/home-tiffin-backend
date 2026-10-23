const pool = require("../config/db");
const TABLES = require("../config/tableNames");
const COLUMNS = require("../config/tableColumns/tblcookprofilesColumns");
const USERS = require("../config/tableColumns/tblusersColumns");
const DISHES = require("../config/tableColumns/tbldishesColumns");
const ORDERS = require("../config/tableColumns/tblordersColumns");

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

// Get a cook profile by user id.
//
// The meal type name rides along so callers (the admin review screen) can show
// the cuisine the cook picked without a second lookup.
const getByUserId = async (userId) => {
  const [rows] = await pool.query(
    `SELECT cp.*,
            (SELECT mt.name FROM ${TABLES.MEAL_TYPES} mt
              WHERE mt.id = cp.${COLUMNS.MEAL_TYPE_ID}) AS meal_type_name
     FROM ${TABLES.COOK_PROFILES} cp
     WHERE cp.${COLUMNS.USER_ID} = ?`,
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
           cp.${COLUMNS.OPENING_TIME}, cp.${COLUMNS.CLOSING_TIME}, cp.${COLUMNS.OPERATING_DAYS},
           cp.${COLUMNS.KITCHEN_PHOTOS}, cp.${COLUMNS.MENU_PICTURE},
           (SELECT mt.name FROM ${TABLES.MEAL_TYPES} mt
             WHERE mt.id = cp.${COLUMNS.MEAL_TYPE_ID}) AS cuisine,
           (SELECT COUNT(*) FROM ${TABLES.ORDERS} o
             WHERE o.${ORDERS.COOK_ID} = u.${USERS.ID}
               AND o.${ORDERS.STATUS} = 'delivered') AS orders_delivered,
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
  await attachMenuSummary(rows);
  return rows;
};

// What a customer wants to know before opening a kitchen: what it cooks, from
// what price, how long it takes, and photos. One query for every listed cook.
const attachMenuSummary = async (cooks) => {
  if (!cooks.length) return;
  const [dishes] = await pool.query(
    `SELECT ${DISHES.COOK_ID} AS cook_id, ${DISHES.CATEGORY} AS category,
            ${DISHES.PRICE} AS price, ${DISHES.PREP_TIME_MINUTES} AS prep,
            ${DISHES.IMAGE} AS image
     FROM ${TABLES.DISHES}
     WHERE ${DISHES.COOK_ID} IN (?)
       AND ${DISHES.IS_AVAILABLE} = 1 AND ${DISHES.IS_HIDDEN} = 0
     ORDER BY ${DISHES.ID} DESC`,
    [cooks.map((c) => c.id)]
  );

  const byCook = new Map();
  for (const dish of dishes) {
    if (!byCook.has(dish.cook_id)) byCook.set(dish.cook_id, []);
    byCook.get(dish.cook_id).push(dish);
  }

  for (const cook of cooks) {
    const list = byCook.get(cook.id) || [];
    const prices = list.map((d) => Number(d.price)).filter((n) => n > 0);
    const preps = list.map((d) => Number(d.prep)).filter((n) => n > 0);

    // Most-cooked categories first.
    const counts = new Map();
    for (const d of list) {
      if (d.category) counts.set(d.category, (counts.get(d.category) || 0) + 1);
    }

    let kitchenPhotos = [];
    try {
      const parsed = JSON.parse(cook.kitchen_photos || "[]");
      if (Array.isArray(parsed)) kitchenPhotos = parsed.filter(Boolean);
    } catch (_) {
      kitchenPhotos = [];
    }
    // Onboarding stores the menu photo as a bare filename.
    const menuPhoto = cook.menu_picture
      ? cook.menu_picture.startsWith("/")
        ? cook.menu_picture
        : `/uploads/${cook.menu_picture}`
      : null;
    delete cook.kitchen_photos;
    delete cook.menu_picture;

    cook.top_categories = [...counts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([name]) => name);
    cook.min_price = prices.length ? Math.min(...prices) : null;
    cook.avg_prep_minutes = preps.length
      ? Math.round(preps.reduce((a, b) => a + b, 0) / preps.length)
      : null;
    // Food first — that is what sells — then the menu, then the kitchen.
    // Never the cook's profile photo: the card is about the food.
    cook.photos = [
      ...new Set([
        ...list.map((d) => d.image).filter(Boolean),
        ...(menuPhoto ? [menuPhoto] : []),
        ...kitchenPhotos,
      ]),
    ].slice(0, 3);
  }
};

// Public single cook (active) with profile
const getActiveCookById = async (cookUserId) => {
  const [rows] = await pool.query(
    `SELECT u.${USERS.ID}, u.${USERS.NAME}, u.${USERS.PHONE}, u.${USERS.PROFILE_IMAGE},
            cp.${COLUMNS.KITCHEN_NAME}, cp.${COLUMNS.CITY}, cp.${COLUMNS.AREA}, cp.${COLUMNS.BIO},
            cp.${COLUMNS.RATING}, cp.${COLUMNS.TOTAL_REVIEWS}, cp.${COLUMNS.IS_KITCHEN_OPEN},
            cp.${COLUMNS.OPENING_TIME}, cp.${COLUMNS.CLOSING_TIME}, cp.${COLUMNS.OPERATING_DAYS},
            cp.${COLUMNS.KITCHEN_PHOTOS}, cp.${COLUMNS.MENU_PICTURE},
            (SELECT mt.name FROM ${TABLES.MEAL_TYPES} mt
              WHERE mt.id = cp.${COLUMNS.MEAL_TYPE_ID}) AS cuisine,
            (SELECT COUNT(*) FROM ${TABLES.ORDERS} o
              WHERE o.${ORDERS.COOK_ID} = u.${USERS.ID}
                AND o.${ORDERS.STATUS} = 'delivered') AS orders_delivered,
            (SELECT COUNT(*) FROM ${TABLES.DISHES} d
              WHERE d.${DISHES.COOK_ID} = u.${USERS.ID}
                AND d.${DISHES.IS_AVAILABLE} = 1 AND d.${DISHES.IS_HIDDEN} = 0) AS dish_count
     FROM ${TABLES.USERS} u
     JOIN ${TABLES.COOK_PROFILES} cp ON cp.${COLUMNS.USER_ID} = u.${USERS.ID}
     WHERE u.${USERS.ID} = ? AND u.${USERS.ROLE} = 'cook' AND u.${USERS.STATUS} = 'active'`,
    [cookUserId]
  );
  // Same summary as the list, so the kitchen page header matches its card.
  await attachMenuSummary(rows);
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
