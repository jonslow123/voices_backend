const express = require('express');
const router = express.Router();
const FeaturedShow = require('../models/FeaturedShow');
const mongoose = require('mongoose');
const extractAudioAndImage = require('../scripts/extractFromIframe');

// GET all featured shows
router.get('/getShows', async (req, res) => {
  try {
    // Check if the database is connected
    if (mongoose.connection.readyState !== 1) {
      return res.status(500).json({ message: 'Database not connected' });
    }

    const shows = await FeaturedShow.find();
    res.json(shows);
  } catch (error) {
    console.error('Error fetching featured shows:', error);
    res.status(500).json({ message: 'Error fetching featured shows' });
  }
});

// POST a new featured show
router.post('/newShow', async (req, res) => {
  try {
    const { title, description, iframeUrl } = req.body;

    // Check if iframeUrl is provided
    if (!iframeUrl) {
      return res.status(400).json({ message: 'iframeUrl is required' });
    }

    // Extract audio and image from the iFrame
    const { audioSrc, imageSrc } = await extractAudioAndImage(iframeUrl);

    const newShow = new FeaturedShow({
      title,
      description,
      audioUrl: audioSrc,
      imageUrl: imageSrc,
      iframeUrl
    });

    await newShow.save();
    res.status(201).json(newShow);
  } catch (error) {
    console.error('Error creating featured show:', error);
    res.status(500).json({ message: 'Error creating featured show' });
  }
});

// Optional: Update a featured show by ID
router.put('/updateShow/:id', async (req, res) => {
  try {
    const { title, description, iframeURL, date } = req.body;
    const updatedShow = await FeaturedShow.findByIdAndUpdate(req.params.id, { title, description, iframeURL, date }, { new: true });
    
    if (!updatedShow) {
      return res.status(404).json({ message: 'Featured show not found' });
    }
    
    res.json(updatedShow);
  } catch (error) {
    console.error('Error updating featured show:', error);
    res.status(500).json({ message: 'Error updating featured show' });
  }
});

// Optional: Delete a featured show by ID
router.delete('/deleteShow/:id', async (req, res) => {
  try {
    const deletedShow = await FeaturedShow.findByIdAndDelete(req.params.id);
    
    if (!deletedShow) {
      return res.status(404).json({ message: 'Featured show not found' });
    }
    
    res.json({ message: 'Featured show deleted successfully' });
  } catch (error) {
    console.error('Error deleting featured show:', error);
    res.status(500).json({ message: 'Error deleting featured show' });
  }
});

module.exports = router; 