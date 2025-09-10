const User = require('../models/User');

exports.getAdminDashboard = async (req, res) => {
  try {
    const userCount = await User.countDocuments();
    res.status(200).json({
      message: `Welcome Admin ${req.user.name}`,
      stats: {
        totalUsers: userCount,
        stockItems: 0, 
        lowStock: 0, 
      },
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
