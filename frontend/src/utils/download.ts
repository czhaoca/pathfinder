/**
 * Download utility functions
 */

/**
 * Download a blob as a file
 */
export function downloadBlob(blob: Blob, filename: string) {
  const url = window.URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  window.URL.revokeObjectURL(url)
  document.body.removeChild(a)
}

/**
 * Generate a timestamped filename
 */
export function generateFilename(prefix: string, extension: string): string {
  const timestamp = new Date().toISOString().split('T')[0]
  return `${prefix}-${timestamp}.${extension}`
}

/**
 * Download JSON data as a file
 */
export function downloadJSON(data: any, filename: string) {
  const json = JSON.stringify(data, null, 2)
  const blob = new Blob([json], { type: 'application/json' })
  downloadBlob(blob, filename)
}

/**
 * Download CSV data as a file
 */
export function downloadCSV(data: string[][], filename: string) {
  const csv = data.map(row => row.map(cell => {
    // Escape quotes and wrap in quotes if contains comma
    const escaped = String(cell).replace(/"/g, '""')
    return escaped.includes(',') ? `"${escaped}"` : escaped
  }).join(',')).join('\n')
  
  const blob = new Blob([csv], { type: 'text/csv' })
  downloadBlob(blob, filename)
}