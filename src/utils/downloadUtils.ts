/**
 * Download utilities for YAML file packaging
 */

/**
 * Downloads multiple files as a ZIP archive
 * @param files Object with filename as key and content as value
 * @param zipName Name of the ZIP file to download
 */
export async function downloadZip(files: Record<string, string>, zipName: string): Promise<void> {
  try {
    // Use dynamic import to load JSZip only when needed
    const JSZip = (await import('jszip')).default
    
    const zip = new JSZip()
    
    // Add each file to the ZIP
    Object.entries(files).forEach(([filename, content]) => {
      zip.file(filename, content)
    })
    
    // Generate ZIP blob
    const zipBlob = await zip.generateAsync({ type: 'blob' })
    
    // Create download link
    const url = URL.createObjectURL(zipBlob)
    const link = document.createElement('a')
    link.href = url
    link.download = zipName
    
    // Trigger download
    document.body.appendChild(link)
    link.click()
    
    // Cleanup
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
    
  } catch (error) {
    console.error('Failed to create ZIP download:', error)
    throw new Error('Failed to download files as ZIP')
  }
}

/**
 * Downloads a single text file
 * @param content File content
 * @param filename Name of file to download
 * @param mimeType MIME type (defaults to text/plain)
 */
export function downloadTextFile(
  content: string, 
  filename: string, 
  mimeType: string = 'text/plain'
): void {
  const blob = new Blob([content], { type: mimeType })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  
  link.href = url
  link.download = filename
  
  document.body.appendChild(link)
  link.click()
  
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}