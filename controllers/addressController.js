const addressModel = require("../models/addressModel");
const COLUMNS = require("../config/tableColumns/tbladdressesColumns");

// ---------------------- LIST MY ADDRESSES ----------------------
const getAddresses = async (req, res) => {
  try {
    const addresses = await addressModel.listByUser(req.user.id);
    res.status(200).json({ success: true, data: addresses });
  } catch (error) {
    console.error("Error fetching addresses:", error);
    res.status(500).json({
      success: false,
      message: error?.sqlMessage || error?.message || "Internal server error",
    });
  }
};

// ---------------------- CREATE ADDRESS ----------------------
const createAddress = async (req, res) => {
  try {
    const {
      type,
      label,
      full_name,
      phone,
      address,
      area,
      city,
      latitude,
      longitude,
      delivery_instructions,
      is_default,
    } = req.body;

    if (!full_name || !phone || !address || !area || !city) {
      return res.status(400).json({
        success: false,
        message: "Full name, phone, address, area and city are required",
      });
    }

    // First address becomes default automatically
    const existing = await addressModel.listByUser(req.user.id);
    const makeDefault = is_default || existing.length === 0;

    if (makeDefault) {
      await addressModel.unsetDefaults(req.user.id);
    }

    const addressId = await addressModel.createAddress({
      user_id: req.user.id,
      type,
      label,
      full_name,
      phone,
      address,
      area,
      city,
      latitude,
      longitude,
      delivery_instructions,
      is_default: makeDefault ? 1 : 0,
    });

    const created = await addressModel.getById(addressId);
    res.status(201).json({ success: true, data: created });
  } catch (error) {
    console.error("Error creating address:", error);
    res.status(500).json({
      success: false,
      message: error?.sqlMessage || error?.message || "Internal server error",
    });
  }
};

// ---------------------- UPDATE ADDRESS ----------------------
const updateAddress = async (req, res) => {
  try {
    const { id } = req.params;

    const existing = await addressModel.getById(id);
    if (!existing || existing[COLUMNS.USER_ID] !== req.user.id) {
      return res
        .status(404)
        .json({ success: false, message: "Address not found" });
    }

    const allowedFields = [
      "type",
      "label",
      "full_name",
      "phone",
      "address",
      "area",
      "city",
      "latitude",
      "longitude",
      "delivery_instructions",
    ];
    const addressData = {};
    for (const field of allowedFields) {
      if (req.body[field] !== undefined) addressData[field] = req.body[field];
    }

    if (Object.keys(addressData).length === 0) {
      return res
        .status(400)
        .json({ success: false, message: "No fields to update" });
    }

    await addressModel.updateAddress(id, addressData);
    const updated = await addressModel.getById(id);
    res.status(200).json({ success: true, data: updated });
  } catch (error) {
    console.error("Error updating address:", error);
    res.status(500).json({
      success: false,
      message: error?.sqlMessage || error?.message || "Internal server error",
    });
  }
};

// ---------------------- DELETE ADDRESS ----------------------
const deleteAddress = async (req, res) => {
  try {
    const { id } = req.params;

    const existing = await addressModel.getById(id);
    if (!existing || existing[COLUMNS.USER_ID] !== req.user.id) {
      return res
        .status(404)
        .json({ success: false, message: "Address not found" });
    }

    await addressModel.deleteAddress(id);
    res
      .status(200)
      .json({ success: true, message: "Address deleted successfully" });
  } catch (error) {
    console.error("Error deleting address:", error);
    res.status(500).json({
      success: false,
      message: error?.sqlMessage || error?.message || "Internal server error",
    });
  }
};

// ---------------------- SET DEFAULT ADDRESS ----------------------
const setDefaultAddress = async (req, res) => {
  try {
    const { id } = req.params;

    const existing = await addressModel.getById(id);
    if (!existing || existing[COLUMNS.USER_ID] !== req.user.id) {
      return res
        .status(404)
        .json({ success: false, message: "Address not found" });
    }

    await addressModel.unsetDefaults(req.user.id);
    await addressModel.setDefault(id);
    res
      .status(200)
      .json({ success: true, message: "Default address updated" });
  } catch (error) {
    console.error("Error setting default address:", error);
    res.status(500).json({
      success: false,
      message: error?.sqlMessage || error?.message || "Internal server error",
    });
  }
};

module.exports = {
  getAddresses,
  createAddress,
  updateAddress,
  deleteAddress,
  setDefaultAddress,
};
