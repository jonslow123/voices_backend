require('dotenv').config();
const mongoose = require('mongoose');

const dropIndex = async () => {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });

    console.log('Connected to MongoDB');

    // Drop the index on the username field
    await mongoose.connection.collection('users').dropIndex('username_1');
    console.log('Successfully dropped the username index');
  } catch (error) {
    if (error.codeName === 'IndexNotFound') {
      console.log('Index not found, it may have already been removed');
    } else {
      console.error('Error dropping index:', error);
    }
  } finally {
    // Close the connection
    mongoose.connection.close();
  }
};

// Run the script
dropIndex();