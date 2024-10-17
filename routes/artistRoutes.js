const express = require('express');
const multer = require('multer');
const { GridFsStorage } = require('multer-gridfs-storage');
const mongoose = require('mongoose');
const Artist = require('../models/Artist.js');

const router = express.Router();

const mongoConnection = mongoose.connection;

mongoose.connection.on('error', (err) => {
  console.error('MongoDB connection error:', err);
});

mongoose.connection.once('open', () => {
  console.log('Connected to MongoDB');
});

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

console.log("Not out of storage:" + storage);

// Initialize multer with GridFS storage
const upload = multer({
  storage: storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // Example limit for file size
}).single('image');

console.log("multer" + upload.storage);

// Get all artists
router.get('/artists', async (req, res) => {
  try {
    const artists = await Artist.find();
    res.json(artists);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Upload endpoint using GridFS storage
router.post('/artists/upload', (req, res) => {
  upload(req, res, function (err) {
    if (err instanceof multer.MulterError) {
      console.error('Multer-specific error:', err);
      return res.status(500).json({ message: 'Error during file upload', error: err });
    } else if (err) {
      console.error('Unknown error:', err);
      return res.status(500).json({ message: 'Upload error', error: err });
    }

    console.log('File object:', req.file); // Log file object here
    console.log('Body:', req.body);

    if (!req.file) {
      return res.status(400).json({ message: 'No file uploaded.' });
    }

    // Continue with saving artist and other operations
    res.status(200).send('File uploaded successfully to MongoDB');
  });
});

// Endpoint to retrieve image by ID
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

module.exports = router;
