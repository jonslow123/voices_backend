const express = require('express');
const router = express.Router();
const User = require('../models/User');
const auth = require('../middleware/auth');
const isAdmin = require('../middleware/isAdmin'); 
const { sendPushNotification } = require('../utils/pushNotifications');
const Artist = require('../models/Artist');
const admin = require('../middleware/admin'); // You'll need to create this middleware

// Middleware to check if user is admin
const adminCheck = [auth, admin];

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

// Get all artists (with pagination and filtering)
router.get('/artists', adminCheck, async (req, res) => {
  try {
    const { page = 1, limit = 20, search, genre, isResident } = req.query;
    
    // Build query
    let query = {};
    
    if (search) {
      query.name = { $regex: search, $options: 'i' };
    }
    
    if (genre) {
      query.genres = genre;
    }
    
    if (isResident !== undefined) {
      query.isResident = isResident === 'true';
    }
    
    // Execute query with pagination
    const artists = await Artist.find(query)
      .sort({ name: 1 })
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .exec();
    
    // Get total count
    const count = await Artist.countDocuments(query);
    
    res.json({
      artists,
      totalPages: Math.ceil(count / limit),
      currentPage: page,
      totalArtists: count
    });
  } catch (error) {
    console.error('Error fetching artists:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get single artist by ID
router.get('/artists/:id', adminCheck, async (req, res) => {
  try {
    const artist = await Artist.findById(req.params.id);
    
    if (!artist) {
      return res.status(404).json({ message: 'Artist not found' });
    }
    
    res.json(artist);
  } catch (error) {
    console.error('Error fetching artist:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Create new artist
router.post('/artists', adminCheck, async (req, res) => {
  try {
    const { name, bio, genres, mixcloudUsername, soundcloudUsername, isResident, featured } = req.body;
    
    // Validate required fields
    if (!name) {
      return res.status(400).json({ message: 'Artist name is required' });
    }
    
    // Check if artist already exists
    const existingArtist = await Artist.findOne({ name });
    if (existingArtist) {
      return res.status(400).json({ message: 'Artist with this name already exists' });
    }
    
    // Create new artist
    const artist = new Artist({
      name,
      bio,
      genres: genres || [],
      mixcloudUsername,
      soundcloudUsername,
      isResident: isResident || false,
      featured: featured || false,
      shows: [],
      lastSyncedAt: new Date()
    });
    
    await artist.save();
    
    res.status(201).json({ 
      message: 'Artist created successfully',
      artist
    });
  } catch (error) {
    console.error('Error creating artist:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Update artist
router.patch('/artists/:id', adminCheck, async (req, res) => {
  try {
    const updates = Object.keys(req.body);
    const allowedUpdates = [
      'name', 'bio', 'genres', 'imageUrl', 'bannerUrl',
      'mixcloudUsername', 'soundcloudUsername', 
      'isActive', 'isResident', 'featured',
      'socialLinks'
    ];
    
    // Validate updates
    const isValidOperation = updates.every(update => allowedUpdates.includes(update));
    if (!isValidOperation) {
      return res.status(400).json({ message: 'Invalid updates' });
    }
    
    // Find and update artist
    const artist = await Artist.findById(req.params.id);
    
    if (!artist) {
      return res.status(404).json({ message: 'Artist not found' });
    }
    
    // Apply updates
    updates.forEach(update => {
      artist[update] = req.body[update];
    });
    
    await artist.save();
    
    res.json({ 
      message: 'Artist updated successfully',
      artist
    });
  } catch (error) {
    console.error('Error updating artist:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Delete artist
router.delete('/artists/:id', adminCheck, async (req, res) => {
  try {
    const artist = await Artist.findByIdAndDelete(req.params.id);
    
    if (!artist) {
      return res.status(404).json({ message: 'Artist not found' });
    }
    
    res.json({ message: 'Artist deleted successfully' });
  } catch (error) {
    console.error('Error deleting artist:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Add show to artist
router.post('/artists/:id/shows', adminCheck, async (req, res) => {
  try {
    const { title, description, date, mixcloudUrl, soundcloudUrl, imageUrl } = req.body;
    
    // Validate required fields
    if (!title) {
      return res.status(400).json({ message: 'Show title is required' });
    }
    
    // Find artist
    const artist = await Artist.findById(req.params.id);
    
    if (!artist) {
      return res.status(404).json({ message: 'Artist not found' });
    }
    
    // Create new show
    const newShow = {
      title,
      description: description || '',
      date: date ? new Date(date) : new Date(),
      mixcloudUrl,
      soundcloudUrl,
      imageUrl
    };
    
    // Add show to artist
    artist.shows.push(newShow);
    await artist.save();
    
    res.status(201).json({
      message: 'Show added successfully',
      show: artist.shows[artist.shows.length - 1]
    });
  } catch (error) {
    console.error('Error adding show:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Update show
router.patch('/artists/:artistId/shows/:showId', adminCheck, async (req, res) => {
  try {
    const { title, description, date, mixcloudUrl, soundcloudUrl, imageUrl } = req.body;
    
    // Find artist
    const artist = await Artist.findById(req.params.artistId);
    
    if (!artist) {
      return res.status(404).json({ message: 'Artist not found' });
    }
    
    // Find show
    const showIndex = artist.shows.findIndex(show => 
      show._id.toString() === req.params.showId
    );
    
    if (showIndex === -1) {
      return res.status(404).json({ message: 'Show not found' });
    }
    
    // Update show fields
    if (title) artist.shows[showIndex].title = title;
    if (description !== undefined) artist.shows[showIndex].description = description;
    if (date) artist.shows[showIndex].date = new Date(date);
    if (mixcloudUrl !== undefined) artist.shows[showIndex].mixcloudUrl = mixcloudUrl;
    if (soundcloudUrl !== undefined) artist.shows[showIndex].soundcloudUrl = soundcloudUrl;
    if (imageUrl !== undefined) artist.shows[showIndex].imageUrl = imageUrl;
    
    await artist.save();
    
    res.json({
      message: 'Show updated successfully',
      show: artist.shows[showIndex]
    });
  } catch (error) {
    console.error('Error updating show:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Delete show
router.delete('/artists/:artistId/shows/:showId', adminCheck, async (req, res) => {
  try {
    // Find artist
    const artist = await Artist.findById(req.params.artistId);
    
    if (!artist) {
      return res.status(404).json({ message: 'Artist not found' });
    }
    
    // Find show
    const showIndex = artist.shows.findIndex(show => 
      show._id.toString() === req.params.showId
    );
    
    if (showIndex === -1) {
      return res.status(404).json({ message: 'Show not found' });
    }
    
    // Remove show
    artist.shows.splice(showIndex, 1);
    await artist.save();
    
    res.json({ message: 'Show deleted successfully' });
  } catch (error) {
    console.error('Error deleting show:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Run Mixcloud sync for a specific artist
router.post('/artists/:id/sync-mixcloud', adminCheck, async (req, res) => {
  try {
    const artist = await Artist.findById(req.params.id);
    
    if (!artist) {
      return res.status(404).json({ message: 'Artist not found' });
    }
    
    if (!artist.mixcloudUsername) {
      return res.status(400).json({ message: 'Artist has no Mixcloud username' });
    }
    
    // This would typically call the update function from your script
    // For now, we'll just respond with a success message
    res.json({ 
      message: `Mixcloud sync initiated for ${artist.name}`,
      note: 'This would typically trigger a background sync job'
    });
    
    // In a real implementation, you would call your sync function here
    // or trigger a background job to handle the sync
  } catch (error) {
    console.error('Error syncing with Mixcloud:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;