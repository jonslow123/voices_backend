const express = require('express');
const Artist = require('../models/Artist.js');

const router = express.Router();

// Get all artists
router.get('/artists', async (req, res) => {
  try {
    const artists = await Artist.find();
    res.json(artists);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Add a new artist
router.post('/artists', async (req, res) => {
  const artist = new Artist({
    bio: req.body.bio,
    day: req.body.day,
    dj_name: req.body.dj_name,
    genre_1: req.body.genre_1,
    genre_3: req.body.genre_3,
    time: req.body.time,
    genre_2: req.body.genre_2,
  });

  try {
    const newArtist = await artist.save();
    res.status(201).json(newArtist);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// Update an artist
router.put('/artists/:id', async (req, res) => {
  try {
    const updatedArtist = await Artist.findByIdAndUpdate(req.params.id, req.body, { new: true });
    res.json(updatedArtist);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// Delete an artist
router.delete('/artists/:id', async (req, res) => {
  try {
    const deletedArtist = await Artist.findByIdAndDelete(req.params.id);
    res.json({ message: 'Artist deleted' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
