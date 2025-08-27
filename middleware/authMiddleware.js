const jwt = require("jsonwebtoken");
const User = require("../models/User");

// Protect middleware: checks token & attaches user
const protect = async (req, res, next) => {
  if (
    !req.headers.authorization ||
    !req.headers.authorization.startsWith("Bearer")
  ) {
    return res.status(401).json({ error: "Not authorized, no token" });
  }

  try {
    const token = req.headers.authorization.split(" ")[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    req.user = await User.findById(decoded.id).select("-password");
    if (!req.user) {
      return res.status(401).json({ error: "Not authorized, user not found" });
    }

    next();
  } catch (error) {
    return res.status(401).json({ error: "Not authorized, token failed" });
  }
};

// Role-based authorization middleware
const authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res
        .status(403)
        .json({ error: "Not authorized for this action" });
    }
    next();
  };
};

module.exports = { protect, authorize };
