// utils/logger.js
const Log = require("../models/Log");

exports.log = async (level, message, meta = {}, user = "System") => {
  console[level === "error" ? "error" : "log"](
    `[${new Date().toISOString()}] [${level.toUpperCase()}] ${message}`
  );
  await Log.create({ source: "backend", level, message, user, meta });
};
