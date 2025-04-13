const mongoose = require('mongoose');

const archivedShowSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true
  },
  description: {
    type: String,
    required: true
  },
  audioUrl: {
    type: String,
    required: true
  },
  imageUrl: {
    type: String,
    required: true
  },
  mixcloudUrl: {
    type: String,
    required: true
  },
  date: {
    type: Date,
    default: Date.now
  }
}, { 
  collection: 'archived_featured_shows' // Specify the collection name for archived shows
});

const ArchivedShow = mongoose.model('ArchivedShow', archivedShowSchema);
module.exports = ArchivedShow; 