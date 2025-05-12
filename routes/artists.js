const express = require('express');
const router = express.Router();
const Artist = require('../models/Artist');
const auth = require('../middleware/auth');
const isAdmin = require('../middleware/isAdmin');

// GET all artists
router.get('/', async (req, res) => {
  try {
    const artists = await Artist.find();
    console.log(`Found ${artists.length} artists`); // Debug log
    
    if (!artists.length) {
      return res.status(404).json({ message: 'No artists found' });
    }
    
    res.json(artists);
  } catch (error) {
    console.error('Error fetching artists:', error);
    res.status(500).json({ message: 'Error fetching artists' });
  }
});

// Get artist by ID
router.get('/:id', async (req, res) => {
  try {
    const artist = await Artist.findById(req.params.id);
    if (!artist) {
      return res.status(404).json({ message: 'Artist not found' });
    }
    res.json(artist);
  } catch (error) {
    console.error('Error fetching artist:', error);
    res.status(500).json({ message: 'Error fetching artist' });
  }
});

// Add a new artist (admin only)
router.post('/', auth, isAdmin, async (req, res) => {
  console.log('=== Artist POST Route Handler ===');
  console.log('Request body:', req.body);
  console.log('User ID:', req.userId);
  console.log('=============================');
  
  try {
    const {
      name,
      bio,
      imageUrl,
      bannerUrl,
      genres,
      mixcloudUsername,
      soundcloudUsername,
      isActive,
      isResident,
      featured,
      socialLinks
    } = req.body;

    // Check if artist with the same name already exists
    const existingArtist = await Artist.findOne({ name });
    if (existingArtist) {
      return res.status(400).json({ message: 'Artist with this name already exists' });
    }

    // Create new artist
    const newArtist = new Artist({
      name,
      bio,
      imageUrl,
      bannerUrl,
      genres,
      shows: [],
      mixcloudUsername,
      soundcloudUsername,
      isActive: isActive !== undefined ? isActive : true,
      isResident: isResident !== undefined ? isResident : false,
      featured: featured !== undefined ? featured : false,
      socialLinks
    });

    await newArtist.save();
    res.status(201).json(newArtist);
  } catch (error) {
    console.error('Error creating artist:', error);
    res.status(500).json({ message: 'Error creating artist', error: error.message });
  }
});

// Update an artist (admin only)
router.put('/:id', auth, isAdmin, async (req, res) => {
  try {
    const artistId = req.params.id;
    const {
      name,
      bio,
      imageUrl,
      bannerUrl,
      genres,
      mixcloudUsername,
      soundcloudUsername,
      isActive,
      isResident,
      featured,
      socialLinks
    } = req.body;

    // Check if artist exists
    const artist = await Artist.findById(artistId);
    if (!artist) {
      return res.status(404).json({ message: 'Artist not found' });
    }

    // Check if the name is being updated and if it conflicts with another artist
    if (name && name !== artist.name) {
      const existingArtist = await Artist.findOne({ name });
      if (existingArtist && existingArtist._id.toString() !== artistId) {
        return res.status(400).json({ message: 'Artist with this name already exists' });
      }
    }

    // Update artist fields
    if (name) artist.name = name;
    if (bio !== undefined) artist.bio = bio;
    if (imageUrl) artist.imageUrl = imageUrl;
    if (bannerUrl !== undefined) artist.bannerUrl = bannerUrl;
    if (genres) artist.genres = genres;
    if (mixcloudUsername !== undefined) artist.mixcloudUsername = mixcloudUsername;
    if (soundcloudUsername !== undefined) artist.soundcloudUsername = soundcloudUsername;
    if (isActive !== undefined) artist.isActive = isActive;
    if (isResident !== undefined) artist.isResident = isResident;
    if (featured !== undefined) artist.featured = featured;
    if (socialLinks) artist.socialLinks = { ...artist.socialLinks, ...socialLinks };

    artist.updatedAt = new Date();
    await artist.save();

    res.json(artist);
  } catch (error) {
    console.error('Error updating artist:', error);
    res.status(500).json({ message: 'Error updating artist', error: error.message });
  }
});

// Add a show to an artist (admin only)
router.post('/:id/shows', auth, isAdmin, async (req, res) => {
  try {
    const artistId = req.params.id;
    const {
      title,
      description,
      date,
      duration,
      mixcloudUrl,
      soundcloudUrl,
      imageUrl,
      mixcloudKey,
      soundcloudId
    } = req.body;

    // Check if artist exists
    const artist = await Artist.findById(artistId);
    if (!artist) {
      return res.status(404).json({ message: 'Artist not found' });
    }

    // Create new show
    const newShow = {
      title,
      description,
      date: date ? new Date(date) : new Date(),
      duration,
      mixcloudUrl,
      soundcloudUrl,
      imageUrl,
      playCount: 0,
      mixcloudKey,
      soundcloudId
    };

    // Add to shows array
    artist.shows.push(newShow);
    artist.updatedAt = new Date();
    await artist.save();

    res.status(201).json(newShow);
  } catch (error) {
    console.error('Error adding show:', error);
    res.status(500).json({ message: 'Error adding show', error: error.message });
  }
});

// Update a show (admin only)
router.put('/:artistId/shows/:showId', auth, isAdmin, async (req, res) => {
  try {
    const { artistId, showId } = req.params;
    
    // Find the artist
    const artist = await Artist.findById(artistId);
    if (!artist) {
      return res.status(404).json({ message: 'Artist not found' });
    }
    
    // Find the show in the artist's shows array
    const show = artist.shows.id(showId);
    if (!show) {
      return res.status(404).json({ message: 'Show not found' });
    }
    
    // Update show fields
    const {
      title,
      description,
      date,
      duration,
      mixcloudUrl,
      soundcloudUrl,
      imageUrl,
      mixcloudKey,
      soundcloudId
    } = req.body;
    
    if (title) show.title = title;
    if (description !== undefined) show.description = description;
    if (date) show.date = new Date(date);
    if (duration !== undefined) show.duration = duration;
    if (mixcloudUrl !== undefined) show.mixcloudUrl = mixcloudUrl;
    if (soundcloudUrl !== undefined) show.soundcloudUrl = soundcloudUrl;
    if (imageUrl !== undefined) show.imageUrl = imageUrl;
    if (mixcloudKey !== undefined) show.mixcloudKey = mixcloudKey;
    if (soundcloudId !== undefined) show.soundcloudId = soundcloudId;
    
    artist.updatedAt = new Date();
    await artist.save();
    
    res.json(show);
  } catch (error) {
    console.error('Error updating show:', error);
    res.status(500).json({ message: 'Error updating show', error: error.message });
  }
});

// Delete a show (admin only)
router.delete('/:artistId/shows/:showId', auth, isAdmin, async (req, res) => {
  try {
    const { artistId, showId } = req.params;
    
    // Find the artist
    const artist = await Artist.findById(artistId);
    if (!artist) {
      return res.status(404).json({ message: 'Artist not found' });
    }
    
    // Find the show
    const show = artist.shows.id(showId);
    if (!show) {
      return res.status(404).json({ message: 'Show not found' });
    }
    
    // Remove the show
    show.deleteOne();
    artist.updatedAt = new Date();
    await artist.save();
    
    res.json({ message: 'Show deleted successfully' });
  } catch (error) {
    console.error('Error deleting show:', error);
    res.status(500).json({ message: 'Error deleting show', error: error.message });
  }
});

// Delete an artist (admin only)
router.delete('/:id', auth, isAdmin, async (req, res) => {
  try {
    const artistId = req.params.id;
    
    const result = await Artist.findByIdAndDelete(artistId);
    if (!result) {
      return res.status(404).json({ message: 'Artist not found' });
    }
    
    res.json({ message: 'Artist deleted successfully' });
  } catch (error) {
    console.error('Error deleting artist:', error);
    res.status(500).json({ message: 'Error deleting artist', error: error.message });
  }
});

module.exports = router; 