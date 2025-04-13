const express = require('express');
const router = express.Router();
const Resident = require('../models/Resident');

// GET all residents
router.get('/', async (req, res) => {
  try {
    const residents = await Resident.find();
    console.log(`Found ${residents.length} residents`); // Debug log
    
    if (!residents.length) {
      return res.status(404).json({ message: 'No residents found' });
    }
    
    res.json(residents);
  } catch (error) {
    console.error('Error fetching residents:', error);
    res.status(500).json({ message: 'Error fetching residents' });
  }
});

// Optional: Get resident by ID
router.get('/:id', async (req, res) => {
  try {
    const resident = await Resident.findById(req.params.id);
    if (!resident) {
      return res.status(404).json({ message: 'Resident not found' });
    }
    res.json(resident);
  } catch (error) {
    console.error('Error fetching resident:', error);
    res.status(500).json({ message: 'Error fetching resident' });
  }
});

module.exports = router; 