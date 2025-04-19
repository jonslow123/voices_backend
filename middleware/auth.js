const jwt = require('jsonwebtoken');

const authMiddleware = async (req, res, next) => {
  try {
    // Log the request for debugging
    console.log('Auth middleware triggered');
    console.log('Headers received:', JSON.stringify(req.headers));
    console.log('JWT Secret exists:', !!process.env.JWT_SECRET);
    
    // Check for authorization header with case-insensitive lookup
    let token = null;
    
    // Try standard header name with normalization
    const authHeader = req.headers.authorization || req.headers.Authorization;
    
    if (authHeader) {
      // Handle both "Bearer <token>" format and plain token
      token = authHeader.startsWith('Bearer ') 
        ? authHeader.replace('Bearer ', '') 
        : authHeader;
    }
    
    // Also check x-auth-token as fallback
    if (!token && (req.headers['x-auth-token'] || req.headers['X-Auth-Token'])) {
      token = req.headers['x-auth-token'] || req.headers['X-Auth-Token'];
    }
    
    if (!token) {
      console.log('No token found in request headers');
      return res.status(401).json({ message: 'Authentication required' });
    }
    
    // Log token prefix for debugging (don't log the whole token for security)
    console.log('Token found, first 10 chars:', token.substring(0, 10) + '...');
    
    // Verify token
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      console.log('Token decoded successfully for user:', decoded.userId);
      req.userId = decoded.userId;
      next();
    } catch (jwtError) {
      console.error('JWT verification failed:', jwtError.message);
      return res.status(401).json({ message: 'Invalid token', error: jwtError.message });
    }
  } catch (error) {
    console.error('Auth middleware error:', error);
    res.status(500).json({ message: 'Server error in authentication' });
  }
};

module.exports = authMiddleware; 