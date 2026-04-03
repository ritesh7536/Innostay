const router = require('express').Router();
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { requireAuth } = require('../middleware/auth');

router.post('/register', async (req, res) => {
  try {
    const { fullname, username, email, phone, password } = req.body;
    if (!fullname || !username || !email || !password) {
      return res.status(400).json({ message: 'Missing required fields' });
    }
    const exists = await User.findOne({ $or: [{ email }, { username }] });
    if (exists) return res.status(409).json({ message: 'User exists' });

    const passwordHash = await bcrypt.hash(password, 10);
    const user = await User.create({ fullname, username, email, phone, passwordHash });
    res.status(201).json({ id: user._id, username: user.username });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

router.post('/login', async (req, res) => {
  console.log('Login request received:', {
    url: req.originalUrl,
    method: req.method,
    body: req.body,
    headers: req.headers
  });
  
  try {
    const { usernameOrEmail, password } = req.body;
    
    if (!usernameOrEmail || !password) {
      console.log('Missing credentials');
      return res.status(400).json({ message: 'Username/email and password are required' });
    }
    
    console.log('Looking for user with username/email:', usernameOrEmail);
    
    try {
      const user = await User.findOne({ 
        $or: [
          { email: usernameOrEmail }, 
          { username: usernameOrEmail }
        ] 
      });
      
      console.log('User found:', user ? 'Yes' : 'No');
      
      if (!user) {
        console.log('No user found with username/email:', usernameOrEmail);
        return res.status(401).json({ 
          success: false,
          message: 'Invalid username/email or password' 
        });
      }
      
      console.log('Comparing password for user:', user.username);
      console.log('Password provided length:', password.length);
      console.log('Hash in DB:', user.passwordHash);
      const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
      console.log('Password valid:', isPasswordValid);
      
      if (!isPasswordValid) {
        console.log('Invalid password for user:', user.username);
        console.log('Password attempt:', password);
        return res.status(401).json({ 
          success: false,
          message: 'Invalid username/email or password' 
        });
      }
      
      console.log('Generating token for user:', user.username);
      const token = jwt.sign(
        { 
          sub: user._id, 
          isAdmin: !!user.isAdmin 
        }, 
        process.env.JWT_SECRET, 
        { expiresIn: '2h' }
      );
      
      console.log('Login successful for user:', user.username);
      
      res.json({ 
        success: true,
        token, 
        user: { 
          id: user._id, 
          username: user.username, 
          fullname: user.fullname, 
          email: user.email,
          isAdmin: !!user.isAdmin 
        } 
      });
      
    } catch (dbError) {
      console.error('Database error during login:', dbError);
      return res.status(500).json({ 
        success: false,
        message: 'An error occurred during login',
        error: dbError.message 
      });
    }
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

router.get('/me', requireAuth, async (req, res) => {
  try {
    const me = await User.findById(req.user.id).select('username fullname email isAdmin');
    if (!me) {
      return res.status(404).json({ message: 'User not found' });
    }
    res.json({ user: me });
  } catch (err) {
    console.error('Error fetching user:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// Temporary route to list all users (remove in production)
router.get('/users', async (req, res) => {
  try {
    const users = await User.find({});
    res.json(users);
  } catch (err) {
    console.error('Error fetching users:', err);
    res.status(500).json({ message: 'Error fetching users' });
  }
});

// Temporary route to delete user by email (remove in production)
router.delete('/users/:email', async (req, res) => {
  try {
    const result = await User.deleteOne({ email: req.params.email });
    res.json({ message: 'User deleted', result });
  } catch (err) {
    console.error('Error deleting user:', err);
    res.status(500).json({ message: 'Error deleting user' });
  }
});

module.exports = router;


