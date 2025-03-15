// File: src/routes/authRoutes.js
import express from 'express';
import { signup, login, forgotPassword, resetPasswordWithOTP } from '../controllers/authController.js';
import authMiddleware from '../middleware/authMiddleware.js';

const router = express.Router();

router.post('/signup', signup);
router.post('/login', login);

// Forgot password endpoints
router.post('/forgot-password', forgotPassword);
router.post('/reset-password-with-otp', resetPasswordWithOTP);

router.get('/protected', authMiddleware, (req, res) => {
  res.json({ message: `Hello Admin: ${req.admin.email}` });
});

export default router;
