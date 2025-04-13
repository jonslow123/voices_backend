import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';

// Get the API_BASE_URL from constants
const API_BASE_URL = Constants.expoConfig.extra.apiBaseUrl;

// Create a function to make API calls
export const apiCall = async (endpoint, method = 'GET', body = null, headers = {}) => {
  try {
    // Get the token if available
    const token = await AsyncStorage.getItem('userToken');
    
    // Prepare headers
    const defaultHeaders = {
      'Content-Type': 'application/json',
    };
    
    // Add authorization header if token exists
    if (token) {
      defaultHeaders.Authorization = `Bearer ${token}`;
    }
    
    // Prepare the request options
    const requestOptions = {
      method,
      headers: {
        ...defaultHeaders,
        ...headers,
      },
    };
    
    // Add the body if it exists
    if (body) {
      requestOptions.body = JSON.stringify(body);
    }
    
    // Make the request
    const response = await fetch(`${API_BASE_URL}${endpoint}`, requestOptions);
    
    // Parse the response
    const data = await response.json();
    
    // Return both the response and the data
    return { response, data };
  } catch (error) {
    console.error('API call error:', error);
    throw error;
  }
};

// Export convenient methods
export const get = (endpoint, headers = {}) => apiCall(endpoint, 'GET', null, headers);
export const post = (endpoint, body, headers = {}) => apiCall(endpoint, 'POST', body, headers);
export const put = (endpoint, body, headers = {}) => apiCall(endpoint, 'PUT', body, headers);
export const del = (endpoint, headers = {}) => apiCall(endpoint, 'DELETE', null, headers); 