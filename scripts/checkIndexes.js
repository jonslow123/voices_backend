require('dotenv').config();
const mongoose = require('mongoose');

const checkIndexes = async () => {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });

    console.log('Connected to MongoDB');

    // Get all indexes on the users collection
    const indexes = await mongoose.connection.collection('users').indexes();
    console.log('Current indexes on users collection:');
    console.log(JSON.stringify(indexes, null, 2));
  } catch (error) {
    console.error('Error checking indexes:', error);
  } finally {
    // Close the connection
    mongoose.connection.close();
  }
};

// Run the script
checkIndexes();