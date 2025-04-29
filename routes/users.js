const express = require('express');
const router = express.Router();
const User = require('../models/User');
const auth = require('../middleware/auth');
const crypto = require('crypto');

console.log('Setting up users routes');

// Debug middleware for all users routes
router.use((req, res, next) => {
  console.log(`Users route accessed: ${req.method} ${req.path}`);
  console.log('Headers:', JSON.stringify(req.headers));
  next();
});

// Get current user profile - with extra logging
router.get('/me', auth, async (req, res) => {
  console.log('GET /me route handler called');
  console.log('User ID from request:', req.userId);
  
  try {
    console.log('Looking up user in database');
    const user = await User.findById(req.userId);
    
    if (!user) {
      console.log('User not found for ID:', req.userId);
      return res.status(404).json({ message: 'User not found' });
    }
    
    console.log('User found, returning profile');
    res.json(user.getPublicProfile());
  } catch (error) {
    console.error('Error fetching user profile:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Update user profile
router.patch('/me', auth, async (req, res) => {
  const updates = Object.keys(req.body);
  const allowedUpdates = [
    'firstName', 'lastName', 'email', 'location', 
    'emailPreferences', 'notificationPreferences'
  ];
  
  // Validate updates
  const isValidOperation = updates.every(update => allowedUpdates.includes(update));
  if (!isValidOperation) {
    return res.status(400).json({ message: 'Invalid updates' });
  }

  try {
    const user = await User.findById(req.userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Check if email is being updated
    const isEmailUpdate = updates.includes('email') && req.body.email !== user.email;
    
    if (isEmailUpdate) {
      // Check if the new email is already in use
      const existingUser = await User.findOne({ email: req.body.email });
      if (existingUser) {
        return res.status(400).json({ message: 'Email already in use' });
      }
      
      // Check if password was provided
      if (!req.body.currentPassword) {
        return res.status(400).json({ 
          message: 'Current password is required to change email address'
        });
      }
      
      // Verify password
      const isPasswordValid = await user.comparePassword(req.body.currentPassword);
      if (!isPasswordValid) {
        return res.status(401).json({ message: 'Current password is incorrect' });
      }
      
      // Generate new verification token
      const verificationToken = crypto.randomBytes(32).toString('hex');
      const verificationTokenExpires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours
      
      // Set the email to unverified
      user.isVerified = false;
      user.verificationToken = verificationToken;
      user.verificationTokenExpires = verificationTokenExpires;
      
      // Send verification email
      try {
        const { sendVerificationEmail } = require('../utils/emailService');
        await sendVerificationEmail(user, verificationToken);
      } catch (emailError) {
        console.error('Error sending verification email:', emailError);
        return res.status(500).json({ 
          message: 'Error sending verification email. Please try again later.',
          emailError: true
        });
      }
    }

    // Apply all updates
    updates.forEach(update => {
      user[update] = req.body[update];
    });

    await user.save();
    
    // Prepare response based on whether email was updated
    const response = {
      user: user.getPublicProfile()
    };
    
    if (isEmailUpdate) {
      response.message = 'Profile updated. Please verify your new email address.';
      response.emailChanged = true;
    } else {
      response.message = 'Profile updated successfully.';
    }
    
    res.json(response);
    
  } catch (error) {
    console.error('Error updating user profile:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Subscribe to an artist
// In your backend routes file
router.post('/subscribe/:username', auth, async (req, res) => {
  try {
    const user = await User.findById(req.userId);
    const artistUsername = req.params.username;

    // Check if already subscribed
    if (user.artistsSubscribed.includes(artistUsername)) {
      return res.status(400).json({ message: 'Already subscribed to this artist' });
    }

    user.artistsSubscribed.push(artistUsername);
    await user.save();
    
    res.json({ message: 'Subscribed successfully', artistsSubscribed: user.artistsSubscribed });
  } catch (error) {
    console.error('Error subscribing to artist:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

router.post('/unsubscribe/:username', auth, async (req, res) => {
  try {
    const user = await User.findById(req.userId);
    const artistUsername = req.params.username;

    console.log('Before unsubscribe:', JSON.stringify(user.artistsSubscribed));
    console.log('Unsubscribing from:', artistUsername);

    // Check the structure of artistsSubscribed
    if (Array.isArray(user.artistsSubscribed) && user.artistsSubscribed.length > 0) {
      // If it's an array of arrays
      if (Array.isArray(user.artistsSubscribed[0])) {
        user.artistsSubscribed = user.artistsSubscribed.filter(
          arr => !(Array.isArray(arr) && arr[0] === artistUsername)
        );
      } 
      // If it's a flat array of strings
      else {
        user.artistsSubscribed = user.artistsSubscribed.filter(
          username => username !== artistUsername
        );
      }
    }
    
    console.log('After unsubscribe:', JSON.stringify(user.artistsSubscribed));
    
    await user.save();
    
    res.json({ 
      message: 'Unsubscribed successfully', 
      artistsSubscribed: user.artistsSubscribed 
    });
  } catch (error) {
    console.error('Error unsubscribing from artist:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Add this endpoint to your user routes
router.post('/device-token', auth, async (req, res) => {
  try {
    const { token } = req.body;
    
    if (!token) {
      return res.status(400).json({ message: 'Token is required' });
    }
    
    const user = await User.addDeviceToken(req.userId, token);
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    res.json({ message: 'Device token registered successfully' });
  } catch (error) {
    console.error('Error registering device token:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Log that routes are set up
console.log('Users routes set up successfully');
module.exports = router; 