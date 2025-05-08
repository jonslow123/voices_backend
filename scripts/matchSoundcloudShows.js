require('dotenv').config();
const mongoose = require('mongoose');
const axios = require('axios');
const Artist = require('../models/Artist');
const stringSimilarity = require('string-similarity');

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

// Soundcloud API configuration
const SOUNDCLOUD_API_URL = 'https://api.soundcloud.com';
const SOUNDCLOUD_CLIENT_ID = process.env.SOUNDCLOUD_CLIENT_ID;

// Function to fetch artist data from Soundcloud
async function fetchSoundcloudArtist(username) {
  try {
    const response = await axios.get(`${SOUNDCLOUD_API_URL}/users`, {
      params: {
        q: username,
        client_id: SOUNDCLOUD_CLIENT_ID
      }
    });
    
    // Find the best match by username
    const users = response.data;
    if (!users || users.length === 0) return null;
    
    // Try to find an exact match first
    const exactMatch = users.find(user => 
      user.permalink?.toLowerCase() === username.toLowerCase() ||
      user.username?.toLowerCase() === username.toLowerCase()
    );
    
    if (exactMatch) return exactMatch;
    
    // If no exact match, use string similarity
    const matches = users.map(user => ({
      user,
      similarity: stringSimilarity.compareTwoStrings(username.toLowerCase(), user.permalink?.toLowerCase() || '')
    }));
    
    matches.sort((a, b) => b.similarity - a.similarity);
    return matches[0]?.similarity > 0.7 ? matches[0].user : null;
  } catch (error) {
    console.error(`Error fetching Soundcloud artist ${username}:`, error.message);
    return null;
  }
}

// Function to fetch artist tracks from Soundcloud
async function fetchSoundcloudTracks(userId) {
  try {
    const response = await axios.get(`${SOUNDCLOUD_API_URL}/users/${userId}/tracks`, {
      params: {
        client_id: SOUNDCLOUD_CLIENT_ID
      }
    });
    return response.data;
  } catch (error) {
    console.error(`Error fetching tracks for Soundcloud user ${userId}:`, error.message);
    return [];
  }
}

// Function to match and update shows
async function matchAndUpdateShows(artist, soundcloudTracks) {
  try {
    const updatedShows = [...artist.shows];
    let matchCount = 0;
    
    // For each Soundcloud track, try to find a match in the existing shows
    for (const track of soundcloudTracks) {
      const bestMatch = findBestMatch(track, artist.shows);
      
      if (bestMatch) {
        // Update the existing show with Soundcloud URL
        const index = updatedShows.findIndex(show => show._id.toString() === bestMatch._id.toString());
        if (index >= 0) {
          updatedShows[index].soundcloudUrl = track.permalink_url;
          updatedShows[index].soundcloudId = track.id.toString();
          matchCount++;
        }
      } else {
        // No match found, add as a new show
        updatedShows.push({
          title: track.title,
          description: track.description || '',
          date: new Date(track.created_at),
          duration: Math.round(track.duration / 1000), // Convert from ms to seconds
          soundcloudUrl: track.permalink_url,
          imageUrl: track.artwork_url || track.user.avatar_url,
          soundcloudId: track.id.toString()
        });
      }
    }
    
    // Update the artist with the new shows
    artist.shows = updatedShows;
    artist.soundcloudUsername = soundcloudTracks[0]?.user.permalink;
    artist.lastSyncedAt = new Date();
    
    await artist.save();
    console.log(`Updated ${artist.name}: Matched ${matchCount} shows, total shows now: ${artist.shows.length}`);
    
    return artist;
  } catch (error) {
    console.error(`Error matching shows for ${artist.name}:`, error);
    return null;
  }
}

// Function to find the best match between a Soundcloud track and existing shows
function findBestMatch(track, shows) {
  const matches = shows.map(show => ({
    show,
    similarity: stringSimilarity.compareTwoStrings(
      track.title.toLowerCase(), 
      show.title.toLowerCase()
    )
  }));
  
  // Sort by similarity score
  matches.sort((a, b) => b.similarity - a.similarity);
  
  // Return the best match if similarity is above threshold
  return matches[0]?.similarity > 0.7 ? matches[0].show : null;
}

// Main function to process all artists
async function processAllArtists() {
  try {
    const artists = await Artist.find({ mixcloudUsername: { $exists: true } });
    console.log(`Processing ${artists.length} artists...`);
    
    for (const artist of artists) {
      console.log(`Processing ${artist.name}...`);
      
      // Skip if no Mixcloud username
      if (!artist.mixcloudUsername) {
        console.log(`Skipping ${artist.name} - no Mixcloud username`);
        continue;
      }
      
      // Find on Soundcloud
      const soundcloudArtist = await fetchSoundcloudArtist(artist.mixcloudUsername);
      if (!soundcloudArtist) {
        console.log(`Could not find ${artist.name} on Soundcloud`);
        continue;
      }
      
      console.log(`Found ${artist.name} on Soundcloud as ${soundcloudArtist.username}`);
      
      // Fetch Soundcloud tracks
      const tracks = await fetchSoundcloudTracks(soundcloudArtist.id);
      console.log(`Found ${tracks.length} tracks for ${artist.name} on Soundcloud`);
      
      // Match and update shows
      await matchAndUpdateShows(artist, tracks);
      
      // Sleep to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    console.log('Finished processing all artists');
  } catch (error) {
    console.error('Error processing artists:', error);
  }
}

// Run the script
processAllArtists()
  .then(() => {
    console.log('Soundcloud matching completed');
    mongoose.disconnect();
  })
  .catch(error => {
    console.error('Error in script execution:', error);
    mongoose.disconnect();
    process.exit(1);
  });