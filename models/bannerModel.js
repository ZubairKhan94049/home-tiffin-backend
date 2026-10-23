const pool = require("../config/db");
const TABLES = require("../config/tableNames");

const FIELDS = [
  "eyebrow", "title", "subtitle", "cta_label", "action_type", "action_value",
  "image", "image_original", "image_crop", "background_color", "text_color", "image_overlay", "sort_order",
  "is_active", "starts_at", "ends_at",
];

/// What customers see right now: switched on, and inside its schedule.
const listLive = async () => {
  const [rows] = await pool.query(
    `SELECT * FROM ${TABLES.BANNERS}
      WHERE is_active = 1
        AND (starts_at IS NULL OR starts_at <= NOW())
        AND (ends_at IS NULL OR ends_at > NOW())
      ORDER BY sort_order ASC, id ASC`
  );
  return rows;
};

const listAll = async () => {
  const [rows] = await pool.query(
    `SELECT * FROM ${TABLES.BANNERS} ORDER BY sort_order ASC, id ASC`
  );
  return rows;
};

const getById = async (id) => {
  const [rows] = await pool.query(
    `SELECT * FROM ${TABLES.BANNERS} WHERE id = ?`, [id]
  );
  return rows[0];
};

const create = async (data) => {
  const keys = Object.keys(data).filter((k) => FIELDS.includes(k));
  const [result] = await pool.query(
    `INSERT INTO ${TABLES.BANNERS} (${keys.join(", ")})
     VALUES (${keys.map(() => "?").join(", ")})`,
    keys.map((k) => data[k])
  );
  return result.insertId;
};

const update = async (id, data) => {
  const keys = Object.keys(data).filter((k) => FIELDS.includes(k));
  if (!keys.length) return;
  await pool.query(
    `UPDATE ${TABLES.BANNERS} SET ${keys.map((k) => `${k} = ?`).join(", ")}
      WHERE id = ?`,
    [...keys.map((k) => data[k]), id]
  );
};

const remove = async (id) => {
  await pool.query(`DELETE FROM ${TABLES.BANNERS} WHERE id = ?`, [id]);
};

/// Rewrites the order from a list of ids, first to last.
const reorder = async (ids) => {
  for (const [index, id] of ids.entries()) {
    await pool.query(
      `UPDATE ${TABLES.BANNERS} SET sort_order = ? WHERE id = ?`, [index, id]
    );
  }
};

const nextSortOrder = async () => {
  const [[row]] = await pool.query(
    `SELECT COALESCE(MAX(sort_order), -1) + 1 AS next FROM ${TABLES.BANNERS}`
  );
  return Number(row.next);
};

module.exports = {
  listLive, listAll, getById, create, update, remove, reorder, nextSortOrder,
};
