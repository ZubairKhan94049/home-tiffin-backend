/**
 * Factory middleware to verify that the authenticated user has a given role.
 * Should be used after authMiddleware.
 * Usage: router.use(roleMiddleware("admin"))
 */
const roleMiddleware = (role) => (req, res, next) => {
  // Check if user object exists (should be set by authMiddleware)
  if (!req.user) {
    return res.status(401).json({
      success: false,
      message: "Authentication required",
    });
  }

  // Check if user has the required role
  if (req.user.role !== role) {
    return res.status(403).json({
      success: false,
      message: `Access denied. ${role.charAt(0).toUpperCase() + role.slice(1)} privileges required.`,
    });
  }

  // User is authenticated and has the required role
  next();
};

module.exports = roleMiddleware;
