/**
 * MultiProfileEndpointEditor Component - WP-GFD2
 * Multi-profile editor with NIC LAG options and immediate validation
 */

import React, { useState, useCallback, useMemo } from 'react'

export interface EndpointProfile {
  id: string
  name: string
  description?: string
  nicSpeed: '10G' | '25G' | '100G' | '400G'
  nicCount: 1 | 2 | 4 | 8
  lagConfig?: LAGConfiguration
  serverCount: number
  rackDistribution?: 'single' | 'distributed' | 'per-leaf'
}

export interface LAGConfiguration {
  enabled: boolean
  mode: 'active-active' | 'active-standby' | 'lacp'
  loadBalancing?: 'L2' | 'L3' | 'L4' | 'L3+L4'
  lacpRate?: 'slow' | 'fast'
  minLinks?: number
  mclag?: boolean
}

export interface MultiProfileEndpointEditorProps {
  profiles: EndpointProfile[]
  onChange: (profiles: EndpointProfile[]) => void
  maxEndpoints?: number
  leafCapacity?: {
    portsPerLeaf: number
    speedsSupported: string[]
  }
}

export interface ValidationMessage {
  type: 'error' | 'warning' | 'info'
  code: string
  message: string
  profileId?: string
  field?: string
  suggestion?: string
}

const MultiProfileEndpointEditor: React.FC<MultiProfileEndpointEditorProps> = ({
  profiles,
  onChange,
  maxEndpoints = 1000,
  leafCapacity
}) => {
  const [expandedProfiles, setExpandedProfiles] = useState<Set<string>>(new Set())
  const [showAddProfile, setShowAddProfile] = useState(false)

  const validationMessages = useMemo(() => {
    return validateProfiles(profiles, maxEndpoints, leafCapacity)
  }, [profiles, maxEndpoints, leafCapacity])

  const totalEndpoints = useMemo(() => {
    return profiles.reduce((sum, p) => sum + p.serverCount, 0)
  }, [profiles])

  const totalPorts = useMemo(() => {
    return profiles.reduce((sum, p) => sum + (p.serverCount * p.nicCount), 0)
  }, [profiles])

  const handleProfileChange = useCallback((profileId: string, updates: Partial<EndpointProfile>) => {
    const updated = profiles.map(p => 
      p.id === profileId ? { ...p, ...updates } : p
    )
    onChange(updated)
  }, [profiles, onChange])

  const handleAddProfile = useCallback(() => {
    const newProfile: EndpointProfile = {
      id: `profile-${Date.now()}`,
      name: `Profile ${profiles.length + 1}`,
      nicSpeed: '25G',
      nicCount: 2,
      serverCount: 10,
      lagConfig: {
        enabled: false,
        mode: 'lacp',
        loadBalancing: 'L3+L4'
      }
    }
    onChange([...profiles, newProfile])
    setShowAddProfile(false)
  }, [profiles, onChange])

  const handleRemoveProfile = useCallback((profileId: string) => {
    onChange(profiles.filter(p => p.id !== profileId))
  }, [profiles, onChange])

  const handleDuplicateProfile = useCallback((profileId: string) => {
    const source = profiles.find(p => p.id === profileId)
    if (source) {
      const duplicate: EndpointProfile = {
        ...source,
        id: `profile-${Date.now()}`,
        name: `${source.name} Copy`
      }
      onChange([...profiles, duplicate])
    }
  }, [profiles, onChange])

  const toggleProfileExpansion = useCallback((profileId: string) => {
    setExpandedProfiles(prev => {
      const next = new Set(prev)
      if (next.has(profileId)) {
        next.delete(profileId)
      } else {
        next.add(profileId)
      }
      return next
    })
  }, [])

  const renderValidationSummary = () => {
    const errors = validationMessages.filter(m => m.type === 'error')
    const warnings = validationMessages.filter(m => m.type === 'warning')
    const infos = validationMessages.filter(m => m.type === 'info')

    if (validationMessages.length === 0) {
      return (
        <div className="validation-summary success">
          ✅ All endpoint profiles are valid
        </div>
      )
    }

    return (
      <div className="validation-summary">
        {errors.length > 0 && (
          <div className="validation-errors">
            <h5>❌ Errors ({errors.length})</h5>
            {errors.map((error, i) => (
              <div key={i} className="validation-message error">
                {error.message}
                {error.suggestion && (
                  <div className="suggestion">💡 {error.suggestion}</div>
                )}
              </div>
            ))}
          </div>
        )}
        {warnings.length > 0 && (
          <div className="validation-warnings">
            <h5>⚠️ Warnings ({warnings.length})</h5>
            {warnings.map((warning, i) => (
              <div key={i} className="validation-message warning">
                {warning.message}
                {warning.suggestion && (
                  <div className="suggestion">💡 {warning.suggestion}</div>
                )}
              </div>
            ))}
          </div>
        )}
        {infos.length > 0 && (
          <div className="validation-infos">
            <h5>ℹ️ Information</h5>
            {infos.map((info, i) => (
              <div key={i} className="validation-message info">
                {info.message}
              </div>
            ))}
          </div>
        )}
      </div>
    )
  }

  const renderProfileCard = (profile: EndpointProfile) => {
    const isExpanded = expandedProfiles.has(profile.id)
    const profileErrors = validationMessages.filter(m => m.profileId === profile.id && m.type === 'error')
    const profileWarnings = validationMessages.filter(m => m.profileId === profile.id && m.type === 'warning')

    return (
      <div key={profile.id} className={`profile-card ${profileErrors.length > 0 ? 'has-errors' : ''}`}>
        <div className="profile-header" onClick={() => toggleProfileExpansion(profile.id)}>
          <div className="profile-title">
            <span className="profile-name">{profile.name}</span>
            <span className="profile-summary">
              {profile.serverCount} servers × {profile.nicCount} × {profile.nicSpeed}
              {profile.lagConfig?.enabled && ' (LAG)'}
            </span>
          </div>
          <div className="profile-indicators">
            {profileErrors.length > 0 && <span className="error-badge">{profileErrors.length}</span>}
            {profileWarnings.length > 0 && <span className="warning-badge">{profileWarnings.length}</span>}
            <button className="expand-btn">{isExpanded ? '−' : '+'}</button>
          </div>
        </div>

        {isExpanded && (
          <div className="profile-content">
            <div className="form-section">
              <h4>Basic Configuration</h4>
              <div className="form-row">
                <label>
                  Profile Name:
                  <input
                    type="text"
                    value={profile.name}
                    onChange={(e) => handleProfileChange(profile.id, { name: e.target.value })}
                    className="form-control"
                  />
                </label>
                <label>
                  Server Count:
                  <input
                    type="number"
                    value={profile.serverCount}
                    onChange={(e) => handleProfileChange(profile.id, { serverCount: parseInt(e.target.value) || 0 })}
                    className="form-control"
                    min="1"
                    max={maxEndpoints}
                  />
                </label>
              </div>

              <div className="form-row">
                <label>
                  NIC Speed:
                  <select
                    value={profile.nicSpeed}
                    onChange={(e) => handleProfileChange(profile.id, { nicSpeed: e.target.value as any })}
                    className="form-control"
                  >
                    <option value="10G">10G</option>
                    <option value="25G">25G</option>
                    <option value="100G">100G</option>
                    <option value="400G">400G</option>
                  </select>
                </label>
                <label>
                  NICs per Server:
                  <select
                    value={profile.nicCount}
                    onChange={(e) => handleProfileChange(profile.id, { nicCount: parseInt(e.target.value) as any })}
                    className="form-control"
                  >
                    <option value="1">1 NIC</option>
                    <option value="2">2 NICs (Dual)</option>
                    <option value="4">4 NICs (Quad)</option>
                    <option value="8">8 NICs (Octa)</option>
                  </select>
                </label>
              </div>

              <div className="form-row">
                <label>
                  Rack Distribution:
                  <select
                    value={profile.rackDistribution || 'distributed'}
                    onChange={(e) => handleProfileChange(profile.id, { rackDistribution: e.target.value as any })}
                    className="form-control"
                  >
                    <option value="single">Single Rack</option>
                    <option value="distributed">Distributed</option>
                    <option value="per-leaf">Per Leaf Pair</option>
                  </select>
                </label>
              </div>
            </div>

            <LAGConfigurationSection
              profile={profile}
              onChange={(lagConfig) => handleProfileChange(profile.id, { lagConfig })}
            />

            <div className="profile-actions">
              <button onClick={() => handleDuplicateProfile(profile.id)} className="btn btn-secondary">
                Duplicate
              </button>
              <button onClick={() => handleRemoveProfile(profile.id)} className="btn btn-danger">
                Remove
              </button>
            </div>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="multi-profile-endpoint-editor">
      <div className="editor-header">
        <h3>Endpoint Profiles</h3>
        <div className="summary-stats">
          <span>Total Servers: {totalEndpoints}</span>
          <span>Total Ports: {totalPorts}</span>
          <span>Profiles: {profiles.length}</span>
        </div>
      </div>

      {renderValidationSummary()}

      <div className="profiles-list">
        {profiles.map(renderProfileCard)}
      </div>

      {showAddProfile ? (
        <div className="add-profile-form">
          <h4>Add New Profile</h4>
          <button onClick={handleAddProfile} className="btn btn-primary">
            Create Profile
          </button>
          <button onClick={() => setShowAddProfile(false)} className="btn btn-secondary">
            Cancel
          </button>
        </div>
      ) : (
        <button onClick={() => setShowAddProfile(true)} className="btn btn-primary add-profile-btn">
          + Add Profile
        </button>
      )}
    </div>
  )
}

const LAGConfigurationSection: React.FC<{
  profile: EndpointProfile
  onChange: (lagConfig: LAGConfiguration) => void
}> = ({ profile, onChange }) => {
  const lagConfig = profile.lagConfig || {
    enabled: false,
    mode: 'lacp',
    loadBalancing: 'L3+L4'
  }

  const handleLAGChange = (updates: Partial<LAGConfiguration>) => {
    onChange({ ...lagConfig, ...updates })
  }

  const canEnableLAG = profile.nicCount >= 2

  return (
    <div className="lag-configuration-section">
      <h4>LAG Configuration</h4>
      
      <div className="form-row">
        <label className="checkbox-label">
          <input
            type="checkbox"
            checked={lagConfig.enabled}
            onChange={(e) => handleLAGChange({ enabled: e.target.checked })}
            disabled={!canEnableLAG}
          />
          Enable Link Aggregation (LAG)
          {!canEnableLAG && (
            <span className="field-help">Requires 2+ NICs per server</span>
          )}
        </label>
      </div>

      {lagConfig.enabled && (
        <>
          <div className="form-row">
            <label>
              LAG Mode:
              <select
                value={lagConfig.mode}
                onChange={(e) => handleLAGChange({ mode: e.target.value as any })}
                className="form-control"
              >
                <option value="lacp">LACP (802.3ad)</option>
                <option value="active-active">Active-Active</option>
                <option value="active-standby">Active-Standby</option>
              </select>
            </label>
            <label>
              Load Balancing:
              <select
                value={lagConfig.loadBalancing || 'L3+L4'}
                onChange={(e) => handleLAGChange({ loadBalancing: e.target.value as any })}
                className="form-control"
              >
                <option value="L2">Layer 2 (MAC)</option>
                <option value="L3">Layer 3 (IP)</option>
                <option value="L4">Layer 4 (Port)</option>
                <option value="L3+L4">Layer 3+4 (IP+Port)</option>
              </select>
            </label>
          </div>

          {lagConfig.mode === 'lacp' && (
            <div className="form-row">
              <label>
                LACP Rate:
                <select
                  value={lagConfig.lacpRate || 'slow'}
                  onChange={(e) => handleLAGChange({ lacpRate: e.target.value as any })}
                  className="form-control"
                >
                  <option value="slow">Slow (30s)</option>
                  <option value="fast">Fast (1s)</option>
                </select>
              </label>
              <label>
                Min Links:
                <input
                  type="number"
                  value={lagConfig.minLinks || 1}
                  onChange={(e) => handleLAGChange({ minLinks: parseInt(e.target.value) || 1 })}
                  className="form-control"
                  min="1"
                  max={profile.nicCount}
                />
                <span className="field-help">Minimum active links required</span>
              </label>
            </div>
          )}

          {profile.nicCount >= 4 && (
            <div className="form-row">
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={lagConfig.mclag || false}
                  onChange={(e) => handleLAGChange({ mclag: e.target.checked })}
                />
                Enable MC-LAG (Multi-Chassis LAG)
                <span className="field-help">Split LAG across two leaf switches for redundancy</span>
              </label>
            </div>
          )}

          <div className="lag-summary">
            <h5>LAG Summary</h5>
            <ul>
              <li>Mode: {lagConfig.mode.toUpperCase()}</li>
              <li>Total Bandwidth: {parseInt(profile.nicSpeed) * profile.nicCount}G per server</li>
              <li>Redundancy: {profile.nicCount - (lagConfig.minLinks || 1)} link fault tolerance</li>
              {lagConfig.mclag && <li>MC-LAG: Links split across leaf pairs</li>}
            </ul>
          </div>
        </>
      )}
    </div>
  )
}

/**
 * Validate endpoint profiles
 */
function validateProfiles(
  profiles: EndpointProfile[],
  maxEndpoints: number,
  leafCapacity?: { portsPerLeaf: number; speedsSupported: string[] }
): ValidationMessage[] {
  const messages: ValidationMessage[] = []
  
  // Check total endpoint count
  const totalEndpoints = profiles.reduce((sum, p) => sum + p.serverCount, 0)
  if (totalEndpoints > maxEndpoints) {
    messages.push({
      type: 'error',
      code: 'ENDPOINT_LIMIT_EXCEEDED',
      message: `Total endpoints (${totalEndpoints}) exceeds maximum (${maxEndpoints})`,
      suggestion: 'Reduce server counts or remove profiles'
    })
  }

  // Check for empty profiles
  if (profiles.length === 0) {
    messages.push({
      type: 'warning',
      code: 'NO_PROFILES',
      message: 'No endpoint profiles defined',
      suggestion: 'Add at least one endpoint profile'
    })
  }

  // Validate each profile
  profiles.forEach(profile => {
    // Check profile name
    if (!profile.name || profile.name.trim() === '') {
      messages.push({
        type: 'error',
        code: 'PROFILE_NAME_REQUIRED',
        message: `Profile requires a name`,
        profileId: profile.id,
        field: 'name'
      })
    }

    // Check server count
    if (profile.serverCount <= 0) {
      messages.push({
        type: 'error',
        code: 'INVALID_SERVER_COUNT',
        message: `Profile "${profile.name}" has invalid server count`,
        profileId: profile.id,
        field: 'serverCount',
        suggestion: 'Set server count to 1 or more'
      })
    }

    // LAG validation
    if (profile.lagConfig?.enabled) {
      if (profile.nicCount < 2) {
        messages.push({
          type: 'error',
          code: 'LAG_REQUIRES_MULTIPLE_NICS',
          message: `LAG enabled but only ${profile.nicCount} NIC configured`,
          profileId: profile.id,
          suggestion: 'Use 2+ NICs per server for LAG'
        })
      }

      if (profile.lagConfig.minLinks && profile.lagConfig.minLinks > profile.nicCount) {
        messages.push({
          type: 'error',
          code: 'LAG_MIN_LINKS_INVALID',
          message: `Min links (${profile.lagConfig.minLinks}) exceeds NIC count (${profile.nicCount})`,
          profileId: profile.id,
          suggestion: 'Reduce min links or increase NIC count'
        })
      }

      if (profile.lagConfig.mclag && profile.nicCount < 4) {
        messages.push({
          type: 'warning',
          code: 'MCLAG_RECOMMENDED_NICS',
          message: `MC-LAG with only ${profile.nicCount} NICs may limit redundancy`,
          profileId: profile.id,
          suggestion: 'Consider 4+ NICs for optimal MC-LAG redundancy'
        })
      }
    }

    // Leaf capacity validation
    if (leafCapacity) {
      const portsNeeded = profile.serverCount * profile.nicCount
      if (portsNeeded > leafCapacity.portsPerLeaf) {
        messages.push({
          type: 'warning',
          code: 'LEAF_CAPACITY_WARNING',
          message: `Profile "${profile.name}" needs ${portsNeeded} ports but leaf has ${leafCapacity.portsPerLeaf}`,
          profileId: profile.id,
          suggestion: 'May require multiple leaf switches'
        })
      }

      if (!leafCapacity.speedsSupported.includes(profile.nicSpeed)) {
        messages.push({
          type: 'error',
          code: 'UNSUPPORTED_SPEED',
          message: `Leaf doesn't support ${profile.nicSpeed}`,
          profileId: profile.id,
          field: 'nicSpeed',
          suggestion: `Use one of: ${leafCapacity.speedsSupported.join(', ')}`
        })
      }
    }

    // High-density warnings
    if (profile.nicCount >= 8) {
      messages.push({
        type: 'info',
        code: 'HIGH_DENSITY_CONFIG',
        message: `High-density configuration with ${profile.nicCount} NICs per server`,
        profileId: profile.id
      })
    }
  })

  // Check for duplicate profile names
  const nameCount = new Map<string, number>()
  profiles.forEach(p => {
    const count = (nameCount.get(p.name) || 0) + 1
    nameCount.set(p.name, count)
  })
  
  nameCount.forEach((count, name) => {
    if (count > 1) {
      messages.push({
        type: 'warning',
        code: 'DUPLICATE_PROFILE_NAME',
        message: `Profile name "${name}" is used ${count} times`,
        suggestion: 'Use unique names for each profile'
      })
    }
  })

  return messages
}

export default MultiProfileEndpointEditor