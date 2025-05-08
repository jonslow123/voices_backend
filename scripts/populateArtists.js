require('dotenv').config();
const mongoose = require('mongoose');
const axios = require('axios');
const Artist = require('../models/Artist');

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
})
.then(() => console.log('MongoDB connected'))
.catch(err => {
  console.error('MongoDB connection error:', err);
  process.exit(1);
});

// Define the Mixcloud API base URL
const MIXCLOUD_API_URL = 'https://api.mixcloud.com';

// Function to fetch artist data from Mixcloud
async function fetchMixcloudArtist(username) {
  try {
    const response = await axios.get(`${MIXCLOUD_API_URL}/${username}`);
    return response.data;
  } catch (error) {
    console.error(`Error fetching artist ${username} from Mixcloud:`, error.message);
    return null;
  }
}

// Function to fetch artist shows from Mixcloud
async function fetchMixcloudShows(username, limit = 100) {
  try {
    const response = await axios.get(`${MIXCLOUD_API_URL}/${username}/cloudcasts?limit=${limit}`);
    return response.data.data;
  } catch (error) {
    console.error(`Error fetching shows for ${username} from Mixcloud:`, error.message);
    return [];
  }
}

// Function to save artist to database
async function saveArtist(mixcloudArtist, shows) {
  try {
    // Extract genres from shows
    const allGenres = new Set();
    shows.forEach(show => {
      if (show.tags) {
        show.tags.forEach(tag => {
          if (tag.name) allGenres.add(tag.name);
        });
      }
    });

    // Transform shows to match our schema
    const transformedShows = shows.map(show => ({
      title: show.name,
      description: show.description || '',
      date: new Date(show.created_time),
      duration: show.audio_length,
      mixcloudUrl: show.url,
      imageUrl: show.pictures?.large || show.pictures?.medium || show.pictures?.small,
      mixcloudKey: show.key,
    }));

    // Check if artist already exists
    let artist = await Artist.findOne({ mixcloudUsername: mixcloudArtist.username });
    
    if (artist) {
      console.log(`Updating existing artist: ${mixcloudArtist.name}`);
      
      // Update basic info
      artist.name = mixcloudArtist.name;
      artist.bio = mixcloudArtist.biog || '';
      artist.imageUrl = mixcloudArtist.pictures?.large || mixcloudArtist.pictures?.medium;
      artist.genres = [...allGenres];
      artist.lastSyncedAt = new Date();
      
      // Add only new shows
      const existingMixcloudKeys = new Set(artist.shows.map(show => show.mixcloudKey));
      const newShows = transformedShows.filter(show => !existingMixcloudKeys.has(show.mixcloudKey));
      
      if (newShows.length > 0) {
        artist.shows = [...artist.shows, ...newShows];
        console.log(`Added ${newShows.length} new shows for ${mixcloudArtist.name}`);
      } else {
        console.log(`No new shows for ${mixcloudArtist.name}`);
      }
    } else {
      // Create new artist
      artist = new Artist({
        name: mixcloudArtist.name,
        bio: mixcloudArtist.biog || '',
        imageUrl: mixcloudArtist.pictures?.large || mixcloudArtist.pictures?.medium,
        genres: [...allGenres],
        shows: transformedShows,
        mixcloudUsername: mixcloudArtist.username,
        lastSyncedAt: new Date()
      });
      console.log(`Created new artist: ${mixcloudArtist.name} with ${transformedShows.length} shows`);
    }
    
    await artist.save();
    return artist;
  } catch (error) {
    console.error(`Error saving artist ${mixcloudArtist.name}:`, error);
    return null;
  }
}

// Function to process a list of Mixcloud usernames
async function processArtists(usernames) {
  console.log(`Processing ${usernames.length} artists...`);
  
  for (const username of usernames) {
    console.log(`Fetching data for ${username}...`);
    
    const artistData = await fetchMixcloudArtist(username);
    if (!artistData) {
      console.log(`Skipping ${username} - could not fetch artist data`);
      continue;
    }
    
    console.log(`Fetching shows for ${username}...`);
    const shows = await fetchMixcloudShows(username);
    
    console.log(`Saving ${username} with ${shows.length} shows...`);
    await saveArtist(artistData, shows);
    
    // Sleep to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  console.log('Finished processing all artists');
}

// List of Mixcloud usernames to process
const MIXCLOUD_USERNAMES = [
  'voicesradio',
  // Add more usernames here
];

// Run the script
processArtists(MIXCLOUD_USERNAMES)
  .then(() => {
    console.log('Artist population completed');
    mongoose.disconnect();
  })
  .catch(error => {
    console.error('Error in script execution:', error);
    mongoose.disconnect();
    process.exit(1);
  });