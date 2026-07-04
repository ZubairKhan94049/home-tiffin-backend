// Runs a .sql file through mysql2 (multipleStatements).
// Usage: node scripts/run-sql.js sql/schema.sql
const fs = require("fs");
const path = require("path");
const mysql = require("mysql2/promise");
const dotenv = require("dotenv");

dotenv.config();

const main = async () => {
  const fileArg = process.argv[2];
  if (!fileArg) {
    console.error("Usage: node scripts/run-sql.js <path-to-sql-file>");
    process.exit(1);
  }

  const filePath = path.resolve(__dirname, "..", fileArg);
  if (!fs.existsSync(filePath)) {
    console.error(`SQL file not found: ${filePath}`);
    process.exit(1);
  }

  const sql = fs.readFileSync(filePath, "utf8");
  const dbName = process.env.DB_NAME || "home_tiffin";

  // Connect without a database so the schema file can run on a fresh server
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    port: process.env.DB_PORT ? Number(process.env.DB_PORT) : 3306,
    multipleStatements: true,
  });

  try {
    await connection.query(
      `CREATE DATABASE IF NOT EXISTS \`${dbName}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`
    );
    await connection.query(`USE \`${dbName}\``);
    await connection.query(sql);
    console.log(`Executed ${fileArg} successfully`);
  } finally {
    await connection.end();
  }
};

main().catch((err) => {
  console.error("Failed to run SQL file:", err.message);
  process.exit(1);
});
