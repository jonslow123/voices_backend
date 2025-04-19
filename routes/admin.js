const express = require('express');
const router = express.Router();
const User = require('../models/User');
const auth = require('../middleware/auth');
const isAdmin = require('../middleware/isAdmin'); 
const { sendPushNotification } = require('../utils/pushNotifications');

// Test sending notifications to a specific user
router.post('/test-notification', auth, isAdmin, async (req, res) => {
  try {
    const { userId, message, title } = req.body;
    
    const testUser = await User.findById(userId);
    if (!testUser) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    if (!testUser.deviceTokens || testUser.deviceTokens.length === 0) {
      return res.status(400).json({ message: 'User has no registered devices' });
    }
    
    // Send test notification
    const result = await sendPushNotification({
      tokens: testUser.deviceTokens,
      title: title || 'Test Notification',
      body: message || 'This is a test notification',
      data: {
        type: 'test',
        timestamp: new Date().toISOString()
      }
    });
    
    res.json({ 
      message: 'Test notification sent',
      results: result
    });
  } catch (error) {
    console.error('Error sending test notification:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Test the artist matching logic
router.post('/test-artist-match', auth, isAdmin, async (req, res) => {
  try {
    const { showTitle } = req.body;
    
    if (!showTitle) {
      return res.status(400).json({ message: 'Show title is required' });
    }
    
    const { matchShowToArtists } = require('../utils/checkUpcomingShows');
    const matchedArtists = await matchShowToArtists(showTitle);
    
    res.json({
      showTitle,
      matchedArtists,
      matchCount: matchedArtists.length
    });
  } catch (error) {
    console.error('Error testing artist match:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;