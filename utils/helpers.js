// utils/helpers.js

// Generate a URL-safe slug from a string
// "Agency CRM" → "agency-crm"
// "Healthcare CRM v2" → "healthcare-crm-v2"
export const slugify = (text) => {
  return text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')        // spaces to dashes
    .replace(/[^\w\-]+/g, '')    // remove non-word chars
    .replace(/\-\-+/g, '-')      // collapse multiple dashes
    .replace(/^-+/, '')          // trim leading dashes
    .replace(/-+$/, '')          // trim trailing dashes
}

// Make a slug unique within a collection by appending a short suffix if needed
// Pass a check function that returns true if the slug is already taken
export const uniqueSlug = async (baseSlug, checkFn) => {
  let slug = baseSlug
  let attempt = 0

  while (await checkFn(slug)) {
    attempt++
    slug = `${baseSlug}-${attempt}`
  }

  return slug
}

// Standard success response shape
export const successResponse = (res, data, statusCode = 200) => {
  return res.status(statusCode).json({ success: true, ...data })
}

// Standard error response shape
export const errorResponse = (res, message, statusCode = 400) => {
  return res.status(statusCode).json({ success: false, message })
}

// Check if a user owns a resource — throws 403 if not
export const assertOwner = (resource, userId, res) => {
  const ownerId = resource.ownerId?.toString() || resource.owner?.toString()
  if (ownerId !== userId.toString()) {
    errorResponse(res, 'Not authorized to modify this resource', 403)
    return false
  }
  return true
}