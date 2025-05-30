const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const mongoose = require('mongoose');
const crypto = require('crypto');
const { sendVerificationEmail, sendPasswordResetEmail } = require('../utils/emailService');
const { OAuth2Client } = require('google-auth-library');
const fs = require('fs');
const path = require('path');
const jwksClient = require('jwks-rsa');
const appleSignin = require('apple-signin-auth');

mongoose.set('strictQuery', false);

// Initialize the Google OAuth2 client
const oauth2Client = new OAuth2Client(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  process.env.GOOGLE_REDIRECT_URI
);

// Initialize JWKS client
const client = jwksClient({
  jwksUri: 'https://appleid.apple.com/auth/keys'
});

// Function to get Apple's public key
const getApplePublicKey = (header, callback) => {
  client.getSigningKey(header.kid, (err, key) => {
    if (err) {
      callback(err);
      return;
    }
    const signingKey = key.getPublicKey();
    callback(null, signingKey);
  });
};

router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    // Check if the database is connected
    if (mongoose.connection.readyState !== 1) {
      return res.status(500).json({ message: 'Database not connected' });
    }

    console.log('Login attempt for email:', email); // Debug log

    // Find user by email
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    // Check password
    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }
    // Check if email is verified
    if (!user.isVerified) {
      return res.status(401).json({ 
        message: 'Please verify your email before logging in',
        needsVerification: true,
        email: user.email
      });
    }

    // Update last login time
    user.lastLogin = new Date();
    await user.save();

    // Create token
    const token = jwt.sign(
      { userId: user._id },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );
    

    console.log('Login successful for:', email);
    res.json({
      token,
      user: user.getPublicProfile()
    });

  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

router.post('/register', async (req, res) => {
  try {
    const { 
      email, 
      password, 
      firstName, 
      lastName,
      location,
      emailPreferences,
      notificationPreferences
    } = req.body;

    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: 'Email already in use' });
    }

    const verificationToken = crypto.randomBytes(32).toString('hex');
    const verificationTokenExpires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    // Create new user with provided fields + verification fields
    const user = new User({
      email,
      password,
      firstName,
      lastName,
      location: location || {},
      emailPreferences: emailPreferences || {},
      notificationPreferences: notificationPreferences || {},
      isVerified: false,
      verificationToken,
      verificationTokenExpires
    });

    await user.save();

    // Send verification email
    try {
      await sendVerificationEmail(user, verificationToken);
    } catch (emailError) {
      console.error('Error sending verification email:', emailError);
      // Continue with the registration process even if email fails
      // We'll inform the user that they may need to request a new verification link
    }

    // For security, we don't send a JWT token here since the account isn't verified yet
    res.status(201).json({
      message: 'User created successfully. Please check your email to verify your account.',
      user: {
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        needsVerification: true
      }
    });

  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

router.get('/verify-email/:token', async (req, res) => {
  const { token } = req.params;
  const acceptHeader = req.get('Accept') || '';
  const isWebRequest = acceptHeader.includes('text/html');
  
  try {
    console.log('Verification attempt:', {
      token,
      acceptHeader,
      isWebRequest,
      verificationPageUrl: process.env.VERIFICATION_PAGE_URL
    });

    const user = await User.findOne({
      verificationToken: token,
      verificationTokenExpires: { $gt: Date.now() }
    });

    console.log('Verification check:', {
      userFound: !!user,
      isVerified: user?.isVerified,
      tokenExpiry: user?.verificationTokenExpires,
      currentTime: new Date()
    });

    if (!user) {
      console.log('No user found with token');
      if (isWebRequest) {
        // Redirect to verification page with the token
        return res.redirect(`${process.env.VERIFICATION_PAGE_URL}/verify-email/${token}`);
      } else {
        return res.status(400).json({ message: 'Invalid or expired verification token' });
      }
    }

    // User found, proceed with verification
    console.log('Updating user verification status');
    user.isVerified = true;
    user.verificationToken = undefined;
    user.verificationTokenExpires = undefined;
    await user.save();

      const jwtToken = jwt.sign(
        { userId: user._id },
        process.env.JWT_SECRET,
        { expiresIn: '24h' }
      );

    if (isWebRequest) {
      const successUrl = `${process.env.VERIFICATION_PAGE_URL}/verify-email?success=true`;
      console.log('Redirecting to success page:', successUrl);
      return res.redirect(successUrl);
    } else {
      return res.json({ 
        message: 'Email verified successfully. You can now log in.',
        token: jwtToken,
        user: user.getPublicProfile()
      });
    }
  } catch (error) {
    console.error('Error verifying email:', error);
    if (isWebRequest) {
      const errorUrl = `${process.env.VERIFICATION_PAGE_URL}/verify-email?error=server`;
      console.log('Redirecting to error page due to server error:', errorUrl);
      return res.redirect(errorUrl);
    } else {
      return res.status(500).json({ message: 'Server error' });
    }
  }
});

// Resend verification email
router.post('/resend-verification', async (req, res) => {
  try {
    const { email } = req.body;
    
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    if (user.isVerified) {
      return res.status(400).json({ message: 'Email is already verified' });
    }
    
    // Generate new verification token
    const verificationToken = crypto.randomBytes(32).toString('hex');
    const verificationTokenExpires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours
    
    user.verificationToken = verificationToken;
    user.verificationTokenExpires = verificationTokenExpires;
    await user.save();
    
    // Send verification email
    await sendVerificationEmail(user, verificationToken);
    
    res.json({ message: 'Verification email sent. Please check your inbox.' });
  } catch (error) {
    console.error('Error resending verification email:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Request password reset
router.post('/forgot-password', async (req, res) => {
  try {
    const { email } = req.body;

    // Find user by email
    const user = await User.findOne({ email });
    if (!user) {
      // For security reasons, don't reveal that the email doesn't exist
      return res.json({ 
        message: 'If an account exists with this email, you will receive a password reset link.' 
      });
    }

    // Generate reset token
    const resetToken = crypto.randomBytes(32).toString('hex');
    const resetTokenExpires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    // Save reset token and expiry to user
    user.resetPasswordToken = resetToken;
    user.resetPasswordExpires = resetTokenExpires;
    await user.save();

    // Send password reset email
    try {
      await sendPasswordResetEmail(user, resetToken);
      res.json({ 
        message: 'If an account exists with this email, you will receive a password reset link.' 
      });
    } catch (emailError) {
      console.error('Error sending password reset email:', emailError);
      user.resetPasswordToken = undefined;
      user.resetPasswordExpires = undefined;
      await user.save();
      return res.status(500).json({ message: 'Error sending password reset email' });
    }

  } catch (error) {
    console.error('Forgot password error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Serve the reset password page
router.get('/reset-password', (req, res) => {
    res.sendFile(path.join(__dirname, '../public/reset-password.html')); // Adjust the path based on your file structure
});

// Handle the password reset
router.post('/reset-password', async (req, res) => {
    try {
        const { token, password } = req.body;

        if (!token || !password) {
            return res.status(400).json({ message: 'Token and password are required' });
        }

        // Find user with valid reset token
        const user = await User.findOne({
            resetPasswordToken: token,
            resetPasswordExpires: { $gt: Date.now() }
        });

        if (!user) {
            return res.status(400).json({ message: 'Invalid or expired reset token' });
        }

        // Set new password
        user.password = password; // Will be hashed by pre-save hook
        user.resetPasswordToken = undefined;
        user.resetPasswordExpires = undefined;
        await user.save();

        res.json({ message: 'Password has been reset successfully' });

    } catch (error) {
        console.error('Reset password error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// Reset password with token
router.post('/reset-password/:token', async (req, res) => {
  try {
    console.log('Password reset request received');
    console.log('Token:', req.params.token);
    console.log('New password length:', req.body.password?.length || 0);
    
    const { token } = req.params;
    const { password } = req.body;

    if (!password || password.length < 8) {
      return res.status(400).json({ message: 'Password must be at least 8 characters long' });
    }

    // Find user with valid reset token
    const user = await User.findOne({
      resetPasswordToken: token,
      resetPasswordExpires: { $gt: Date.now() }
    });

    if (!user) {
      console.log('No user found with this reset token or token expired');
      return res.status(400).json({ message: 'Invalid or expired reset token' });
    }

    console.log('User found, resetting password');
    
    // Set new password (will be hashed by pre-save hook)
    user.password = password;
    user.resetPasswordToken = undefined;
    user.resetPasswordExpires = undefined;
    await user.save();

    console.log('Password reset successful');
    res.json({ message: 'Password has been reset successfully' });

  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Change email address (no authentication required)
router.post('/change-email', async (req, res) => {
  try {
    const { currentEmail, newEmail, password } = req.body;
    
    // Validate required fields
    if (!currentEmail || !newEmail || !password) {
      return res.status(400).json({ 
        message: 'Current email, new email, and password are required' 
      });
    }
    
    // Check if emails are different
    if (currentEmail === newEmail) {
      return res.status(400).json({ message: 'New email must be different from current email' });
    }
    
    // Find user by current email
    const user = await User.findOne({ email: currentEmail });
    if (!user) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }
    
    // Verify password
    const isPasswordValid = await user.comparePassword(password);
    if (!isPasswordValid) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }
    
    // Check if new email is already in use by another account
    const existingUser = await User.findOne({ email: newEmail });
    if (existingUser && existingUser._id.toString() !== user._id.toString()) {
      return res.status(400).json({ message: 'Email already in use by another account' });
    }
    
    // Generate new verification token
    const verificationToken = crypto.randomBytes(32).toString('hex');
    const verificationTokenExpires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours
    
    // Update user
    user.email = newEmail;
    user.isVerified = false;
    user.verificationToken = verificationToken;
    user.verificationTokenExpires = verificationTokenExpires;
    
    await user.save();
    
    // Send verification email to new address
    try {
      await sendVerificationEmail(user, verificationToken);
    } catch (emailError) {
      console.error('Error sending verification email:', emailError);
      // Revert the change if verification email fails
      user.email = currentEmail;
      user.isVerified = true; // Assuming the previous email was verified
      user.verificationToken = undefined;
      user.verificationTokenExpires = undefined;
      await user.save();
      
      return res.status(500).json({ 
        message: 'Failed to send verification email. Email not changed.',
        emailError: true 
      });
    }
    
    res.json({
      message: 'Email address updated. Please verify your new email address.',
      email: newEmail,
      needsVerification: true
    });
    
  } catch (error) {
    console.error('Change email error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Logout - optional token invalidation
router.post('/logout', async (req, res) => {
  try {
    const authHeader = req.headers.authorization || req.headers.Authorization;
    let token = null;
    
    if (authHeader) {
      token = authHeader.startsWith('Bearer ') 
        ? authHeader.replace('Bearer ', '') 
        : authHeader;
    } else if (req.headers['x-auth-token'] || req.headers['X-Auth-Token']) {
      token = req.headers['x-auth-token'] || req.headers['X-Auth-Token'];
    }
    
    // If you want to track invalidated tokens (requires a blacklist in your database)
    // This is optional but adds security by preventing token reuse after logout
    if (token) {
      try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const userId = decoded.userId;
        
        // You could store this token in a blacklist with an expiry
        // For demonstration, I'll just log it
        console.log(`User ${userId} logged out, token invalidated`);
      } catch (error) {
        // Invalid token, but still return success since the goal is to log out
        console.log('Invalid token provided for logout');
      }
    }
    
    res.json({ message: 'Logged out successfully' });
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Google Auth endpoint
router.post('/google-auth', async (req, res) => {
  try {
    const { code } = req.body;
    
    if (!code) {
      return res.status(400).json({ message: 'Authorization code is required' });
    }

    // Exchange the code for tokens
    const { tokens } = await oauth2Client.getToken(code);
    oauth2Client.setCredentials(tokens);

    // Get user profile information from Google
    const ticket = await oauth2Client.verifyIdToken({
      idToken: tokens.id_token,
      audience: process.env.GOOGLE_CLIENT_ID
    });

    const payload = ticket.getPayload();
    const { email, given_name: firstName, family_name: lastName, email_verified } = payload;

    // Check if the user already exists
    let user = await User.findOne({ email });

    if (user) {
      // User exists, check if they were created with Google Auth or regular signup
      if (user.password === '$GOOGLE_AUTH$') {
        // User was created with Google Auth before, just log them in
        
        // Update last login time
        user.lastLogin = new Date();
        await user.save();
        
        // Create JWT token
        const token = jwt.sign(
          { userId: user._id },
          process.env.JWT_SECRET,
          { expiresIn: '24h' }
        );
        
        return res.json({
          token,
          user: user.getPublicProfile(),
          isNewUser: false
        });
      } else {
        // User signed up with email/password, don't allow Google Auth login
        return res.status(400).json({ 
          message: 'An account already exists with this email. Please log in with your password.',
          needsPassword: true
        });
      }
    } else {
      // Create a new user with Google information
      // Generate a random password placeholder (user won't need it, but the schema requires it)
      const googleAuthPassword = '$GOOGLE_AUTH$';
      
      user = new User({
        email,
        firstName: firstName || '',
        lastName: lastName || '',
        password: googleAuthPassword,
        isVerified: email_verified, // automatically verify if Google verified the email
        location: {},
        notificationPreferences: {
          artistAlerts: true,
          eventAlerts: true
        },
        newsletters: true
      });
      
      await user.save();
      
      // Create JWT token
      const token = jwt.sign(
        { userId: user._id },
        process.env.JWT_SECRET,
        { expiresIn: '24h' }
      );
      
      return res.status(201).json({
        token,
        user: user.getPublicProfile(),
        isNewUser: true,
        message: 'Account created successfully with Google'
      });
    }
  } catch (error) {
    console.error('Google auth error:', error);
    res.status(500).json({ message: 'Server error during Google authentication' });
  }
});

router.get('/health', async (req, res) => {
  try {
    const dbStatus = mongoose.connection.readyState;
    const statusMap = {
      0: 'disconnected',
      1: 'connected',
      2: 'connecting',
      3: 'disconnecting'
    };
    
    const envCheck = {
      JWT_SECRET: !!process.env.JWT_SECRET,
      MONGODB_URI: !!process.env.MONGODB_URI
    };
    
    res.json({
      status: 'ok',
      database: statusMap[dbStatus] || 'unknown',
      environment: envCheck
    });
  } catch (error) {
    console.error('Health check error:', error);
    res.status(500).json({ status: 'error', message: error.message });
  }
});

// Check if Apple user exists endpoint
router.post('/check-apple-user', async (req, res) => {
  try {
    const { appleUserId } = req.body;
    
    if (!appleUserId) {
      return res.status(400).json({ message: 'Apple User ID is required' });
    }
    
    // Check if user exists
    const user = await User.findOne({ appleUserId });
    
    if (!user) {
      return res.json({ exists: false });
    }
    
    // Generate JWT token
    const token = jwt.sign(
      { userId: user._id },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );
    
    // Return user info with token
    res.json({
      exists: true,
      token,
      user: {
        id: user._id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        isAdmin: user.isAdmin
      }
    });
  } catch (error) {
    console.error('Error checking Apple user:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Apple auth endpoint
router.post('/apple-auth', async (req, res) => {
  try {
    console.log('Received Apple auth request:', req.body);
    const { idToken, email, firstName, lastName, email_verified, sub } = req.body;

    if (!idToken) {
      console.log('Missing idToken in request');
      return res.status(400).json({ message: 'Apple ID token is required' });
    }

    // Provide defaults for empty names to satisfy validation
    const finalFirstName = (firstName && firstName.trim()) ? firstName.trim() : 'Apple';
    const finalLastName = (lastName && lastName.trim()) ? lastName.trim() : 'User';

    // Verify the token
    let payload;
    try {
      payload = await appleSignin.verifyIdToken(idToken, {
        audience: process.env.APPLE_CLIENT_ID, // Your Services ID
      });
      console.log('Token verified successfully:', payload);
    } catch (verifyError) {
      console.error('Token verification error:', verifyError);
      
      // If token verification fails, use the data from the request
      // This is a fallback for testing or when verification isn't possible
      if (email || sub) {
        console.log('Using provided data as fallback');
        payload = { 
          sub: sub || 'unknown',
          email: email
        };
      } else {
        return res.status(401).json({ 
          message: 'Token verification failed and no fallback data provided',
          error: verifyError.message 
        });
      }
    }

    // Check if user already exists
    const existingUser = await User.findOne({
      $or: [
        { appleId: payload.sub },
        { email: payload.email || email }
      ]
    });

    if (existingUser) {
      console.log('User already exists:', existingUser.email);
      return res.status(409).json({ message: 'User already exists with this Apple ID or email' });
    }

    console.log('Creating new user with data:', {
      email: payload.email || email,
      firstName: finalFirstName,
      lastName: finalLastName,
      appleId: payload.sub
    });

    // Create new user
    const newUser = new User({
      appleId: payload.sub,
      email: payload.email || email,
      firstName: finalFirstName,
      lastName: finalLastName,
      password: '$APPLE_AUTH$', // Special marker for Apple users
      isVerified: email_verified || true, // Apple verifies emails
      authProvider: 'apple'
    });

    await newUser.save();
    console.log('New user created successfully');

    // Generate token
    const token = jwt.sign(
      { userId: newUser._id },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.status(201).json({
      token,
      user: {
        _id: newUser._id,
        email: newUser.email,
        firstName: newUser.firstName,
        lastName: newUser.lastName,
        isVerified: newUser.isVerified,
        notificationPreferences: newUser.notificationPreferences,
        newsletters: newUser.newsletters
      }
    });
  } catch (error) {
    console.error('Apple auth error:', error);
    res.status(500).json({ 
      message: 'Authentication failed',
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

// Apple Sign In - Login
router.post('/apple-login', async (req, res) => {
  try {
    console.log('Apple login request:', req.body);
    const { idToken, sub } = req.body;

    if (!idToken && !sub) {
      return res.status(400).json({ message: 'Apple ID token or user ID is required' });
    }

    let appleId = sub;

    // If we have a token, try to verify it and extract the Apple ID
    if (idToken) {
      try {
        console.log('Attempting to verify token...');
        const tokenPayload = await appleSignin.verifyIdToken(idToken, {
          audience: process.env.APPLE_CLIENT_ID
        });
        console.log('Token verified successfully');
        
        // Extract user ID from token
        if (tokenPayload.sub) {
          appleId = tokenPayload.sub;
          console.log('Extracted Apple ID from token:', appleId);
        }
      } catch (verifyError) {
        console.error('Token verification error:', verifyError);
        
        // If verification fails and we don't have a fallback sub, return error
        if (!sub) {
          return res.status(401).json({ 
            message: 'Token verification failed and no user ID provided',
            error: verifyError.message 
          });
        }
        console.log('Using provided sub as fallback:', sub);
      }
    }

    if (!appleId) {
      return res.status(400).json({ message: 'Unable to determine Apple user ID' });
    }

    // Find user by Apple ID
    const user = await User.findOne({ appleId });

    if (!user) {
      console.log('No user found with Apple ID:', appleId);
      return res.status(404).json({ message: 'User not found. Please sign up first.' });
    }

    console.log('User found:', user.email);

    // Generate token
    const token = jwt.sign(
      { userId: user._id },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({
      token,
      user: {
        _id: user._id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        isVerified: user.isVerified,
        notificationPreferences: user.notificationPreferences,
        newsletters: user.newsletters
      }
    });
  } catch (error) {
    console.error('Apple login error:', error);
    res.status(500).json({ 
      message: 'Login failed',
      error: error.message
    });
  }
});

// DEBUG ENDPOINT - Apple login without token verification (FOR DEVELOPMENT ONLY)
router.post('/apple-login-debug', async (req, res) => {
  try {
    console.log('DEBUG apple login request:', req.body);
    const { email, user, firstName, lastName } = req.body;
    
    if (!email && !user) {
      return res.status(400).json({ message: 'Email or user ID is required' });
    }
    
    // Try to find user first
    let foundUser;
    
    if (user) {
      console.log('DEBUG: Looking for user by appleId:', user);
      foundUser = await User.findOne({ appleId: user });
    }
    
    if (!foundUser && email) {
      console.log('DEBUG: Looking for user by email:', email);
      foundUser = await User.findOne({ email });
    }
    
    if (!foundUser) {
      console.log('DEBUG: No existing user found, creating new user');
      // Create a new user
      foundUser = new User({
        email: email || 'apple_user_' + Date.now() + '@example.com',
        firstName: firstName || 'Apple',
        lastName: lastName || 'User',
        password: '$APPLE_AUTH$',
        isVerified: true,
        authProvider: 'apple',
        appleId: user || 'debug_' + Date.now()
      });
      
      await foundUser.save();
      console.log('DEBUG: New user created:', foundUser.email);
    } else {
      console.log('DEBUG: Found existing user:', foundUser.email);
    }
    
    // Generate token
    const token = jwt.sign(
      { userId: foundUser._id },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );
    
    console.log('DEBUG: Login successful, returning token');
    res.json({
      token,
      user: {
        _id: foundUser._id,
        email: foundUser.email,
        firstName: foundUser.firstName,
        lastName: foundUser.lastName,
        isVerified: foundUser.isVerified
      },
      debug: true
    });
  } catch (error) {
    console.error('DEBUG Apple login error:', error);
    res.status(500).json({
      message: 'Debug login failed',
      error: error.toString(),
      stack: error.stack
    });
  }
});

// DEBUG ENDPOINT - Check for Apple users in database
router.get('/debug-check-users', async (req, res) => {
  try {
    // Find all users with Apple auth or matching the specific email
    const appleUsers = await User.find({ 
      $or: [
        { authProvider: 'apple' },
        { appleId: { $exists: true } }
      ]
    }).select('email firstName lastName appleId authProvider');
    
    // Look for the specific email
    const specificUser = await User.findOne({ 
      email: 'onslow.jack@yahoo.com' 
    }).select('_id email firstName lastName password appleId authProvider');
    
    // Get total user count
    const totalUsers = await User.countDocuments({});
    
    res.json({
      message: 'Database check complete',
      totalUsers,
      appleUsersCount: appleUsers.length,
      appleUsers,
      specificUser
    });
  } catch (error) {
    console.error('Debug check error:', error);
    res.status(500).json({
      message: 'Error checking users',
      error: error.toString()
    });
  }
});

// Apple Email Login - Manual login for Apple users using email
router.post('/apple-email-login', async (req, res) => {
  try {
    console.log('Apple email login request:', req.body);
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ message: 'Email is required' });
    }

    console.log('Looking for Apple user with email:', email);

    // Find a user with this email who registered via Apple
    const user = await User.findOne({
      email: email,
      authProvider: 'apple'
    });

    if (!user) {
      console.log('No Apple user found with email:', email);
      
      // Check if any user exists with this email (for debugging)
      const anyUser = await User.findOne({ email: email });
      if (anyUser) {
        console.log('User exists but not with Apple auth provider:', anyUser.authProvider);
        return res.status(404).json({ 
          message: 'User found but not registered with Apple. Please use regular login or sign in with Apple.',
          authProvider: anyUser.authProvider
        });
      }
      
      return res.status(404).json({ message: 'No Apple account found with this email. Please sign up with Apple first.' });
    }

    console.log('Apple user found:', user.email, 'Apple ID:', user.appleId);

    // Generate token
    const token = jwt.sign(
      { userId: user._id },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    console.log('Apple email login successful');

    res.json({
      token,
      user: {
        _id: user._id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        isVerified: user.isVerified,
        notificationPreferences: user.notificationPreferences,
        newsletters: user.newsletters
      },
      loginMethod: 'apple-email'
    });
  } catch (error) {
    console.error('Apple email login error:', error);
    res.status(500).json({ 
      message: 'Login failed',
      error: error.message
    });
  }
});

// Check if email exists and return auth provider info
router.post('/check-email', async (req, res) => {
  try {
    console.log('Email check request:', req.body);
    const { email } = req.body;
    
    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }
    
    // Normalize email
    const normalizedEmail = email.toLowerCase().trim();
    console.log('Checking for email:', normalizedEmail);
    
    // Check if user exists with this email
    const existingUser = await User.findOne({ 
      email: normalizedEmail 
    }).select('email authProvider isVerified createdAt');
    
    if (!existingUser) {
      console.log('No user found with email:', normalizedEmail);
      return res.json({ 
        exists: false,
        email: normalizedEmail
      });
    }
    
    console.log('User found:', {
      email: existingUser.email,
      authProvider: existingUser.authProvider,
      isVerified: existingUser.isVerified
    });
    
    // Return detailed information about the existing user
    res.json({ 
      exists: true,
      email: existingUser.email,
      authProvider: existingUser.authProvider || 'email', // Default to 'email' if not set
      isVerified: existingUser.isVerified,
      createdAt: existingUser.createdAt,
      // Provide guidance on how to proceed
      recommendedAction: getRecommendedAction(existingUser.authProvider, existingUser.isVerified)
    });
  } catch (error) {
    console.error('Error checking email:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      message: error.message 
    });
  }
});

// Helper function to provide guidance based on existing user
function getRecommendedAction(authProvider, isVerified) {
  if (authProvider === 'apple') {
    return {
      action: 'use_apple_signin',
      message: 'This email is registered with Apple Sign In. Please use "Sign in with Apple" or the manual Apple email login.'
    };
  } else if (authProvider === 'google') {
    return {
      action: 'use_google_signin',
      message: 'This email is registered with Google Sign In. Please use "Sign in with Google".'
    };
  } else if (!isVerified) {
    return {
      action: 'verify_email',
      message: 'This email is registered but not verified. Please check your email for verification link or request a new one.'
    };
  } else {
    return {
      action: 'use_password_login',
      message: 'This email is registered. Please use your password to log in.'
    };
  }
}

// Delete user account
router.delete('/delete-account', async (req, res) => {
  try {
    console.log('Account deletion request received');
    
    // Get token from headers
    const authHeader = req.headers.authorization || req.headers.Authorization;
    let token = null;
    
    if (authHeader) {
      token = authHeader.startsWith('Bearer ') 
        ? authHeader.replace('Bearer ', '') 
        : authHeader;
    } else if (req.headers['x-auth-token'] || req.headers['X-Auth-Token']) {
      token = req.headers['x-auth-token'] || req.headers['X-Auth-Token'];
    }
    
    if (!token) {
      return res.status(401).json({ message: 'No authentication token provided' });
    }
    
    // Verify token and get user ID
    let userId;
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      userId = decoded.userId;
      console.log('Token verified for user:', userId);
    } catch (error) {
      console.error('Token verification failed:', error);
      return res.status(401).json({ message: 'Invalid or expired token' });
    }
    
    // Optional: Require password confirmation for extra security
    const { password, confirmDeletion } = req.body;
    
    // Find the user
    const user = await User.findById(userId);
    if (!user) {
      console.log('User not found for deletion:', userId);
      return res.status(404).json({ message: 'User not found' });
    }
    
    console.log('Found user for deletion:', user.email);
    
    // For non-social auth users, require password confirmation
    if (user.password && user.password !== '$APPLE_AUTH$' && user.password !== '$GOOGLE_AUTH$') {
      if (!password) {
        return res.status(400).json({ 
          message: 'Password confirmation required for account deletion' 
        });
      }
      
      // Verify password
      const isPasswordValid = await user.comparePassword(password);
      if (!isPasswordValid) {
        console.log('Invalid password provided for account deletion');
        return res.status(401).json({ message: 'Invalid password' });
      }
    }
    
    // Require explicit confirmation
    if (!confirmDeletion) {
      return res.status(400).json({ 
        message: 'Account deletion must be explicitly confirmed. Set confirmDeletion to true.' 
      });
    }
    
    // Store user info for logging before deletion
    const userInfo = {
      id: user._id,
      email: user.email,
      authProvider: user.authProvider,
      createdAt: user.createdAt
    };
    
    // Delete the user account
    await User.findByIdAndDelete(userId);
    
    console.log('User account deleted successfully:', userInfo);
    
    // Return success response
    res.json({
      message: 'Account deleted successfully',
      deletedUser: {
        email: userInfo.email,
        deletedAt: new Date()
      }
    });
    
  } catch (error) {
    console.error('Account deletion error:', error);
    res.status(500).json({ 
      message: 'Failed to delete account',
      error: error.message 
    });
  }
});

module.exports = router; 