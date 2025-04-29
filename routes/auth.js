const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const mongoose = require('mongoose');
const crypto = require('crypto');
const { sendVerificationEmail, sendPasswordResetEmail } = require('../utils/emailService');


mongoose.set('strictQuery', false);

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

const path = require('path');

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

module.exports = router; 