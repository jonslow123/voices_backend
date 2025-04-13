const express = require('express');
const multer = require('multer');
const { GridFsStorage } = require('multer-gridfs-storage');
const mongoose = require('mongoose');
const Artist = require('../models/Artist.js');
const Fuse = require('fuse.js');
let fetch;

(async () => {
  const nodeFetch = await import('node-fetch');
  fetch = nodeFetch.default;
})();
const router = express.Router();

const mongoConnection = mongoose.connection;

// Set up GridFS storage
const storage = new GridFsStorage({
  db: mongoConnection,
  options: { useNewUrlParser: true, useUnifiedTopology: true },
  file: (req, file) => {
    console.log('File being processed:', file); // Log file object
    return {
      filename: file.originalname,
      bucketName: 'uploads',
    };
  },
});

const upload = multer({
  storage: storage,
  limits: { fileSize: 10 * 1024 * 1024 }, 
}).single('image');

console.log("multer" + upload.storage);

const fetchMixcloudShows = async (username) => {
  try {
    const response = await fetch(`https://api.mixcloud.com/${username}/cloudcasts/`);
    const data = await response.json();
    return data.data;
  } catch (error) {
    console.error('Error fetching MixCloud shows:', error);
    return [];
  }
};

const filterShowsByArtist = (shows, artistName) => {
  const options = {
    includeScore: true,
    threshold: 0.4, 
    keys: ['name', 'key'] 
  };

  const fuse = new Fuse(shows, options);
  
  const result = fuse.search(artistName);

  return result.map((item) => item.item);
};

const getArtistShows = async (mixcloudUsername, artistName) => {
  const allShows = await fetchMixcloudShows(mixcloudUsername);
  const filteredShows = filterShowsByArtist(allShows, artistName);
  
  return filteredShows;
};

router.get('/artists', async (req, res) => {
  try {
    const artists = await Artist.find();
    res.json(artists);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.get('/artists/shows', async (req, res) => {
  console.log('--- Full Request ---');
  console.log('Headers:', req.headers); // Request headers
  console.log('Query Params:', req.query); // Query parameters (e.g., ?name=Maria Hanlon)
  console.log('Body:', req.body); // Request body (for POST/PUT requests)
  console.log('Method:', req.method); // HTTP method (GET, POST, etc.)
  console.log('URL:', req.originalUrl); // Full URL of the request

  const artistName = req.query.name; // Correctly extracting the "name" query parameter
  console.log("NAME: " + artistName);
  
  if (!artistName) {
    return res.status(400).json({ message: 'Artist name is required' });
  }

  try {
    const shows = await getArtistShows('VoicesRadio', artistName);
    res.json(shows);
  } catch (error) {
    console.error('Error fetching shows:', error);
    res.status(500).json({ message: 'Error fetching shows', error });
  }
});

router.get('/artists/:artistId', async (req, res) => {
  try {
    const artistId = req.params.artistId;

    const artist = await Artist.findById(artistId); 
    
    if (!artist) {
      return res.status(404).json({ message: 'Artist not found' });
    }

    res.json(artist);
  } catch (err) {
    console.error('Error fetching artist:', err);
    res.status(500).json({ message: 'Server error', error: err });
  }
});


router.post('/artists/upload', (req, res) => {
  upload(req, res, async function (err) {
    if (err instanceof multer.MulterError) {
      console.error('Multer-specific error:', err);
      return res.status(500).json({ message: 'Error during file upload', error: err });
    } else if (err) {
      console.error('Unknown error:', err);
      return res.status(500).json({ message: 'Upload error', error: err });
    }

    console.log('File object:', req.file);
    console.log('File object:', req.file.id); 
    console.log('Body:', req.body); 
    
    if (!req.file) {
      return res.status(400).json({ message: 'No file uploaded.' });
    }

    try {
      // Create a new artist document with the uploaded file's metadata and artist data from the form
      const newArtist = new Artist({
        dj_name: req.body.dj_name,
        bio: req.body.bio,
        day: req.body.day,
        time: req.body.time,
        genre_1: req.body.genre_1,
        genre_2: req.body.genre_2,
        genre_3: req.body.genre_3,
        imageId: req.file.id, 
      });
      await newArtist.save();

      res.status(200).send('File uploaded and artist saved successfully to MongoDB');
    } catch (saveErr) {
      console.error('Error saving artist:', saveErr);
      res.status(500).json({ message: 'Error saving artist information', error: saveErr });
    }
  });
});

router.get('/artists/image/:id', async (req, res) => {
  try {
    const fileId = req.params.id;
    const gfs = new mongoose.mongo.GridFSBucket(mongoConnection.db, {
      bucketName: 'uploads', // Should match the bucket name in storage
    });

    const downloadStream = gfs.openDownloadStream(new mongoose.Types.ObjectId(fileId));

    downloadStream.on('data', (chunk) => {
      res.write(chunk);
    });

    downloadStream.on('error', (err) => {
      console.error(err);
      res.status(404).json({ message: 'Image not found', error: err });
    });

    downloadStream.on('end', () => {
      res.end();
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error', error: err });
  }
});

router.delete('/artists/:id', async (req, res) => {
  try {
    const deletedArtist = await Artist.findByIdAndDelete(req.params.id);
    res.json({ message: 'Artist deleted' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
