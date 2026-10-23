const RIDER_PROFILES = require("../config/tableColumns/tblriderprofilesColumns");
const USERS = require("../config/tableColumns/tblusersColumns");

// A rider may not go online or accept deliveries until every section below is
// filled in. Keep this the single definition — the toggle, the order-accept
// guard and the app's checklist all read from it, so they can never disagree.

const filled = (value) => `${value ?? ""}`.trim().length > 0;

const SECTIONS = [
  {
    key: "personal",
    label: "Personal information",
    hint: "Your name, phone, CNIC and city",
    isComplete: (profile, user) =>
      filled(user?.[USERS.NAME]) &&
      filled(user?.[USERS.PHONE]) &&
      filled(profile?.[RIDER_PROFILES.CNIC_NUMBER]) &&
      filled(profile?.[RIDER_PROFILES.CITY]),
  },
  {
    key: "vehicle",
    label: "Vehicle information",
    hint: "Vehicle, plate, CNIC photos and licence",
    isComplete: (profile) =>
      filled(profile?.[RIDER_PROFILES.VEHICLE_TYPE]) &&
      filled(profile?.[RIDER_PROFILES.LICENSE_PLATE]) &&
      filled(profile?.[RIDER_PROFILES.CNIC_FRONT]) &&
      filled(profile?.[RIDER_PROFILES.CNIC_BACK]) &&
      filled(profile?.[RIDER_PROFILES.LICENSE_PHOTO]),
  },
  {
    key: "address",
    label: "Address",
    hint: "The address printed on your CNIC",
    isComplete: (profile) =>
      filled(profile?.[RIDER_PROFILES.ADDRESS_LINE]) &&
      filled(profile?.[RIDER_PROFILES.ADDRESS_AREA]) &&
      filled(profile?.[RIDER_PROFILES.ADDRESS_CITY]),
  },
  {
    key: "emergency",
    label: "Emergency contact",
    hint: "Who we call if something happens on shift",
    isComplete: (profile) =>
      filled(profile?.[RIDER_PROFILES.EMERGENCY_NAME]) &&
      filled(profile?.[RIDER_PROFILES.EMERGENCY_RELATIONSHIP]) &&
      filled(profile?.[RIDER_PROFILES.EMERGENCY_PHONE]),
  },
  {
    key: "safety",
    label: "Safety guidelines",
    hint: "Read and accept the safety guidelines",
    isComplete: (profile) =>
      Boolean(profile?.[RIDER_PROFILES.SAFETY_ACCEPTED_AT]),
  },
];

/// Returns { percent, is_complete, sections: [...], missing: [labels] }.
const riderProfileCompletion = (profile, user) => {
  const sections = SECTIONS.map((section) => ({
    key: section.key,
    label: section.label,
    hint: section.hint,
    is_complete: Boolean(section.isComplete(profile, user)),
  }));

  const done = sections.filter((s) => s.is_complete).length;
  return {
    percent: Math.round((done / sections.length) * 100),
    is_complete: done === sections.length,
    completed_sections: done,
    total_sections: sections.length,
    sections,
    missing: sections.filter((s) => !s.is_complete).map((s) => s.label),
  };
};

module.exports = { riderProfileCompletion };
