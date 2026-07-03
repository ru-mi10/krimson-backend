// index.js
import 'dotenv/config'
import { validateEnv } from './config/env.js'
import express from 'express'
import cors from 'cors'
import rateLimit from 'express-rate-limit'
import connectDB from './config/db.js'

// Validate environment before anything else
validateEnv()

// Import models (registers schemas with Mongoose)
import './models/User.js'
import './models/Workspace.js'
import './models/System.js'
import './models/Page.js'
import './models/Theme.js'
import './models/Version.js'
import './models/Activity.js'

// Import routes
import authRoutes from './routes/auth.js'
import systemRoutes from './routes/systems.js'
import pageRoutes from './routes/pages.js'
import themeRoutes from './routes/themes.js'
import versionRoutes from './routes/versions.js'
import exploreRoutes from './routes/explore.js'
import aiRoutes from './routes/ai.js'
import exportRoutes from './routes/export.js'

const app = express()

// ── Middleware ─────────────────────────────────────────────────────────────

app.use(cors({
  origin: process.env.CLIENT_URL,
  credentials: true,
}))

app.use(express.json({ limit: '1mb' }))

// Global rate limiter — tighten per-route for sensitive endpoints
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many requests. Please try again later.' },
})
app.use(globalLimiter)

// ── Routes ─────────────────────────────────────────────────────────────────

app.use('/api/auth', authRoutes)
app.use('/api/systems', systemRoutes)
app.use('/api/systems', pageRoutes)       // /api/systems/:systemId/pages
app.use('/api/systems', themeRoutes)      // /api/systems/:systemId/theme
app.use('/api/systems', versionRoutes)    // /api/systems/:systemId/versions
app.use('/api/explore', exploreRoutes)
app.use('/api/ai', aiRoutes)
app.use('/api/export', exportRoutes)

// ── Health check ───────────────────────────────────────────────────────────

app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    environment: process.env.NODE_ENV,
    timestamp: new Date().toISOString(),
  })
})

// ── 404 handler ────────────────────────────────────────────────────────────

app.use((req, res) => {
  res.status(404).json({ success: false, message: 'Route not found' })
})

// ── Global error handler ───────────────────────────────────────────────────

app.use((err, req, res, next) => {
  console.error('[Krimson Error]', err)

  // Mongoose validation error
  if (err.name === 'ValidationError') {
    const message = Object.values(err.errors).map((e) => e.message).join(', ')
    return res.status(400).json({ success: false, message })
  }

  // Mongoose duplicate key
  if (err.code === 11000) {
    const field = Object.keys(err.keyValue)[0]
    return res.status(400).json({
      success: false,
      message: `${field.charAt(0).toUpperCase() + field.slice(1)} already exists`,
    })
  }

  // JWT errors
  if (err.name === 'JsonWebTokenError') {
    return res.status(401).json({ success: false, message: 'Invalid token' })
  }
  if (err.name === 'TokenExpiredError') {
    return res.status(401).json({ success: false, message: 'Token expired' })
  }

  // Default 500
  res.status(err.statusCode || 500).json({
    success: false,
    message: process.env.NODE_ENV === 'production' ? 'Server error' : err.message,
  })
})

// ── Start ──────────────────────────────────────────────────────────────────

const PORT = process.env.PORT || 8000

connectDB().then(() => {
  app.listen(PORT, () => {
    console.log(`[Krimson] Server running on port ${PORT} (${process.env.NODE_ENV})`)
  })
})