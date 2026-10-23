const bannerModel = require("../models/bannerModel");

const ACTIONS = ["none", "url", "cook", "dish", "search", "explore"];
const HEX = /^#[0-9a-fA-F]{6}$/;

const fail = (res, code, message) =>
  res.status(code).json({ success: false, message });

const serverError = (res, label, error) => {
  console.error(`Error ${label}:`, error);
  return res.status(500).json({
    success: false,
    message: error?.sqlMessage || error?.message || "Internal server error",
  });
};

const text = (value, max) => {
  if (value === undefined) return undefined;
  const trimmed = `${value ?? ""}`.trim();
  return trimmed ? trimmed.slice(0, max) : null;
};

const flag = (value) =>
  value === undefined
    ? undefined
    : value === true || value === 1 || value === "1" || value === "true"
      ? 1
      : 0;

const when = (value) => {
  if (value === undefined) return undefined;
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

/// The frame the admin placed on the original: fractions of its width and
/// height, so it survives the original being any size. `null` clears it,
/// `false` means it was malformed.
const parseCrop = (value) => {
  if (value === null || value === "" || value === "null") return null;
  let crop = value;
  if (typeof crop === "string") {
    try {
      crop = JSON.parse(crop);
    } catch {
      return false;
    }
  }
  const keys = ["x", "y", "width", "height"];
  if (!crop || typeof crop !== "object") return false;
  const out = {};
  for (const key of keys) {
    const n = Number(crop[key]);
    if (!Number.isFinite(n) || n < 0 || n > 1) return false;
    out[key] = Math.round(n * 10000) / 10000;
  }
  if (out.width <= 0 || out.height <= 0) return false;
  // A frame hanging off the edge would show empty space.
  if (out.x + out.width > 1.0001 || out.y + out.height > 1.0001) return false;
  return out;
};

/// Validates and normalises whatever the admin form sent. Multipart sends
/// everything as strings, so each field is coerced here once.
const parseBanner = (body, file, existing) => {
  const data = {
    eyebrow: text(body.eyebrow, 40),
    title: text(body.title, 80),
    subtitle: text(body.subtitle, 140),
    cta_label: text(body.cta_label, 30),
    action_value: text(body.action_value, 500),
    image_overlay: flag(body.image_overlay),
    is_active: flag(body.is_active),
    starts_at: when(body.starts_at),
    ends_at: when(body.ends_at),
  };

  if (body.action_type !== undefined) {
    if (!ACTIONS.includes(body.action_type)) {
      return { error: `action_type must be one of: ${ACTIONS.join(", ")}` };
    }
    data.action_type = body.action_type;
  }

  for (const key of ["background_color", "text_color"]) {
    if (body[key] === undefined) continue;
    if (!HEX.test(`${body[key]}`)) return { error: `${key} must be like #C8762A` };
    data[key] = `${body[key]}`.toUpperCase();
  }

  // `file` is multer's `req.files`: the cropped image customers see and,
  // optionally, the full original it was cut from.
  const cropped = file?.image?.[0];
  const original = file?.image_original?.[0];
  if (cropped) data.image = `/uploads/${cropped.filename}`;
  if (original) data.image_original = `/uploads/${original.filename}`;

  if (body.image_crop !== undefined) {
    const crop = parseCrop(body.image_crop);
    if (crop === false) return { error: "image_crop must be { x, y, width, height } between 0 and 1" };
    data.image_crop = crop === null ? null : JSON.stringify(crop);
  }

  if (!cropped && (body.remove_image === "true" || body.remove_image === true)) {
    data.image = null;
    data.image_original = null;
    data.image_crop = null;
  }

  // Judge the banner as it will end up, not just the fields in this request.
  const merged = { ...existing, ...Object.fromEntries(
    Object.entries(data).filter(([, v]) => v !== undefined)) };

  if (!merged.image && !merged.title) {
    return { error: "A banner needs a title, an image, or both" };
  }
  const action = merged.action_type || "none";
  if (["url", "cook", "dish", "search"].includes(action) && !merged.action_value) {
    return { error: `Say where "${action}" should go` };
  }
  if (action === "url" && !/^https?:\/\//i.test(merged.action_value)) {
    return { error: "Links must start with http:// or https://" };
  }
  if (["cook", "dish"].includes(action) && !/^\d+$/.test(`${merged.action_value}`)) {
    return { error: `Use the ${action}'s id number` };
  }
  if (merged.starts_at && merged.ends_at &&
      new Date(merged.ends_at) <= new Date(merged.starts_at)) {
    return { error: "The end date must be after the start date" };
  }

  return {
    data: Object.fromEntries(Object.entries(data).filter(([, v]) => v !== undefined)),
  };
};

// ---------------------- CUSTOMER ----------------------

const getLiveBanners = async (req, res) => {
  try {
    res.status(200).json({ success: true, data: await bannerModel.listLive() });
  } catch (error) {
    return serverError(res, "fetching banners", error);
  }
};

// ---------------------- ADMIN ----------------------

const listBanners = async (req, res) => {
  try {
    res.status(200).json({ success: true, data: await bannerModel.listAll() });
  } catch (error) {
    return serverError(res, "listing banners", error);
  }
};

const createBanner = async (req, res) => {
  try {
    const parsed = parseBanner(req.body, req.files, {});
    if (parsed.error) return fail(res, 400, parsed.error);
    const id = await bannerModel.create({
      sort_order: await bannerModel.nextSortOrder(),
      ...parsed.data,
    });
    res.status(201).json({ success: true, data: await bannerModel.getById(id) });
  } catch (error) {
    return serverError(res, "creating banner", error);
  }
};

const updateBanner = async (req, res) => {
  try {
    const existing = await bannerModel.getById(req.params.id);
    if (!existing) return fail(res, 404, "Banner not found");
    const parsed = parseBanner(req.body, req.files, existing);
    if (parsed.error) return fail(res, 400, parsed.error);
    await bannerModel.update(existing.id, parsed.data);
    res.status(200).json({ success: true, data: await bannerModel.getById(existing.id) });
  } catch (error) {
    return serverError(res, "updating banner", error);
  }
};

const deleteBanner = async (req, res) => {
  try {
    const existing = await bannerModel.getById(req.params.id);
    if (!existing) return fail(res, 404, "Banner not found");
    await bannerModel.remove(existing.id);
    res.status(200).json({ success: true, message: "Banner deleted" });
  } catch (error) {
    return serverError(res, "deleting banner", error);
  }
};

const reorderBanners = async (req, res) => {
  try {
    const ids = Array.isArray(req.body.ids) ? req.body.ids.map(Number) : [];
    if (!ids.length || ids.some((id) => !Number.isInteger(id))) {
      return fail(res, 400, "Send ids as an array, first to last");
    }
    await bannerModel.reorder(ids);
    res.status(200).json({ success: true, data: await bannerModel.listAll() });
  } catch (error) {
    return serverError(res, "reordering banners", error);
  }
};

module.exports = {
  getLiveBanners,
  listBanners,
  createBanner,
  updateBanner,
  deleteBanner,
  reorderBanners,
};
