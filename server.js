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

// Middleware
app.use(cors());
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
