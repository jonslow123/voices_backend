const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    lowercase: true
  },
  password: {
    type: String,
    required: true
  },
  firstName: {
    type: String,
    required: true,
    trim: true
  },
  lastName: {
    type: String,
    required: true,
    trim: true
  },
  artistsSubscribed: [{
    type: [String], 
    ref: 'Resident'
  }],
  emailPreferences: {
    newsletters: { type: Boolean, default: true },
    eventUpdates: { type: Boolean, default: true },
    artistAlerts: { type: Boolean, default: true }
  },
  notificationPreferences: {
    newShows: { type: Boolean, default: true },
    artistUpdates: { type: Boolean, default: true },
    appUpdates: { type: Boolean, default: true }
  },
  location: {
    city: String,
    country: String,
    coordinates: {
      type: { type: String, enum: ['Point'], default: 'Point' },
      coordinates: { type: [Number], default: [0, 0] }
    }
  },
  deviceTokens: {
    type: [String],
    default: []
  },
  // Add to your user schema
  isAdmin: {
    type: Boolean,
    default: false
  },
  isVerified: { type: Boolean, default: false },
  verificationToken: String,
  verificationTokenExpires: Date,
  createdAt: { type: Date, default: Date.now },
  lastLogin: Date,
  resetPasswordToken: String,
  resetPasswordExpires: Date,
  }, { 
  collection: 'users'
});

// Hash password before saving
userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  
  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

// Method to compare passwords
userSchema.methods.comparePassword = async function(candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

// Virtual for full name
userSchema.virtual('fullName').get(function() {
  return `${this.firstName} ${this.lastName}`;
});

// Method to get user info without sensitive data
userSchema.methods.getPublicProfile = function() {
  const userObject = this.toObject();
  delete userObject.password;
  return userObject;
};

userSchema.statics.addDeviceToken = async function(userId, token) {
  const user = await this.findById(userId);
  if (!user) return null;
  
  // Add token if not already present
  if (!user.deviceTokens.includes(token)) {
    user.deviceTokens.push(token);
    await user.save();
  }
  
  return user;
};

const User = mongoose.model('User', userSchema);
module.exports = User; 