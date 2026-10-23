const RIDER_PROFILES = {
  ID: "id", // Unique identifier for each rider profile
  USER_ID: "user_id", // FK -> tblusers.id
  CITY: "city", // Operating city
  VEHICLE_TYPE: "vehicle_type", // bike | car | bicycle ...
  VEHICLE_BRAND: "vehicle_brand", // Optional vehicle brand
  VEHICLE_MODEL: "vehicle_model", // Optional vehicle model
  LICENSE_PLATE: "license_plate", // Vehicle registration plate
  CNIC_NUMBER: "cnic_number", // CNIC number
  ADDRESS_LINE: "address_line", // Street address as printed on the CNIC
  ADDRESS_AREA: "address_area", // Area / sector
  ADDRESS_CITY: "address_city", // City on the CNIC
  EMERGENCY_NAME: "emergency_name", // Emergency contact full name
  EMERGENCY_RELATIONSHIP: "emergency_relationship", // Relationship to rider
  EMERGENCY_PHONE: "emergency_phone", // Emergency contact phone
  EMERGENCY_ALT_PHONE: "emergency_alt_phone", // Optional second number
  SAFETY_ACCEPTED_AT: "safety_accepted_at", // When safety guidelines were read
  CNIC_FRONT: "cnic_front", // Path to CNIC front image
  CNIC_BACK: "cnic_back", // Path to CNIC back image
  LICENSE_PHOTO: "license_photo", // Path to driving license image
  VEHICLE_PHOTO: "vehicle_photo", // Path to vehicle image
  IS_ONLINE: "is_online", // 1 = accepting deliveries
  CASH_IN_HAND: "cash_in_hand", // COD cash held by rider (Rs.)
  REJECTION_REASON: "rejection_reason", // Admin rejection reason (if rejected)
  APPROVED_AT: "approved_at", // When admin approved the rider
  CREATED_AT: "created_at", // Record creation timestamp
  UPDATED_AT: "updated_at", // Record update timestamp
};

module.exports = RIDER_PROFILES;
