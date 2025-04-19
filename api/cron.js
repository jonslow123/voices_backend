const { checkUpcomingShows } = require('../utils/checkUpcomingShows');

module.exports = async (req, res) => {
  // Allow both GET and POST methods
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    await checkUpcomingShows();
    res.status(200).json({ success: true, message: 'Shows checked successfully' });
  } catch (error) {
    console.error('Error running scheduled task:', error);
    res.status(500).json({ success: false, error: 'Failed to check shows' });
  }
};