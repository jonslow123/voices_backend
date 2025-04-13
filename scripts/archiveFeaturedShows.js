require('dotenv').config();
const mongoose = require('mongoose');
const FeaturedShow = require('../models/FeaturedShow');
const ArchivedShow = require('../models/ArchivedShow');

async function archiveFeaturedShows() {
  try {
    // Connect to MongoDB only if not already connected
    if (mongoose.connection.readyState !== 1) {
      await mongoose.connect(process.env.MONGODB_URI);
    }

    // Fetch all current featured shows
    const showsToArchive = await FeaturedShow.find();

    if (showsToArchive.length === 0) {
      console.log('No featured shows to archive.');
      return;
    }

    // Move shows to the archive collection
    await ArchivedShow.insertMany(showsToArchive);

    // Clear the current featured shows collection
    await FeaturedShow.deleteMany();

    console.log('Featured shows archived successfully.');
  } catch (error) {
    console.error('Error archiving featured shows:', error);
  }
}

// Export the function to be used elsewhere
module.exports = archiveFeaturedShows; 