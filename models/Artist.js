const mongoose = require('mongoose');

const showSchema = new mongoose.Schema({
  title: { type: String, required: true },
  description: String,
  date: Date,
  duration: Number, // in seconds
  mixcloudUrl: String,
  soundcloudUrl: String,
  imageUrl: String,
  playCount: { type: Number, default: 0 },
  // For internal use
  mixcloudKey: String, // Store unique identifier from Mixcloud
  soundcloudId: String, // Store unique identifier from Soundcloud
});

const artistSchema = new mongoose.Schema({
  name: { 
    type: String, 
    required: true,
    unique: true,
    trim: true 
  },
  bio: String,
  imageUrl: String,
  bannerUrl: String,
  genres: [String],
  shows: [showSchema],
  // URLs and identifiers
  mixcloudUsername: String,
  soundcloudUsername: String,
  // Metadata
  isActive: { type: Boolean, default: true },
  isResident: { type: Boolean, default: false },
  featured: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
  // For tracking
  lastSyncedAt: Date,
  // Social media
  socialLinks: {
    instagram: String,
    twitter: String,
    facebook: String,
    website: String
  }
}, { 
  collection: 'artists',
  timestamps: true
});

// Virtual for show count
artistSchema.virtual('showCount').get(function() {
  return this.shows ? this.shows.length : 0;
});

// Method to get artist info without sensitive data
artistSchema.methods.getPublicProfile = function() {
  const artistObject = this.toObject();
  return artistObject;
};

// Pre-save hook to update timestamps
artistSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

const Artist = mongoose.model('Artist', artistSchema);

module.exports = Artist;
