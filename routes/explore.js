// routes/explore.js
// Public discovery — the Explore gallery.
// Returns Systems only. Never components, snippets, or code.

import express from 'express'
import System from '../models/System.js'
import Page from '../models/Page.js'
import { successResponse, errorResponse } from '../utils/helpers.js'

const router = express.Router()

// ── GET /api/explore — Browse public Systems ──────────────────────────────
router.get('/', async (req, res, next) => {
  try {
    const {
      q,           // search query
      category,    // filter by category
      sort = 'recent', // recent | popular | forked
      page = 1,
      limit = 24,
    } = req.query

    const query = {
      status: 'published',
      visibility: 'public',
    }

    // Full-text search on name + description + tags
    if (q && q.trim()) {
      query.$or = [
        { name: { $regex: q.trim(), $options: 'i' } },
        { description: { $regex: q.trim(), $options: 'i' } },
        { tags: { $in: [new RegExp(q.trim(), 'i')] } },
      ]
    }

    if (category && category !== 'all') {
      query.category = category
    }

    // Sort options
    const sortMap = {
      recent: { createdAt: -1 },
      popular: { 'stats.viewCount': -1 },
      forked: { 'stats.forkCount': -1 },
    }
    const sortOrder = sortMap[sort] || sortMap.recent

    const systems = await System.find(query)
      .populate('ownerId', 'username avatar')
      .sort(sortOrder)
      .limit(+limit)
      .skip((+page - 1) * +limit)
      .lean()

    // Attach page count to each system card
    const systemIds = systems.map((s) => s._id)
    const pageCounts = await Page.aggregate([
      { $match: { systemId: { $in: systemIds } } },
      { $group: { _id: '$systemId', count: { $sum: 1 } } },
    ])
    const pageCountMap = {}
    pageCounts.forEach(({ _id, count }) => { pageCountMap[_id.toString()] = count })

    const enriched = systems.map((s) => ({
      ...s,
      pageCount: pageCountMap[s._id.toString()] || 0,
    }))

    const total = await System.countDocuments(query)

    successResponse(res, {
      systems: enriched,
      pagination: {
        total,
        page: +page,
        limit: +limit,
        totalPages: Math.ceil(total / +limit),
      },
    })
  } catch (error) {
    next(error)
  }
})

// ── GET /api/explore/featured — Featured Systems (curated) ────────────────
router.get('/featured', async (req, res, next) => {
  try {
    // For now: most forked + most viewed public systems
    const systems = await System.find({ status: 'published', visibility: 'public' })
      .populate('ownerId', 'username avatar')
      .sort({ 'stats.forkCount': -1, 'stats.viewCount': -1 })
      .limit(6)
      .lean()

    const systemIds = systems.map((s) => s._id)
    const pageCounts = await Page.aggregate([
      { $match: { systemId: { $in: systemIds } } },
      { $group: { _id: '$systemId', count: { $sum: 1 } } },
    ])
    const pageCountMap = {}
    pageCounts.forEach(({ _id, count }) => { pageCountMap[_id.toString()] = count })

    const enriched = systems.map((s) => ({
      ...s,
      pageCount: pageCountMap[s._id.toString()] || 0,
    }))

    successResponse(res, { systems: enriched })
  } catch (error) {
    next(error)
  }
})

// ── GET /api/explore/categories — Available categories with counts ─────────
router.get('/categories', async (req, res, next) => {
  try {
    const counts = await System.aggregate([
      { $match: { status: 'published', visibility: 'public' } },
      { $group: { _id: '$category', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ])

    successResponse(res, { categories: counts })
  } catch (error) {
    next(error)
  }
})

export default router