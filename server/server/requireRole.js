module.exports = function requireRole(roles = []) {
  return (req, res, next) => {
    // authRequired уже должен поставить req.user
    if (!req.user) return res.status(401).json({ error: "Not authenticated" });
    if (!roles.includes(req.user.role)) return res.status(403).json({ error: "Forbidden" });
    next();
  };
};
