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
const { authMiddleware } = require('./middleware/auth');

app.use('/api/cron', cronRoutes);

// Middleware
app.use(cors({
  origin: [
    'https://voicesradio.co.uk',
    'http://localhost:3000',
    'https://voices-mobile-app.vercel.app',
    // Add any other domains your app is served from
    'exp://192.168.0.7:19000', // Add your Expo development URL
    'exp://localhost:19000'
  ],
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json());
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

// Handle OPTIONS requests explicitly
app.options('*', (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-auth-token');
  res.status(200).end();
});

// Add a test route that includes auth
app.get('/api/auth-test', authMiddleware, (req, res) => {
  res.json({
    message: 'Authentication successful',
    userId: req.userId,
    timestamp: new Date().toISOString()
  });
});
