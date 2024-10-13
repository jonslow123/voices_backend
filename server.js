const express = require('express');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const artistRoutes = require('./routes/artistRoutes.js');


// Load environment variables from a .env file
dotenv.config();

// Create the Express app
const app = express();

// Middleware to parse JSON requests
app.use(express.json());

// Use the artist routes
app.use('/api', artistRoutes);

// MongoDB connection string from .env file
const mongoUri = process.env.MONGO_URI;

// Connect to MongoDB
mongoose.connect(mongoUri, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => console.log('Connected to MongoDB'))
  .catch((err) => console.error('Failed to connect to MongoDB', err));

// Simple route for testing
app.get('/', (req, res) => {
  res.send('API is running...');
});

// Start the server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
