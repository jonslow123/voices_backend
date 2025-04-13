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

module.exports = { sendVerificationEmail };