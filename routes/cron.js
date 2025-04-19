const express = require('express');
const router = express.Router();
const { checkUpcomingShows } = require('../utils/checkUpcomingShows');

router.get('/', async (req, res) => {
  try {
    await checkUpcomingShows();
    res.status(200).json({ success: true, message: 'Shows checked successfully' });
  } catch (error) {
    console.error('Error running scheduled task:', error);
    res.status(500).json({ success: false, error: 'Failed to check shows' });
  }
});

router.post('/', async (req, res) => {
  try {
    await checkUpcomingShows();
    res.status(200).json({ success: true, message: 'Shows checked successfully' });
  } catch (error) {
    console.error('Error running scheduled task:', error);
    res.status(500).json({ success: false, error: 'Failed to check shows' });
  }
});

module.exports = router;