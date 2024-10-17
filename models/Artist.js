const mongoose = require('mongoose');

// Define the schema for an artist
const artistSchema = new mongoose.Schema({
  bio: {
    type: String,
    required: false,
  },
  day: {
    type: String,
    required: false,
  },
  dj_name: {
    type: String,
    required: true,
  },
  genre_1: {
    type: String,
    required: true,
  },
  genre_3: {
    type: String,
    required: true,
  },
  time: {
    type: String,
    required: false,
  },
  genre_2: {
    type: String,
    required: true,
  },
  imageId: { 
    type: String,
    required: true
  }
});

// Create the model from the schema and export it
const Artist = mongoose.model('Artist', artistSchema, 'voices_residents');
module.exports = Artist;
