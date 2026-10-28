const pool = require("../config/db");
const TABLES = require("../config/tableNames");
const COLUMNS = require("../config/tableColumns/tbldishesColumns");
const USERS = require("../config/tableColumns/tblusersColumns");
const COOK_PROFILES = require("../config/tableColumns/tblcookprofilesColumns");
const IMAGES = require("../config/tableColumns/tbldishimagesColumns");
const VARIATIONS = require("../config/tableColumns/tbldishvariationsColumns");
const AVAILABILITY = require("../config/tableColumns/tbldishavailabilityColumns");
const CONTENTS = require("../config/tableColumns/tbldishcontentsColumns");
const ORDER_ITEMS = require("../config/tableColumns/tblorderitemsColumns");
const ORDERS = require("../config/tableColumns/tblordersColumns");

// Photos and variations live in their own tables, so every read that hands a
// dish to an app attaches them here — one round trip for the whole list
// rather than one per dish.
const attachChildren = async (dishes) => {
  const rows = Array.isArray(dishes) ? dishes.filter(Boolean) : [];
  if (!rows.length) return rows;

  const ids = rows.map((d) => d[COLUMNS.ID]);
  const [images] = await pool.query(
    `SELECT * FROM ${TABLES.DISH_IMAGES} WHERE ${IMAGES.DISH_ID} IN (?)
     ORDER BY ${IMAGES.SORT_ORDER} ASC, ${IMAGES.ID} ASC`,
    [ids]
  );
  const [variations] = await pool.query(
    `SELECT * FROM ${TABLES.DISH_VARIATIONS} WHERE ${VARIATIONS.DISH_ID} IN (?)
     ORDER BY ${VARIATIONS.SORT_ORDER} ASC, ${VARIATIONS.ID} ASC`,
    [ids]
  );
  const [availability] = await pool.query(
    `SELECT * FROM ${TABLES.DISH_AVAILABILITY} WHERE ${AVAILABILITY.DISH_ID} IN (?)
     ORDER BY ${AVAILABILITY.SORT_ORDER} ASC, ${AVAILABILITY.ID} ASC`,
    [ids]
  );
  const [contents] = await pool.query(
    `SELECT * FROM ${TABLES.DISH_CONTENTS} WHERE ${CONTENTS.DISH_ID} IN (?)
     ORDER BY ${CONTENTS.SORT_ORDER} ASC, ${CONTENTS.ID} ASC`,
    [ids]
  );

  const by = (list, key) =>
    list.reduce((acc, row) => {
      (acc[row[key]] ||= []).push(row);
      return acc;
    }, {});
  const imagesByDish = by(images, IMAGES.DISH_ID);
  const variationsByDish = by(variations, VARIATIONS.DISH_ID);
  const availabilityByDish = by(availability, AVAILABILITY.DISH_ID);
  const contentsByDish = by(contents, CONTENTS.DISH_ID);

  for (const dish of rows) {
    dish.images = imagesByDish[dish[COLUMNS.ID]] || [];
    dish.variations = variationsByDish[dish[COLUMNS.ID]] || [];
    dish.availability = availabilityByDish[dish[COLUMNS.ID]] || [];
    dish.contents = contentsByDish[dish[COLUMNS.ID]] || [];
  }
  return rows;
};

/// Replaces a dish's variations wholesale — the cook edits them as one list,
/// so reconciling row by row would only invite drift.
const replaceVariations = async (dishId, variations = []) => {
  await pool.query(
    `DELETE FROM ${TABLES.DISH_VARIATIONS} WHERE ${VARIATIONS.DISH_ID} = ?`,
    [dishId]
  );
  if (!variations.length) return;
  await pool.query(
    `INSERT INTO ${TABLES.DISH_VARIATIONS}
      (${VARIATIONS.DISH_ID}, ${VARIATIONS.NAME}, ${VARIATIONS.PRICE},
       ${VARIATIONS.SERVES}, ${VARIATIONS.SORT_ORDER})
     VALUES ?`,
    [variations.map((v, i) => [dishId, v.name, v.price, v.serves ?? null, i])]
  );
};

/// Adds newly uploaded photos, keeping the ones the cook did not remove.
const replaceImages = async (dishId, images = []) => {
  await pool.query(
    `DELETE FROM ${TABLES.DISH_IMAGES} WHERE ${IMAGES.DISH_ID} = ?`,
    [dishId]
  );
  if (!images.length) return;
  await pool.query(
    `INSERT INTO ${TABLES.DISH_IMAGES}
      (${IMAGES.DISH_ID}, ${IMAGES.IMAGE}, ${IMAGES.SORT_ORDER})
     VALUES ?`,
    [images.map((image, i) => [dishId, image, i])]
  );
};

/// The item's serving windows, replaced as one list like its variations.
const replaceAvailability = async (dishId, slots = []) => {
  await pool.query(
    `DELETE FROM ${TABLES.DISH_AVAILABILITY} WHERE ${AVAILABILITY.DISH_ID} = ?`,
    [dishId]
  );
  if (!slots.length) return;
  await pool.query(
    `INSERT INTO ${TABLES.DISH_AVAILABILITY}
      (${AVAILABILITY.DISH_ID}, ${AVAILABILITY.AVAILABLE_FROM},
       ${AVAILABILITY.AVAILABLE_TO}, ${AVAILABILITY.SORT_ORDER})
     VALUES ?`,
    [slots.map((slot, i) => [dishId, slot.from, slot.to, i])]
  );
};

/// What the item is made up of — the lines a platter lists.
const replaceContents = async (dishId, contents = []) => {
  await pool.query(
    `DELETE FROM ${TABLES.DISH_CONTENTS} WHERE ${CONTENTS.DISH_ID} = ?`,
    [dishId]
  );
  if (!contents.length) return;
  await pool.query(
    `INSERT INTO ${TABLES.DISH_CONTENTS}
      (${CONTENTS.DISH_ID}, ${CONTENTS.NAME}, ${CONTENTS.QUANTITY}, ${CONTENTS.SORT_ORDER})
     VALUES ?`,
    [contents.map((row, i) => [dishId, row.name, row.quantity ?? null, i])]
  );
};

/// How one dish has actually sold, for the cook's analytics screen.
///
/// Only delivered orders count — a cancelled order is not a sale, and
/// counting it would flatter every number on the screen. Revenue comes from
/// the price snapshot on the order line, not the dish's current price, so
/// changing a price never rewrites history.
const analyticsForDish = async (dishId, cookId) => {
  const sold = `oi.${ORDER_ITEMS.QUANTITY}`;
  const line = `oi.${ORDER_ITEMS.PRICE} * oi.${ORDER_ITEMS.QUANTITY}`;
  const from = `FROM ${TABLES.ORDER_ITEMS} oi
     JOIN ${TABLES.ORDERS} o ON o.${ORDERS.ID} = oi.${ORDER_ITEMS.ORDER_ID}
    WHERE o.${ORDERS.STATUS} = 'delivered'`;

  const [[totals]] = await pool.query(
    `SELECT COUNT(DISTINCT oi.${ORDER_ITEMS.ORDER_ID}) AS orders,
            COALESCE(SUM(${sold}), 0) AS quantity,
            COALESCE(SUM(${line}), 0) AS revenue,
            MIN(o.${ORDERS.DELIVERED_AT}) AS first_sold,
            MAX(o.${ORDERS.DELIVERED_AT}) AS last_sold
       ${from} AND oi.${ORDER_ITEMS.DISH_ID} = ?`,
    [dishId]
  );

  // The last 30 days, day by day, so the screen can draw a trend. Days with
  // no sales are missing here and filled in by the controller.
  const [daily] = await pool.query(
    `SELECT DATE(o.${ORDERS.DELIVERED_AT}) AS day,
            COALESCE(SUM(${sold}), 0) AS quantity,
            COALESCE(SUM(${line}), 0) AS revenue
       ${from} AND oi.${ORDER_ITEMS.DISH_ID} = ?
        AND o.${ORDERS.DELIVERED_AT} >= (CURDATE() - INTERVAL 29 DAY)
      GROUP BY day ORDER BY day ASC`,
    [dishId]
  );

  // Where it sits among the cook's other items, by revenue.
  const [[rank]] = await pool.query(
    `SELECT COUNT(*) + 1 AS position FROM (
       SELECT oi.${ORDER_ITEMS.DISH_ID} AS dish_id, SUM(${line}) AS revenue
         ${from} AND o.${ORDERS.COOK_ID} = ?
        GROUP BY oi.${ORDER_ITEMS.DISH_ID}
     ) peers
      WHERE peers.revenue > (
        SELECT COALESCE(SUM(${line}), 0) ${from} AND oi.${ORDER_ITEMS.DISH_ID} = ?
      )`,
    [cookId, dishId]
  );

  const [[menu]] = await pool.query(
    `SELECT COUNT(DISTINCT oi.${ORDER_ITEMS.DISH_ID}) AS selling_dishes,
            COALESCE(SUM(${line}), 0) AS revenue
       ${from} AND o.${ORDERS.COOK_ID} = ?`,
    [cookId]
  );

  return { totals, daily, rank, menu };
};

/// All active categories, for the cook's searchable picker.
const listCategories = async () => {
  const [rows] = await pool.query(
    `SELECT id, name, description FROM ${TABLES.DISH_CATEGORIES}
     WHERE is_active = 1 ORDER BY sort_order ASC, name ASC`
  );
  return rows;
};

// Get a dish by id
const getById = async (id) => {
  const [rows] = await pool.query(
    `SELECT * FROM ${TABLES.DISHES} WHERE ${COLUMNS.ID} = ?`,
    [id]
  );
  return (await attachChildren(rows))[0];
};

// Get several dishes by ids
const getByIds = async (ids) => {
  if (!ids.length) return [];
  const [rows] = await pool.query(
    `SELECT * FROM ${TABLES.DISHES} WHERE ${COLUMNS.ID} IN (?)`,
    [ids]
  );
  return attachChildren(rows);
};

// All dishes of a cook (cook's own management view)
const listByCook = async (cookId) => {
  const [rows] = await pool.query(
    `SELECT * FROM ${TABLES.DISHES} WHERE ${COLUMNS.COOK_ID} = ? ORDER BY ${COLUMNS.CREATED_AT} DESC`,
    [cookId]
  );
  return attachChildren(rows);
};

// Customer-visible dishes of a cook (available && !hidden)
const listVisibleByCook = async (cookId) => {
  const [rows] = await pool.query(
    `SELECT * FROM ${TABLES.DISHES}
     WHERE ${COLUMNS.COOK_ID} = ? AND ${COLUMNS.IS_AVAILABLE} = 1 AND ${COLUMNS.IS_HIDDEN} = 0
     ORDER BY ${COLUMNS.CATEGORY}, ${COLUMNS.NAME}`,
    [cookId]
  );
  return attachChildren(rows);
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
  return attachChildren(rows);
};

/// Orderable dishes filed under one category, best-rated kitchens first.
const listVisibleByCategory = async (categoryId) => {
  const [rows] = await pool.query(
    `SELECT d.*, u.${USERS.NAME} AS cook_name,
            cp.${COOK_PROFILES.KITCHEN_NAME} AS kitchen_name,
            cp.${COOK_PROFILES.RATING} AS cook_rating,
            cp.${COOK_PROFILES.IS_KITCHEN_OPEN} AS is_kitchen_open
       FROM ${TABLES.DISHES} d
       JOIN ${TABLES.USERS} u ON u.${USERS.ID} = d.${COLUMNS.COOK_ID}
       JOIN ${TABLES.COOK_PROFILES} cp ON cp.${COOK_PROFILES.USER_ID} = u.${USERS.ID}
      WHERE d.${COLUMNS.CATEGORY_ID} = ? AND u.${USERS.STATUS} = 'active'
        AND d.${COLUMNS.IS_AVAILABLE} = 1 AND d.${COLUMNS.IS_HIDDEN} = 0
      ORDER BY cp.${COOK_PROFILES.RATING} DESC, d.${COLUMNS.NAME} ASC`,
    [categoryId]
  );
  return attachChildren(rows);
};

/// One dish a customer could order, with its kitchen.
const getVisibleById = async (id) => {
  const [rows] = await pool.query(
    `SELECT d.*, u.${USERS.NAME} AS cook_name,
            cp.${COOK_PROFILES.KITCHEN_NAME} AS kitchen_name,
            cp.${COOK_PROFILES.RATING} AS cook_rating,
            cp.${COOK_PROFILES.IS_KITCHEN_OPEN} AS is_kitchen_open
       FROM ${TABLES.DISHES} d
       JOIN ${TABLES.USERS} u ON u.${USERS.ID} = d.${COLUMNS.COOK_ID}
       JOIN ${TABLES.COOK_PROFILES} cp ON cp.${COOK_PROFILES.USER_ID} = u.${USERS.ID}
      WHERE d.${COLUMNS.ID} = ? AND d.${COLUMNS.IS_HIDDEN} = 0
        AND u.${USERS.STATUS} = 'active'`,
    [id]
  );
  return (await attachChildren(rows))[0];
};

/// What a customer typed into search, matched against the dish name, its
/// description, its category and the kitchen it comes from — "biryani"
/// should find the dish, and "Ammi's" should find everything Ammi cooks.
/// Only dishes a customer could actually order.
const search = async (term, limit = 30) => {
  const like = `%${term}%`;
  const [rows] = await pool.query(
    `SELECT d.*, u.${USERS.NAME} AS cook_name,
            cp.${COOK_PROFILES.KITCHEN_NAME} AS kitchen_name,
            cp.${COOK_PROFILES.RATING} AS cook_rating,
            -- A name match is what the customer meant; a word in the
            -- description is a weaker hit, so it sorts after.
            (d.${COLUMNS.NAME} LIKE ?) AS name_hit
       FROM ${TABLES.DISHES} d
       JOIN ${TABLES.USERS} u ON u.${USERS.ID} = d.${COLUMNS.COOK_ID}
       JOIN ${TABLES.COOK_PROFILES} cp ON cp.${COOK_PROFILES.USER_ID} = u.${USERS.ID}
      WHERE u.${USERS.STATUS} = 'active'
        AND d.${COLUMNS.IS_AVAILABLE} = 1 AND d.${COLUMNS.IS_HIDDEN} = 0
        AND (d.${COLUMNS.NAME} LIKE ? OR d.${COLUMNS.DESCRIPTION} LIKE ?
             OR d.${COLUMNS.CATEGORY} LIKE ? OR cp.${COOK_PROFILES.KITCHEN_NAME} LIKE ?)
      ORDER BY name_hit DESC, cp.${COOK_PROFILES.RATING} DESC, d.${COLUMNS.NAME} ASC
      LIMIT ?`,
    [like, like, like, like, like, Number(limit)]
  );
  return attachChildren(rows);
};

// Create a dish
const createDish = async (dishData) => {
  const {
    cook_id,
    name,
    description = null,
    category,
    category_id = null,
    price,
    serves = null,
    spice_level = 1,
    prep_time_minutes = 30,
    available_days = null,
    image = null,
  } = dishData;

  const [result] = await pool.query(
    `INSERT INTO ${TABLES.DISHES}
      (${COLUMNS.COOK_ID}, ${COLUMNS.NAME}, ${COLUMNS.DESCRIPTION}, ${COLUMNS.CATEGORY}, ${COLUMNS.CATEGORY_ID},
       ${COLUMNS.PRICE}, ${COLUMNS.SERVES}, ${COLUMNS.SPICE_LEVEL}, ${COLUMNS.PREP_TIME_MINUTES},
       ${COLUMNS.AVAILABLE_DAYS}, ${COLUMNS.IMAGE})
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      cook_id,
      name,
      description,
      category,
      category_id,
      price,
      serves,
      spice_level,
      prep_time_minutes,
      available_days,
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
  listVisibleByCategory,
  getVisibleById,
  search,
  analyticsForDish,
  listCategories,
  replaceImages,
  replaceVariations,
  replaceAvailability,
  replaceContents,
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
