const express = require('express');
const router = express.Router();
const Artist = require('../models/Artist');

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

module.exports = router; 