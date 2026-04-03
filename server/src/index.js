require('dotenv').config();
const path = require('path');
const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');

const { connectToDatabase } = require('./mongo');
const authRoutes = require('./routes/auth');
const roomRoutes = require('./routes/rooms');
const bookingRoutes = require('./routes/bookings');
const verifyRoutes = require('./routes/verify');
const paymentRoutes = require('./routes/payment');

const app = express();
const frontendDir = path.join(__dirname, '..', '..', 'Hotel_booking web2');
// Serve uploaded files statically
app.use('/uploads', express.static(require('path').join(__dirname, '..', 'uploads')));
app.use(express.static(frontendDir));

app.use(express.json());

// CORS configuration - temporarily allowing all origins for debugging
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', req.headers.origin || '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.header('Access-Control-Allow-Credentials', 'true');
    
    if (req.method === 'OPTIONS') {
        return res.sendStatus(200);
    }
    
    next();
});

app.get('/api/health', async (_req, res) => {
  try {
    // Test database connection
    await mongoose.connection.db.admin().ping();
    res.json({ 
      ok: true, 
      db: 'connected'
    });
  } catch (err) {
    console.error('Database connection error:', err);
    res.status(500).json({ 
      ok: false, 
      error: 'Database connection failed',
      details: err.message
    });
  }
});

// Test route to verify server is working
app.get('/api/test', (req, res) => {
  console.log('Test route hit');
  res.json({ message: 'Server is working!' });
});

// Debug logging for routes
console.log('Registering routes:');
console.log('  - /api/auth');
console.log('  - /api/rooms');
console.log('  - /api/bookings');

app.use('/api/auth', authRoutes);
app.use('/api/rooms', roomRoutes);
app.use('/api/bookings', bookingRoutes);
app.use('/api/verify', verifyRoutes);
app.use('/api/payment', paymentRoutes);

// Debug middleware to log all incoming requests
app.use((req, res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.originalUrl}`);
    console.log('Headers:', JSON.stringify(req.headers, null, 2));
    console.log('Body:', JSON.stringify(req.body, null, 2));
    next();
});

const PORT = process.env.PORT || 4000;

connectToDatabase()
  .then(() => {
    app.listen(PORT, () => console.log(`API running on port ${PORT}`));
  })
  .catch((err) => {
    console.error('Failed to connect to database', err);
    process.exit(1);
  });


