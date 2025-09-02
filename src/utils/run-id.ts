/**
 * Generate unique run IDs for CI operations
 * Format: timestamp-random for readability and uniqueness
 */

/**
 * Generate a unique run ID for CI operations
 * Format: YYYYMMDD-HHMMSS-XXXXX (date-time-random)
 */
export function generateRunId(): string {
  const now = new Date()
  
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  
  const hours = String(now.getHours()).padStart(2, '0')
  const minutes = String(now.getMinutes()).padStart(2, '0')
  const seconds = String(now.getSeconds()).padStart(2, '0')
  
  const random = Math.random().toString(36).substring(2, 7).toUpperCase()
  
  return `${year}${month}${day}-${hours}${minutes}${seconds}-${random}`
}

/**
 * Parse run ID to extract timestamp
 */
export function parseRunId(runId: string): { timestamp: Date | null; random: string | null } {
  const match = runId.match(/^(\d{8})-(\d{6})-([A-Z0-9]{5})$/)
  
  if (!match) {
    return { timestamp: null, random: null }
  }
  
  const [, dateStr, timeStr, random] = match
  
  const year = parseInt(dateStr.substring(0, 4), 10)
  const month = parseInt(dateStr.substring(4, 6), 10) - 1
  const day = parseInt(dateStr.substring(6, 8), 10)
  
  const hours = parseInt(timeStr.substring(0, 2), 10)
  const minutes = parseInt(timeStr.substring(2, 4), 10)
  const seconds = parseInt(timeStr.substring(4, 6), 10)
  
  const timestamp = new Date(year, month, day, hours, minutes, seconds)
  
  return { timestamp, random }
}

/**
 * Check if run ID is recent (within specified hours)
 */
export function isRecentRunId(runId: string, withinHours: number = 24): boolean {
  const { timestamp } = parseRunId(runId)
  
  if (!timestamp) return false
  
  const now = new Date()
  const ageMs = now.getTime() - timestamp.getTime()
  const ageHours = ageMs / (1000 * 60 * 60)
  
  return ageHours <= withinHours
}