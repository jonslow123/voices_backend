export default {
  name: "YourAppName",
  version: "1.0.0",
  // ... other config
  extra: {
    apiBaseUrl: process.env.API_BASE_URL || "http://192.168.0.7:4000",
  },
}; 