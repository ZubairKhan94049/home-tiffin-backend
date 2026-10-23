const pool = require("../config/db");
const TABLES = require("../config/tableNames");

const FIELDS = ["name", "description", "emoji", "image", "sort_order", "is_active", "show_on_home"];

/// Active categories, for the cook's picker and the customer app. `homeOnly`
/// narrows it to the main ones the admin chose for the home screen.
const listActive = async ({ homeOnly = false } = {}) => {
  const [rows] = await pool.query(
    `SELECT id, name, description, emoji, image, show_on_home
       FROM ${TABLES.DISH_CATEGORIES}
      WHERE is_active = 1 ${homeOnly ? "AND show_on_home = 1" : ""}
      ORDER BY sort_order ASC, name ASC`
  );
  return rows;
};

/// Everything, with how many dishes use each — the admin needs that to know
/// whether a category can be deleted or should just be hidden.
const listAll = async () => {
  const [rows] = await pool.query(
    `SELECT c.*,
            (SELECT COUNT(*) FROM ${TABLES.DISHES} d WHERE d.category_id = c.id) AS dish_count
       FROM ${TABLES.DISH_CATEGORIES} c
      ORDER BY c.sort_order ASC, c.name ASC`
  );
  return rows;
};

const getById = async (id) => {
  const [rows] = await pool.query(
    `SELECT c.*,
            (SELECT COUNT(*) FROM ${TABLES.DISHES} d WHERE d.category_id = c.id) AS dish_count
       FROM ${TABLES.DISH_CATEGORIES} c WHERE c.id = ?`,
    [id]
  );
  return rows[0];
};

const findByName = async (name) => {
  const [rows] = await pool.query(
    `SELECT * FROM ${TABLES.DISH_CATEGORIES} WHERE LOWER(name) = LOWER(?) LIMIT 1`,
    [name]
  );
  return rows[0];
};

const create = async (data) => {
  const keys = Object.keys(data).filter((k) => FIELDS.includes(k));
  const [result] = await pool.query(
    `INSERT INTO ${TABLES.DISH_CATEGORIES} (${keys.join(", ")})
     VALUES (${keys.map(() => "?").join(", ")})`,
    keys.map((k) => data[k])
  );
  return result.insertId;
};

/// Dishes keep the category name alongside its id, so a rename is carried to
/// them too — otherwise menus would still show the old name.
const update = async (id, data) => {
  const keys = Object.keys(data).filter((k) => FIELDS.includes(k));
  if (!keys.length) return;
  await pool.query(
    `UPDATE ${TABLES.DISH_CATEGORIES} SET ${keys.map((k) => `${k} = ?`).join(", ")}
      WHERE id = ?`,
    [...keys.map((k) => data[k]), id]
  );
  if (data.name) {
    await pool.query(
      `UPDATE ${TABLES.DISHES} SET category = ? WHERE category_id = ?`,
      [data.name, id]
    );
  }
};

const remove = async (id) => {
  await pool.query(`DELETE FROM ${TABLES.DISH_CATEGORIES} WHERE id = ?`, [id]);
};

const reorder = async (ids) => {
  for (const [index, id] of ids.entries()) {
    await pool.query(
      `UPDATE ${TABLES.DISH_CATEGORIES} SET sort_order = ? WHERE id = ?`,
      [index, id]
    );
  }
};

const nextSortOrder = async () => {
  const [[row]] = await pool.query(
    `SELECT COALESCE(MAX(sort_order), 0) + 1 AS next FROM ${TABLES.DISH_CATEGORIES}`
  );
  return Number(row.next);
};

module.exports = {
  listActive, listAll, getById, findByName, create, update, remove, reorder, nextSortOrder,
};
