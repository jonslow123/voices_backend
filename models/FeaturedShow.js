const mongoose = require('mongoose');

const featuredShowSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true
  },
  description: {
    type: String,
    required: true
  },
  iframeUrl: {
    type: String,
    required: true // URL to the iFrame
  },
  date: {
    type: Date,
    default: Date.now // Date of the show
  }
}, { 
  collection: 'live_featured_shows' // Specify the collection name
});

const FeaturedShow = mongoose.model('FeaturedShow', featuredShowSchema);
module.exports = FeaturedShow; 