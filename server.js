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
const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');
  } catch (error) {
    console.error('MongoDB connection error:', error);
    process.exit(1); // Exit the process if connection fails
  }
};

// Start the server after connecting to MongoDB
const startServer = async () => {
  await connectDB();
  const PORT = process.env.PORT || 4000;
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`API accessible at: ${process.env.API_BASE_URL}`);
  });
};

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/artists', residentRoutes);
app.use('/api/featured-shows', featuredShowsRoutes);
app.use('/api/users', userRoutes);

// Schedule the archiving process to run at the end of each month
cron.schedule('0 0 1 * *', () => {
  console.log('Running archiving process...');
  archiveFeaturedShows();
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ message: 'Something went wrong!' });
});

// Start the server
startServer();
