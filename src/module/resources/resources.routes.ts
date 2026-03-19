/**
 * Resources Routes
 *
 * API Endpoints:
 *
 * POST   /resources/upload     - Upload a document
 * GET    /resources            - Get all documents for user
 * GET    /resources/:id        - Get a single document
 * GET    /resources/:id/download - Get download URL
 * DELETE /resources/:id        - Delete a document by ID
 * DELETE /resources/path/*     - Delete a document by file path
 *
 * All endpoints require Authorization header with Bearer token
 */

export const RESOURCES_ROUTES = {
  UPLOAD: '/resources/upload',
  LIST: '/resources',
  GET: '/resources/:id',
  DOWNLOAD: '/resources/:id/download',
  DELETE: '/resources/:id',
  DELETE_BY_PATH: '/resources/path/*',
} as const;
