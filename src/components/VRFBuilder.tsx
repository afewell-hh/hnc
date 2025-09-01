/**
 * VRFBuilder Component - WP-VPC1
 * VRF (Virtual Routing and Forwarding) configuration with route targets and network assignments
 */

import React, { useCallback, useMemo } from 'react'
import type { VRFBuilderProps, VRFConfig, VPCNetwork } from '../types/vpc-editor.types'
import { createFieldProvenance } from '../utils/provenance.utils'

const VRFBuilder: React.FC<VRFBuilderProps> = ({
  vrf,
  onChange,
  availableNetworks,
  existingVrfs,
  mode = 'guided'
}) => {
  const handleVRFChange = useCallback((field: keyof VRFConfig, value: any) => {
    onChange({
      ...vrf,
      [field]: value,
      provenance: createFieldProvenance('user', field)
    })
  }, [vrf, onChange])

  const handleRouteTargetChange = useCallback((
    type: 'import' | 'export', 
    targets: string[]
  ) => {
    const updatedRouteTargets = {
      ...vrf.routeTargets,
      [type]: targets
    }
    
    onChange({
      ...vrf,
      routeTargets: updatedRouteTargets,
      provenance: createFieldProvenance('user', 'routeTargets')
    })
  }, [vrf, onChange])

  const handleNetworkAssignment = useCallback((networkName: string, assigned: boolean) => {
    const updatedNetworks = assigned
      ? [...vrf.networks, networkName]
      : vrf.networks.filter(n => n !== networkName)
    
    onChange({
      ...vrf,
      networks: updatedNetworks,
      provenance: createFieldProvenance('user', 'networks')
    })
  }, [vrf, onChange])

  const validationMessages = useMemo(() => {
    return validateVRF(vrf, availableNetworks, existingVrfs)
  }, [vrf, availableNetworks, existingVrfs])

  const renderGuidedMode = () => (
    <div className="guided-mode">
      <div className="form-section">
        <h4>VRF Basics</h4>
        <div className="form-row">
          <label>
            VRF Name:
            <input
              type="text"
              value={vrf.name}
              onChange={(e) => handleVRFChange('name', e.target.value)}
              className="form-control"
              placeholder="production-vrf"
            />
            <div className="field-help">
              Unique identifier for this VRF instance
            </div>
          </label>
          <label>
            Description:
            <input
              type="text"
              value={vrf.description || ''}
              onChange={(e) => handleVRFChange('description', e.target.value)}
              className="form-control"
              placeholder="Production environment VRF"
            />
          </label>
        </div>
      </div>

      <div className="form-section">
        <h4>Route Configuration</h4>
        <div className="form-row">
          <label>
            Route Distinguisher:
            <input
              type="text"
              value={vrf.routeDistinguisher}
              onChange={(e) => handleVRFChange('routeDistinguisher', e.target.value)}
              className="form-control"
              placeholder="65000:1"
            />
            <div className="field-help">
              Format: ASN:number (e.g., 65000:1) or IP:number (e.g., 10.0.0.1:1)
              <br />Uniquely identifies routes in this VRF
            </div>
          </label>
        </div>
      </div>

      <div className="form-section">
        <h4>Route Targets</h4>
        <p className="section-help">
          Route targets control which routes are imported/exported between VRFs
        </p>
        
        <div className="route-targets">
          <div className="route-target-section">
            <h5>Import Targets</h5>
            <RouteTargetList
              targets={vrf.routeTargets.import}
              onChange={(targets) => handleRouteTargetChange('import', targets)}
              placeholder="65000:100"
              helpText="Routes with these targets will be imported into this VRF"
            />
          </div>
          
          <div className="route-target-section">
            <h5>Export Targets</h5>
            <RouteTargetList
              targets={vrf.routeTargets.export}
              onChange={(targets) => handleRouteTargetChange('export', targets)}
              placeholder="65000:200"
              helpText="Routes from this VRF will be tagged with these targets"
            />
          </div>
        </div>
      </div>

      <div className="form-section">
        <h4>Network Assignment</h4>
        <p className="section-help">
          Select which networks belong to this VRF
        </p>
        
        <div className="network-assignment">
          {availableNetworks.length === 0 ? (
            <div className="empty-state">
              <p>No networks available. Create networks first to assign them to VRFs.</p>
            </div>
          ) : (
            availableNetworks.map(network => (
              <NetworkAssignmentItem
                key={network.name}
                network={network}
                assigned={vrf.networks.includes(network.name)}
                onToggle={(assigned) => handleNetworkAssignment(network.name, assigned)}
              />
            ))
          )}
        </div>
      </div>
    </div>
  )

  const renderExpertMode = () => (
    <div className="expert-mode">
      <div className="json-editor">
        <h4>VRF Configuration (JSON)</h4>
        <textarea
          value={JSON.stringify(vrf, null, 2)}
          onChange={(e) => {
            try {
              const parsed = JSON.parse(e.target.value)
              onChange(parsed)
            } catch {
              // Invalid JSON, ignore for now
            }
          }}
          className="json-textarea"
          rows={20}
        />
        <div className="json-help">
          <h5>VRF Configuration Schema:</h5>
          <pre>{`{
  "name": "string",
  "routeDistinguisher": "ASN:number | IP:number",
  "routeTargets": {
    "import": ["target1", "target2"],
    "export": ["target1", "target2"]
  },
  "networks": ["network1", "network2"],
  "description": "string"
}`}</pre>
        </div>
      </div>
    </div>
  )

  const renderValidationMessages = () => (
    <div className="validation-section">
      {validationMessages.errors.map((error, index) => (
        <div key={`error-${index}`} className="validation-error">
          <strong>❌ Error:</strong> {error.what}
          <div className="validation-details">
            <div><strong>How to fix:</strong> {error.how}</div>
            <div><strong>Why:</strong> {error.why}</div>
          </div>
        </div>
      ))}
      
      {validationMessages.warnings.map((warning, index) => (
        <div key={`warning-${index}`} className="validation-warning">
          <strong>⚠️ Warning:</strong> {warning.what}
          <div className="validation-details">
            <div><strong>Recommendation:</strong> {warning.how}</div>
            <div><strong>Why:</strong> {warning.why}</div>
          </div>
        </div>
      ))}
    </div>
  )

  return (
    <div className="vrf-builder">
      <div className="builder-header">
        <h3>VRF Configuration</h3>
        <div className="mode-indicator">
          Mode: <span className="mode-badge">{mode}</span>
        </div>
      </div>

      {validationMessages.errors.length > 0 || validationMessages.warnings.length > 0 ? (
        renderValidationMessages()
      ) : null}

      {mode === 'guided' ? renderGuidedMode() : renderExpertMode()}
    </div>
  )
}

interface RouteTargetListProps {
  targets: string[]
  onChange: (targets: string[]) => void
  placeholder: string
  helpText: string
}

const RouteTargetList: React.FC<RouteTargetListProps> = ({
  targets,
  onChange,
  placeholder,
  helpText
}) => {
  const handleAddTarget = useCallback(() => {
    onChange([...targets, ''])
  }, [targets, onChange])

  const handleUpdateTarget = useCallback((index: number, value: string) => {
    const updated = [...targets]
    updated[index] = value
    onChange(updated)
  }, [targets, onChange])

  const handleRemoveTarget = useCallback((index: number) => {
    const updated = targets.filter((_, i) => i !== index)
    onChange(updated)
  }, [targets, onChange])

  return (
    <div className="route-target-list">
      <p className="help-text">{helpText}</p>
      
      {targets.map((target, index) => (
        <div key={index} className="target-input">
          <input
            type="text"
            value={target}
            onChange={(e) => handleUpdateTarget(index, e.target.value)}
            placeholder={placeholder}
            className="form-control"
          />
          <button 
            onClick={() => handleRemoveTarget(index)}
            className="btn btn-danger btn-sm"
            type="button"
          >
            Remove
          </button>
        </div>
      ))}
      
      <button onClick={handleAddTarget} className="btn btn-secondary btn-sm">
        Add Route Target
      </button>
    </div>
  )
}

interface NetworkAssignmentItemProps {
  network: VPCNetwork
  assigned: boolean
  onToggle: (assigned: boolean) => void
}

const NetworkAssignmentItem: React.FC<NetworkAssignmentItemProps> = ({
  network,
  assigned,
  onToggle
}) => {
  return (
    <div className="network-assignment-item">
      <label className="checkbox-label">
        <input
          type="checkbox"
          checked={assigned}
          onChange={(e) => onToggle(e.target.checked)}
        />
        <div className="network-info">
          <div className="network-name">{network.name}</div>
          <div className="network-cidr">{network.cidr}</div>
          {network.description && (
            <div className="network-description">{network.description}</div>
          )}
        </div>
      </label>
    </div>
  )
}

/**
 * Validate VRF configuration
 */
function validateVRF(
  vrf: VRFConfig,
  availableNetworks: VPCNetwork[],
  existingVrfs: VRFConfig[]
) {
  const errors: Array<{what: string, how: string, why: string}> = []
  const warnings: Array<{what: string, how: string, why: string}> = []

  // Validate VRF name
  if (!vrf.name || vrf.name.trim().length === 0) {
    errors.push({
      what: 'VRF name is required',
      how: 'Enter a descriptive name for this VRF',
      why: 'VRF names are used for identification and configuration'
    })
  }

  // Check for duplicate VRF names
  const duplicateName = existingVrfs.find(v => v.name === vrf.name && v !== vrf)
  if (duplicateName) {
    errors.push({
      what: `VRF name "${vrf.name}" is already used`,
      how: 'Choose a unique name for this VRF',
      why: 'VRF names must be unique within the configuration'
    })
  }

  // Validate route distinguisher
  if (!vrf.routeDistinguisher) {
    errors.push({
      what: 'Route distinguisher is required',
      how: 'Enter a route distinguisher (e.g., 65000:1)',
      why: 'Route distinguishers uniquely identify routes in MPLS VPN'
    })
  } else if (!isValidRouteDistinguisher(vrf.routeDistinguisher)) {
    errors.push({
      what: 'Invalid route distinguisher format',
      how: 'Use format ASN:number (e.g., 65000:1) or IP:number (e.g., 10.0.0.1:1)',
      why: 'Route distinguishers must follow BGP/MPLS VPN standards'
    })
  }

  // Check for duplicate route distinguishers
  const duplicateRD = existingVrfs.find(v => 
    v.routeDistinguisher === vrf.routeDistinguisher && v !== vrf
  )
  if (duplicateRD) {
    errors.push({
      what: `Route distinguisher "${vrf.routeDistinguisher}" is already used`,
      how: 'Use a unique route distinguisher for each VRF',
      why: 'Duplicate route distinguishers cause routing conflicts'
    })
  }

  // Validate route targets
  vrf.routeTargets.import.forEach(target => {
    if (!isValidRouteTarget(target)) {
      errors.push({
        what: `Invalid import route target: "${target}"`,
        how: 'Use format ASN:number (e.g., 65000:100)',
        why: 'Route targets must be valid for BGP extended communities'
      })
    }
  })

  vrf.routeTargets.export.forEach(target => {
    if (!isValidRouteTarget(target)) {
      errors.push({
        what: `Invalid export route target: "${target}"`,
        how: 'Use format ASN:number (e.g., 65000:200)',
        why: 'Route targets must be valid for BGP extended communities'
      })
    }
  })

  // Validate network references
  vrf.networks.forEach(networkName => {
    const networkExists = availableNetworks.find(n => n.name === networkName)
    if (!networkExists) {
      warnings.push({
        what: `Referenced network "${networkName}" does not exist`,
        how: 'Remove the reference or create the network first',
        why: 'VRFs can only contain existing networks'
      })
    }
  })

  // Check for networks used in multiple VRFs
  vrf.networks.forEach(networkName => {
    const otherVRFsUsingNetwork = existingVrfs.filter(v => 
      v !== vrf && v.networks.includes(networkName)
    )
    
    if (otherVRFsUsingNetwork.length > 0) {
      const vrfNames = otherVRFsUsingNetwork.map(v => v.name).join(', ')
      warnings.push({
        what: `Network "${networkName}" is also used in VRF(s): ${vrfNames}`,
        how: 'Consider if this network should be in multiple VRFs',
        why: 'Networks in multiple VRFs may have complex routing behavior'
      })
    }
  })

  // Recommendations
  if (vrf.routeTargets.import.length === 0 && vrf.routeTargets.export.length === 0) {
    warnings.push({
      what: 'No route targets configured',
      how: 'Add import/export route targets for route sharing between VRFs',
      why: 'Route targets enable communication between VRFs and external networks'
    })
  }

  if (vrf.networks.length === 0) {
    warnings.push({
      what: 'No networks assigned to this VRF',
      how: 'Assign one or more networks to this VRF',
      why: 'VRFs without networks have no routing table entries'
    })
  }

  return { errors, warnings }
}

/**
 * Validate route distinguisher format
 */
function isValidRouteDistinguisher(rd: string): boolean {
  // ASN:number format (e.g., 65000:1)
  const asnFormat = /^\d{1,10}:\d{1,10}$/
  
  // IP:number format (e.g., 10.0.0.1:1)
  const ipFormat = /^(\d{1,3}\.){3}\d{1,3}:\d{1,5}$/
  
  return asnFormat.test(rd) || ipFormat.test(rd)
}

/**
 * Validate route target format
 */
function isValidRouteTarget(target: string): boolean {
  if (!target || target.trim().length === 0) return false
  
  // ASN:number format
  const asnFormat = /^\d{1,10}:\d{1,10}$/
  
  return asnFormat.test(target.trim())
}

export default VRFBuilder