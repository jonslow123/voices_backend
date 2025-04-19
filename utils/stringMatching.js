// server/utils/stringMatching.js
const stringSimilarity = require('string-similarity');

function fuzzyMatch(str1, str2, threshold = 0.6) {
  // Convert both strings to lowercase for better matching
  const s1 = str1.toLowerCase();
  const s2 = str2.toLowerCase();
  
  // Direct inclusion check
  if (s1.includes(s2) || s2.includes(s1)) {
    return true;
  }
  
  // Check if artist name appears as a whole word in the show title
  const words = s1.split(/\s+/);
  if (words.some(word => word === s2 || 
      word.replace(/[^\w]/g, '') === s2.replace(/[^\w]/g, ''))) {
    return true;
  }
  
  // Check for common abbreviations and prefixes
  const prefixes = ['dj ', 'mc ', 'dr. ', 'prof. '];
  for (const prefix of prefixes) {
    if ((s1.startsWith(prefix) && s2.includes(s1.substring(prefix.length))) ||
        (s2.startsWith(prefix) && s1.includes(s2.substring(prefix.length)))) {
      return true;
    }
  }
  
  // Use string similarity for more complex matching
  const similarity = stringSimilarity.compareTwoStrings(s1, s2);
  return similarity >= threshold;
}

module.exports = { fuzzyMatch };