import jwt from 'jsonwebtoken';

export default function (req, res, next) {
  // Typically the token is sent in headers or via cookies
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return res.status(401).json({ error: 'No token provided' });
  }

  // Extract token after "Bearer "
  const token = authHeader.split(' ')[1]; // e.g. "Bearer <token>"
  if (!token) {
    return res.status(401).json({ error: 'Invalid token' });
  }

  try {
    const decoded = jwt.verify(
      token,
      process.env.JWT_SECRET || 'your_jwt_secret'
    );
    req.admin = decoded; // attach admin data (payload) to req
    next();
  } catch (error) {
    return res.status(401).json({ error: 'Token is not valid' });
  }
}
