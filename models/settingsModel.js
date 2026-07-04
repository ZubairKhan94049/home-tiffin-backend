const pool = require("../config/db");
const TABLES = require("../config/tableNames");
const COLUMNS = require("../config/tableColumns/tblsettingsColumns");

// Get the single settings row
const getSettings = async () => {
  const [rows] = await pool.query(
    `SELECT * FROM ${TABLES.SETTINGS} WHERE ${COLUMNS.ID} = 1`
  );
  return rows[0];
};

// Update settings (partial)
const updateSettings = async (settingsData) => {
  const fields = [];
  const values = [];

  for (const [key, value] of Object.entries(settingsData)) {
    fields.push(`${key} = ?`);
    values.push(key === COLUMNS.SERVICE_AREAS ? JSON.stringify(value) : value);
  }

  values.push(1);

  const [result] = await pool.query(
    `UPDATE ${TABLES.SETTINGS} SET ${fields.join(", ")} WHERE ${COLUMNS.ID} = ?`,
    values
  );
  return result;
};

module.exports = { getSettings, updateSettings };
