import React from 'react'
import ReactDOM from 'react-dom/client'
import { FabricDesignView } from './app.view'
import { __resetFGDStubForTests } from './io/fgd.js'

// Expose reset function for tests
if (typeof window !== 'undefined') {
  (window as any).__HNC_RESET__ = () => { 
    __resetFGDStubForTests()
    localStorage.clear()
    sessionStorage.clear()
  }
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <FabricDesignView />
  </React.StrictMode>,
)