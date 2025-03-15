/************************************************************************
 * authController.js (ESM version)
 ************************************************************************/
// File: src/controllers/authController.js
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import Admin from '../models/Admin.js';
import nodemailer from 'nodemailer';


export const signup = async (req, res) => {
  try {
    // Destructure name from request body
    const { name, email, password } = req.body;

    // Check if admin already exists
    const existingAdmin = await Admin.findOne({ email });
    if (existingAdmin) {
      return res.status(400).json({ error: 'Admin already exists' });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create new admin (include name)
    const newAdmin = new Admin({ 
      name, 
      email, 
      password: hashedPassword 
    });
    await newAdmin.save();

    return res.status(201).json({ message: 'Admin created successfully' });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Server error' });
  }
};



export const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    // Check if admin exists
    const admin = await Admin.findOne({ email });
    if (!admin) {
      return res.status(400).json({ error: 'Admin not found' });
    }

    // Compare password
    const isMatch = await bcrypt.compare(password, admin.password);
    if (!isMatch) {
      return res.status(400).json({ error: 'Invalid credentials' });
    }

    // Create JWT
    const token = jwt.sign(
      { adminId: admin._id, email: admin.email },
      process.env.JWT_SECRET || 'your_jwt_secret',
      { expiresIn: '1h' }
    );

    return res.status(200).json({
      message: 'Logged in successfully',
      token,
      adminId: admin._id,
      email: admin.email,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Server error' });
  }
};


export const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    // Find Admin by email
    const admin = await Admin.findOne({ email });
    if (!admin) {
      return res.status(400).json({ error: 'No account found with that email' });
    }

    // Generate a 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString(); // e.g. "123456"
    const otpExpiry = Date.now() + 1000 * 60 * 10; // OTP valid for 10 minutes

    // (Optional) Hash the OTP before storing, or store plain. For simplicity, let's store plain:
    admin.resetOTP = otp;
    admin.resetOTPExpiry = new Date(otpExpiry);
    await admin.save();

    // Send email with nodemailer
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: process.env.SMTP_PORT,
      secure: false, // true if 465, false if other ports
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });

    const mailOptions = {
      from: '"Your App" <no-reply@yourapp.com>',
      to: email,
      subject: 'Password Reset OTP',
      text: `Your OTP is: ${otp}. It is valid for 10 minutes.`,
    };

    await transporter.sendMail(mailOptions);

    return res.json({ message: 'OTP sent to your email' });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Server error sending OTP' });
  }
};

/**
 * POST /auth/reset-password-with-otp
 *  - Takes { email, otp, newPassword } in req.body
 *  - Verifies OTP, checks expiry
 *  - Hashes new password, updates Admin doc
 */
export const resetPasswordWithOTP = async (req, res) => {
  try {
    const { email, otp, newPassword } = req.body;
    if (!email || !otp || !newPassword) {
      return res.status(400).json({ error: 'Email, OTP, and newPassword are required' });
    }

    const admin = await Admin.findOne({ email });
    if (!admin) {
      return res.status(400).json({ error: 'No account found with that email' });
    }

    // Check if OTP matches and is not expired
    const now = Date.now();
    if (
      admin.resetOTP !== otp ||
      !admin.resetOTPExpiry ||
      now > admin.resetOTPExpiry.getTime()
    ) {
      return res.status(400).json({ error: 'Invalid or expired OTP' });
    }

    // OTP is valid; hash new password
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    admin.password = hashedPassword;

    // Clear OTP fields
    admin.resetOTP = '';
    admin.resetOTPExpiry = null;

    await admin.save();

    return res.json({ message: 'Password updated successfully' });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Server error resetting password' });
  }
};