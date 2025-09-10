const User = require('../models/User');
const jwt = require('jsonwebtoken');

const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: '30d',
  });
}

exports.registerUser = async (req, res) => {
    try{
        const { name, username, email, password, role } = req.body;
        const userExists = await User.findOne({email});
        if(userExists) {
            return res.status(400).json({ error: 'User already exists' });
        }
        const user = await User.create({
            name,
            username,
            email,
            password,
            role,
        });
        res.status(201).json({
            _id:user._id,
            name: user.name,
            username: user.username,
            email: user.email,
            role: user.role,
            token: generateToken(user._id),
        });
    } catch(error) {
        res.status(500).json({ error: error.message });
    }
};

exports.loginUser = async (req, res) => {
    try {
        const { email, password } = req.body;
        const user = await User.findOne({ email });
        if(!user) {
            return res.status(400).json({ error: 'Invalid email or password' });
        }
        const isMatch = await user.matchPassword(password);
        if(!isMatch) {
            return res.status(400).json({error : 'Invalid credentials'});
        }
        res.status(200).json({
            _id: user._id,
            name: user.name,
            username: user.username,
            email: user.email,
            role: user.role,
            token: generateToken(user._id),
        });
   } catch (error) {
    res.status(500).json({error: error.message});
   }
};

exports.getProfile = async (req, res) => {
    try {
        const user = await User.findById(req.user._id).select('-password');
        if(!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        res.status(200).json(user);
    } catch(error) {
        res.status(500).json({ error: error.message });
    }
};

exports.getAllUsers = async (req, res) => {
  try {
    const users = await User.find().select("-password"); 
    res.status(200).json(users);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};