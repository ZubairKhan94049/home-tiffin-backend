const pool = require("../config/db");
const TABLES = require("../config/tableNames");
const COOK = require("../config/tableColumns/tblcookprofilesColumns");
const USERS = require("../config/tableColumns/tblusersColumns");
const userModel = require("../models/userModel");
const cookProfileModel = require("../models/cookProfileModel");
const cookBankAccountModel = require("../models/cookBankAccountModel");
const BANK = require("../config/tableColumns/tblcookbankaccountsColumns");

// The cook registration wizard. Every step writes straight into the cook's
// profile row and bumps onboarding_step, so closing the app mid-way loses
// nothing — GET /cook/onboarding replays exactly where they were.

const TOTAL_STEPS = 5;

const fail = (res, code, message) =>
  res.status(code).json({ success: false, message });

const missing = (body, fields) =>
  fields.filter((f) => `${body[f] ?? ""}`.trim().length === 0);

// ---------------------------------------------------------------------------
// Legal documents
// ---------------------------------------------------------------------------

/// The privacy policy, terms and partner agreement, held as editable text in
/// settings so a correction does not need an app release. Public, because the
/// apps show them before anyone has an account.
const getLegalDocuments = async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT privacy_policy, terms_conditions, partner_contract,
              legal_updated_at
         FROM ${TABLES.SETTINGS} WHERE id = 1`
    );
    const settings = rows[0] || {};
    res.status(200).json({
      success: true,
      data: {
        privacy_policy: settings.privacy_policy || null,
        terms_conditions: settings.terms_conditions || null,
        partner_contract: settings.partner_contract || null,
        updated_at: settings.legal_updated_at || null,
      },
    });
  } catch (error) {
    console.error("Error fetching legal documents:", error);
    res.status(500).json({
      success: false,
      message: error?.sqlMessage || error?.message || "Internal server error",
    });
  }
};

// ---------------------------------------------------------------------------
// Meal types (step 2 dropdown)
// ---------------------------------------------------------------------------
const getMealTypes = async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT id, name, description FROM ${TABLES.MEAL_TYPES}
       WHERE is_active = 1 ORDER BY sort_order ASC, name ASC`
    );
    res.status(200).json({ success: true, data: rows });
  } catch (error) {
    console.error("Error fetching meal types:", error);
    res.status(500).json({
      success: false,
      message: error?.sqlMessage || error?.message || "Internal server error",
    });
  }
};

// ---------------------------------------------------------------------------
// Progress
// ---------------------------------------------------------------------------

/// Everything the app needs to render the wizard or the status screen.
const buildState = (user, profile) => {
  // The account itself is step 1, and a cook profile only exists once it is
  // registered — so a cook sitting on step 2 has already completed one step.
  // Without this the wizard opened at "0% complete", which is never true.
  const step = Math.max(Number(profile?.[COOK.ONBOARDING_STEP] ?? 0), 1);
  const isComplete = Boolean(profile?.[COOK.ONBOARDING_COMPLETED_AT]);
  return {
    current_step: isComplete ? TOTAL_STEPS : Math.min(step + 1, TOTAL_STEPS),
    completed_step: step,
    total_steps: TOTAL_STEPS,
    is_complete: isComplete,
    email: user?.[USERS.EMAIL] ?? null,
    phone: user?.[USERS.PHONE] ?? null,
    email_verified: Boolean(user?.[USERS.EMAIL_VERIFIED_AT]),
    // Saved answers, so each step reopens filled in.
    data: {
      business_name: profile?.[COOK.KITCHEN_NAME] ?? null,
      meal_type_id: profile?.[COOK.MEAL_TYPE_ID] ?? null,
      street: profile?.[COOK.ADDRESS_STREET] ?? null,
      house_number: profile?.[COOK.ADDRESS_HOUSE] ?? null,
      state: profile?.[COOK.ADDRESS_STATE] ?? null,
      city: profile?.[COOK.CITY] ?? null,
      area: profile?.[COOK.AREA] ?? null,
      postal_code: profile?.[COOK.ADDRESS_POSTAL_CODE] ?? null,
      address_extra: profile?.[COOK.ADDRESS_EXTRA] ?? null,
      is_tax_registered: profile?.[COOK.IS_TAX_REGISTERED],
      sales_tax_number: profile?.[COOK.SALES_TAX_NUMBER] ?? null,
      menu_price_includes_tax: profile?.[COOK.MENU_PRICE_INCLUDES_TAX],
      cnic_number: profile?.[COOK.CNIC_NUMBER] ?? null,
      account_holder_name: profile?.[COOK.BANK_ACCOUNT_HOLDER] ?? null,
      bank_name: profile?.[COOK.BANK_NAME] ?? null,
      iban: profile?.[COOK.BANK_IBAN] ?? null,
      billing_same_as_business: Boolean(
        profile?.[COOK.BILLING_SAME_AS_BUSINESS]
      ),
      billing_street: profile?.[COOK.BILLING_STREET] ?? null,
      billing_house: profile?.[COOK.BILLING_HOUSE] ?? null,
      billing_state: profile?.[COOK.BILLING_STATE] ?? null,
      billing_city: profile?.[COOK.BILLING_CITY] ?? null,
      billing_area: profile?.[COOK.BILLING_AREA] ?? null,
      billing_postal_code: profile?.[COOK.BILLING_POSTAL_CODE] ?? null,
      billing_extra: profile?.[COOK.BILLING_EXTRA] ?? null,
    },
    documents: {
      cnic_front: profile?.[COOK.CNIC_FRONT] || null,
      cnic_back: profile?.[COOK.CNIC_BACK] || null,
      bank_proof: profile?.[COOK.BANK_PROOF] || null,
      menu_picture: profile?.[COOK.MENU_PICTURE] || null,
    },
    // The four rows on the post-submission status screen.
    status: {
      contract: profile?.[COOK.CONTRACT_STATUS] ?? "pending",
      documents: profile?.[COOK.DOCUMENTS_STATUS] ?? "pending",
      profile: profile?.[COOK.PROFILE_STATUS] ?? "locked",
      activation: profile?.[COOK.ACTIVATION_STATUS] ?? "locked",
      // Why the admin sent the documents back, so the cook knows what to fix
      // instead of guessing which of the four uploads was unclear.
      note: profile?.[COOK.REJECTION_REASON] ?? null,
    },
  };
};

const getOnboarding = async (req, res) => {
  try {
    const user = await userModel.getUserById(req.user.id);
    const profile = await cookProfileModel.getByUserId(req.user.id);
    if (!profile) return fail(res, 404, "Cook profile not found");
    res.status(200).json({ success: true, data: buildState(user, profile) });
  } catch (error) {
    console.error("Error fetching onboarding state:", error);
    res.status(500).json({
      success: false,
      message: error?.sqlMessage || error?.message || "Internal server error",
    });
  }
};

// ---------------------------------------------------------------------------
// Saving one step
// ---------------------------------------------------------------------------

/// Maps a step number to the columns it writes and the fields it requires.
const stepHandlers = {
  2: (body) => {
    const required = ["business_name", "meal_type_id", "street",
      "house_number", "state", "city", "area", "postal_code"];
    const gaps = missing(body, required);
    if (gaps.length) return { error: `Missing: ${gaps.join(", ")}` };
    return {
      data: {
        [COOK.KITCHEN_NAME]: body.business_name.trim(),
        [COOK.MEAL_TYPE_ID]: body.meal_type_id,
        [COOK.ADDRESS_STREET]: body.street.trim(),
        [COOK.ADDRESS_HOUSE]: body.house_number.trim(),
        [COOK.ADDRESS_STATE]: body.state.trim(),
        [COOK.CITY]: body.city.trim(),
        [COOK.AREA]: body.area.trim(),
        [COOK.ADDRESS_POSTAL_CODE]: body.postal_code.trim(),
        [COOK.ADDRESS_EXTRA]: (body.address_extra || "").trim() || null,
      },
    };
  },

  3: (body) => {
    const registered = body.is_tax_registered === true ||
      body.is_tax_registered === 1 || body.is_tax_registered === "true";

    if (registered) {
      const gaps = missing(body, ["sales_tax_number"]);
      if (gaps.length) return { error: "Sales tax registration number is required" };
      if (body.menu_price_includes_tax === undefined ||
          body.menu_price_includes_tax === null) {
        return { error: "Tell us whether menu prices include tax" };
      }
      return {
        data: {
          [COOK.IS_TAX_REGISTERED]: 1,
          [COOK.SALES_TAX_NUMBER]: `${body.sales_tax_number}`.trim(),
          [COOK.MENU_PRICE_INCLUDES_TAX]:
            body.menu_price_includes_tax === true ||
            body.menu_price_includes_tax === 1 ? 1 : 0,
          [COOK.CNIC_NUMBER]: null,
        },
      };
    }

    const cnic = `${body.cnic_number ?? ""}`.trim();
    if (!/^\d{5}-\d{7}-\d$/.test(cnic)) {
      return { error: "Enter a valid CNIC (12345-1234567-1)" };
    }
    return {
      data: {
        [COOK.IS_TAX_REGISTERED]: 0,
        [COOK.SALES_TAX_NUMBER]: null,
        [COOK.MENU_PRICE_INCLUDES_TAX]: null,
        [COOK.CNIC_NUMBER]: cnic,
      },
    };
  },

  4: (body) => {
    const gaps = missing(body, ["account_holder_name", "bank_name", "iban"]);
    if (gaps.length) return { error: `Missing: ${gaps.join(", ")}` };

    const sameAddress = body.billing_same_as_business !== false;
    const data = {
      [COOK.BANK_ACCOUNT_HOLDER]: body.account_holder_name.trim(),
      [COOK.BANK_NAME]: body.bank_name.trim(),
      [COOK.BANK_IBAN]: `${body.iban}`.replace(/\s/g, "").toUpperCase(),
      [COOK.BILLING_SAME_AS_BUSINESS]: sameAddress ? 1 : 0,
    };

    if (sameAddress) {
      // Clear any separate billing address they entered before ticking the box.
      Object.assign(data, {
        [COOK.BILLING_STREET]: null,
        [COOK.BILLING_HOUSE]: null,
        [COOK.BILLING_STATE]: null,
        [COOK.BILLING_CITY]: null,
        [COOK.BILLING_AREA]: null,
        [COOK.BILLING_POSTAL_CODE]: null,
        [COOK.BILLING_EXTRA]: null,
      });
      return { data };
    }

    const billingRequired = ["billing_street", "billing_house",
      "billing_state", "billing_city", "billing_area", "billing_postal_code"];
    const billingGaps = missing(body, billingRequired);
    if (billingGaps.length) {
      return { error: `Missing billing address: ${billingGaps.join(", ")}` };
    }
    Object.assign(data, {
      [COOK.BILLING_STREET]: body.billing_street.trim(),
      [COOK.BILLING_HOUSE]: body.billing_house.trim(),
      [COOK.BILLING_STATE]: body.billing_state.trim(),
      [COOK.BILLING_CITY]: body.billing_city.trim(),
      [COOK.BILLING_AREA]: body.billing_area.trim(),
      [COOK.BILLING_POSTAL_CODE]: body.billing_postal_code.trim(),
      [COOK.BILLING_EXTRA]: (body.billing_extra || "").trim() || null,
    });
    return { data };
  },
};

/// Step 4 collects bank details, but the payout account the cook (and the
/// admin) actually sees lives in its own table. Without this the details are
/// typed during registration and the Bank Accounts screen stays empty.
///
/// Matched on IBAN so re-saving the step corrects the same account rather
/// than piling up duplicates. Once the cook has added accounts of their own,
/// that screen owns the list and this stops interfering.
const syncPayoutAccount = async (cookId, profile) => {
  const iban = `${profile[COOK.BANK_IBAN] ?? ""}`.trim();
  const holder = `${profile[COOK.BANK_ACCOUNT_HOLDER] ?? ""}`.trim();
  const bank = `${profile[COOK.BANK_NAME] ?? ""}`.trim();
  if (!iban || !holder || !bank) return;

  const existing = await cookBankAccountModel.listByCook(cookId);
  const match = existing.find(
    (row) => `${row[BANK.IBAN] ?? ""}`.trim().toUpperCase() === iban.toUpperCase()
  );

  if (match) {
    await cookBankAccountModel.updateAccount(match[BANK.ID], cookId, {
      [BANK.BANK_NAME]: bank,
      [BANK.ACCOUNT_TITLE]: holder,
    });
    return;
  }
  if (existing.length > 0) return;

  await cookBankAccountModel.createAccount({
    cook_id: cookId,
    bank_name: bank,
    account_title: holder,
    // Registration only asks for an IBAN, which is the account number here.
    account_number: iban,
    iban,
    is_default: 1,
  });
};

const saveStep = async (req, res) => {
  try {
    const step = Number(req.params.step);
    if (!stepHandlers[step]) {
      return fail(res, 400, `Step ${req.params.step} is not a savable step`);
    }

    const profile = await cookProfileModel.getByUserId(req.user.id);
    if (!profile) return fail(res, 404, "Cook profile not found");

    const result = stepHandlers[step](req.body || {});
    if (result.error) return fail(res, 400, result.error);

    // Never move the marker backwards — editing step 2 after reaching 4
    // shouldn't throw away steps 3 and 4.
    const reached = Math.max(Number(profile[COOK.ONBOARDING_STEP] || 0), step);
    await cookProfileModel.updateByUserId(req.user.id, {
      ...result.data,
      [COOK.ONBOARDING_STEP]: reached,
    });

    const updated = await cookProfileModel.getByUserId(req.user.id);
    if (step === 4) await syncPayoutAccount(req.user.id, updated);

    const user = await userModel.getUserById(req.user.id);
    res.status(200).json({
      success: true,
      message: `Step ${step} saved`,
      data: buildState(user, updated),
    });
  } catch (error) {
    console.error("Error saving onboarding step:", error);
    res.status(500).json({
      success: false,
      message: error?.sqlMessage || error?.message || "Internal server error",
    });
  }
};

// ---------------------------------------------------------------------------
// Step 5 — documents, then submit
// ---------------------------------------------------------------------------

const DOCUMENT_FIELDS = {
  cnic_front: COOK.CNIC_FRONT,
  cnic_back: COOK.CNIC_BACK,
  bank_proof: COOK.BANK_PROOF,
  menu_picture: COOK.MENU_PICTURE,
};

const uploadDocuments = async (req, res) => {
  try {
    const profile = await cookProfileModel.getByUserId(req.user.id);
    if (!profile) return fail(res, 404, "Cook profile not found");

    const data = {};
    for (const [field, column] of Object.entries(DOCUMENT_FIELDS)) {
      const file = req.files?.[field]?.[0];
      if (file) data[column] = file.filename;
    }
    if (!Object.keys(data).length) {
      return fail(res, 400, "No documents were uploaded");
    }

    await cookProfileModel.updateByUserId(req.user.id, data);
    const updated = await cookProfileModel.getByUserId(req.user.id);
    const user = await userModel.getUserById(req.user.id);
    res.status(200).json({
      success: true,
      message: "Documents uploaded",
      data: buildState(user, updated),
    });
  } catch (error) {
    console.error("Error uploading onboarding documents:", error);
    res.status(500).json({
      success: false,
      message: error?.sqlMessage || error?.message || "Internal server error",
    });
  }
};

/// Finishes the wizard: all four documents present, then the cook moves to the
/// status screen and the admin takes over.
const submitOnboarding = async (req, res) => {
  try {
    const profile = await cookProfileModel.getByUserId(req.user.id);
    if (!profile) return fail(res, 404, "Cook profile not found");

    if (Number(profile[COOK.ONBOARDING_STEP] || 0) < 4) {
      return fail(res, 400, "Complete the earlier steps first");
    }

    const missingDocs = Object.entries(DOCUMENT_FIELDS)
      .filter(([, column]) => !profile[column])
      .map(([field]) => field);
    if (missingDocs.length) {
      return fail(res, 400, `Still needed: ${missingDocs.join(", ")}`);
    }

    // The contract email goes out on submission, so row 1 of the status
    // screen is already truthful when the cook first sees it. The admin still
    // moves it to "completed" once it comes back signed.
    await cookProfileModel.updateByUserId(req.user.id, {
      [COOK.ONBOARDING_STEP]: TOTAL_STEPS,
      [COOK.ONBOARDING_COMPLETED_AT]: new Date(),
      [COOK.DOCUMENTS_STATUS]: "under_review",
      // Only on the first submission — a re-upload after a rejection must not
      // drag an already-signed contract back to "sent".
      ...(profile[COOK.CONTRACT_STATUS] === "pending"
        ? { [COOK.CONTRACT_STATUS]: "sent" }
        : {}),
    });

    const user = await userModel.getUserById(req.user.id);
    const updated = await cookProfileModel.getByUserId(req.user.id);
    res.status(200).json({
      success: true,
      message: "Registration submitted",
      data: buildState(user, updated),
    });
  } catch (error) {
    console.error("Error submitting onboarding:", error);
    res.status(500).json({
      success: false,
      message: error?.sqlMessage || error?.message || "Internal server error",
    });
  }
};

module.exports = {
  getMealTypes,
  getLegalDocuments,
  getOnboarding,
  saveStep,
  uploadDocuments,
  submitOnboarding,
  buildState,
  TOTAL_STEPS,
};
