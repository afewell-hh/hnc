import React, { useState, useCallback } from 'react'
import type { VPC, VPCAttachment, K8sMetadata } from '../../upstream/types/generated'

export interface VPCSubnet {
  name: string
  cidr: string
  gateway?: string
  vlan?: number
  isolated?: boolean
  restricted?: boolean
  dhcp?: {
    enable: boolean
    start?: string
    end?: string
  }
}

export interface VPCConfig {
  metadata: K8sMetadata
  spec: {
    defaultIsolated?: boolean
    defaultRestricted?: boolean
    ipv4Namespace?: string
    vlanNamespace?: string
    mode?: 'default' | 'single' | 'multi'
    subnets: Record<string, VPCSubnet>
    permit?: string[][]
    staticRoutes?: Array<{
      destination: string
      nextHop: string
      metric?: number
    }>
  }
}

export interface VPCEditorProps {
  vpc?: VPCConfig
  onChange: (vpc: VPCConfig) => void
  onValidate?: (isValid: boolean, errors: string[]) => void
  readonly?: boolean
}

export const VPCEditor: React.FC<VPCEditorProps> = ({
  vpc,
  onChange,
  onValidate,
  readonly = false
}) => {
  const [activeTab, setActiveTab] = useState<'basic' | 'subnets' | 'routing' | 'policies'>('basic')
  const [errors, setErrors] = useState<string[]>([])

  // Initialize default VPC config
  const defaultVPC: VPCConfig = {
    metadata: {
      name: 'vpc-1',
      labels: {},
      annotations: {}
    },
    spec: {
      defaultIsolated: false,
      defaultRestricted: false,
      ipv4Namespace: 'default',
      vlanNamespace: 'default',
      mode: 'default',
      subnets: {
        'default': {
          name: 'default',
          cidr: '10.1.0.0/24',
          gateway: '10.1.0.1',
          isolated: false,
          restricted: false
        }
      },
      permit: [],
      staticRoutes: []
    }
  }

  const currentVPC = vpc || defaultVPC

  const validateVPC = useCallback((config: VPCConfig): { isValid: boolean; errors: string[] } => {
    const validationErrors: string[] = []

    // Validate metadata
    if (!config.metadata.name) {
      validationErrors.push('VPC name is required')
    }

    // Validate CIDR ranges
    Object.entries(config.spec.subnets).forEach(([name, subnet]) => {
      if (!subnet.cidr || !/^(\d{1,3}\.){3}\d{1,3}\/\d{1,2}$/.test(subnet.cidr)) {
        validationErrors.push(`Invalid CIDR format for subnet ${name}`)
      }
      if (subnet.gateway && !/^(\d{1,3}\.){3}\d{1,3}$/.test(subnet.gateway)) {
        validationErrors.push(`Invalid gateway IP for subnet ${name}`)
      }
    })

    // Check for overlapping subnets
    const cidrs = Object.values(config.spec.subnets).map(s => s.cidr)
    // Basic overlap check (simplified)
    const uniqueCidrs = new Set(cidrs)
    if (uniqueCidrs.size !== cidrs.length) {
      validationErrors.push('Duplicate subnet CIDRs detected')
    }

    // Validate static routes
    config.spec.staticRoutes?.forEach((route, index) => {
      if (!route.destination || !/^(\d{1,3}\.){3}\d{1,3}\/\d{1,2}$/.test(route.destination)) {
        validationErrors.push(`Invalid destination in static route ${index + 1}`)
      }
      if (!route.nextHop || !/^(\d{1,3}\.){3}\d{1,3}$/.test(route.nextHop)) {
        validationErrors.push(`Invalid next hop in static route ${index + 1}`)
      }
    })

    return { isValid: validationErrors.length === 0, errors: validationErrors }
  }, [])

  const handleChange = useCallback((updates: Partial<VPCConfig>) => {
    const newVPC = {
      ...currentVPC,
      ...updates,
      spec: {
        ...currentVPC.spec,
        ...(updates.spec || {})
      },
      metadata: {
        ...currentVPC.metadata,
        ...(updates.metadata || {})
      }
    }

    const validation = validateVPC(newVPC)
    setErrors(validation.errors)
    onValidate?.(validation.isValid, validation.errors)
    onChange(newVPC)
  }, [currentVPC, onChange, onValidate, validateVPC])

  const addSubnet = useCallback(() => {
    const subnetName = `subnet-${Object.keys(currentVPC.spec.subnets).length + 1}`
    const newSubnet: VPCSubnet = {
      name: subnetName,
      cidr: '10.1.1.0/24',
      gateway: '10.1.1.1',
      isolated: currentVPC.spec.defaultIsolated || false,
      restricted: currentVPC.spec.defaultRestricted || false
    }

    handleChange({
      spec: {
        ...currentVPC.spec,
        subnets: {
          ...currentVPC.spec.subnets,
          [subnetName]: newSubnet
        }
      }
    })
  }, [currentVPC, handleChange])

  const removeSubnet = useCallback((subnetName: string) => {
    const { [subnetName]: removed, ...remainingSubnets } = currentVPC.spec.subnets
    handleChange({
      spec: {
        ...currentVPC.spec,
        subnets: remainingSubnets
      }
    })
  }, [currentVPC, handleChange])

  const updateSubnet = useCallback((subnetName: string, updates: Partial<VPCSubnet>) => {
    handleChange({
      spec: {
        ...currentVPC.spec,
        subnets: {
          ...currentVPC.spec.subnets,
          [subnetName]: {
            ...currentVPC.spec.subnets[subnetName],
            ...updates
          }
        }
      }
    })
  }, [currentVPC, handleChange])

  const addStaticRoute = useCallback(() => {
    const newRoute = {
      destination: '0.0.0.0/0',
      nextHop: '10.1.0.1',
      metric: 100
    }

    handleChange({
      spec: {
        ...currentVPC.spec,
        staticRoutes: [...(currentVPC.spec.staticRoutes || []), newRoute]
      }
    })
  }, [currentVPC, handleChange])

  const removeStaticRoute = useCallback((index: number) => {
    const routes = [...(currentVPC.spec.staticRoutes || [])]
    routes.splice(index, 1)
    handleChange({
      spec: {
        ...currentVPC.spec,
        staticRoutes: routes
      }
    })
  }, [currentVPC, handleChange])

  const tabStyle = (tab: string) => ({
    padding: '8px 16px',
    backgroundColor: activeTab === tab ? '#007bff' : '#f8f9fa',
    color: activeTab === tab ? 'white' : '#495057',
    border: '1px solid #dee2e6',
    cursor: 'pointer',
    borderBottom: activeTab === tab ? 'none' : '1px solid #dee2e6'
  })

  return (
    <div className="vpc-editor" style={{ border: '1px solid #ccc', borderRadius: '4px', padding: '20px' }}>
      <div style={{ marginBottom: '20px' }}>
        <h3>VPC Configuration</h3>
        {errors.length > 0 && (
          <div style={{ 
            padding: '10px', 
            backgroundColor: '#f8d7da', 
            border: '1px solid #f5c6cb',
            borderRadius: '4px',
            marginBottom: '15px'
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
        <button style={tabStyle('subnets')} onClick={() => setActiveTab('subnets')}>
          Subnets
        </button>
        <button style={tabStyle('routing')} onClick={() => setActiveTab('routing')}>
          Static Routes
        </button>
        <button style={tabStyle('policies')} onClick={() => setActiveTab('policies')}>
          Access Policies
        </button>
      </div>

      {/* Basic Settings Tab */}
      {activeTab === 'basic' && (
        <div className="basic-settings">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
            <div>
              <label>
                <strong>VPC Name:</strong>
                <input
                  type="text"
                  value={currentVPC.metadata.name || ''}
                  onChange={(e) => handleChange({
                    metadata: { ...currentVPC.metadata, name: e.target.value }
                  })}
                  disabled={readonly}
                  style={{ width: '100%', padding: '8px', marginTop: '5px' }}
                  data-testid="vpc-name-input"
                />
              </label>
            </div>
            <div>
              <label>
                <strong>IPv4 Namespace:</strong>
                <input
                  type="text"
                  value={currentVPC.spec.ipv4Namespace || 'default'}
                  onChange={(e) => handleChange({
                    spec: { ...currentVPC.spec, ipv4Namespace: e.target.value }
                  })}
                  disabled={readonly}
                  style={{ width: '100%', padding: '8px', marginTop: '5px' }}
                  data-testid="ipv4-namespace-input"
                />
              </label>
            </div>
            <div>
              <label>
                <strong>VLAN Namespace:</strong>
                <input
                  type="text"
                  value={currentVPC.spec.vlanNamespace || 'default'}
                  onChange={(e) => handleChange({
                    spec: { ...currentVPC.spec, vlanNamespace: e.target.value }
                  })}
                  disabled={readonly}
                  style={{ width: '100%', padding: '8px', marginTop: '5px' }}
                  data-testid="vlan-namespace-input"
                />
              </label>
            </div>
            <div>
              <label>
                <strong>VPC Mode:</strong>
                <select
                  value={currentVPC.spec.mode || 'default'}
                  onChange={(e) => handleChange({
                    spec: { ...currentVPC.spec, mode: e.target.value as 'default' | 'single' | 'multi' }
                  })}
                  disabled={readonly}
                  style={{ width: '100%', padding: '8px', marginTop: '5px' }}
                  data-testid="vpc-mode-select"
                >
                  <option value="default">Default</option>
                  <option value="single">Single</option>
                  <option value="multi">Multi</option>
                </select>
              </label>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '20px', marginTop: '20px' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <input
                type="checkbox"
                checked={currentVPC.spec.defaultIsolated || false}
                onChange={(e) => handleChange({
                  spec: { ...currentVPC.spec, defaultIsolated: e.target.checked }
                })}
                disabled={readonly}
                data-testid="default-isolated-checkbox"
              />
              <span>Default Isolated Mode</span>
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <input
                type="checkbox"
                checked={currentVPC.spec.defaultRestricted || false}
                onChange={(e) => handleChange({
                  spec: { ...currentVPC.spec, defaultRestricted: e.target.checked }
                })}
                disabled={readonly}
                data-testid="default-restricted-checkbox"
              />
              <span>Default Restricted Mode</span>
            </label>
          </div>
        </div>
      )}

      {/* Subnets Tab */}
      {activeTab === 'subnets' && (
        <div className="subnets-section">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <h4>Subnets</h4>
            {!readonly && (
              <button
                onClick={addSubnet}
                style={{
                  padding: '8px 16px',
                  backgroundColor: '#28a745',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer'
                }}
                data-testid="add-subnet-button"
              >
                Add Subnet
              </button>
            )}
          </div>

          {Object.entries(currentVPC.spec.subnets).map(([name, subnet]) => (
            <div key={name} style={{ 
              border: '1px solid #ddd', 
              borderRadius: '4px', 
              padding: '15px', 
              marginBottom: '15px' 
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
                <h5 style={{ margin: 0 }}>Subnet: {name}</h5>
                {!readonly && name !== 'default' && (
                  <button
                    onClick={() => removeSubnet(name)}
                    style={{
                      padding: '4px 8px',
                      backgroundColor: '#dc3545',
                      color: 'white',
                      border: 'none',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      fontSize: '12px'
                    }}
                    data-testid={`remove-subnet-${name}`}
                  >
                    Remove
                  </button>
                )}
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '15px' }}>
                <div>
                  <label>
                    <strong>CIDR:</strong>
                    <input
                      type="text"
                      value={subnet.cidr}
                      onChange={(e) => updateSubnet(name, { cidr: e.target.value })}
                      disabled={readonly}
                      style={{ width: '100%', padding: '8px', marginTop: '5px' }}
                      placeholder="10.1.0.0/24"
                      data-testid={`subnet-${name}-cidr`}
                    />
                  </label>
                </div>
                <div>
                  <label>
                    <strong>Gateway:</strong>
                    <input
                      type="text"
                      value={subnet.gateway || ''}
                      onChange={(e) => updateSubnet(name, { gateway: e.target.value })}
                      disabled={readonly}
                      style={{ width: '100%', padding: '8px', marginTop: '5px' }}
                      placeholder="10.1.0.1"
                      data-testid={`subnet-${name}-gateway`}
                    />
                  </label>
                </div>
                <div>
                  <label>
                    <strong>VLAN ID:</strong>
                    <input
                      type="number"
                      value={subnet.vlan || ''}
                      onChange={(e) => updateSubnet(name, { 
                        vlan: e.target.value ? parseInt(e.target.value) : undefined 
                      })}
                      disabled={readonly}
                      style={{ width: '100%', padding: '8px', marginTop: '5px' }}
                      min={1}
                      max={4094}
                      placeholder="Auto"
                      data-testid={`subnet-${name}-vlan`}
                    />
                  </label>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '20px', marginTop: '15px' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <input
                    type="checkbox"
                    checked={subnet.isolated || false}
                    onChange={(e) => updateSubnet(name, { isolated: e.target.checked })}
                    disabled={readonly}
                    data-testid={`subnet-${name}-isolated`}
                  />
                  <span>Isolated</span>
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <input
                    type="checkbox"
                    checked={subnet.restricted || false}
                    onChange={(e) => updateSubnet(name, { restricted: e.target.checked })}
                    disabled={readonly}
                    data-testid={`subnet-${name}-restricted`}
                  />
                  <span>Restricted</span>
                </label>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Static Routes Tab */}
      {activeTab === 'routing' && (
        <div className="routing-section">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <h4>Static Routes</h4>
            {!readonly && (
              <button
                onClick={addStaticRoute}
                style={{
                  padding: '8px 16px',
                  backgroundColor: '#28a745',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer'
                }}
                data-testid="add-static-route-button"
              >
                Add Route
              </button>
            )}
          </div>

          {currentVPC.spec.staticRoutes?.map((route, index) => (
            <div key={index} style={{ 
              border: '1px solid #ddd', 
              borderRadius: '4px', 
              padding: '15px', 
              marginBottom: '15px' 
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
                <h5 style={{ margin: 0 }}>Route {index + 1}</h5>
                {!readonly && (
                  <button
                    onClick={() => removeStaticRoute(index)}
                    style={{
                      padding: '4px 8px',
                      backgroundColor: '#dc3545',
                      color: 'white',
                      border: 'none',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      fontSize: '12px'
                    }}
                    data-testid={`remove-route-${index}`}
                  >
                    Remove
                  </button>
                )}
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '15px' }}>
                <div>
                  <label>
                    <strong>Destination:</strong>
                    <input
                      type="text"
                      value={route.destination}
                      onChange={(e) => {
                        const routes = [...(currentVPC.spec.staticRoutes || [])]
                        routes[index] = { ...routes[index], destination: e.target.value }
                        handleChange({ spec: { ...currentVPC.spec, staticRoutes: routes } })
                      }}
                      disabled={readonly}
                      style={{ width: '100%', padding: '8px', marginTop: '5px' }}
                      placeholder="0.0.0.0/0"
                      data-testid={`route-${index}-destination`}
                    />
                  </label>
                </div>
                <div>
                  <label>
                    <strong>Next Hop:</strong>
                    <input
                      type="text"
                      value={route.nextHop}
                      onChange={(e) => {
                        const routes = [...(currentVPC.spec.staticRoutes || [])]
                        routes[index] = { ...routes[index], nextHop: e.target.value }
                        handleChange({ spec: { ...currentVPC.spec, staticRoutes: routes } })
                      }}
                      disabled={readonly}
                      style={{ width: '100%', padding: '8px', marginTop: '5px' }}
                      placeholder="10.1.0.1"
                      data-testid={`route-${index}-nexthop`}
                    />
                  </label>
                </div>
                <div>
                  <label>
                    <strong>Metric:</strong>
                    <input
                      type="number"
                      value={route.metric || ''}
                      onChange={(e) => {
                        const routes = [...(currentVPC.spec.staticRoutes || [])]
                        routes[index] = { 
                          ...routes[index], 
                          metric: e.target.value ? parseInt(e.target.value) : undefined 
                        }
                        handleChange({ spec: { ...currentVPC.spec, staticRoutes: routes } })
                      }}
                      disabled={readonly}
                      style={{ width: '100%', padding: '8px', marginTop: '5px' }}
                      min={1}
                      placeholder="100"
                      data-testid={`route-${index}-metric`}
                    />
                  </label>
                </div>
              </div>
            </div>
          ))}

          {(!currentVPC.spec.staticRoutes || currentVPC.spec.staticRoutes.length === 0) && (
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

      {/* Access Policies Tab */}
      {activeTab === 'policies' && (
        <div className="policies-section">
          <h4>Access Control Policies</h4>
          <div style={{ 
            padding: '20px', 
            backgroundColor: '#fff3cd',
            border: '1px solid #ffeaa7',
            borderRadius: '4px',
            marginTop: '15px'
          }}>
            <p style={{ margin: 0 }}>
              <strong>Note:</strong> Access policies define which subnets can communicate with each other.
              Policies work in conjunction with subnet isolation settings.
            </p>
          </div>
          
          <div style={{ 
            padding: '20px', 
            textAlign: 'center', 
            color: '#6c757d',
            border: '2px dashed #dee2e6',
            borderRadius: '4px',
            marginTop: '20px'
          }}>
            Advanced policy editor coming soon. For now, configure isolation at the subnet level.
          </div>
        </div>
      )}
    </div>
  )
}

export default VPCEditor