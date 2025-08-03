/**
 * Common download utility functions
 */

/**
 * Send a file download response
 * @param {Response} res - Express response object
 * @param {Buffer|Stream} content - File content
 * @param {string} filename - Filename for download
 * @param {string} contentType - MIME type
 */
function sendDownload(res, content, filename, contentType) {
  res.setHeader('Content-Type', contentType);
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  
  if (Buffer.isBuffer(content)) {
    res.setHeader('Content-Length', content.length);
    res.send(content);
  } else {
    // Handle streams
    content.pipe(res);
  }
}

/**
 * Generate a timestamped filename
 * @param {string} prefix - File prefix
 * @param {string} extension - File extension
 * @returns {string} Timestamped filename
 */
function generateFilename(prefix, extension) {
  const timestamp = new Date().toISOString().split('T')[0];
  return `${prefix}-${timestamp}.${extension}`;
}

/**
 * Content type mappings
 */
const CONTENT_TYPES = {
  pdf: 'application/pdf',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  csv: 'text/csv',
  json: 'application/json',
  txt: 'text/plain',
  zip: 'application/zip'
};

/**
 * Get content type for file extension
 * @param {string} extension - File extension
 * @returns {string} Content type
 */
function getContentType(extension) {
  return CONTENT_TYPES[extension.toLowerCase()] || 'application/octet-stream';
}

module.exports = {
  sendDownload,
  generateFilename,
  getContentType,
  CONTENT_TYPES
};