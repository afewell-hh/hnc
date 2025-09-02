/**
 * ExternalLinkEditor Component - WP-EXT1 Step S3
 * UI component for external connectivity configuration
 */

import React, { useState, useCallback, useEffect } from 'react'
import type { 
  ExternalLink, 
  ExplicitPort, 
  BorderCapabilities,
  ExternalLinkAllocation 
} from '../../domain/external-link'
import { 
  createExternalLink,
  validateExternalLink,
  convertBandwidthToPorts,
  convertToExplicitMode,
  convertToBandwidthMode,
  calculateTotalBandwidth,
  getDefaultBorderCapabilities
} from '../../domain/external-link'
import { validateBorderConfiguration, type BorderValidation } from '../../domain/border-validation'
import { convertBandwidthToPortsAdvanced, type ConversionOptions } from '../../domain/bandwidth-converter'

export interface ExternalLinkEditorProps {
  externalLinks: ExternalLink[]
  onLinksChange: (links: ExternalLink[]) => void
  borderCapabilities?: BorderCapabilities
  spineCount?: number  // for divisibility validation
  mode?: 'guided' | 'expert'
  onValidationChange?: (validation: BorderValidation) => void
}

const ExternalLinkEditor: React.FC<ExternalLinkEditorProps> = ({
  externalLinks,
  onLinksChange,
  borderCapabilities,
  spineCount,
  mode = 'guided',
  onValidationChange
}) => {
  const [selectedLinkId, setSelectedLinkId] = useState<string | null>(null)
  const [showAdvancedOptions, setShowAdvancedOptions] = useState(false)
  const [validation, setValidation] = useState<BorderValidation | null>(null)

  // Validate on changes
  useEffect(() => {
    const borderValidation = validateBorderConfiguration(externalLinks, {
      borderLeafModel: borderCapabilities ? undefined : undefined, // Use default if not provided
      spineCount,
      strictMode: false
    })
    
    setValidation(borderValidation)
    onValidationChange?.(borderValidation)
  }, [externalLinks, borderCapabilities, spineCount, onValidationChange])

  const handleAddLink = useCallback(() => {
    const newLink = createExternalLink(`external-link-${externalLinks.length + 1}`)
    onLinksChange([...externalLinks, newLink])
    setSelectedLinkId(newLink.id)
  }, [externalLinks, onLinksChange])

  const handleDeleteLink = useCallback((linkId: string) => {
    const updatedLinks = externalLinks.filter(link => link.id !== linkId)
    onLinksChange(updatedLinks)
    if (selectedLinkId === linkId) {
      setSelectedLinkId(null)
    }
  }, [externalLinks, onLinksChange, selectedLinkId])

  const handleUpdateLink = useCallback((updatedLink: ExternalLink) => {
    const updatedLinks = externalLinks.map(link => 
      link.id === updatedLink.id ? updatedLink : link
    )
    onLinksChange(updatedLinks)
  }, [externalLinks, onLinksChange])

  const handleDuplicateLink = useCallback((linkId: string) => {
    const sourceLink = externalLinks.find(link => link.id === linkId)
    if (sourceLink) {
      const duplicatedLink = {
        ...sourceLink,
        id: `${sourceLink.id}-copy-${Date.now()}`,
        name: `${sourceLink.name} (Copy)`
      }
      onLinksChange([...externalLinks, duplicatedLink])
    }
  }, [externalLinks, onLinksChange])

  const selectedLink = selectedLinkId ? externalLinks.find(link => link.id === selectedLinkId) : null

  const renderLinkList = () => (
    <div className="external-link-list">
      <div className="link-list-header">
        <h4>External Links</h4>
        <button 
          className="btn btn-primary btn-sm"
          onClick={handleAddLink}
        >
          + Add Link
        </button>
      </div>

      {externalLinks.length === 0 ? (
        <div className="empty-state">
          <p>No external links configured.</p>
          <p className="text-muted">Add an external link to configure border connectivity.</p>
        </div>
      ) : (
        <div className="link-items">
          {externalLinks.map(link => (
            <div 
              key={link.id}
              className={`link-item ${selectedLinkId === link.id ? 'selected' : ''} ${!link.enabled ? 'disabled' : ''}`}
              onClick={() => setSelectedLinkId(link.id)}
            >
              <div className="link-item-content">
                <div className="link-name">{link.name}</div>
                <div className="link-summary">
                  {link.mode === 'target-bandwidth' 
                    ? `Target: ${link.targetGbps}Gbps`
                    : `${link.explicitPorts?.reduce((sum, p) => sum + p.count, 0) || 0} ports`
                  }
                </div>
                {link.category && (
                  <div className="link-category">{link.category}</div>
                )}
              </div>
              
              <div className="link-actions">
                <button
                  className="btn btn-link btn-sm"
                  onClick={(e) => { e.stopPropagation(); handleDuplicateLink(link.id) }}
                  title="Duplicate"
                >
                  📋
                </button>
                <button
                  className="btn btn-link btn-sm text-danger"
                  onClick={(e) => { e.stopPropagation(); handleDeleteLink(link.id) }}
                  title="Delete"
                >
                  🗑️
                </button>
              </div>

              <LinkValidationIndicator link={link} capabilities={borderCapabilities} />
            </div>
          ))}
        </div>
      )}
    </div>
  )

  const renderLinkEditor = () => {
    if (!selectedLink) {
      return (
        <div className="link-editor-placeholder">
          <p>Select an external link to configure</p>
        </div>
      )
    }

    return (
      <div className="link-editor">
        <LinkEditorContent
          link={selectedLink}
          onUpdate={handleUpdateLink}
          capabilities={borderCapabilities}
          spineCount={spineCount}
          showAdvanced={showAdvancedOptions}
          mode={mode}
        />
      </div>
    )
  }

  const renderValidationSummary = () => {
    if (!validation) return null

    const { overallStatus } = validation
    const statusClass = overallStatus.level === 'error' ? 'alert-danger' : 
                       overallStatus.level === 'warning' ? 'alert-warning' : 'alert-success'

    return (
      <div className={`validation-summary alert ${statusClass}`}>
        <div className="validation-header">
          <strong>{overallStatus.summary}</strong>
          {!overallStatus.canSave && (
            <span className="badge badge-danger ms-2">Blocks Save</span>
          )}
        </div>
        {overallStatus.details.length > 0 && (
          <ul className="validation-details">
            {overallStatus.details.map((detail, index) => (
              <li key={index}>{detail}</li>
            ))}
          </ul>
        )}
      </div>
    )
  }

  const renderControls = () => (
    <div className="external-controls">
      {mode === 'expert' && (
        <label className="form-check">
          <input
            type="checkbox"
            checked={showAdvancedOptions}
            onChange={(e) => setShowAdvancedOptions(e.target.checked)}
            className="form-check-input"
          />
          <span className="form-check-label">Show advanced options</span>
        </label>
      )}
    </div>
  )

  return (
    <div className="external-link-editor">
      <div className="editor-header">
        <h3>External Connectivity</h3>
        <p className="text-muted">
          Configure external links for internet, datacenter interconnect, or other border connectivity.
        </p>
      </div>

      {renderValidationSummary()}
      {renderControls()}

      <div className="editor-layout">
        <div className="editor-sidebar">
          {renderLinkList()}
        </div>
        <div className="editor-main">
          {renderLinkEditor()}
        </div>
      </div>
    </div>
  )
}

// Individual link editor component
interface LinkEditorContentProps {
  link: ExternalLink
  onUpdate: (link: ExternalLink) => void
  capabilities?: BorderCapabilities
  spineCount?: number
  showAdvanced: boolean
  mode: 'guided' | 'expert'
}

const LinkEditorContent: React.FC<LinkEditorContentProps> = ({
  link,
  onUpdate,
  capabilities,
  spineCount,
  showAdvanced,
  mode
}) => {
  const [allocation, setAllocation] = useState<ExternalLinkAllocation | null>(null)

  // Recalculate allocation when link changes
  useEffect(() => {
    const newAllocation = validateExternalLink(link, capabilities)
    setAllocation(newAllocation)
  }, [link, capabilities])

  const handleBasicUpdate = (field: keyof ExternalLink, value: any) => {
    onUpdate({ ...link, [field]: value })
  }

  const handleModeSwitch = (newMode: 'target-bandwidth' | 'explicit-ports') => {
    if (newMode === link.mode) return

    if (newMode === 'explicit-ports') {
      const explicitLink = convertToExplicitMode(link, capabilities)
      onUpdate(explicitLink)
    } else {
      const bandwidthLink = convertToBandwidthMode(link, allocation?.totalBandwidthGbps)
      onUpdate(bandwidthLink)
    }
  }

  const handleAdvancedConversion = () => {
    if (link.mode !== 'target-bandwidth' || !link.targetGbps) return

    const options: ConversionOptions = {
      preferredSpeed: link.preferredSpeed,
      allowBreakout: true,
      optimizeFor: 'efficiency',
      maxPortWaste: 25,
      lagCompatible: false
    }

    const advancedResult = convertBandwidthToPortsAdvanced(
      link.targetGbps,
      capabilities || getDefaultBorderCapabilities(),
      options
    )

    const explicitLink: ExternalLink = {
      ...link,
      mode: 'explicit-ports',
      explicitPorts: advancedResult.ports,
      targetGbps: undefined,
      preferredSpeed: undefined
    }

    onUpdate(explicitLink)
  }

  const handleAddExplicitPort = () => {
    const currentPorts = link.explicitPorts || []
    const newPorts = [...currentPorts, { speed: '100G' as const, count: 1 }]
    onUpdate({ ...link, explicitPorts: newPorts })
  }

  const handleUpdateExplicitPort = (index: number, field: keyof ExplicitPort, value: any) => {
    const currentPorts = link.explicitPorts || []
    const updatedPorts = currentPorts.map((port, i) => 
      i === index ? { ...port, [field]: value } : port
    )
    onUpdate({ ...link, explicitPorts: updatedPorts })
  }

  const handleRemoveExplicitPort = (index: number) => {
    const currentPorts = link.explicitPorts || []
    const updatedPorts = currentPorts.filter((_, i) => i !== index)
    onUpdate({ ...link, explicitPorts: updatedPorts })
  }

  return (
    <div className="link-editor-content">
      <div className="basic-settings">
        <div className="form-group">
          <label>Link Name</label>
          <input
            type="text"
            value={link.name}
            onChange={(e) => handleBasicUpdate('name', e.target.value)}
            className="form-control"
            placeholder="e.g., Internet Uplink"
          />
        </div>

        <div className="form-group">
          <label>Description</label>
          <input
            type="text"
            value={link.description || ''}
            onChange={(e) => handleBasicUpdate('description', e.target.value)}
            className="form-control"
            placeholder="Optional description"
          />
        </div>

        <div className="form-row">
          <div className="form-group col-md-6">
            <label>Category</label>
            <select
              value={link.category}
              onChange={(e) => handleBasicUpdate('category', e.target.value)}
              className="form-control"
            >
              <option value="vpc.external">VPC External</option>
              <option value="vpc.staticExternal">VPC Static External</option>
            </select>
          </div>

          <div className="form-group col-md-6">
            <label className="form-check">
              <input
                type="checkbox"
                checked={link.enabled !== false}
                onChange={(e) => handleBasicUpdate('enabled', e.target.checked)}
                className="form-check-input"
              />
              <span className="form-check-label">Enabled</span>
            </label>
          </div>
        </div>
      </div>

      <div className="mode-selection">
        <label>Configuration Mode</label>
        <div className="btn-group" role="group">
          <button
            type="button"
            className={`btn ${link.mode === 'target-bandwidth' ? 'btn-primary' : 'btn-outline-primary'}`}
            onClick={() => handleModeSwitch('target-bandwidth')}
          >
            Target Bandwidth
          </button>
          <button
            type="button"
            className={`btn ${link.mode === 'explicit-ports' ? 'btn-primary' : 'btn-outline-primary'}`}
            onClick={() => handleModeSwitch('explicit-ports')}
          >
            Explicit Ports
          </button>
        </div>
      </div>

      {link.mode === 'target-bandwidth' ? (
        <TargetBandwidthEditor
          link={link}
          onUpdate={onUpdate}
          capabilities={capabilities}
          showAdvanced={showAdvanced}
          onAdvancedConversion={handleAdvancedConversion}
        />
      ) : (
        <ExplicitPortsEditor
          link={link}
          onAddPort={handleAddExplicitPort}
          onUpdatePort={handleUpdateExplicitPort}
          onRemovePort={handleRemoveExplicitPort}
          capabilities={capabilities}
        />
      )}

      {allocation && (
        <AllocationPreview 
          allocation={allocation} 
          spineCount={spineCount}
          showAdvanced={showAdvanced}
        />
      )}
    </div>
  )
}

// Target bandwidth mode editor
interface TargetBandwidthEditorProps {
  link: ExternalLink
  onUpdate: (link: ExternalLink) => void
  capabilities?: BorderCapabilities
  showAdvanced: boolean
  onAdvancedConversion: () => void
}

const TargetBandwidthEditor: React.FC<TargetBandwidthEditorProps> = ({
  link,
  onUpdate,
  capabilities,
  showAdvanced,
  onAdvancedConversion
}) => {
  const availableSpeeds = capabilities?.availableSpeeds || ['10G', '25G', '100G', '400G']

  return (
    <div className="target-bandwidth-editor">
      <div className="form-row">
        <div className="form-group col-md-6">
          <label>Target Bandwidth (Gbps)</label>
          <input
            type="number"
            value={link.targetGbps || ''}
            onChange={(e) => onUpdate({ ...link, targetGbps: parseInt(e.target.value) || 0 })}
            className="form-control"
            placeholder="100"
            min="1"
            max="10000"
          />
        </div>

        <div className="form-group col-md-6">
          <label>Preferred Speed</label>
          <select
            value={link.preferredSpeed || ''}
            onChange={(e) => onUpdate({ ...link, preferredSpeed: e.target.value as any || undefined })}
            className="form-control"
          >
            <option value="">Auto (Optimal)</option>
            {availableSpeeds.map(speed => (
              <option key={speed} value={speed}>{speed}</option>
            ))}
          </select>
        </div>
      </div>

      {showAdvanced && (
        <div className="advanced-options">
          <h5>Advanced Conversion</h5>
          <p className="text-muted">
            Use advanced algorithms to optimize port allocation for efficiency, cost, or simplicity.
          </p>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={onAdvancedConversion}
            disabled={!link.targetGbps}
          >
            Apply Advanced Optimization
          </button>
        </div>
      )}
    </div>
  )
}

// Explicit ports mode editor
interface ExplicitPortsEditorProps {
  link: ExternalLink
  onAddPort: () => void
  onUpdatePort: (index: number, field: keyof ExplicitPort, value: any) => void
  onRemovePort: (index: number) => void
  capabilities?: BorderCapabilities
}

const ExplicitPortsEditor: React.FC<ExplicitPortsEditorProps> = ({
  link,
  onAddPort,
  onUpdatePort,
  onRemovePort,
  capabilities
}) => {
  const availableSpeeds = capabilities?.availableSpeeds || ['10G', '25G', '100G', '400G']
  const ports = link.explicitPorts || []

  return (
    <div className="explicit-ports-editor">
      <div className="ports-header">
        <h5>Port Configuration</h5>
        <button
          type="button"
          className="btn btn-sm btn-primary"
          onClick={onAddPort}
        >
          + Add Port Group
        </button>
      </div>

      {ports.length === 0 ? (
        <div className="empty-state">
          <p>No ports configured. Add a port group to specify exact port requirements.</p>
        </div>
      ) : (
        <div className="ports-list">
          {ports.map((port, index) => (
            <div key={index} className="port-group">
              <div className="form-row">
                <div className="form-group col-md-4">
                  <label>Speed</label>
                  <select
                    value={port.speed}
                    onChange={(e) => onUpdatePort(index, 'speed', e.target.value)}
                    className="form-control"
                  >
                    {availableSpeeds.map(speed => (
                      <option key={speed} value={speed}>{speed}</option>
                    ))}
                  </select>
                </div>

                <div className="form-group col-md-6">
                  <label>Port Count</label>
                  <input
                    type="number"
                    value={port.count}
                    onChange={(e) => onUpdatePort(index, 'count', parseInt(e.target.value) || 0)}
                    className="form-control"
                    min="1"
                    max="128"
                  />
                </div>

                <div className="form-group col-md-2">
                  <label>&nbsp;</label>
                  <button
                    type="button"
                    className="btn btn-danger btn-block"
                    onClick={() => onRemovePort(index)}
                  >
                    Remove
                  </button>
                </div>
              </div>

              <div className="port-summary">
                Total: {port.count * parseInt(port.speed.replace('G', ''))}Gbps
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// Allocation preview component
interface AllocationPreviewProps {
  allocation: ExternalLinkAllocation
  spineCount?: number
  showAdvanced: boolean
}

const AllocationPreview: React.FC<AllocationPreviewProps> = ({
  allocation,
  spineCount,
  showAdvanced
}) => {
  const { allocatedPorts, totalBandwidthGbps, efficiency, warnings, errors } = allocation

  return (
    <div className="allocation-preview">
      <h5>Configuration Preview</h5>
      
      <div className="allocation-summary">
        <div className="summary-metrics">
          <div className="metric">
            <label>Total Bandwidth</label>
            <div className="value">{totalBandwidthGbps}Gbps</div>
          </div>
          <div className="metric">
            <label>Efficiency</label>
            <div className="value">{efficiency}%</div>
          </div>
          <div className="metric">
            <label>Total Ports</label>
            <div className="value">
              {allocatedPorts.reduce((sum, p) => sum + p.count, 0)}
            </div>
          </div>
        </div>

        {allocatedPorts.length > 0 && (
          <div className="port-breakdown">
            <label>Port Allocation</label>
            {allocatedPorts.map((port, index) => (
              <div key={index} className="port-line">
                {port.count}× {port.speed} = {port.count * parseInt(port.speed.replace('G', ''))}Gbps
              </div>
            ))}
          </div>
        )}
      </div>

      {spineCount && showAdvanced && (
        <div className="divisibility-check">
          <label>Spine Distribution</label>
          <div className="distribution-info">
            {allocatedPorts.map((port, index) => {
              const portsPerSpine = Math.floor(port.count / spineCount)
              const remainder = port.count % spineCount
              return (
                <div key={index} className="distribution-line">
                  {port.speed}: {portsPerSpine} per spine 
                  {remainder > 0 && <span className="text-warning"> (+{remainder} uneven)</span>}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {(warnings.length > 0 || errors.length > 0) && (
        <div className="allocation-issues">
          {errors.map((error, index) => (
            <div key={index} className="alert alert-danger">{error}</div>
          ))}
          {warnings.map((warning, index) => (
            <div key={index} className="alert alert-warning">{warning}</div>
          ))}
        </div>
      )}
    </div>
  )
}

// Link validation indicator component
interface LinkValidationIndicatorProps {
  link: ExternalLink
  capabilities?: BorderCapabilities
}

const LinkValidationIndicator: React.FC<LinkValidationIndicatorProps> = ({
  link,
  capabilities
}) => {
  const allocation = validateExternalLink(link, capabilities)
  
  let indicatorClass = 'status-ok'
  let indicatorIcon = '✓'
  
  if (allocation.errors.length > 0) {
    indicatorClass = 'status-error'
    indicatorIcon = '✗'
  } else if (allocation.warnings.length > 0) {
    indicatorClass = 'status-warning'
    indicatorIcon = '⚠'
  }

  return (
    <div className={`validation-indicator ${indicatorClass}`} title={allocation.errors[0] || allocation.warnings[0] || 'Valid'}>
      {indicatorIcon}
    </div>
  )
}

export default ExternalLinkEditor