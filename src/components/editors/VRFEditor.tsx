import React, { useState, useCallback } from 'react'

export interface VRFRoute {
  id: string
  destination: string
  nextHop: string
  metric?: number
  adminDistance?: number
  type: 'static' | 'connected' | 'bgp' | 'ospf'
}

export interface VRFConfig {
  metadata: {
    name: string
    namespace?: string
    labels?: Record<string, string>
    annotations?: Record<string, string>
  }
  spec: {
    vni?: number
    routeDistinguisher?: string
    routeTargets?: {
      import: string[]
      export: string[]
    }
    routes: VRFRoute[]
    bgp?: {
      asn?: number
      routerId?: string
      neighbors?: Array<{
        ip: string
        asn: number
        password?: string
      }>
    }
    redistribution?: {
      connected?: boolean
      static?: boolean
      ospf?: boolean
    }
    maxPaths?: number
    description?: string
  }
}

export interface VRFEditorProps {
  vrf?: VRFConfig
  availableVNIs?: number[]
  onChange: (vrf: VRFConfig) => void
  onValidate?: (isValid: boolean, errors: string[]) => void
  readonly?: boolean
}

export const VRFEditor: React.FC<VRFEditorProps> = ({
  vrf,
  availableVNIs = [],
  onChange,
  onValidate,
  readonly = false
}) => {
  const [activeTab, setActiveTab] = useState<'basic' | 'routes' | 'bgp' | 'redistribution'>('basic')
  const [errors, setErrors] = useState<string[]>([])

  // Initialize default VRF config
  const defaultVRF: VRFConfig = {
    metadata: {
      name: 'vrf-1',
      labels: {},
      annotations: {}
    },
    spec: {
      vni: undefined,
      routeDistinguisher: '',
      routeTargets: {
        import: [],
        export: []
      },
      routes: [],
      bgp: {
        asn: 65000,
        routerId: '',
        neighbors: []
      },
      redistribution: {
        connected: false,
        static: false,
        ospf: false
      },
      maxPaths: 1,
      description: ''
    }
  }

  const currentVRF = vrf || defaultVRF

  const validateVRF = useCallback((config: VRFConfig): { isValid: boolean; errors: string[] } => {
    const validationErrors: string[] = []

    // Validate metadata
    if (!config.metadata.name) {
      validationErrors.push('VRF name is required')
    }

    // Validate Route Distinguisher format
    if (config.spec.routeDistinguisher && !/^\d+:\d+$/.test(config.spec.routeDistinguisher)) {
      validationErrors.push('Route Distinguisher must be in format "ASN:value" (e.g., 65000:100)')
    }

    // Validate Route Targets
    config.spec.routeTargets?.import.forEach((rt, index) => {
      if (!/^\d+:\d+$/.test(rt)) {
        validationErrors.push(`Import Route Target ${index + 1}: Invalid format, use "ASN:value"`)
      }
    })

    config.spec.routeTargets?.export.forEach((rt, index) => {
      if (!/^\d+:\d+$/.test(rt)) {
        validationErrors.push(`Export Route Target ${index + 1}: Invalid format, use "ASN:value"`)
      }
    })

    // Validate VNI
    if (config.spec.vni && (config.spec.vni < 1 || config.spec.vni > 16777215)) {
      validationErrors.push('VNI must be between 1 and 16777215')
    }

    // Validate routes
    config.spec.routes.forEach((route, index) => {
      if (!route.destination || !/^(\d{1,3}\.){3}\d{1,3}\/\d{1,2}$/.test(route.destination)) {
        validationErrors.push(`Route ${index + 1}: Invalid destination CIDR format`)
      }
      if (!route.nextHop || !/^(\d{1,3}\.){3}\d{1,3}$/.test(route.nextHop)) {
        validationErrors.push(`Route ${index + 1}: Invalid next hop IP format`)
      }
    })

    // Validate BGP configuration
    if (config.spec.bgp?.routerId && !/^(\d{1,3}\.){3}\d{1,3}$/.test(config.spec.bgp.routerId)) {
      validationErrors.push('BGP Router ID must be a valid IP address')
    }

    config.spec.bgp?.neighbors?.forEach((neighbor, index) => {
      if (!/^(\d{1,3}\.){3}\d{1,3}$/.test(neighbor.ip)) {
        validationErrors.push(`BGP Neighbor ${index + 1}: Invalid IP address`)
      }
      if (!neighbor.asn || neighbor.asn < 1) {
        validationErrors.push(`BGP Neighbor ${index + 1}: Valid ASN is required`)
      }
    })

    return { isValid: validationErrors.length === 0, errors: validationErrors }
  }, [])

  const handleChange = useCallback((updates: Partial<VRFConfig>) => {
    const newVRF = {
      ...currentVRF,
      ...updates,
      spec: {
        ...currentVRF.spec,
        ...(updates.spec || {})
      },
      metadata: {
        ...currentVRF.metadata,
        ...(updates.metadata || {})
      }
    }

    const validation = validateVRF(newVRF)
    setErrors(validation.errors)
    onValidate?.(validation.isValid, validation.errors)
    onChange(newVRF)
  }, [currentVRF, onChange, onValidate, validateVRF])

  const addRoute = useCallback(() => {
    const newRoute: VRFRoute = {
      id: `route-${Date.now()}`,
      destination: '0.0.0.0/0',
      nextHop: '10.0.0.1',
      metric: 1,
      type: 'static'
    }

    handleChange({
      spec: {
        ...currentVRF.spec,
        routes: [...currentVRF.spec.routes, newRoute]
      }
    })
  }, [currentVRF, handleChange])

  const updateRoute = useCallback((routeId: string, updates: Partial<VRFRoute>) => {
    const routes = currentVRF.spec.routes.map(route =>
      route.id === routeId ? { ...route, ...updates } : route
    )
    
    handleChange({
      spec: {
        ...currentVRF.spec,
        routes
      }
    })
  }, [currentVRF, handleChange])

  const removeRoute = useCallback((routeId: string) => {
    handleChange({
      spec: {
        ...currentVRF.spec,
        routes: currentVRF.spec.routes.filter(route => route.id !== routeId)
      }
    })
  }, [currentVRF, handleChange])

  const addRouteTarget = useCallback((type: 'import' | 'export') => {
    const newRT = '65000:100'
    const currentRTs = currentVRF.spec.routeTargets?.[type] || []
    
    if (!currentRTs.includes(newRT)) {
      handleChange({
        spec: {
          ...currentVRF.spec,
          routeTargets: {
            ...currentVRF.spec.routeTargets,
            [type]: [...currentRTs, newRT]
          }
        }
      })
    }
  }, [currentVRF, handleChange])

  const updateRouteTarget = useCallback((type: 'import' | 'export', index: number, value: string) => {
    const currentRTs = [...(currentVRF.spec.routeTargets?.[type] || [])]
    currentRTs[index] = value
    
    handleChange({
      spec: {
        ...currentVRF.spec,
        routeTargets: {
          ...currentVRF.spec.routeTargets,
          [type]: currentRTs
        }
      }
    })
  }, [currentVRF, handleChange])

  const removeRouteTarget = useCallback((type: 'import' | 'export', index: number) => {
    const currentRTs = [...(currentVRF.spec.routeTargets?.[type] || [])]
    currentRTs.splice(index, 1)
    
    handleChange({
      spec: {
        ...currentVRF.spec,
        routeTargets: {
          ...currentVRF.spec.routeTargets,
          [type]: currentRTs
        }
      }
    })
  }, [currentVRF, handleChange])

  const addBGPNeighbor = useCallback(() => {
    const newNeighbor = {
      ip: '10.0.0.1',
      asn: 65001,
      password: ''
    }

    handleChange({
      spec: {
        ...currentVRF.spec,
        bgp: {
          ...currentVRF.spec.bgp,
          neighbors: [...(currentVRF.spec.bgp?.neighbors || []), newNeighbor]
        }
      }
    })
  }, [currentVRF, handleChange])

  const updateBGPNeighbor = useCallback((index: number, updates: Partial<{ ip: string; asn: number; password: string }>) => {
    const neighbors = [...(currentVRF.spec.bgp?.neighbors || [])]
    neighbors[index] = { ...neighbors[index], ...updates }
    
    handleChange({
      spec: {
        ...currentVRF.spec,
        bgp: {
          ...currentVRF.spec.bgp,
          neighbors
        }
      }
    })
  }, [currentVRF, handleChange])

  const removeBGPNeighbor = useCallback((index: number) => {
    const neighbors = [...(currentVRF.spec.bgp?.neighbors || [])]
    neighbors.splice(index, 1)
    
    handleChange({
      spec: {
        ...currentVRF.spec,
        bgp: {
          ...currentVRF.spec.bgp,
          neighbors
        }
      }
    })
  }, [currentVRF, handleChange])

  const tabStyle = (tab: string) => ({
    padding: '8px 16px',
    backgroundColor: activeTab === tab ? '#007bff' : '#f8f9fa',
    color: activeTab === tab ? 'white' : '#495057',
    border: '1px solid #dee2e6',
    cursor: 'pointer',
    borderBottom: activeTab === tab ? 'none' : '1px solid #dee2e6'
  })

  return (
    <div className="vrf-editor" style={{ border: '1px solid #ccc', borderRadius: '4px', padding: '20px' }}>
      <div style={{ marginBottom: '20px' }}>
        <h3>VRF (Virtual Routing and Forwarding) Configuration</h3>
        <p style={{ color: '#6c757d', fontSize: '14px' }}>
          Configure virtual routing instances with BGP, route targets, and routing policies
        </p>
        
        {errors.length > 0 && (
          <div style={{ 
            padding: '10px', 
            backgroundColor: '#f8d7da', 
            border: '1px solid #f5c6cb',
            borderRadius: '4px',
            marginTop: '15px'
          }}>
            <h4 style={{ margin: '0 0 10px 0', color: '#721c24' }}>Validation Errors:</h4>
            <ul style={{ margin: 0, paddingLeft: '20px' }}>
              {errors.map((error, index) => (
                <li key={index} style={{ color: '#721c24' }}>{error}</li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* Tab Navigation */}
      <div style={{ display: 'flex', marginBottom: '20px', borderBottom: '1px solid #dee2e6' }}>
        <button style={tabStyle('basic')} onClick={() => setActiveTab('basic')}>
          Basic Settings
        </button>
        <button style={tabStyle('routes')} onClick={() => setActiveTab('routes')}>
          Static Routes
        </button>
        <button style={tabStyle('bgp')} onClick={() => setActiveTab('bgp')}>
          BGP Configuration
        </button>
        <button style={tabStyle('redistribution')} onClick={() => setActiveTab('redistribution')}>
          Route Redistribution
        </button>
      </div>

      {/* Basic Settings Tab */}
      {activeTab === 'basic' && (
        <div className="basic-settings">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '30px' }}>
            <div>
              <label>
                <strong>VRF Name:</strong>
                <input
                  type="text"
                  value={currentVRF.metadata.name || ''}
                  onChange={(e) => handleChange({
                    metadata: { ...currentVRF.metadata, name: e.target.value }
                  })}
                  disabled={readonly}
                  style={{ width: '100%', padding: '8px', marginTop: '5px' }}
                  data-testid="vrf-name-input"
                />
              </label>
            </div>

            <div>
              <label>
                <strong>Description:</strong>
                <input
                  type="text"
                  value={currentVRF.spec.description || ''}
                  onChange={(e) => handleChange({
                    spec: { ...currentVRF.spec, description: e.target.value }
                  })}
                  disabled={readonly}
                  style={{ width: '100%', padding: '8px', marginTop: '5px' }}
                  placeholder="VRF description"
                  data-testid="vrf-description-input"
                />
              </label>
            </div>

            <div>
              <label>
                <strong>VNI (VXLAN Network Identifier):</strong>
                <select
                  value={currentVRF.spec.vni || ''}
                  onChange={(e) => handleChange({
                    spec: { ...currentVRF.spec, vni: e.target.value ? parseInt(e.target.value) : undefined }
                  })}
                  disabled={readonly}
                  style={{ width: '100%', padding: '8px', marginTop: '5px' }}
                  data-testid="vrf-vni-select"
                >
                  <option value="">Auto-assign VNI</option>
                  {availableVNIs.map((vni) => (
                    <option key={vni} value={vni}>{vni}</option>
                  ))}
                </select>
              </label>
              <div style={{ fontSize: '12px', color: '#6c757d', marginTop: '5px' }}>
                Unique identifier for VXLAN encapsulation (1-16777215)
              </div>
            </div>

            <div>
              <label>
                <strong>Route Distinguisher:</strong>
                <input
                  type="text"
                  value={currentVRF.spec.routeDistinguisher || ''}
                  onChange={(e) => handleChange({
                    spec: { ...currentVRF.spec, routeDistinguisher: e.target.value }
                  })}
                  disabled={readonly}
                  style={{ width: '100%', padding: '8px', marginTop: '5px' }}
                  placeholder="65000:100"
                  data-testid="route-distinguisher-input"
                />
              </label>
              <div style={{ fontSize: '12px', color: '#6c757d', marginTop: '5px' }}>
                Format: ASN:value (makes routes globally unique)
              </div>
            </div>

            <div>
              <label>
                <strong>Max Paths:</strong>
                <input
                  type="number"
                  value={currentVRF.spec.maxPaths || 1}
                  onChange={(e) => handleChange({
                    spec: { ...currentVRF.spec, maxPaths: parseInt(e.target.value) || 1 }
                  })}
                  disabled={readonly}
                  style={{ width: '100%', padding: '8px', marginTop: '5px' }}
                  min={1}
                  max={64}
                  data-testid="max-paths-input"
                />
              </label>
              <div style={{ fontSize: '12px', color: '#6c757d', marginTop: '5px' }}>
                Maximum number of equal-cost paths for load balancing
              </div>
            </div>
          </div>

          {/* Route Targets */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '30px' }}>
            {/* Import Route Targets */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
                <h5>Import Route Targets</h5>
                {!readonly && (
                  <button
                    onClick={() => addRouteTarget('import')}
                    style={{
                      padding: '4px 8px',
                      backgroundColor: '#28a745',
                      color: 'white',
                      border: 'none',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      fontSize: '12px'
                    }}
                    data-testid="add-import-rt"
                  >
                    Add
                  </button>
                )}
              </div>
              <div style={{ border: '1px solid #ddd', borderRadius: '4px', padding: '10px', minHeight: '100px' }}>
                {currentVRF.spec.routeTargets?.import.map((rt, index) => (
                  <div key={index} style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                    <input
                      type="text"
                      value={rt}
                      onChange={(e) => updateRouteTarget('import', index, e.target.value)}
                      disabled={readonly}
                      style={{ flex: 1, padding: '6px', fontSize: '14px' }}
                      placeholder="65000:100"
                      data-testid={`import-rt-${index}`}
                    />
                    {!readonly && (
                      <button
                        onClick={() => removeRouteTarget('import', index)}
                        style={{
                          padding: '4px 6px',
                          backgroundColor: '#dc3545',
                          color: 'white',
                          border: 'none',
                          borderRadius: '4px',
                          cursor: 'pointer',
                          fontSize: '10px'
                        }}
                        data-testid={`remove-import-rt-${index}`}
                      >
                        ×
                      </button>
                    )}
                  </div>
                )) || (
                  <div style={{ color: '#6c757d', fontStyle: 'italic', textAlign: 'center', paddingTop: '20px' }}>
                    No import route targets configured
                  </div>
                )}
              </div>
            </div>

            {/* Export Route Targets */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
                <h5>Export Route Targets</h5>
                {!readonly && (
                  <button
                    onClick={() => addRouteTarget('export')}
                    style={{
                      padding: '4px 8px',
                      backgroundColor: '#28a745',
                      color: 'white',
                      border: 'none',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      fontSize: '12px'
                    }}
                    data-testid="add-export-rt"
                  >
                    Add
                  </button>
                )}
              </div>
              <div style={{ border: '1px solid #ddd', borderRadius: '4px', padding: '10px', minHeight: '100px' }}>
                {currentVRF.spec.routeTargets?.export.map((rt, index) => (
                  <div key={index} style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                    <input
                      type="text"
                      value={rt}
                      onChange={(e) => updateRouteTarget('export', index, e.target.value)}
                      disabled={readonly}
                      style={{ flex: 1, padding: '6px', fontSize: '14px' }}
                      placeholder="65000:100"
                      data-testid={`export-rt-${index}`}
                    />
                    {!readonly && (
                      <button
                        onClick={() => removeRouteTarget('export', index)}
                        style={{
                          padding: '4px 6px',
                          backgroundColor: '#dc3545',
                          color: 'white',
                          border: 'none',
                          borderRadius: '4px',
                          cursor: 'pointer',
                          fontSize: '10px'
                        }}
                        data-testid={`remove-export-rt-${index}`}
                      >
                        ×
                      </button>
                    )}
                  </div>
                )) || (
                  <div style={{ color: '#6c757d', fontStyle: 'italic', textAlign: 'center', paddingTop: '20px' }}>
                    No export route targets configured
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Static Routes Tab */}
      {activeTab === 'routes' && (
        <div className="routes-section">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <h4>Static Routes</h4>
            {!readonly && (
              <button
                onClick={addRoute}
                style={{
                  padding: '8px 16px',
                  backgroundColor: '#28a745',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer'
                }}
                data-testid="add-route-button"
              >
                Add Route
              </button>
            )}
          </div>

          {currentVRF.spec.routes.map((route, index) => (
            <div key={route.id} style={{ 
              border: '1px solid #ddd', 
              borderRadius: '4px', 
              padding: '15px', 
              marginBottom: '15px' 
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
                <h5 style={{ margin: 0 }}>Route {index + 1}</h5>
                {!readonly && (
                  <button
                    onClick={() => removeRoute(route.id)}
                    style={{
                      padding: '4px 8px',
                      backgroundColor: '#dc3545',
                      color: 'white',
                      border: 'none',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      fontSize: '12px'
                    }}
                    data-testid={`remove-route-${route.id}`}
                  >
                    Remove
                  </button>
                )}
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '2fr 2fr 1fr 1fr 1fr', gap: '15px' }}>
                <div>
                  <label>
                    <strong>Destination:</strong>
                    <input
                      type="text"
                      value={route.destination}
                      onChange={(e) => updateRoute(route.id, { destination: e.target.value })}
                      disabled={readonly}
                      style={{ width: '100%', padding: '8px', marginTop: '5px' }}
                      placeholder="10.0.0.0/24"
                      data-testid={`route-${route.id}-destination`}
                    />
                  </label>
                </div>
                <div>
                  <label>
                    <strong>Next Hop:</strong>
                    <input
                      type="text"
                      value={route.nextHop}
                      onChange={(e) => updateRoute(route.id, { nextHop: e.target.value })}
                      disabled={readonly}
                      style={{ width: '100%', padding: '8px', marginTop: '5px' }}
                      placeholder="10.0.0.1"
                      data-testid={`route-${route.id}-nexthop`}
                    />
                  </label>
                </div>
                <div>
                  <label>
                    <strong>Metric:</strong>
                    <input
                      type="number"
                      value={route.metric || ''}
                      onChange={(e) => updateRoute(route.id, { 
                        metric: e.target.value ? parseInt(e.target.value) : undefined 
                      })}
                      disabled={readonly}
                      style={{ width: '100%', padding: '8px', marginTop: '5px' }}
                      min={1}
                      placeholder="1"
                      data-testid={`route-${route.id}-metric`}
                    />
                  </label>
                </div>
                <div>
                  <label>
                    <strong>Admin Distance:</strong>
                    <input
                      type="number"
                      value={route.adminDistance || ''}
                      onChange={(e) => updateRoute(route.id, { 
                        adminDistance: e.target.value ? parseInt(e.target.value) : undefined 
                      })}
                      disabled={readonly}
                      style={{ width: '100%', padding: '8px', marginTop: '5px' }}
                      min={1}
                      max={255}
                      placeholder="1"
                      data-testid={`route-${route.id}-admin-distance`}
                    />
                  </label>
                </div>
                <div>
                  <label>
                    <strong>Type:</strong>
                    <select
                      value={route.type}
                      onChange={(e) => updateRoute(route.id, { 
                        type: e.target.value as 'static' | 'connected' | 'bgp' | 'ospf' 
                      })}
                      disabled={readonly}
                      style={{ width: '100%', padding: '8px', marginTop: '5px' }}
                      data-testid={`route-${route.id}-type`}
                    >
                      <option value="static">Static</option>
                      <option value="connected">Connected</option>
                      <option value="bgp">BGP</option>
                      <option value="ospf">OSPF</option>
                    </select>
                  </label>
                </div>
              </div>
            </div>
          ))}

          {currentVRF.spec.routes.length === 0 && (
            <div style={{ 
              padding: '20px', 
              textAlign: 'center', 
              color: '#6c757d',
              border: '2px dashed #dee2e6',
              borderRadius: '4px'
            }}>
              No static routes configured. Click "Add Route" to create one.
            </div>
          )}
        </div>
      )}

      {/* BGP Configuration Tab */}
      {activeTab === 'bgp' && (
        <div className="bgp-section">
          <h4>BGP Configuration</h4>
          
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '30px' }}>
            <div>
              <label>
                <strong>BGP ASN:</strong>
                <input
                  type="number"
                  value={currentVRF.spec.bgp?.asn || ''}
                  onChange={(e) => handleChange({
                    spec: {
                      ...currentVRF.spec,
                      bgp: {
                        ...currentVRF.spec.bgp,
                        asn: e.target.value ? parseInt(e.target.value) : undefined
                      }
                    }
                  })}
                  disabled={readonly}
                  style={{ width: '100%', padding: '8px', marginTop: '5px' }}
                  min={1}
                  max={4294967295}
                  placeholder="65000"
                  data-testid="bgp-asn-input"
                />
              </label>
            </div>

            <div>
              <label>
                <strong>Router ID:</strong>
                <input
                  type="text"
                  value={currentVRF.spec.bgp?.routerId || ''}
                  onChange={(e) => handleChange({
                    spec: {
                      ...currentVRF.spec,
                      bgp: {
                        ...currentVRF.spec.bgp,
                        routerId: e.target.value
                      }
                    }
                  })}
                  disabled={readonly}
                  style={{ width: '100%', padding: '8px', marginTop: '5px' }}
                  placeholder="10.0.0.1"
                  data-testid="bgp-router-id-input"
                />
              </label>
              <div style={{ fontSize: '12px', color: '#6c757d', marginTop: '5px' }}>
                BGP Router ID (typically a loopback IP address)
              </div>
            </div>
          </div>

          {/* BGP Neighbors */}
          <div style={{ marginBottom: '30px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h5>BGP Neighbors</h5>
              {!readonly && (
                <button
                  onClick={addBGPNeighbor}
                  style={{
                    padding: '8px 16px',
                    backgroundColor: '#28a745',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer'
                  }}
                  data-testid="add-bgp-neighbor-button"
                >
                  Add Neighbor
                </button>
              )}
            </div>

            {currentVRF.spec.bgp?.neighbors?.map((neighbor, index) => (
              <div key={index} style={{ 
                border: '1px solid #ddd', 
                borderRadius: '4px', 
                padding: '15px', 
                marginBottom: '15px' 
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
                  <h6 style={{ margin: 0 }}>Neighbor {index + 1}</h6>
                  {!readonly && (
                    <button
                      onClick={() => removeBGPNeighbor(index)}
                      style={{
                        padding: '4px 8px',
                        backgroundColor: '#dc3545',
                        color: 'white',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        fontSize: '12px'
                      }}
                      data-testid={`remove-bgp-neighbor-${index}`}
                    >
                      Remove
                    </button>
                  )}
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '15px' }}>
                  <div>
                    <label>
                      <strong>Neighbor IP:</strong>
                      <input
                        type="text"
                        value={neighbor.ip}
                        onChange={(e) => updateBGPNeighbor(index, { ip: e.target.value })}
                        disabled={readonly}
                        style={{ width: '100%', padding: '8px', marginTop: '5px' }}
                        placeholder="10.0.0.2"
                        data-testid={`bgp-neighbor-${index}-ip`}
                      />
                    </label>
                  </div>
                  <div>
                    <label>
                      <strong>Remote ASN:</strong>
                      <input
                        type="number"
                        value={neighbor.asn}
                        onChange={(e) => updateBGPNeighbor(index, { asn: parseInt(e.target.value) || 0 })}
                        disabled={readonly}
                        style={{ width: '100%', padding: '8px', marginTop: '5px' }}
                        min={1}
                        max={4294967295}
                        placeholder="65001"
                        data-testid={`bgp-neighbor-${index}-asn`}
                      />
                    </label>
                  </div>
                  <div>
                    <label>
                      <strong>Password:</strong>
                      <input
                        type="password"
                        value={neighbor.password || ''}
                        onChange={(e) => updateBGPNeighbor(index, { password: e.target.value })}
                        disabled={readonly}
                        style={{ width: '100%', padding: '8px', marginTop: '5px' }}
                        placeholder="Optional"
                        data-testid={`bgp-neighbor-${index}-password`}
                      />
                    </label>
                  </div>
                </div>
              </div>
            )) || (
              <div style={{ 
                padding: '20px', 
                textAlign: 'center', 
                color: '#6c757d',
                border: '2px dashed #dee2e6',
                borderRadius: '4px'
              }}>
                No BGP neighbors configured. Click "Add Neighbor" to create one.
              </div>
            )}
          </div>
        </div>
      )}

      {/* Route Redistribution Tab */}
      {activeTab === 'redistribution' && (
        <div className="redistribution-section">
          <h4>Route Redistribution</h4>
          <p style={{ color: '#6c757d', fontSize: '14px', marginBottom: '30px' }}>
            Configure which route types should be redistributed into BGP
          </p>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '30px' }}>
            <div>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <input
                  type="checkbox"
                  checked={currentVRF.spec.redistribution?.connected || false}
                  onChange={(e) => handleChange({
                    spec: {
                      ...currentVRF.spec,
                      redistribution: {
                        ...currentVRF.spec.redistribution,
                        connected: e.target.checked
                      }
                    }
                  })}
                  disabled={readonly}
                  data-testid="redistribute-connected"
                />
                <span>
                  <strong>Connected Routes</strong>
                  <div style={{ fontSize: '12px', color: '#6c757d', marginTop: '2px' }}>
                    Redistribute directly connected subnets
                  </div>
                </span>
              </label>
            </div>

            <div>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <input
                  type="checkbox"
                  checked={currentVRF.spec.redistribution?.static || false}
                  onChange={(e) => handleChange({
                    spec: {
                      ...currentVRF.spec,
                      redistribution: {
                        ...currentVRF.spec.redistribution,
                        static: e.target.checked
                      }
                    }
                  })}
                  disabled={readonly}
                  data-testid="redistribute-static"
                />
                <span>
                  <strong>Static Routes</strong>
                  <div style={{ fontSize: '12px', color: '#6c757d', marginTop: '2px' }}>
                    Redistribute configured static routes
                  </div>
                </span>
              </label>
            </div>

            <div>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <input
                  type="checkbox"
                  checked={currentVRF.spec.redistribution?.ospf || false}
                  onChange={(e) => handleChange({
                    spec: {
                      ...currentVRF.spec,
                      redistribution: {
                        ...currentVRF.spec.redistribution,
                        ospf: e.target.checked
                      }
                    }
                  })}
                  disabled={readonly}
                  data-testid="redistribute-ospf"
                />
                <span>
                  <strong>OSPF Routes</strong>
                  <div style={{ fontSize: '12px', color: '#6c757d', marginTop: '2px' }}>
                    Redistribute OSPF learned routes
                  </div>
                </span>
              </label>
            </div>
          </div>

          <div style={{ 
            marginTop: '30px', 
            padding: '15px', 
            backgroundColor: '#fff3cd',
            border: '1px solid #ffeaa7',
            borderRadius: '4px'
          }}>
            <h5 style={{ margin: '0 0 10px 0' }}>💡 Redistribution Notes</h5>
            <ul style={{ margin: 0, paddingLeft: '20px', fontSize: '14px' }}>
              <li><strong>Connected:</strong> Automatically advertise subnets of directly connected interfaces</li>
              <li><strong>Static:</strong> Advertise manually configured static routes via BGP</li>
              <li><strong>OSPF:</strong> Redistribute routes learned from OSPF into BGP (use with caution)</li>
              <li><strong>Route Filtering:</strong> Consider using route maps for selective redistribution</li>
            </ul>
          </div>
        </div>
      )}
    </div>
  )
}

export default VRFEditor