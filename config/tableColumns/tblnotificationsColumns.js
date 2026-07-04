const NOTIFICATIONS = {
  ID: "id", // Unique identifier for each notification
  USER_ID: "user_id", // FK -> tblusers.id (receiver)
  TITLE: "title", // Notification title
  BODY: "body", // Notification body
  TYPE: "type", // order | account | system ...
  IS_READ: "is_read", // 1 = read
  CREATED_AT: "created_at", // Record creation timestamp
};

module.exports = NOTIFICATIONS;
