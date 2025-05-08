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

// Function to fetch all hosts from Mixcloud for VoicesRadio
async function fetchAllHosts() {
  try {
    let hosts = [];
    let nextUrl = `${MIXCLOUD_API_URL}/VoicesRadio/hosts/?limit=100`;
    
    // Keep fetching until there are no more pages
    while (nextUrl) {
      console.log(`Fetching hosts from: ${nextUrl}`);
      const response = await axios.get(nextUrl);
      
      if (!response.data || !response.data.data) {
        throw new Error('Invalid response format from Mixcloud');
      }
      
      // Add hosts from this page
      hosts = [...hosts, ...response.data.data];
      console.log(`Fetched ${response.data.data.length} hosts, total so far: ${hosts.length}`);
      
      // Check if there's another page
      nextUrl = response.data.paging?.next || null;
    }
    
    return hosts;
  } catch (error) {
    console.error('Error fetching hosts from Mixcloud:', error.message);
    throw error;
  }
}

// Function to fetch host details and their shows
async function fetchHostDetails(username) {
  try {
    console.log(`Fetching details for host: ${username}`);
    
    // First get the host's shows
    const showsResponse = await axios.get(`${MIXCLOUD_API_URL}/VoicesRadio/hosts/${username}`);
    
    if (!showsResponse.data || !showsResponse.data.data) {
      throw new Error(`Invalid shows response for host ${username}`);
    }
    
    const shows = showsResponse.data.data;
    console.log(`Fetched ${shows.length} shows for ${username}`);
    
    // Extract genres from shows
    const genreCounts = {};
    shows.forEach(show => {
      if (show.tags && Array.isArray(show.tags)) {
        show.tags.forEach(tag => {
          if (tag.name) {
            genreCounts[tag.name] = (genreCounts[tag.name] || 0) + 1;
          }
        });
      }
    });
    
    // Convert to array and sort by count
    const genresArray = Object.entries(genreCounts)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);
    
    // Get top genres
    const topGenres = genresArray.map(genre => genre.name);
    
    // Get the host details
    const hostDetailsResponse = await axios.get(`${MIXCLOUD_API_URL}/${username}`);
    
    return {
      details: hostDetailsResponse.data,
      shows: shows,
      genres: topGenres
    };
  } catch (error) {
    console.error(`Error fetching details for host ${username}:`, error.message);
    return null;
  }
}

// Function to save/update artist in database
async function saveArtist(hostData) {
  try {
    if (!hostData || !hostData.details) {
      console.log('Invalid host data, skipping');
      return null;
    }
    
    const { details, shows, genres } = hostData;
    
    // Transform shows to match our schema
    const transformedShows = shows.map(show => ({
      title: show.name,
      description: show.description || '',
      date: new Date(show.created_time || show.updated_time || Date.now()),
      duration: show.audio_length || 0,
      mixcloudUrl: show.url,
      imageUrl: show.pictures?.large || show.pictures?.medium || show.pictures?.small,
      mixcloudKey: show.key,
    }));
    
    // Check if artist already exists
    let artist = await Artist.findOne({ mixcloudUsername: details.username });
    
    if (artist) {
      console.log(`Updating existing artist: ${details.name}`);
      
      // Update basic info
      artist.name = details.name;
      artist.bio = details.biog || '';
      artist.imageUrl = details.pictures?.large || details.pictures?.medium;
      artist.genres = genres;
      artist.lastSyncedAt = new Date();
      
      // Add only new shows
      const existingMixcloudKeys = new Set(artist.shows.map(show => show.mixcloudKey));
      const newShows = transformedShows.filter(show => !existingMixcloudKeys.has(show.mixcloudKey));
      
      if (newShows.length > 0) {
        artist.shows = [...artist.shows, ...newShows];
        console.log(`Added ${newShows.length} new shows for ${details.name}`);
      } else {
        console.log(`No new shows for ${details.name}`);
      }
    } else {
      // Create new artist
      artist = new Artist({
        name: details.name,
        bio: details.biog || '',
        imageUrl: details.pictures?.large || details.pictures?.medium,
        genres: genres,
        shows: transformedShows,
        mixcloudUsername: details.username,
        lastSyncedAt: new Date()
      });
      console.log(`Created new artist: ${details.name} with ${transformedShows.length} shows`);
    }
    
    await artist.save();
    return artist;
  } catch (error) {
    console.error(`Error saving artist:`, error);
    return null;
  }
}

// Main function to process all hosts
async function processAllHosts() {
  try {
    console.log('Starting to fetch all hosts from Mixcloud...');
    const hosts = await fetchAllHosts();
    console.log(`Successfully fetched ${hosts.length} hosts`);
    
    let successCount = 0;
    let failCount = 0;
    
    for (const host of hosts) {
      try {
        console.log(`Processing host: ${host.username}`);
        
        // Get detailed info for each host
        const hostData = await fetchHostDetails(host.username);
        
        if (hostData) {
          // Save artist to database
          const artist = await saveArtist(hostData);
          
          if (artist) {
            successCount++;
            console.log(`Successfully processed ${host.username}`);
          } else {
            failCount++;
            console.log(`Failed to save ${host.username} to database`);
          }
        } else {
          failCount++;
          console.log(`Failed to fetch details for ${host.username}`);
        }
        
        // Sleep to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 1500));
      } catch (hostError) {
        failCount++;
        console.error(`Error processing host ${host.username}:`, hostError);
      }
    }
    
    console.log('=== PROCESS COMPLETE ===');
    console.log(`Successfully processed: ${successCount} hosts`);
    console.log(`Failed to process: ${failCount} hosts`);
  } catch (error) {
    console.error('Error in main process:', error);
  }
}

// Run the script
processAllHosts()
  .then(() => {
    console.log('Script execution completed');
    mongoose.disconnect();
  })
  .catch(error => {
    console.error('Error in script execution:', error);
    mongoose.disconnect();
    process.exit(1);
  });