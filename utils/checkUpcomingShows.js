const cron = require('node-cron');
const axios = require('axios');
const User = require('../models/User');
const { sendPushNotification } = require('../utils/pushNotifications');
const { fuzzyMatch } = require('../utils/stringMatching');

// Run at 55 minutes past every hour (5 minutes before the hour)
cron.schedule('55 * * * *', async () => {
  try {
    console.log('Running upcoming shows check job');
    await checkUpcomingShows();
  } catch (error) {
    console.error('Error in upcoming shows job:', error);
  }
});

async function checkUpcomingShows() {
  // Get current and upcoming shows 
  const { currentShows, upcomingShows } = await getShowsData();
  
  // Get all users with their subscribed artists
  const users = await User.find({
    'notificationPreferences.newShows': true  // Only get users who want notifications
  }).select('deviceTokens artistsSubscribed');
  
  // Process only upcoming shows that start at the next hour
  for (const show of upcomingShows) {
    // Get the artists that match this show
    const matchedArtists = await matchShowToArtists(show.name);
    
    if (matchedArtists.length > 0) {
      console.log(`Show "${show.name}" matched artists:`, matchedArtists);
      
      // Only notify about artists who aren't already playing
      const artistsToNotify = matchedArtists.filter(artist => {
        // Check if the artist is already playing in a current show
        return !currentShows.some(currentShow => 
          matchShowToArtistSync(currentShow.name, artist)
        );
      });
      
      if (artistsToNotify.length === 0) {
        console.log(`All matched artists for "${show.name}" are already playing. Skipping notifications.`);
        continue;
      }
      
      console.log(`Sending notifications for artists:`, artistsToNotify.map(a => a.name));
      
      // Find users subscribed to these artists
      const notifyUsers = users.filter(user => {
        const subscribedArtists = user.artistsSubscribed.flat();
        return artistsToNotify.some(artist => subscribedArtists.includes(artist.username));
      });
      
      // Send notifications
      for (const user of notifyUsers) {
        if (user.deviceTokens && user.deviceTokens.length > 0) {
          // Calculate time until show
          const timeUntilShow = calculateTimeUntil(show.starts);
          
          // Get the first matched artist for this user
          const userArtists = user.artistsSubscribed.flat();
          const firstMatchedArtist = artistsToNotify.find(artist => 
            userArtists.includes(artist.username)
          );
          
          if (firstMatchedArtist) {
            // Send notification
            await sendPushNotification({
              tokens: user.deviceTokens,
              title: 'Upcoming Show Alert',
              body: `${firstMatchedArtist.name} will be live in ${timeUntilShow}!`,
              data: {
                type: 'show_alert',
                showId: show.id,
                artistUsername: firstMatchedArtist.username
              }
            });
          }
        }
      }
    }
  }
}

async function getShowsData() {
  try {
    const timezone = 'Europe/London';
    
    const response = await axios.get(
      `https://voicesradio.airtime.pro/api/week-info?timezone=${timezone}`
    );
    
    if (!response.data) {
      console.error('Empty response from Airtime API');
      return { currentShows: [], upcomingShows: [] };
    }
    
    const weekInfo = response.data;
    const allShows = Object.values(weekInfo).flat().filter(item => typeof item === 'object' && item !== null);
    
    const now = new Date();
    const nextHour = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
      now.getHours() + 1,
      0, 0, 0
    );
    
    // Current shows = shows that are happening right now
    const currentShows = allShows.filter(show => {
      const showStartTime = new Date(show.starts);
      const showEndTime = new Date(show.ends);
      return showStartTime <= now && showEndTime > now;
    });
    
    // Upcoming shows = shows that start at the next hour exactly
    const upcomingShows = allShows.filter(show => {
      const showStartTime = new Date(show.starts);
      return showStartTime.getTime() === nextHour.getTime();
    });
    
    return { currentShows, upcomingShows };
  } catch (error) {
    console.error('Error fetching show data:', error);
    return { currentShows: [], upcomingShows: [] };
  }
}

// This synchronous version is used for checking currently playing shows
function matchShowToArtistSync(showName, artist) {
  return fuzzyMatch(showName, artist.name) || 
         showName.toLowerCase().includes(artist.name.toLowerCase()) ||
         showName.toLowerCase().includes(artist.username.toLowerCase());
}

async function matchShowToArtists(showName) {
  // Get all artists from the database or API
  const mixcloudResponse = await axios.get('https://api.mixcloud.com/VoicesRadio/hosts/');
  const allArtists = mixcloudResponse.data.data || [];
  
  // Filter artists that match the show name using fuzzy matching
  return allArtists.filter(artist => matchShowToArtistSync(showName, artist));
}

function calculateTimeUntil(dateString) {
  const now = new Date();
  const showTime = new Date(dateString);
  const diffMs = showTime - now;
  const diffMins = Math.floor(diffMs / 60000);
  
  if (diffMins < 60) {
    return `${diffMins} minutes`;
  } else {
    const hours = Math.floor(diffMins / 60);
    const mins = diffMins % 60;
    return `${hours} hour${hours > 1 ? 's' : ''}${mins > 0 ? ` and ${mins} minutes` : ''}`;
  }
}

// Export functions for testing
module.exports = {
  checkUpcomingShows,
  matchShowToArtists,
  getShowsData
};