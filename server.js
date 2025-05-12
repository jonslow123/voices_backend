require('dotenv').config();
require('./utils/checkUpcomingShows');
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const authRoutes = require('./routes/auth');
const residentRoutes = require('./routes/artists');
const featuredShowsRoutes = require('./routes/featuredShows');
const cron = require('node-cron');
const { archiveFeaturedShows } = require('./scripts/archiveFeaturedShows'); // Import the archiving function
const userRoutes = require('./routes/users');
const adminRoutes = require('./routes/admin');
const app = express();
const cronRoutes = require('./routes/cron');
const fs = require('fs');
const path = require('path');
const auth = require('./middleware/auth');
const User = require('./models/User');

app.use('/api/cron', cronRoutes);

// Basic middleware first
app.use(express.json());
app.use(cors());

// Request logging
app.use((req, res, next) => {
  console.log('=== Request Details ===');
  console.log(`Method: ${req.method}`);
  console.log(`URL: ${req.url}`);
  console.log(`Path: ${req.path}`);
  console.log(`Original URL: ${req.originalUrl}`);
  console.log('Headers:', JSON.stringify(req.headers, null, 2));
  console.log('Body:', JSON.stringify(req.body, null, 2));
  console.log('=====================');
  next();
});

app.use('/api/admin', adminRoutes);

// Set strictQuery to false to prepare for Mongoose 7
mongoose.set('strictQuery', false);

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
})
.then(() => {
  console.log('Connected to MongoDB');
  // Start the server only after successful connection
  const PORT = process.env.PORT || 4000;
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`API accessible at: ${process.env.API_BASE_URL}`);
  });
})
.catch(err => {
  console.error('MongoDB connection error:', err);
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/artists', residentRoutes);
app.use('/api/featured-shows', featuredShowsRoutes);

// Then routes
app.use('/api/users', require('./routes/users'));

// Then check if your users routes are properly registered
console.log('Registering user routes...');

const usersRoutePath = path.join(__dirname, 'routes', 'users.js');
console.log('Checking for users.js at:', usersRoutePath);
console.log('File exists:', fs.existsSync(usersRoutePath));

// Then when importing
try {
  const userRoutes = require('./routes/users');
  console.log('Successfully imported users routes');
  app.use('/api/users', userRoutes);
} catch (error) {
  console.error('Error importing users routes:', error);
}

console.log('User routes registered');


// Add a direct route that doesn't use the router
app.get('/api/users/me-direct', auth, async (req, res) => {
  try {
    const user = await User.findById(req.userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found (direct route)' });
    }
    res.json(user.getPublicProfile());
  } catch (error) {
    console.error('Error fetching user profile (direct route):', error);
    res.status(500).json({ message: 'Server error (direct route)' });
  }
});

// Catch-all route for debugging
app.use('*', (req, res) => {
  console.log('=== Unmatched Route ===');
  console.log(`Method: ${req.method}`);
  console.log(`URL: ${req.url}`);
  console.log(`Path: ${req.path}`);
  console.log(`Original URL: ${req.originalUrl}`);
  console.log('Headers:', JSON.stringify(req.headers, null, 2));
  console.log('Body:', JSON.stringify(req.body, null, 2));
  console.log('=====================');
  res.status(404).json({ message: 'Route not found', path: req.path });
});
