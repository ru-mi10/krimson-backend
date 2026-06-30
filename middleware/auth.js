// middleware/auth.js
import jwt from 'jsonwebtoken'
import User from '../models/User.js'

// Protects routes — verifies JWT and attaches user to request
export const protect = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ success: false, message: 'Not authorized' })
    }

    const token = authHeader.split(' ')[1]
    const decoded = jwt.verify(token, process.env.JWT_SECRET)

    // Attach user — select only what's needed in controllers
    const user = await User.findById(decoded.id).select('_id username email fullName workspace')

    if (!user) {
      return res.status(401).json({ success: false, message: 'User no longer exists' })
    }

    req.user = user
    next()
  } catch (error) {
    next(error)
  }
}

// Optional auth — attaches user if token present but doesn't block if not
// Used for public routes like System public page that show different UI when logged in
export const optionalAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      req.user = null
      return next()
    }
    const token = authHeader.split(' ')[1]
    const decoded = jwt.verify(token, process.env.JWT_SECRET)
    req.user = await User.findById(decoded.id).select('_id username email fullName workspace')
    next()
  } catch {
    req.user = null
    next()
  }
}