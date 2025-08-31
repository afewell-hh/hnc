import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'

// Dynamic import to avoid TypeScript issues with .js files
async function setupTestHelpers() {
  if (typeof window !== 'undefined') {
    try {
      const fgdModule = await import('./io/fgd.js') as any
      ;(window as any).__HNC_RESET__ = () => { 
        if (fgdModule.__resetFGDStubForTests) {
          fgdModule.__resetFGDStubForTests()
        }
        localStorage.clear()
        sessionStorage.clear()
      }
    } catch (e) {
      // Fallback if import fails
      ;(window as any).__HNC_RESET__ = () => {
        localStorage.clear()
        sessionStorage.clear()
      }
    }
  }
}

// Setup test helpers
setupTestHelpers()

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)