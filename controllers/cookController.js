const orderModel = require("../models/orderModel");
const dishModel = require("../models/dishModel");
const cookProfileModel = require("../models/cookProfileModel");
const settingsModel = require("../models/settingsModel");
const settlementModel = require("../models/settlementModel");
const notificationModel = require("../models/notificationModel");
const cookBankAccountModel = require("../models/cookBankAccountModel");
const cookBankRequestModel = require("../models/cookBankRequestModel");
const BANK_REQUESTS = require("../config/tableColumns/tblcookbankrequestsColumns");
const BANK_ACCOUNTS = require("../config/tableColumns/tblcookbankaccountsColumns");
const ORDERS = require("../config/tableColumns/tblordersColumns");
const DISHES = require("../config/tableColumns/tbldishesColumns");
const DISH_IMAGES = require("../config/tableColumns/tbldishimagesColumns");
const COOK_PROFILES = require("../config/tableColumns/tblcookprofilesColumns");
const USERS = require("../config/tableColumns/tblusersColumns");
const SETTINGS = require("../config/tableColumns/tblsettingsColumns");
const userModel = require("../models/userModel");
const TABLES = require("../config/tableNames");
const pool = require("../config/db");

// ---------------------- DASHBOARD ----------------------
const getDashboard = async (req, res) => {
  try {
    const profile = await cookProfileModel.getByUserId(req.user.id);
    if (!profile) {
      return res
        .status(404)
        .json({ success: false, message: "Cook profile not found" });
    }

    const settings = await settingsModel.getSettings();
    const todayStats = await orderModel.cookTodayStats(
      req.user.id,
      Number(settings.commission_pct)
    );
    const dishCounts = await dishModel.countsForCook(req.user.id);

    res.status(200).json({
      success: true,
      data: {
        orders_today: Number(todayStats.orders_today),
        earnings_today: Number(todayStats.earnings_today),
        pending_orders: Number(todayStats.pending_orders),
        rating: Number(profile[COOK_PROFILES.RATING]),
        total_reviews: profile[COOK_PROFILES.TOTAL_REVIEWS],
        is_kitchen_open: profile[COOK_PROFILES.IS_KITCHEN_OPEN],
        available_dishes: Number(dishCounts.available_dishes),
        total_dishes: Number(dishCounts.total_dishes),
      },
    });
  } catch (error) {
    console.error("Error fetching cook dashboard:", error);
    res.status(500).json({
      success: false,
      message: error?.sqlMessage || error?.message || "Internal server error",
    });
  }
};

// ---------------------- TOGGLE KITCHEN ----------------------
const toggleKitchen = async (req, res) => {
  try {
    const profile = await cookProfileModel.getByUserId(req.user.id);
    if (!profile) {
      return res
        .status(404)
        .json({ success: false, message: "Cook profile not found" });
    }

    const newState = profile[COOK_PROFILES.IS_KITCHEN_OPEN] ? 0 : 1;
    await cookProfileModel.updateByUserId(req.user.id, {
      [COOK_PROFILES.IS_KITCHEN_OPEN]: newState,
    });

    res.status(200).json({
      success: true,
      message: newState ? "Kitchen is now open" : "Kitchen is now closed",
      data: { is_kitchen_open: newState },
    });
  } catch (error) {
    console.error("Error toggling kitchen:", error);
    res.status(500).json({
      success: false,
      message: error?.sqlMessage || error?.message || "Internal server error",
    });
  }
};

// ---------------------- MY DISHES ----------------------
const getDishes = async (req, res) => {
  try {
    const dishes = await dishModel.listByCook(req.user.id);
    res.status(200).json({ success: true, data: dishes });
  } catch (error) {
    console.error("Error fetching dishes:", error);
    res.status(500).json({
      success: false,
      message: error?.sqlMessage || error?.message || "Internal server error",
    });
  }
};

// ---------------------- CREATE DISH ----------------------
// ---------------------- DISH HELPERS ----------------------

const DAYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];

/// "mon,tue" or ["mon","tue"] -> "mon,tue". Empty (or all seven) means the
/// dish is on every day, which is stored as NULL so readers need no special
/// case.
const parseDays = (value) => {
  if (value === undefined) return undefined;
  const raw = Array.isArray(value) ? value : `${value ?? ""}`.split(",");
  const days = DAYS.filter((day) =>
    raw.some((entry) => `${entry}`.trim().toLowerCase() === day)
  );
  return days.length === 0 || days.length === DAYS.length ? null : days.join(",");
};

/// "18:30" -> "18:30:00"; anything unparseable clears the window.
const parseTime = (value) => {
  if (value === undefined) return undefined;
  const match = `${value ?? ""}`.trim().match(/^(\d{1,2}):(\d{2})/);
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 23 || minutes > 59) return null;
  return `${`${hours}`.padStart(2, "0")}:${match[2]}:00`;
};

/// Serving windows, as a JSON array of { from, to }. A window whose end is
/// not after its start is dropped rather than rejected — the app already says
/// so inline, and a stray row should not cost the cook the save.
const parseTimeSlots = (value) => {
  if (value === undefined) return undefined;
  let list = value;
  if (typeof list === "string") {
    try {
      list = JSON.parse(list);
    } catch {
      return [];
    }
  }
  if (!Array.isArray(list)) return [];
  const minutes = (time) => {
    const [h, m] = time.split(":");
    return Number(h) * 60 + Number(m);
  };
  return list
    .map((row) => ({ from: parseTime(row?.from), to: parseTime(row?.to) }))
    .filter((row) => row.from && row.to && minutes(row.to) > minutes(row.from))
    .slice(0, 10);
};

/// What a platter is made up of, as a JSON array of { name, quantity }. The
/// quantity is free text ("1/2 kg", "2 pcs") and may be left out.
const parseContents = (value) => {
  if (value === undefined) return undefined;
  let list = value;
  if (typeof list === "string") {
    try {
      list = JSON.parse(list);
    } catch {
      return [];
    }
  }
  if (!Array.isArray(list)) return [];
  return list
    .map((row) => ({
      name: `${row?.name ?? ""}`.trim(),
      quantity: `${row?.quantity ?? ""}`.trim() || null,
    }))
    .filter((row) => row.name.length > 0)
    .slice(0, 30);
};

/// The app sends variations as a JSON array of { name, price }. Rows without
/// a name or a positive price are dropped rather than rejected — a half-typed
/// row should not cost the cook the whole save.
const parseVariations = (value) => {
  if (value === undefined) return undefined;
  let list = value;
  if (typeof list === "string") {
    try {
      list = JSON.parse(list);
    } catch {
      return [];
    }
  }
  if (!Array.isArray(list)) return [];
  return list
    .map((row) => ({
      name: `${row?.name ?? ""}`.trim(),
      price: Math.round(Number(row?.price ?? 0)),
      // Blank falls back to the item's own serving size.
      serves: `${row?.serves ?? ""}`.trim() || null,
    }))
    .filter((row) => row.name.length > 0 && row.price > 0)
    .slice(0, 20);
};

/// An item can only be offered when the kitchen is actually cooking, so the
/// day set and every serving window are checked against the cook's own
/// operating hours. The app enforces this too; this is what makes it true.
const checkAgainstKitchenHours = (profile, { days, slots }) => {
  const kitchenDays = parseDays(profile[COOK_PROFILES.OPERATING_DAYS]);
  if (kitchenDays && days) {
    const allowed = kitchenDays.split(",");
    const stray = days.split(",").filter((day) => day && !allowed.includes(day));
    if (stray.length) {
      return `Your kitchen does not cook on ${stray.join(", ")}`;
    }
  }

  const opening = profile[COOK_PROFILES.OPENING_TIME];
  const closing = profile[COOK_PROFILES.CLOSING_TIME];
  if (!opening || !closing || !slots?.length) return null;

  const outside = slots.some(
    (slot) => slot.from < `${opening}` || slot.to > `${closing}`
  );
  return outside
    ? `Availability must sit inside your kitchen hours (${`${opening}`.slice(0, 5)}–${`${closing}`.slice(0, 5)})`
    : null;
};

const MAX_IMAGES = 3;

/// Every photo path this cook already owns. Duplicating an item re-uses the
/// original's photos, and `kept_images` is only trusted against this set so
/// one cook cannot point at another's uploads.
const cookImagePaths = async (cookId) => {
  const [rows] = await pool.query(
    `SELECT di.${DISH_IMAGES.IMAGE} AS image
       FROM ${TABLES.DISH_IMAGES} di
       JOIN ${TABLES.DISHES} d ON d.${DISHES.ID} = di.${DISH_IMAGES.DISH_ID}
      WHERE d.${DISHES.COOK_ID} = ?`,
    [cookId]
  );
  return rows.map((row) => row.image);
};

/// Photos the cook kept (already-hosted paths they did not remove) plus the
/// ones they just uploaded, capped at three.
const collectImages = (req, existing = []) => {
  const uploaded = (req.files || []).map((file) => `/uploads/${file.filename}`);
  const keptRaw = req.body.kept_images;
  let kept;
  if (keptRaw === undefined) {
    kept = existing;
  } else {
    const list = Array.isArray(keptRaw) ? keptRaw : `${keptRaw}`.split(",");
    const allowed = new Set(existing);
    kept = list.map((p) => `${p}`.trim()).filter((p) => allowed.has(p));
  }
  return [...kept, ...uploaded].slice(0, MAX_IMAGES);
};

/// Resolves the category the cook picked. They choose from the backend list,
/// so the id is authoritative and the name is stored alongside it for the
/// readers that still show `category` directly.
const resolveCategory = async (body) => {
  const id = Number(body.category_id);
  if (Number.isInteger(id) && id > 0) {
    const [rows] = await pool.query(
      `SELECT id, name FROM ${TABLES.DISH_CATEGORIES} WHERE id = ? AND is_active = 1`,
      [id]
    );
    if (rows[0]) return { category_id: rows[0].id, category: rows[0].name };
  }
  const name = `${body.category ?? ""}`.trim();
  return name ? { category_id: null, category: name } : null;
};

// ---------------------- PROFILE ----------------------

const DAYS_OF_WEEK = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];

/// "mon,tue" or ["mon","tue"] -> "mon,tue". Empty or all seven means every
/// day, stored NULL so readers need no special case.
const parseOperatingDays = (value) => {
  if (value === undefined) return undefined;
  const raw = Array.isArray(value) ? value : `${value ?? ""}`.split(",");
  const days = DAYS_OF_WEEK.filter((day) =>
    raw.some((entry) => `${entry}`.trim().toLowerCase() === day)
  );
  return days.length === 0 || days.length === DAYS_OF_WEEK.length
    ? null
    : days.join(",");
};

/// Everything the cook's profile screen reads: the person, the kitchen, when
/// it cooks, the documents on file and where payouts go.
const getProfile = async (req, res) => {
  try {
    const user = await userModel.getUserById(req.user.id);
    const profile = await cookProfileModel.getByUserId(req.user.id);
    if (!user || !profile) {
      return res
        .status(404)
        .json({ success: false, message: "Cook profile not found" });
    }

    const settings = await settingsModel.getSettings();
    const clean = { ...user };
    delete clean[USERS.PASSWORD];

    res.status(200).json({
      success: true,
      data: {
        ...clean,
        profile,
        documents: {
          cnic_front: profile[COOK_PROFILES.CNIC_FRONT] || null,
          cnic_back: profile[COOK_PROFILES.CNIC_BACK] || null,
          bank_proof: profile[COOK_PROFILES.BANK_PROOF] || null,
          menu_picture: profile[COOK_PROFILES.MENU_PICTURE] || null,
        },
        // The four admin-driven rows, so the documents screen can say where
        // the application stands without a second call.
        status: {
          contract: profile[COOK_PROFILES.CONTRACT_STATUS] ?? "pending",
          documents: profile[COOK_PROFILES.DOCUMENTS_STATUS] ?? "pending",
          profile: profile[COOK_PROFILES.PROFILE_STATUS] ?? "locked",
          activation: profile[COOK_PROFILES.ACTIVATION_STATUS] ?? "locked",
          note: profile[COOK_PROFILES.REJECTION_REASON] ?? null,
        },
        support_phone: settings[SETTINGS.SUPPORT_PHONE] ?? null,
      },
    });
  } catch (error) {
    console.error("Error fetching cook profile:", error);
    res.status(500).json({
      success: false,
      message: error?.sqlMessage || error?.message || "Internal server error",
    });
  }
};

/// What the profile screen may change, split by the table it lands in.
const USER_FIELDS = { name: USERS.NAME, phone: USERS.PHONE, email: USERS.EMAIL };

const PROFILE_FIELDS = {
  kitchen_name: COOK_PROFILES.KITCHEN_NAME,
  bio: COOK_PROFILES.BIO,
  city: COOK_PROFILES.CITY,
  area: COOK_PROFILES.AREA,
  address_street: COOK_PROFILES.ADDRESS_STREET,
  address_house: COOK_PROFILES.ADDRESS_HOUSE,
  address_state: COOK_PROFILES.ADDRESS_STATE,
  address_postal_code: COOK_PROFILES.ADDRESS_POSTAL_CODE,
  address_extra: COOK_PROFILES.ADDRESS_EXTRA,
};

const updateProfile = async (req, res) => {
  try {
    const profile = await cookProfileModel.getByUserId(req.user.id);
    if (!profile) {
      return res
        .status(404)
        .json({ success: false, message: "Cook profile not found" });
    }

    const userData = {};
    for (const [field, column] of Object.entries(USER_FIELDS)) {
      if (req.body[field] === undefined) continue;
      const value = `${req.body[field]}`.trim();
      if (!value) {
        return res
          .status(400)
          .json({ success: false, message: `${field} cannot be empty` });
      }
      userData[column] = value;
    }

    // A phone or email already on another account would break signing in.
    for (const [field, lookup] of [
      ["phone", () => userModel.findUserByPhoneOrEmail(userData[USERS.PHONE], null)],
      ["email", () => userModel.findUserByPhoneOrEmail(null, userData[USERS.EMAIL])],
    ]) {
      const column = field === "phone" ? USERS.PHONE : USERS.EMAIL;
      if (userData[column] === undefined) continue;
      const existing = await lookup();
      if (existing && existing[USERS.ID] !== req.user.id) {
        return res.status(409).json({
          success: false,
          message: `That ${field} is already used by another account`,
        });
      }
    }

    const profileData = {};
    for (const [field, column] of Object.entries(PROFILE_FIELDS)) {
      if (req.body[field] === undefined) continue;
      profileData[column] = `${req.body[field]}`.trim() || null;
    }

    const days = parseOperatingDays(req.body.operating_days);
    if (days !== undefined) profileData[COOK_PROFILES.OPERATING_DAYS] = days;

    for (const [field, column] of [
      ["opening_time", COOK_PROFILES.OPENING_TIME],
      ["closing_time", COOK_PROFILES.CLOSING_TIME],
    ]) {
      if (req.body[field] === undefined) continue;
      profileData[column] = parseTime(req.body[field]);
    }

    if (req.body.daily_capacity !== undefined) {
      const capacity = Math.round(Number(req.body.daily_capacity));
      profileData[COOK_PROFILES.DAILY_CAPACITY] =
        Number.isFinite(capacity) && capacity > 0 ? capacity : null;
    }

    const opening =
      profileData[COOK_PROFILES.OPENING_TIME] ??
      profile[COOK_PROFILES.OPENING_TIME];
    const closing =
      profileData[COOK_PROFILES.CLOSING_TIME] ??
      profile[COOK_PROFILES.CLOSING_TIME];
    if (opening && closing && `${closing}` <= `${opening}`) {
      return res.status(400).json({
        success: false,
        message: "Closing time must be after opening time",
      });
    }

    if (!Object.keys(userData).length && !Object.keys(profileData).length) {
      return res
        .status(400)
        .json({ success: false, message: "No fields to update" });
    }

    if (Object.keys(userData).length) {
      await userModel.updateUser(req.user.id, userData);
    }
    if (Object.keys(profileData).length) {
      await cookProfileModel.updateByUserId(req.user.id, profileData);
    }

    return getProfile(req, res);
  } catch (error) {
    console.error("Error updating cook profile:", error);
    res.status(500).json({
      success: false,
      message: error?.sqlMessage || error?.message || "Internal server error",
    });
  }
};

// ---------------------- INSIGHTS (DASHBOARD) ----------------------

/// Local calendar date, never UTC. `toISOString()` would shift the whole
/// window by a day everywhere east of Greenwich — in PKT an evening "today"
/// becomes yesterday — and MySQL's DATE() works in the server's own time.
const iso = (date) =>
  `${date.getFullYear()}-${`${date.getMonth() + 1}`.padStart(2, "0")}-` +
  `${`${date.getDate()}`.padStart(2, "0")}`;

/// The windows the dashboard offers, each with the matching window before it
/// so every headline can say which way it is going.
const RANGES = {
  "7d": { label: "Last 7 days", days: 7 },
  "30d": { label: "Last 30 days", days: 30 },
  prev_month: { label: "Last month" },
};

const resolveRange = (key) => {
  const today = new Date();
  if (key === "prev_month") {
    const start = new Date(today.getFullYear(), today.getMonth() - 1, 1);
    const end = new Date(today.getFullYear(), today.getMonth(), 0);
    const priorStart = new Date(today.getFullYear(), today.getMonth() - 2, 1);
    const priorEnd = new Date(today.getFullYear(), today.getMonth() - 1, 0);
    return {
      key,
      label: RANGES.prev_month.label,
      from: iso(start),
      to: iso(end),
      prior_from: iso(priorStart),
      prior_to: iso(priorEnd),
      days:
        Math.round((end - start) / (24 * 60 * 60 * 1000)) + 1,
    };
  }

  const { label, days } = RANGES[key] ?? RANGES["7d"];
  const end = today;
  const start = new Date(today.getTime() - (days - 1) * 24 * 60 * 60 * 1000);
  const priorEnd = new Date(start.getTime() - 24 * 60 * 60 * 1000);
  const priorStart = new Date(
    priorEnd.getTime() - (days - 1) * 24 * 60 * 60 * 1000
  );
  return {
    key: RANGES[key] ? key : "7d",
    label,
    days,
    from: iso(start),
    to: iso(end),
    prior_from: iso(priorStart),
    prior_to: iso(priorEnd),
  };
};

/// `daily` only holds days that saw an order, so the gaps are filled in —
/// a chart with holes reads as missing data rather than a quiet day.
const fillRange = (rows, from, to) => {
  const byDay = new Map(rows.map((row) => [iso(new Date(row.day)), row]));
  const series = [];
  const cursor = new Date(`${from}T00:00:00`);
  const last = new Date(`${to}T00:00:00`);
  while (cursor <= last) {
    const date = iso(cursor);
    const hit = byDay.get(date);
    series.push({
      date,
      orders: Number(hit?.orders ?? 0),
      gross: Number(hit?.gross ?? 0),
      net: Number(hit?.net ?? 0),
    });
    cursor.setDate(cursor.getDate() + 1);
  }
  return series;
};

const pctChange = (now, before) =>
  before === 0 ? null : Math.round(((now - before) / before) * 100);

const getInsights = async (req, res) => {
  try {
    const profile = await cookProfileModel.getByUserId(req.user.id);
    if (!profile) {
      return res
        .status(404)
        .json({ success: false, message: "Cook profile not found" });
    }

    const settings = await settingsModel.getSettings();
    const commission = Number(settings.commission_pct);
    const range = resolveRange(`${req.query.range ?? "7d"}`);

    const [current, prior, todayStats, dishCounts] = await Promise.all([
      orderModel.cookInsights(req.user.id, commission, range.from, range.to),
      orderModel.cookInsights(
        req.user.id,
        commission,
        range.prior_from,
        range.prior_to
      ),
      orderModel.cookTodayStats(req.user.id, commission),
      dishModel.countsForCook(req.user.id),
    ]);

    const orders = Number(current.sales.orders);
    const gross = Number(current.sales.gross);
    const placed = Number(current.volume.placed);
    const cancelled = Number(current.volume.cancelled);
    const customerOrders = Number(current.customers.orders);
    const returningOrders = Number(current.customers.returning_orders);

    res.status(200).json({
      success: true,
      data: {
        range: {
          key: range.key,
          label: range.label,
          from: range.from,
          to: range.to,
        },
        today: {
          orders: Number(todayStats.orders_today),
          earnings: Number(todayStats.earnings_today),
          pending: Number(todayStats.pending_orders),
        },
        sales: {
          orders,
          gross,
          net: Number(current.sales.net),
          average_order_value: orders === 0 ? 0 : Math.round(gross / orders),
          change_pct: pctChange(gross, Number(prior.sales.gross)),
          orders_change_pct: pctChange(orders, Number(prior.sales.orders)),
          daily: fillRange(current.daily, range.from, range.to),
        },
        // 24 buckets, so the app can draw the day without filling gaps itself.
        hourly: Array.from({ length: 24 }, (_, hour) => {
          const hit = current.hourly.find((row) => Number(row.hour) === hour);
          return {
            hour,
            orders: Number(hit?.orders ?? 0),
            gross: Number(hit?.gross ?? 0),
          };
        }),
        rejections: {
          placed,
          cancelled,
          rate_pct: placed === 0 ? 0 : Number(((cancelled / placed) * 100).toFixed(2)),
          lost_sales: Number(current.volume.lost),
          change: pctChange(cancelled, Number(prior.volume.cancelled)),
          reasons: current.reasons.map((row) => ({
            reason: row.reason,
            count: Number(row.count),
            share_pct:
              cancelled === 0
                ? 0
                : Math.round((Number(row.count) / cancelled) * 100),
          })),
        },
        customers: {
          people: Number(current.customers.people),
          orders: customerOrders,
          returning_orders: returningOrders,
          new_orders: customerOrders - returningOrders,
          returning_pct:
            customerOrders === 0
              ? 0
              : Math.round((returningOrders / customerOrders) * 100),
        },
        top_items: current.topItems.map((row) => ({
          dish_id: Number(row.dish_id),
          name: row.name,
          quantity: Number(row.quantity),
          revenue: Number(row.revenue),
        })),
        kitchen: {
          name: profile[COOK_PROFILES.KITCHEN_NAME],
          is_open: Boolean(profile[COOK_PROFILES.IS_KITCHEN_OPEN]),
          available_dishes: Number(dishCounts.available_dishes),
          total_dishes: Number(dishCounts.total_dishes),
        },
        rating: {
          value: Number(profile[COOK_PROFILES.RATING]),
          count: Number(profile[COOK_PROFILES.TOTAL_REVIEWS]),
        },
      },
    });
  } catch (error) {
    console.error("Error fetching cook insights:", error);
    res.status(500).json({
      success: false,
      message: error?.sqlMessage || error?.message || "Internal server error",
    });
  }
};

// ---------------------- ANALYTICS ----------------------

const DAY_MS = 24 * 60 * 60 * 1000;

/// `daily` only holds the days that sold something, so the gaps are filled in
/// — a chart with holes in it reads as missing data rather than a quiet week.
const fillDays = (rows, days) => {
  const byDay = new Map(
    rows.map((row) => [
      iso(new Date(row.day)),
      { quantity: Number(row.quantity), revenue: Number(row.revenue) },
    ])
  );
  const today = new Date();
  const series = [];
  for (let i = days - 1; i >= 0; i--) {
    const date = iso(new Date(today.getTime() - i * DAY_MS));
    const hit = byDay.get(date);
    series.push({
      date,
      quantity: hit?.quantity ?? 0,
      revenue: hit?.revenue ?? 0,
    });
  }
  return series;
};

const sum = (series, key) => series.reduce((total, d) => total + d[key], 0);

const getDishAnalytics = async (req, res) => {
  try {
    const { id } = req.params;
    const dish = await dishModel.getById(id);
    if (!dish || dish[DISHES.COOK_ID] !== req.user.id) {
      return res.status(404).json({ success: false, message: "Dish not found" });
    }

    const { totals, daily, rank, menu } = await dishModel.analyticsForDish(
      id,
      req.user.id
    );

    const series = fillDays(daily, 30);
    const last7 = series.slice(-7);
    const previous7 = series.slice(-14, -7);

    const quantity = Number(totals.quantity);
    const revenue = Number(totals.revenue);
    const orders = Number(totals.orders);
    const menuRevenue = Number(menu.revenue);
    const soldLast7 = sum(last7, "quantity");
    const soldPrevious7 = sum(previous7, "quantity");

    res.status(200).json({
      success: true,
      data: {
        dish_id: Number(id),
        name: dish[DISHES.NAME],
        image: dish[DISHES.IMAGE],
        is_available: Boolean(dish[DISHES.IS_AVAILABLE]),
        totals: {
          orders,
          quantity,
          revenue,
          // What the cook actually banks per order of this item.
          average_order_value: orders === 0 ? 0 : Math.round(revenue / orders),
          first_sold: totals.first_sold,
          last_sold: totals.last_sold,
        },
        last_7_days: {
          quantity: soldLast7,
          revenue: sum(last7, "revenue"),
          // Null rather than 0% when there is nothing to compare against —
          // "up 0%" after a week with no sales would be a lie.
          change_pct:
            soldPrevious7 === 0
              ? null
              : Math.round(((soldLast7 - soldPrevious7) / soldPrevious7) * 100),
        },
        last_30_days: {
          quantity: sum(series, "quantity"),
          revenue: sum(series, "revenue"),
        },
        menu: {
          rank: Number(rank.position),
          selling_dishes: Number(menu.selling_dishes),
          revenue_share_pct:
            menuRevenue === 0 ? 0 : Math.round((revenue / menuRevenue) * 100),
        },
        daily: series,
      },
    });
  } catch (error) {
    console.error("Error fetching dish analytics:", error);
    res.status(500).json({
      success: false,
      message: error?.sqlMessage || error?.message || "Internal server error",
    });
  }
};

// ---------------------- CATEGORIES ----------------------
const getDishCategories = async (req, res) => {
  try {
    const categories = await dishModel.listCategories();
    res.status(200).json({ success: true, data: categories });
  } catch (error) {
    console.error("Error fetching dish categories:", error);
    res.status(500).json({
      success: false,
      message: error?.sqlMessage || error?.message || "Internal server error",
    });
  }
};

const createDish = async (req, res) => {
  try {
    const { name, description, serves, spice_level, prep_time_minutes } =
      req.body;

    const category = await resolveCategory(req.body);
    if (!name || !category || !req.body.price) {
      return res.status(400).json({
        success: false,
        message: "Name, category and price are required",
      });
    }

    const price = Math.round(Number(req.body.price));
    if (!price || price <= 0) {
      return res
        .status(400)
        .json({ success: false, message: "Price must be greater than zero" });
    }

    const days = parseDays(req.body.available_days) ?? null;
    const slots = parseTimeSlots(req.body.availability) ?? [];
    const clash = checkAgainstKitchenHours(
      await cookProfileModel.getByUserId(req.user.id),
      { days, slots }
    );
    if (clash) return res.status(400).json({ success: false, message: clash });

    const images = collectImages(req, await cookImagePaths(req.user.id));
    if (images.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Please add at least one photo of the item",
      });
    }

    const dishId = await dishModel.createDish({
      cook_id: req.user.id,
      name,
      description,
      ...category,
      price,
      serves: `${serves ?? ""}`.trim() || null,
      spice_level: spice_level ? Number(spice_level) : 1,
      prep_time_minutes: prep_time_minutes ? Number(prep_time_minutes) : 30,
      available_days: days,
      // The first photo doubles as the cover every existing reader already uses.
      image: images[0],
    });

    await dishModel.replaceImages(dishId, images);
    await dishModel.replaceVariations(dishId, parseVariations(req.body.variations) ?? []);
    await dishModel.replaceAvailability(dishId, slots);
    await dishModel.replaceContents(dishId, parseContents(req.body.contents) ?? []);

    const dish = await dishModel.getById(dishId);
    res.status(201).json({ success: true, data: dish });
  } catch (error) {
    console.error("Error creating dish:", error);
    res.status(500).json({
      success: false,
      message: error?.sqlMessage || error?.message || "Internal server error",
    });
  }
};

const updateDish = async (req, res) => {
  try {
    const { id } = req.params;

    const dish = await dishModel.getById(id);
    if (!dish || dish[DISHES.COOK_ID] !== req.user.id) {
      return res.status(404).json({ success: false, message: "Dish not found" });
    }

    const allowedFields = [
      "name",
      "description",
      "price",
      "serves",
      "spice_level",
      "prep_time_minutes",
      "is_available",
    ];
    const dishData = {};
    for (const field of allowedFields) {
      if (req.body[field] !== undefined) dishData[field] = req.body[field];
    }

    if (req.body.category_id !== undefined || req.body.category !== undefined) {
      const category = await resolveCategory(req.body);
      if (!category) {
        return res
          .status(400)
          .json({ success: false, message: "Unknown category" });
      }
      Object.assign(dishData, category);
    }

    const days = parseDays(req.body.available_days);
    if (days !== undefined) dishData[DISHES.AVAILABLE_DAYS] = days;

    // Photos are sent as a whole set — what was kept plus what was just
    // uploaded — so the cook can reorder or drop one in the same save.
    const touchingImages =
      (req.files && req.files.length > 0) || req.body.kept_images !== undefined;
    let images = null;
    if (touchingImages) {
      images = collectImages(
        req,
        (dish.images || []).map((row) => row.image)
      );
      if (images.length === 0) {
        return res.status(400).json({
          success: false,
          message: "An item needs at least one photo",
        });
      }
      dishData.image = images[0];
    }

    const variations = parseVariations(req.body.variations);
    const slots = parseTimeSlots(req.body.availability);
    const contents = parseContents(req.body.contents);

    const clash = checkAgainstKitchenHours(
      await cookProfileModel.getByUserId(req.user.id),
      {
        // Whatever the save leaves the item with, not just what it changes.
        days: days !== undefined ? days : dish[DISHES.AVAILABLE_DAYS],
        slots:
          slots ??
          (dish.availability || []).map((row) => ({
            from: row.available_from,
            to: row.available_to,
          })),
      }
    );
    if (clash) return res.status(400).json({ success: false, message: clash });

    if (
      Object.keys(dishData).length === 0 &&
      !images &&
      !variations &&
      !slots &&
      !contents
    ) {
      return res
        .status(400)
        .json({ success: false, message: "No fields to update" });
    }

    if (Object.keys(dishData).length > 0) await dishModel.updateDish(id, dishData);
    if (images) await dishModel.replaceImages(id, images);
    if (variations) await dishModel.replaceVariations(id, variations);
    if (slots) await dishModel.replaceAvailability(id, slots);
    if (contents) await dishModel.replaceContents(id, contents);

    const updated = await dishModel.getById(id);
    res.status(200).json({ success: true, data: updated });
  } catch (error) {
    console.error("Error updating dish:", error);
    res.status(500).json({
      success: false,
      message: error?.sqlMessage || error?.message || "Internal server error",
    });
  }
};

// ---------------------- DELETE DISH ----------------------
const deleteDish = async (req, res) => {
  try {
    const { id } = req.params;

    const dish = await dishModel.getById(id);
    if (!dish || dish[DISHES.COOK_ID] !== req.user.id) {
      return res.status(404).json({ success: false, message: "Dish not found" });
    }

    await dishModel.deleteDish(id);
    res.status(200).json({ success: true, message: "Dish deleted successfully" });
  } catch (error) {
    console.error("Error deleting dish:", error);
    res.status(500).json({
      success: false,
      message: error?.sqlMessage || error?.message || "Internal server error",
    });
  }
};

// ---------------------- TOGGLE DISH AVAILABILITY ----------------------
const toggleDishAvailability = async (req, res) => {
  try {
    const { id } = req.params;

    const dish = await dishModel.getById(id);
    if (!dish || dish[DISHES.COOK_ID] !== req.user.id) {
      return res.status(404).json({ success: false, message: "Dish not found" });
    }

    await dishModel.toggleAvailability(id);
    const updated = await dishModel.getById(id);
    res.status(200).json({ success: true, data: updated });
  } catch (error) {
    console.error("Error toggling dish availability:", error);
    res.status(500).json({
      success: false,
      message: error?.sqlMessage || error?.message || "Internal server error",
    });
  }
};

// ---------------------- MY ORDERS (new | active | history) ----------------------
const getOrders = async (req, res) => {
  try {
    const { status } = req.query;
    const orders = await orderModel.listByCook(req.user.id, status);
    for (const order of orders) {
      order.items = await orderModel.getItems(order[ORDERS.ID]);
    }
    res.status(200).json({ success: true, data: orders });
  } catch (error) {
    console.error("Error fetching cook orders:", error);
    res.status(500).json({
      success: false,
      message: error?.sqlMessage || error?.message || "Internal server error",
    });
  }
};

// ---------------------- ACCEPT ORDER (new -> accepted + preparing) ----------------------
const acceptOrder = async (req, res) => {
  try {
    const { id } = req.params;

    const result = await orderModel.acceptByCook(id, req.user.id);
    if (result.affectedRows === 0) {
      return res.status(400).json({
        success: false,
        message: "Order cannot be accepted. Only new orders of your kitchen can be accepted.",
      });
    }

    const order = await orderModel.getById(id);
    await notificationModel.createNotification({
      user_id: order[ORDERS.CUSTOMER_ID],
      title: `Order #${order[ORDERS.ORDER_NUMBER]} accepted`,
      body: "Your order has been accepted and is being prepared",
      type: "order",
    });

    res.status(200).json({ success: true, data: order });
  } catch (error) {
    console.error("Error accepting order:", error);
    res.status(500).json({
      success: false,
      message: error?.sqlMessage || error?.message || "Internal server error",
    });
  }
};

// ---------------------- REJECT ORDER (new -> cancelled) ----------------------
const rejectOrder = async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;

    if (!reason) {
      return res
        .status(400)
        .json({ success: false, message: "Rejection reason is required" });
    }

    const result = await orderModel.rejectByCook(id, req.user.id, reason);
    if (result.affectedRows === 0) {
      return res.status(400).json({
        success: false,
        message: "Order cannot be rejected. Only new orders of your kitchen can be rejected.",
      });
    }

    const order = await orderModel.getById(id);
    await notificationModel.createNotification({
      user_id: order[ORDERS.CUSTOMER_ID],
      title: `Order #${order[ORDERS.ORDER_NUMBER]} cancelled`,
      body: `Your order was cancelled by the cook: ${reason}`,
      type: "order",
    });

    res.status(200).json({ success: true, data: order });
  } catch (error) {
    console.error("Error rejecting order:", error);
    res.status(500).json({
      success: false,
      message: error?.sqlMessage || error?.message || "Internal server error",
    });
  }
};

// ---------------------- MARK READY (preparing -> ready) ----------------------
const readyOrder = async (req, res) => {
  try {
    const { id } = req.params;

    const result = await orderModel.markReadyByCook(id, req.user.id);
    if (result.affectedRows === 0) {
      return res.status(400).json({
        success: false,
        message: "Order cannot be marked ready. Only preparing orders of your kitchen can be marked ready.",
      });
    }

    const order = await orderModel.getById(id);
    await notificationModel.createNotification({
      user_id: order[ORDERS.CUSTOMER_ID],
      title: `Order #${order[ORDERS.ORDER_NUMBER]} is ready`,
      body: "Your order is ready and waiting for a rider",
      type: "order",
    });

    res.status(200).json({ success: true, data: order });
  } catch (error) {
    console.error("Error marking order ready:", error);
    res.status(500).json({
      success: false,
      message: error?.sqlMessage || error?.message || "Internal server error",
    });
  }
};

// ---------------------- EARNINGS ----------------------
const getEarnings = async (req, res) => {
  try {
    const settings = await settingsModel.getSettings();
    const commissionPct = Number(settings.commission_pct);

    const [today, week, month, allTime] = [
      await orderModel.cookEarnings(req.user.id, commissionPct, "today"),
      await orderModel.cookEarnings(req.user.id, commissionPct, "week"),
      await orderModel.cookEarnings(req.user.id, commissionPct, "month"),
      await orderModel.cookEarnings(req.user.id, commissionPct, "all"),
    ];

    const payouts = await settlementModel.cookPayoutHistory(req.user.id);
    const owed = await settlementModel.cookOwedSummary(req.user.id, commissionPct);

    res.status(200).json({
      success: true,
      data: {
        commission_pct: commissionPct,
        today,
        week,
        month,
        all_time: allTime,
        outstanding: Number(owed.earned) - Number(owed.total_paid),
        payouts,
      },
    });
  } catch (error) {
    console.error("Error fetching cook earnings:", error);
    res.status(500).json({
      success: false,
      message: error?.sqlMessage || error?.message || "Internal server error",
    });
  }
};

// ---------------------- BANK ACCOUNTS ----------------------
// Cooks are paid out weekly by bank transfer, so they supply the account.
// (Riders never do — they hand cash in to the platform account instead.)

const fail = (res, code, message) =>
  res.status(code).json({ success: false, message });

const sanitizeAccount = (body) => ({
  bank_name: (body.bank_name || "").trim(),
  account_title: (body.account_title || "").trim(),
  account_number: (body.account_number || "").trim(),
  iban: (body.iban || "").trim().toUpperCase() || null,
  branch: (body.branch || "").trim() || null,
});

const getBankAccounts = async (req, res) => {
  try {
    const accounts = await cookBankAccountModel.listByCook(req.user.id);
    // The limit travels with the list so the app can say so before the cook
    // fills in a form it would then reject.
    res.status(200).json({
      success: true,
      data: accounts,
      meta: { max_accounts: MAX_BANK_ACCOUNTS },
    });
  } catch (error) {
    console.error("Error fetching bank accounts:", error);
    res.status(500).json({
      success: false,
      message: error?.sqlMessage || error?.message || "Internal server error",
    });
  }
};

/// Payout accounts stop being self-service: the cook asks, an admin applies.
/// The account money is sent to is exactly what an attacker who got into the
/// account would want to swap, and a cook cannot undo a wrong payout.
const REQUEST_TYPES = ["add", "update", "remove"];

/// Two is enough for a working account and a spare. More accounts means more
/// places a payout can be misdirected to, for no benefit to the cook.
const MAX_BANK_ACCOUNTS = 2;

const getBankRequests = async (req, res) => {
  try {
    const requests = await cookBankRequestModel.listByCook(req.user.id);
    res.status(200).json({ success: true, data: requests });
  } catch (error) {
    console.error("Error fetching bank requests:", error);
    res.status(500).json({
      success: false,
      message: error?.sqlMessage || error?.message || "Internal server error",
    });
  }
};

const createBankRequest = async (req, res) => {
  try {
    const type = `${req.body.type ?? ""}`.trim();
    if (!REQUEST_TYPES.includes(type)) {
      return fail(res, 400, `type must be one of: ${REQUEST_TYPES.join(", ")}`);
    }

    // One open request at a time, so two changes cannot race each other.
    const open = await cookBankRequestModel.pendingForCook(req.user.id);
    if (open) {
      return fail(
        res,
        409,
        "You already have a request waiting for review. Cancel it first to send another."
      );
    }

    const data = {
      [BANK_REQUESTS.COOK_ID]: req.user.id,
      [BANK_REQUESTS.TYPE]: type,
      [BANK_REQUESTS.COOK_NOTE]: `${req.body.note ?? ""}`.trim() || null,
    };

    if (type === "add") {
      const held = await cookBankAccountModel.countForCook(req.user.id);
      if (held >= MAX_BANK_ACCOUNTS) {
        return fail(
          res,
          400,
          `You can keep up to ${MAX_BANK_ACCOUNTS} payout accounts. Ask us to remove one first.`
        );
      }

      const account = sanitizeAccount(req.body);
      if (!account.bank_name || !account.account_title || !account.account_number) {
        return fail(res, 400, "Bank name, account title and account number are required");
      }
      if (!req.file) {
        return fail(
          res,
          400,
          "Please attach a photo of your cheque book or bank statement"
        );
      }
      Object.assign(data, account, {
        [BANK_REQUESTS.PROOF_IMAGE]: `/uploads/${req.file.filename}`,
        [BANK_REQUESTS.MAKE_DEFAULT]: req.body.make_default === "true" ||
          req.body.make_default === true ? 1 : 0,
      });
    } else {
      const accountId = Number(req.body.account_id);
      const account = await cookBankAccountModel.getById(accountId);
      if (!account || account[BANK_ACCOUNTS.COOK_ID] !== req.user.id) {
        return fail(res, 404, "Bank account not found");
      }
      data[BANK_REQUESTS.ACCOUNT_ID] = accountId;

      if (type === "update") {
        const proposed = sanitizeAccount(req.body);
        if (!proposed.bank_name || !proposed.account_title || !proposed.account_number) {
          return fail(res, 400, "Bank name, account title and account number are required");
        }
        if (!req.file) {
          return fail(
            res,
            400,
            "Please attach a photo of your cheque book or bank statement"
          );
        }
        Object.assign(data, proposed, {
          [BANK_REQUESTS.PROOF_IMAGE]: `/uploads/${req.file.filename}`,
          [BANK_REQUESTS.MAKE_DEFAULT]: req.body.make_default === "true" ||
            req.body.make_default === true ? 1 : 0,
        });
      }

      if (type === "remove") {
        const total = await cookBankAccountModel.countForCook(req.user.id);
        if (total <= 1) {
          return fail(
            res,
            400,
            "This is your only payout account. Add another one before removing it."
          );
        }
      }
    }

    const id = await cookBankRequestModel.createRequest(data);

    await notificationModel.createNotification({
      user_id: req.user.id,
      title: "Request sent",
      body: "We will review your payout account request and let you know.",
      type: "account",
    });

    res.status(201).json({
      success: true,
      message: "Request sent for review",
      data: await cookBankRequestModel.getById(id),
    });
  } catch (error) {
    console.error("Error creating bank request:", error);
    res.status(500).json({
      success: false,
      message: error?.sqlMessage || error?.message || "Internal server error",
    });
  }
};

/// A cook may take back a request an admin has not decided on yet.
const cancelBankRequest = async (req, res) => {
  try {
    const request = await cookBankRequestModel.getById(req.params.id);
    if (!request || request[BANK_REQUESTS.COOK_ID] !== req.user.id) {
      return fail(res, 404, "Request not found");
    }
    if (request[BANK_REQUESTS.STATUS] !== "pending") {
      return fail(res, 400, "That request has already been reviewed");
    }
    await cookBankRequestModel.deleteRequest(request[BANK_REQUESTS.ID], req.user.id);
    res.status(200).json({ success: true, message: "Request cancelled" });
  } catch (error) {
    console.error("Error cancelling bank request:", error);
    res.status(500).json({
      success: false,
      message: error?.sqlMessage || error?.message || "Internal server error",
    });
  }
};

module.exports = {
  getProfile,
  updateProfile,
  getDashboard,
  getInsights,
  toggleKitchen,
  getDishes,
  getDishCategories,
  getDishAnalytics,
  createDish,
  updateDish,
  deleteDish,
  toggleDishAvailability,
  getOrders,
  acceptOrder,
  rejectOrder,
  readyOrder,
  getEarnings,
  getBankAccounts,
  getBankRequests,
  createBankRequest,
  cancelBankRequest,
};
