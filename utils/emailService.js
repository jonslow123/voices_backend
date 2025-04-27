const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST,
  port: process.env.EMAIL_PORT,
  secure: process.env.EMAIL_SECURE === 'true', // true for 465, false for other ports
  auth: {
    user: process.env.EMAIL_USER, // Your Gmail address
    pass: process.env.EMAIL_PASSWORD, // The App Password from .env
  },
});

const sendVerificationEmail = async (user, token) => {
  const verificationUrl = `${process.env.API_BASE_URL}/api/auth/verify-email/${token}`; // Or your frontend verification URL

  const mailOptions = {
    from: process.env.EMAIL_FROM,
    to: user.email,
    subject: 'Verify Your Email Address for Voices App',
    text: `Hello ${user.firstName},\n\nPlease verify your email address by clicking the following link: ${verificationUrl}\n\nIf you did not request this, please ignore this email.\n\nThanks,\nThe Voices App Team`,
    html: `<p>Hello ${user.firstName},</p><p>Please verify your email address by clicking the following link:</p><p><a href="${verificationUrl}">${verificationUrl}</a></p><p>If you did not request this, please ignore this email.</p><p>Thanks,<br/>The Voices App Team</p>`,
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log('Verification email sent successfully to:', user.email);
  } catch (error) {
    console.error('Error sending verification email:', error);
    throw error; // Re-throw the error to be caught in the calling function
  }
};

const sendPasswordResetEmail = async (user, token) => {
  const resetUrl = `${process.env.API_BASE_URL}/api/auth/reset-password?token=${token}`;

  const mailOptions = {
    from: process.env.EMAIL_FROM,
    to: user.email,
    subject: 'Reset Your Password - Voices App',
    text: `Hello ${user.firstName},\n\n
    You are receiving this email because you (or someone else) has requested to reset your password.\n\n
    Please click on the following link to reset your password: ${resetUrl}\n\n
    If you did not request this, please ignore this email and your password will remain unchanged.\n\n
    This link will expire in 24 hours.\n\n
    Thanks,\nThe Voices App Team`,
    html: `
      <p>Hello ${user.firstName},</p>
      <p>You are receiving this email because you (or someone else) has requested to reset your password.</p>
      <p>Please <a href="${resetUrl}">Change Password Here</a></p>
      <p>If you did not request this, please ignore this email and your password will remain unchanged.</p>
      <p>This link will expire in 24 hours.</p>
      <p>Thanks,<br/>The Voices App Team</p>
    `,
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log('Password reset email sent successfully to:', user.email);
  } catch (error) {
    console.error('Error sending password reset email:', error);
    throw error;
  }
};

module.exports = {
  sendVerificationEmail,
  sendPasswordResetEmail
};