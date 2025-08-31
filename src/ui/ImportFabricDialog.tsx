import React, { useState, useRef } from 'react'
import type { FabricSpec } from '../app.types'

export interface ImportFabricDialogProps {
  isOpen: boolean
  onClose: () => void
  onImport: (fabricSpec: FabricSpec) => void
  importProgress?: {
    status: 'idle' | 'importing' | 'success' | 'error'
    message?: string
    progress?: number
  }
}

/**
 * Dialog component for importing fabric specifications from FGD files
 * Provides file picker with drag-and-drop support and accessibility compliance
 */
export const ImportFabricDialog: React.FC<ImportFabricDialogProps> = ({
  isOpen,
  onClose,
  onImport,
  importProgress = { status: 'idle' }
}) => {
  const [dragActive, setDragActive] = useState(false)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [importData, setImportData] = useState<string>('')
  const fileInputRef = useRef<HTMLInputElement>(null)

  if (!isOpen) return null

  const handleFileSelect = (file: File) => {
    setSelectedFile(file)
    
    if (file.type === 'application/json' || file.name.endsWith('.json') || 
        file.type === 'application/x-yaml' || file.name.endsWith('.yaml') || 
        file.name.endsWith('.yml')) {
      
      const reader = new FileReader()
      reader.onload = (e) => {
        const content = e.target?.result as string
        setImportData(content)
      }
      reader.readAsText(file)
    }
  }

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true)
    } else if (e.type === 'dragleave') {
      setDragActive(false)
    }
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(false)
    
    const files = Array.from(e.dataTransfer.files)
    if (files.length > 0) {
      handleFileSelect(files[0])
    }
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (files && files.length > 0) {
      handleFileSelect(files[0])
    }
  }

  const handleImport = () => {
    if (!importData) return

    try {
      // Try to parse as JSON first, then YAML if it fails
      let fabricSpec: FabricSpec
      
      if (importData.trim().startsWith('{')) {
        fabricSpec = JSON.parse(importData)
      } else {
        // For YAML, we'll use a simple parser for now
        // In production, you'd want to use a proper YAML library
        throw new Error('YAML parsing not implemented in this demo')
      }
      
      // Validate the structure has required fields
      if (!fabricSpec.name || !fabricSpec.spineModelId || !fabricSpec.leafModelId) {
        throw new Error('Invalid fabric specification: missing required fields (name, spineModelId, leafModelId)')
      }
      
      onImport(fabricSpec)
    } catch (error) {
      console.error('Failed to parse import file:', error)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      onClose()
    } else if (e.key === 'Enter' && (e.metaKey || e.ctrlKey) && importData) {
      handleImport()
    }
  }

  return (
    <div 
      className="import-dialog-overlay"
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000
      }}
      data-testid="import-fabric-dialog"
      onKeyDown={handleKeyDown}
      tabIndex={-1}
    >
      <div
        role="dialog"
        aria-labelledby="import-dialog-title"
        aria-describedby="import-dialog-description"
        style={{
          backgroundColor: 'white',
          padding: '2rem',
          borderRadius: '8px',
          boxShadow: '0 4px 20px rgba(0, 0, 0, 0.15)',
          maxWidth: '600px',
          width: '90%',
          maxHeight: '80vh',
          overflow: 'auto'
        }}
      >
        <header style={{ marginBottom: '1.5rem' }}>
          <h2 id="import-dialog-title" style={{ margin: 0, fontSize: '1.5rem' }}>
            Import Fabric Configuration
          </h2>
          <p id="import-dialog-description" style={{ margin: '0.5rem 0 0 0', color: '#666' }}>
            Import a fabric specification from an FGD JSON file or YAML configuration.
          </p>
        </header>

        {/* File Drop Zone */}
        <div
          className={`file-drop-zone ${dragActive ? 'drag-active' : ''}`}
          style={{
            border: `2px dashed ${dragActive ? '#007bff' : '#ccc'}`,
            borderRadius: '8px',
            padding: '2rem',
            textAlign: 'center',
            marginBottom: '1rem',
            backgroundColor: dragActive ? '#f8f9ff' : '#fafafa',
            cursor: 'pointer',
            transition: 'all 0.2s ease'
          }}
          onDragEnter={handleDrag}
          onDragLeave={handleDrag}
          onDragOver={handleDrag}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          role="button"
          aria-label="Drop files here or click to select"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault()
              fileInputRef.current?.click()
            }
          }}
          data-testid="file-drop-zone"
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".json,.yaml,.yml"
            onChange={handleInputChange}
            style={{ display: 'none' }}
            aria-label="Select fabric configuration file"
            data-testid="file-input"
          />
          
          <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>📁</div>
          <p style={{ margin: '0 0 0.5rem 0', fontWeight: 'bold' }}>
            Drop your fabric configuration here
          </p>
          <p style={{ margin: 0, color: '#666', fontSize: '0.9rem' }}>
            or click to browse for JSON/YAML files
          </p>
        </div>

        {/* Selected File Info */}
        {selectedFile && (
          <div 
            style={{
              padding: '1rem',
              backgroundColor: '#e8f5e8',
              border: '1px solid #4caf50',
              borderRadius: '4px',
              marginBottom: '1rem'
            }}
            data-testid="selected-file-info"
          >
            <p style={{ margin: '0 0 0.5rem 0', fontWeight: 'bold' }}>
              Selected File:
            </p>
            <p style={{ margin: 0, fontSize: '0.9rem' }}>
              {selectedFile.name} ({Math.round(selectedFile.size / 1024)}KB)
            </p>
          </div>
        )}

        {/* Import Progress */}
        {importProgress.status !== 'idle' && (
          <div 
            style={{
              padding: '1rem',
              marginBottom: '1rem',
              borderRadius: '4px',
              backgroundColor: 
                importProgress.status === 'success' ? '#e8f5e8' :
                importProgress.status === 'error' ? '#ffe8e8' :
                '#fff3cd'
            }}
            data-testid="import-progress"
            role="status"
            aria-live="polite"
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              {importProgress.status === 'importing' && (
                <div 
                  style={{ 
                    width: '16px', 
                    height: '16px', 
                    border: '2px solid #ccc',
                    borderTop: '2px solid #007bff',
                    borderRadius: '50%',
                    animation: 'spin 1s linear infinite' 
                  }}
                  aria-label="Importing"
                />
              )}
              {importProgress.status === 'success' && <span style={{ color: '#4caf50' }}>✓</span>}
              {importProgress.status === 'error' && <span style={{ color: '#f44336' }}>✗</span>}
              
              <span>{importProgress.message || 'Processing...'}</span>
            </div>
            
            {importProgress.progress !== undefined && (
              <div 
                style={{ 
                  marginTop: '0.5rem',
                  height: '4px',
                  backgroundColor: '#eee',
                  borderRadius: '2px'
                }}
              >
                <div 
                  style={{
                    width: `${importProgress.progress}%`,
                    height: '100%',
                    backgroundColor: '#007bff',
                    borderRadius: '2px',
                    transition: 'width 0.3s ease'
                  }}
                  role="progressbar"
                  aria-valuenow={importProgress.progress}
                  aria-valuemin={0}
                  aria-valuemax={100}
                />
              </div>
            )}
          </div>
        )}

        {/* Actions */}
        <div 
          style={{ 
            display: 'flex', 
            gap: '1rem', 
            justifyContent: 'flex-end',
            marginTop: '1.5rem'
          }}
        >
          <button
            type="button"
            onClick={onClose}
            style={{
              padding: '0.75rem 1.5rem',
              border: '1px solid #ccc',
              backgroundColor: 'white',
              borderRadius: '4px',
              cursor: 'pointer'
            }}
            data-testid="cancel-import-button"
            aria-label="Cancel import"
          >
            Cancel
          </button>
          
          <button
            type="button"
            onClick={handleImport}
            disabled={!importData || importProgress.status === 'importing'}
            style={{
              padding: '0.75rem 1.5rem',
              border: 'none',
              backgroundColor: importData && importProgress.status !== 'importing' ? '#007bff' : '#ccc',
              color: 'white',
              borderRadius: '4px',
              cursor: importData && importProgress.status !== 'importing' ? 'pointer' : 'not-allowed',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem'
            }}
            data-testid="import-button"
            aria-label="Import fabric configuration"
          >
            {importProgress.status === 'importing' ? 'Importing...' : 'Import'}
          </button>
        </div>
      </div>

      <style jsx>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  )
}