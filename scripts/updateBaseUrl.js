const fs = require('fs');
const { networkInterfaces } = require('os');
const dotenv = require('dotenv');

// Get local IP address
function getLocalIpAddress() {
  const nets = networkInterfaces();
  for (const name of Object.keys(nets)) {
    for (const net of nets[name]) {
      // Skip internal and non-IPv4 addresses
      if (net.family === 'IPv4' && !net.internal) {
        return net.address;
      }
    }
  }
  return 'localhost';
}

// Update .env file
function updateEnvFile() {
  const ip = getLocalIpAddress();
  const port = process.env.PORT || 4000;
  const apiBaseUrl = `http://${ip}:${port}`;
  
  // Read the current .env file
  const envConfig = dotenv.parse(fs.readFileSync('.env'));
  
  // Update API_BASE_URL
  envConfig.API_BASE_URL = apiBaseUrl;
  
  // Write back to .env
  const newEnv = Object.entries(envConfig)
    .map(([key, value]) => `${key}=${value}`)
    .join('\n');
  
  fs.writeFileSync('.env', newEnv);
  
  console.log(`Updated API_BASE_URL to ${apiBaseUrl}`);
}

updateEnvFile(); 