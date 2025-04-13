const express = require('express');
const router = express.Router();
const User = require('../models/User');
const auth = require('../middleware/auth');

// Get current user profile
router.get('/me', auth, async (req, res) => {
  try {
    const user = await User.findById(req.userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
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
    'firstName', 'lastName', 'location', 
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

    // Apply updates
    updates.forEach(update => {
      user[update] = req.body[update];
    });

    await user.save();
    res.json(user.getPublicProfile());
  } catch (error) {
    console.error('Error updating user profile:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Subscribe to an artist
router.post('/subscribe/:artistId', auth, async (req, res) => {
  try {
    const user = await User.findById(req.userId);
    const artistId = req.params.artistId;

    // Check if already subscribed
    if (user.artistsSubscribed.includes(artistId)) {
      return res.status(400).json({ message: 'Already subscribed to this artist' });
    }

    user.artistsSubscribed.push(artistId);
    await user.save();
    
    res.json({ message: 'Subscribed successfully', artistsSubscribed: user.artistsSubscribed });
  } catch (error) {
    console.error('Error subscribing to artist:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Unsubscribe from an artist
router.post('/unsubscribe/:artistId', auth, async (req, res) => {
  try {
    const user = await User.findById(req.userId);
    const artistId = req.params.artistId;

    // Filter out the artist ID
    user.artistsSubscribed = user.artistsSubscribed.filter(
      id => id.toString() !== artistId
    );
    
    await user.save();
    
    res.json({ message: 'Unsubscribed successfully', artistsSubscribed: user.artistsSubscribed });
  } catch (error) {
    console.error('Error unsubscribing from artist:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router; 