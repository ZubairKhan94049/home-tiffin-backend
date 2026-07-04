const pool = require("../config/db");
const TABLES = require("../config/tableNames");
const COLUMNS = require("../config/tableColumns/tblordersColumns");
const ITEMS = require("../config/tableColumns/tblorderitemsColumns");
const USERS = require("../config/tableColumns/tblusersColumns");
const COOK_PROFILES = require("../config/tableColumns/tblcookprofilesColumns");

const FIRST_ORDER_NUMBER = 1229;

// Next public order number (#1229+)
const getNextOrderNumber = async () => {
  const [rows] = await pool.query(
    `SELECT COALESCE(MAX(${COLUMNS.ORDER_NUMBER}), ?) + 1 AS next_number FROM ${TABLES.ORDERS}`,
    [FIRST_ORDER_NUMBER - 1]
  );
  return rows[0].next_number;
};

// Create order + items in a single transaction
const createOrder = async (orderData, items) => {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    const [result] = await connection.query(
      `INSERT INTO ${TABLES.ORDERS}
        (${COLUMNS.ORDER_NUMBER}, ${COLUMNS.CUSTOMER_ID}, ${COLUMNS.COOK_ID}, ${COLUMNS.DELIVERY_ADDRESS},
         ${COLUMNS.STATUS}, ${COLUMNS.ITEM_TOTAL}, ${COLUMNS.DELIVERY_FEE}, ${COLUMNS.DISCOUNT}, ${COLUMNS.TAX},
         ${COLUMNS.TOTAL}, ${COLUMNS.PAYMENT_METHOD}, ${COLUMNS.SPECIAL_INSTRUCTIONS})
       VALUES (?, ?, ?, ?, 'new', ?, ?, ?, ?, ?, ?, ?)`,
      [
        orderData.order_number,
        orderData.customer_id,
        orderData.cook_id,
        JSON.stringify(orderData.delivery_address),
        orderData.item_total,
        orderData.delivery_fee,
        orderData.discount,
        orderData.tax,
        orderData.total,
        orderData.payment_method || "cod",
        orderData.special_instructions || null,
      ]
    );

    const orderId = result.insertId;

    const itemValues = items.map((item) => [
      orderId,
      item.dish_id,
      item.name,
      item.price,
      item.quantity,
      item.is_veg ? 1 : 0,
    ]);

    await connection.query(
      `INSERT INTO ${TABLES.ORDER_ITEMS}
        (${ITEMS.ORDER_ID}, ${ITEMS.DISH_ID}, ${ITEMS.NAME}, ${ITEMS.PRICE}, ${ITEMS.QUANTITY}, ${ITEMS.IS_VEG})
       VALUES ?`,
      [itemValues]
    );

    await connection.commit();
    return orderId;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
};

// Get a single order by id (with names)
const getById = async (id) => {
  const [rows] = await pool.query(
    `SELECT o.*,
            cu.${USERS.NAME} AS customer_name, cu.${USERS.PHONE} AS customer_phone,
            ck.${USERS.NAME} AS cook_name, cp.${COOK_PROFILES.KITCHEN_NAME} AS kitchen_name,
            rd.${USERS.NAME} AS rider_name, rd.${USERS.PHONE} AS rider_phone
     FROM ${TABLES.ORDERS} o
     JOIN ${TABLES.USERS} cu ON cu.${USERS.ID} = o.${COLUMNS.CUSTOMER_ID}
     JOIN ${TABLES.USERS} ck ON ck.${USERS.ID} = o.${COLUMNS.COOK_ID}
     LEFT JOIN ${TABLES.COOK_PROFILES} cp ON cp.${COOK_PROFILES.USER_ID} = o.${COLUMNS.COOK_ID}
     LEFT JOIN ${TABLES.USERS} rd ON rd.${USERS.ID} = o.${COLUMNS.RIDER_ID}
     WHERE o.${COLUMNS.ID} = ?`,
    [id]
  );
  return rows[0];
};

// Items of an order
const getItems = async (orderId) => {
  const [rows] = await pool.query(
    `SELECT * FROM ${TABLES.ORDER_ITEMS} WHERE ${ITEMS.ORDER_ID} = ?`,
    [orderId]
  );
  return rows;
};

// Customer's orders (newest first)
const listByCustomer = async (customerId) => {
  const [rows] = await pool.query(
    `SELECT o.*, cp.${COOK_PROFILES.KITCHEN_NAME} AS kitchen_name
     FROM ${TABLES.ORDERS} o
     LEFT JOIN ${TABLES.COOK_PROFILES} cp ON cp.${COOK_PROFILES.USER_ID} = o.${COLUMNS.COOK_ID}
     WHERE o.${COLUMNS.CUSTOMER_ID} = ?
     ORDER BY o.${COLUMNS.PLACED_AT} DESC`,
    [customerId]
  );
  return rows;
};

// Cook's orders grouped by tab (new | active | history)
const listByCook = async (cookId, statusGroup) => {
  let statusClause = "";
  if (statusGroup === "new") {
    statusClause = `AND o.${COLUMNS.STATUS} = 'new'`;
  } else if (statusGroup === "active") {
    statusClause = `AND o.${COLUMNS.STATUS} IN ('accepted', 'preparing', 'ready', 'on_the_way')`;
  } else if (statusGroup === "history") {
    statusClause = `AND o.${COLUMNS.STATUS} IN ('delivered', 'cancelled')`;
  }

  const [rows] = await pool.query(
    `SELECT o.*, cu.${USERS.NAME} AS customer_name, cu.${USERS.PHONE} AS customer_phone,
            rd.${USERS.NAME} AS rider_name
     FROM ${TABLES.ORDERS} o
     JOIN ${TABLES.USERS} cu ON cu.${USERS.ID} = o.${COLUMNS.CUSTOMER_ID}
     LEFT JOIN ${TABLES.USERS} rd ON rd.${USERS.ID} = o.${COLUMNS.RIDER_ID}
     WHERE o.${COLUMNS.COOK_ID} = ? ${statusClause}
     ORDER BY o.${COLUMNS.PLACED_AT} DESC`,
    [cookId]
  );
  return rows;
};

// Rider's orders grouped by tab (ongoing | completed)
const listByRider = async (riderId, statusGroup) => {
  let statusClause = "";
  if (statusGroup === "ongoing") {
    statusClause = `AND o.${COLUMNS.STATUS} IN ('ready', 'on_the_way')`;
  } else if (statusGroup === "completed") {
    statusClause = `AND o.${COLUMNS.STATUS} = 'delivered'`;
  }

  const [rows] = await pool.query(
    `SELECT o.*, cu.${USERS.NAME} AS customer_name, cu.${USERS.PHONE} AS customer_phone,
            ck.${USERS.NAME} AS cook_name, cp.${COOK_PROFILES.KITCHEN_NAME} AS kitchen_name
     FROM ${TABLES.ORDERS} o
     JOIN ${TABLES.USERS} cu ON cu.${USERS.ID} = o.${COLUMNS.CUSTOMER_ID}
     JOIN ${TABLES.USERS} ck ON ck.${USERS.ID} = o.${COLUMNS.COOK_ID}
     LEFT JOIN ${TABLES.COOK_PROFILES} cp ON cp.${COOK_PROFILES.USER_ID} = o.${COLUMNS.COOK_ID}
     WHERE o.${COLUMNS.RIDER_ID} = ? ${statusClause}
     ORDER BY o.${COLUMNS.PLACED_AT} DESC`,
    [riderId]
  );
  return rows;
};

// Ready orders without an assigned rider (available for pickup)
const listAvailableForRiders = async () => {
  const [rows] = await pool.query(
    `SELECT o.*, cu.${USERS.NAME} AS customer_name,
            ck.${USERS.NAME} AS cook_name, cp.${COOK_PROFILES.KITCHEN_NAME} AS kitchen_name,
            cp.${COOK_PROFILES.AREA} AS kitchen_area, cp.${COOK_PROFILES.CITY} AS kitchen_city
     FROM ${TABLES.ORDERS} o
     JOIN ${TABLES.USERS} cu ON cu.${USERS.ID} = o.${COLUMNS.CUSTOMER_ID}
     JOIN ${TABLES.USERS} ck ON ck.${USERS.ID} = o.${COLUMNS.COOK_ID}
     LEFT JOIN ${TABLES.COOK_PROFILES} cp ON cp.${COOK_PROFILES.USER_ID} = o.${COLUMNS.COOK_ID}
     WHERE o.${COLUMNS.STATUS} = 'ready' AND o.${COLUMNS.RIDER_ID} IS NULL
     ORDER BY o.${COLUMNS.READY_AT} ASC`
  );
  return rows;
};

// Admin order list with optional status filter and search
const listForAdmin = async ({ status, search } = {}) => {
  let query = `
    SELECT o.*, cu.${USERS.NAME} AS customer_name,
           ck.${USERS.NAME} AS cook_name, cp.${COOK_PROFILES.KITCHEN_NAME} AS kitchen_name,
           rd.${USERS.NAME} AS rider_name
    FROM ${TABLES.ORDERS} o
    JOIN ${TABLES.USERS} cu ON cu.${USERS.ID} = o.${COLUMNS.CUSTOMER_ID}
    JOIN ${TABLES.USERS} ck ON ck.${USERS.ID} = o.${COLUMNS.COOK_ID}
    LEFT JOIN ${TABLES.COOK_PROFILES} cp ON cp.${COOK_PROFILES.USER_ID} = o.${COLUMNS.COOK_ID}
    LEFT JOIN ${TABLES.USERS} rd ON rd.${USERS.ID} = o.${COLUMNS.RIDER_ID}
    WHERE 1 = 1`;
  const params = [];

  if (status) {
    query += ` AND o.${COLUMNS.STATUS} = ?`;
    params.push(status);
  }
  if (search) {
    query += ` AND (o.${COLUMNS.ORDER_NUMBER} LIKE ? OR cu.${USERS.NAME} LIKE ? OR ck.${USERS.NAME} LIKE ? OR cp.${COOK_PROFILES.KITCHEN_NAME} LIKE ?)`;
    params.push(`%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`);
  }

  query += ` ORDER BY o.${COLUMNS.PLACED_AT} DESC`;

  const [rows] = await pool.query(query, params);
  return rows;
};

// -------- Guarded status transitions (conditional updates) --------

// Cook accepts: new -> preparing (accept + prep together)
const acceptByCook = async (orderId, cookId) => {
  const [result] = await pool.query(
    `UPDATE ${TABLES.ORDERS}
     SET ${COLUMNS.STATUS} = 'preparing', ${COLUMNS.ACCEPTED_AT} = NOW()
     WHERE ${COLUMNS.ID} = ? AND ${COLUMNS.COOK_ID} = ? AND ${COLUMNS.STATUS} = 'new'`,
    [orderId, cookId]
  );
  return result;
};

// Cook rejects: new -> cancelled
const rejectByCook = async (orderId, cookId, reason) => {
  const [result] = await pool.query(
    `UPDATE ${TABLES.ORDERS}
     SET ${COLUMNS.STATUS} = 'cancelled', ${COLUMNS.CANCEL_REASON} = ?, ${COLUMNS.CANCELLED_BY} = 'cook', ${COLUMNS.CANCELLED_AT} = NOW()
     WHERE ${COLUMNS.ID} = ? AND ${COLUMNS.COOK_ID} = ? AND ${COLUMNS.STATUS} = 'new'`,
    [reason, orderId, cookId]
  );
  return result;
};

// Cook marks ready: preparing -> ready
const markReadyByCook = async (orderId, cookId) => {
  const [result] = await pool.query(
    `UPDATE ${TABLES.ORDERS}
     SET ${COLUMNS.STATUS} = 'ready', ${COLUMNS.READY_AT} = NOW()
     WHERE ${COLUMNS.ID} = ? AND ${COLUMNS.COOK_ID} = ? AND ${COLUMNS.STATUS} = 'preparing'`,
    [orderId, cookId]
  );
  return result;
};

// Rider self-assigns / admin assigns: ready + unassigned only
const assignRider = async (orderId, riderId) => {
  const [result] = await pool.query(
    `UPDATE ${TABLES.ORDERS}
     SET ${COLUMNS.RIDER_ID} = ?
     WHERE ${COLUMNS.ID} = ? AND ${COLUMNS.STATUS} = 'ready' AND ${COLUMNS.RIDER_ID} IS NULL`,
    [riderId, orderId]
  );
  return result;
};

// Rider picks up: ready (assigned to this rider) -> on_the_way
const pickupByRider = async (orderId, riderId) => {
  const [result] = await pool.query(
    `UPDATE ${TABLES.ORDERS}
     SET ${COLUMNS.STATUS} = 'on_the_way', ${COLUMNS.PICKED_UP_AT} = NOW()
     WHERE ${COLUMNS.ID} = ? AND ${COLUMNS.RIDER_ID} = ? AND ${COLUMNS.STATUS} = 'ready'`,
    [orderId, riderId]
  );
  return result;
};

// Rider delivers: on_the_way (assigned to this rider) -> delivered
const deliverByRider = async (orderId, riderId) => {
  const [result] = await pool.query(
    `UPDATE ${TABLES.ORDERS}
     SET ${COLUMNS.STATUS} = 'delivered', ${COLUMNS.DELIVERED_AT} = NOW()
     WHERE ${COLUMNS.ID} = ? AND ${COLUMNS.RIDER_ID} = ? AND ${COLUMNS.STATUS} = 'on_the_way'`,
    [orderId, riderId]
  );
  return result;
};

// Admin force-cancels: any non-terminal status -> cancelled
const cancelByAdmin = async (orderId, reason) => {
  const [result] = await pool.query(
    `UPDATE ${TABLES.ORDERS}
     SET ${COLUMNS.STATUS} = 'cancelled', ${COLUMNS.CANCEL_REASON} = ?, ${COLUMNS.CANCELLED_BY} = 'admin', ${COLUMNS.CANCELLED_AT} = NOW()
     WHERE ${COLUMNS.ID} = ? AND ${COLUMNS.STATUS} NOT IN ('delivered', 'cancelled')`,
    [reason, orderId]
  );
  return result;
};

// -------- Aggregates --------

// Counts by status (all time)
const countsByStatus = async () => {
  const [rows] = await pool.query(
    `SELECT ${COLUMNS.STATUS} AS status, COUNT(*) AS count
     FROM ${TABLES.ORDERS} GROUP BY ${COLUMNS.STATUS}`
  );
  return rows;
};

// Admin dashboard: today's order count + GMV (delivered totals today)
const todayStats = async () => {
  const [rows] = await pool.query(
    `SELECT COUNT(*) AS orders_today,
            COALESCE(SUM(CASE WHEN ${COLUMNS.STATUS} = 'delivered' THEN ${COLUMNS.TOTAL} ELSE 0 END), 0) AS gmv_today
     FROM ${TABLES.ORDERS}
     WHERE DATE(${COLUMNS.PLACED_AT}) = CURDATE()`
  );
  return rows[0];
};

// Recent orders for admin dashboard
const recentOrders = async (limit = 5) => {
  const [rows] = await pool.query(
    `SELECT o.${COLUMNS.ID}, o.${COLUMNS.ORDER_NUMBER}, o.${COLUMNS.STATUS}, o.${COLUMNS.TOTAL}, o.${COLUMNS.PLACED_AT},
            cu.${USERS.NAME} AS customer_name, cp.${COOK_PROFILES.KITCHEN_NAME} AS kitchen_name
     FROM ${TABLES.ORDERS} o
     JOIN ${TABLES.USERS} cu ON cu.${USERS.ID} = o.${COLUMNS.CUSTOMER_ID}
     LEFT JOIN ${TABLES.COOK_PROFILES} cp ON cp.${COOK_PROFILES.USER_ID} = o.${COLUMNS.COOK_ID}
     ORDER BY o.${COLUMNS.PLACED_AT} DESC
     LIMIT ?`,
    [Number(limit)]
  );
  return rows;
};

// Cook dashboard stats for today
const cookTodayStats = async (cookId, commissionPct) => {
  const [rows] = await pool.query(
    `SELECT COUNT(*) AS orders_today,
            COALESCE(SUM(CASE WHEN ${COLUMNS.STATUS} = 'delivered' THEN ROUND(${COLUMNS.ITEM_TOTAL} * (1 - ? / 100)) ELSE 0 END), 0) AS earnings_today,
            COALESCE(SUM(${COLUMNS.STATUS} = 'new'), 0) AS pending_orders
     FROM ${TABLES.ORDERS}
     WHERE ${COLUMNS.COOK_ID} = ? AND DATE(${COLUMNS.PLACED_AT}) = CURDATE()`,
    [commissionPct, cookId]
  );
  return rows[0];
};

// Cook earnings for a period ("today" | "week" | "month" | "all")
const cookEarnings = async (cookId, commissionPct, period) => {
  let dateClause = "";
  if (period === "today") {
    dateClause = `AND DATE(${COLUMNS.DELIVERED_AT}) = CURDATE()`;
  } else if (period === "week") {
    dateClause = `AND ${COLUMNS.DELIVERED_AT} >= DATE_SUB(NOW(), INTERVAL 7 DAY)`;
  } else if (period === "month") {
    dateClause = `AND ${COLUMNS.DELIVERED_AT} >= DATE_SUB(NOW(), INTERVAL 30 DAY)`;
  }

  const [rows] = await pool.query(
    `SELECT COUNT(*) AS order_count,
            COALESCE(SUM(${COLUMNS.ITEM_TOTAL}), 0) AS gross_sales,
            COALESCE(ROUND(SUM(${COLUMNS.ITEM_TOTAL} * (1 - ? / 100))), 0) AS net_earnings
     FROM ${TABLES.ORDERS}
     WHERE ${COLUMNS.COOK_ID} = ? AND ${COLUMNS.STATUS} = 'delivered' ${dateClause}`,
    [commissionPct, cookId]
  );
  return rows[0];
};

// Rider earnings for a period ("today" | "week" | "month" | "all")
const riderEarnings = async (riderId, period) => {
  let dateClause = "";
  if (period === "today") {
    dateClause = `AND DATE(${COLUMNS.DELIVERED_AT}) = CURDATE()`;
  } else if (period === "week") {
    dateClause = `AND ${COLUMNS.DELIVERED_AT} >= DATE_SUB(NOW(), INTERVAL 7 DAY)`;
  } else if (period === "month") {
    dateClause = `AND ${COLUMNS.DELIVERED_AT} >= DATE_SUB(NOW(), INTERVAL 30 DAY)`;
  }

  const [rows] = await pool.query(
    `SELECT COUNT(*) AS deliveries,
            COALESCE(SUM(${COLUMNS.DELIVERY_FEE}), 0) AS delivery_fees
     FROM ${TABLES.ORDERS}
     WHERE ${COLUMNS.RIDER_ID} = ? AND ${COLUMNS.STATUS} = 'delivered' ${dateClause}`,
    [riderId]
  );
  return rows[0];
};

module.exports = {
  getNextOrderNumber,
  createOrder,
  getById,
  getItems,
  listByCustomer,
  listByCook,
  listByRider,
  listAvailableForRiders,
  listForAdmin,
  acceptByCook,
  rejectByCook,
  markReadyByCook,
  assignRider,
  pickupByRider,
  deliverByRider,
  cancelByAdmin,
  countsByStatus,
  todayStats,
  recentOrders,
  cookTodayStats,
  cookEarnings,
  riderEarnings,
};
