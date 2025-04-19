// server/services/pushNotifications.js
const { Expo } = require('expo-server-sdk');

const expo = new Expo();

async function sendPushNotification({ tokens, title, body, data = {} }) {
  // Create the messages to send
  const messages = [];
  
  for (const pushToken of tokens) {
    // Check that token is valid
    if (!Expo.isExpoPushToken(pushToken)) {
      console.error(`Push token ${pushToken} is not a valid Expo push token`);
      continue;
    }
    
    // Construct the message
    messages.push({
      to: pushToken,
      sound: 'default',
      title,
      body,
      data,
      priority: 'high',
    });
  }
  
  // Batch the notifications to not exceed rate limits
  const chunks = expo.chunkPushNotifications(messages);
  const tickets = [];
  
  for (const chunk of chunks) {
    try {
      const ticketChunk = await expo.sendPushNotificationsAsync(chunk);
      tickets.push(...ticketChunk);
    } catch (error) {
      console.error('Error sending notifications:', error);
    }
  }
  
  return tickets;
}

module.exports = { sendPushNotification };