const axios = require('axios');
const cheerio = require('cheerio');

async function extractAudioAndImage(iframeUrl) {
  try {
    const { data } = await axios.get(iframeUrl);
    const $ = cheerio.load(data);

    // Assuming the audio is in a <audio> tag
    const audioSrc = $('audio').attr('src');
    
    // Assuming the image is in an <img> tag
    const imageSrc = $('img').attr('src');

    return { audioSrc, imageSrc };
  } catch (error) {
    console.error('Error extracting from iFrame:', error);
    return { audioSrc: null, imageSrc: null };
  }
}

module.exports = extractAudioAndImage; 