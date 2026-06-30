// routes/auth.js
import express from 'express'
import rateLimit from 'express-rate-limit'
import { body, validationResult } from 'express-validator'
import jwt from 'jsonwebtoken'
import User from '../models/User.js'
import Workspace from '../models/Workspace.js'
import { protect } from '../middleware/auth.js'
import { slugify } from '../utils/helpers.js'

const router = express.Router()

// Strict rate limit for auth endpoints
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { success: false, message: 'Too many attempts. Try again in 15 minutes.' },
})

const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  })
}

// ── POST /api/auth/register ────────────────────────────────────────────────
router.post(
  '/register',
  authLimiter,
  [
    body('fullName').trim().notEmpty().withMessage('Full name is required'),
    body('email').isEmail().normalizeEmail().withMessage('Valid email is required'),
    body('username')
      .trim()
      .isLength({ min: 3, max: 32 })
      .matches(/^[a-z0-9_-]+$/i)
      .withMessage('Username must be 3-32 chars, letters/numbers/underscore/hyphen only'),
    body('password')
      .isLength({ min: 8 })
      .withMessage('Password must be at least 8 characters'),
  ],
  async (req, res, next) => {
    try {
      const errors = validationResult(req)
      if (!errors.isEmpty()) {
        return res.status(400).json({ success: false, message: errors.array()[0].msg })
      }

      const { fullName, email, password, username } = req.body

      // Check uniqueness
      const existing = await User.findOne({
        $or: [{ email: email.toLowerCase() }, { username: username.toLowerCase() }],
      })
      if (existing) {
        const field = existing.email === email.toLowerCase() ? 'Email' : 'Username'
        return res.status(400).json({ success: false, message: `${field} already in use` })
      }

      // Create user
      const user = await User.create({ fullName, email, password, username: username.toLowerCase() })

      // Create their personal workspace automatically
      const workspaceSlug = slugify(username)
      const workspace = await Workspace.create({
        ownerId: user._id,
        name: `${fullName}'s Workspace`,
        slug: workspaceSlug,
      })

      // Link workspace back to user
      user.workspace = workspace._id
      await user.save()

      res.status(201).json({
        success: true,
        token: generateToken(user._id),
        user: {
          _id: user._id,
          fullName: user.fullName,
          email: user.email,
          username: user.username,
          workspace: { _id: workspace._id, slug: workspace.slug },
        },
      })
    } catch (error) {
      next(error)
    }
  }
)

// ── POST /api/auth/login ───────────────────────────────────────────────────
router.post(
  '/login',
  authLimiter,
  [
    body('email').isEmail().normalizeEmail().withMessage('Valid email is required'),
    body('password').notEmpty().withMessage('Password is required'),
  ],
  async (req, res, next) => {
    try {
      const errors = validationResult(req)
      if (!errors.isEmpty()) {
        return res.status(400).json({ success: false, message: errors.array()[0].msg })
      }

      const { email, password } = req.body

      const user = await User.findOne({ email }).select('+password').populate('workspace', 'slug')
      if (!user || !(await user.comparePassword(password))) {
        return res.status(401).json({ success: false, message: 'Invalid email or password' })
      }

      res.json({
        success: true,
        token: generateToken(user._id),
        user: {
          _id: user._id,
          fullName: user.fullName,
          email: user.email,
          username: user.username,
          workspace: user.workspace,
        },
      })
    } catch (error) {
      next(error)
    }
  }
)

// ── GET /api/auth/me ───────────────────────────────────────────────────────
router.get('/me', protect, async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id).populate('workspace', 'slug name')
    res.json({ success: true, user })
  } catch (error) {
    next(error)
  }
})

export default router