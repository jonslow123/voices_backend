const mongoose = require('mongoose');

const residentSchema = new mongoose.Schema({
  bio: String,
  day: String,
  dj_name: String,
  genre_1: String,
  genre_2: String,
  genre_3: String,
  time: String,
  imageId: String
}, { 
  collection: 'voices_residents' // Use existing collection name
});

const Resident = mongoose.model('Resident', residentSchema);
module.exports = Resident; 