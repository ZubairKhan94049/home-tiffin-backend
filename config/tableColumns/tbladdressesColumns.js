const ADDRESSES = {
  ID: "id", // Unique identifier for each address
  USER_ID: "user_id", // FK -> tblusers.id (owner)
  TYPE: "type", // home | work | other
  LABEL: "label", // Short label ("Home", "Office" ...)
  FULL_NAME: "full_name", // Receiver full name
  PHONE: "phone", // Receiver phone
  ADDRESS: "address", // Street address line
  AREA: "area", // Area / sector
  CITY: "city", // City
  LATITUDE: "latitude", // Optional latitude
  LONGITUDE: "longitude", // Optional longitude
  DELIVERY_INSTRUCTIONS: "delivery_instructions", // Optional rider instructions
  IS_DEFAULT: "is_default", // 1 = default address
  CREATED_AT: "created_at", // Record creation timestamp
  UPDATED_AT: "updated_at", // Record update timestamp
};

module.exports = ADDRESSES;
