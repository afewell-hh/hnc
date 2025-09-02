import React, { useState, useCallback } from 'react'
import type { VPCPeering, K8sMetadata } from '../../upstream/types/generated'

export interface VPCPeeringPermit {
  localSubnets: string[]
  remoteSubnets: string[]
  bidirectional?: boolean
}

export interface VPCPeeringConfig {
  metadata: K8sMetadata
  spec: {
    remote?: string
    permit?: VPCPeeringPermit[]
  }
}

export interface VPCPeeringEditorProps {
  peering?: VPCPeeringConfig
  availableVPCs?: string[]
  availableSubnets?: Record<string, string[]> // vpc-name -> subnet names
  onChange: (peering: VPCPeeringConfig) => void
  onValidate?: (isValid: boolean, errors: string[]) => void
  readonly?: boolean
}

export const VPCPeeringEditor: React.FC<VPCPeeringEditorProps> = ({
  peering,
  availableVPCs = [],
  availableSubnets = {},
  onChange,
  onValidate,
  readonly = false
}) => {
  const [errors, setErrors] = useState<string[]>([])
  const [activePermit, setActivePermit] = useState<number | null>(null)

  // Initialize default peering config
  const defaultPeering: VPCPeeringConfig = {
    metadata: {
      name: 'vpc-peering-1',
      labels: {},
      annotations: {}
    },
    spec: {
      remote: '',
      permit: []
    }
  }

  const currentPeering = peering || defaultPeering

  const validatePeering = useCallback((config: VPCPeeringConfig): { isValid: boolean; errors: string[] } => {
    const validationErrors: string[] = []

    // Validate metadata
    if (!config.metadata.name) {
      validationErrors.push('Peering name is required')
    }

    // Validate remote VPC
    if (!config.spec.remote) {
      validationErrors.push('Remote VPC is required')
    }

    // Validate permits
    if (!config.spec.permit || config.spec.permit.length === 0) {
      validationErrors.push('At least one peering policy is required')
    } else {
      config.spec.permit.forEach((permit, index) => {
        if (!permit.localSubnets || permit.localSubnets.length === 0) {
          validationErrors.push(`Permit ${index + 1}: Local subnets are required`)
        }
        if (!permit.remoteSubnets || permit.remoteSubnets.length === 0) {
          validationErrors.push(`Permit ${index + 1}: Remote subnets are required`)
        }
      })
    }

    return { isValid: validationErrors.length === 0, errors: validationErrors }
  }, [])

  const handleChange = useCallback((updates: Partial<VPCPeeringConfig>) => {
    const newPeering = {
      ...currentPeering,
      ...updates,
      spec: {
        ...currentPeering.spec,
        ...(updates.spec || {})
      },
      metadata: {
        ...currentPeering.metadata,
        ...(updates.metadata || {})
      }
    }

    const validation = validatePeering(newPeering)
    setErrors(validation.errors)
    onValidate?.(validation.isValid, validation.errors)
    onChange(newPeering)
  }, [currentPeering, onChange, onValidate, validatePeering])

  const addPermit = useCallback(() => {
    const newPermit: VPCPeeringPermit = {
      localSubnets: [],
      remoteSubnets: [],
      bidirectional: true
    }

    handleChange({
      spec: {
        ...currentPeering.spec,
        permit: [...(currentPeering.spec.permit || []), newPermit]
      }
    })
  }, [currentPeering, handleChange])

  const removePermit = useCallback((index: number) => {
    const permits = [...(currentPeering.spec.permit || [])]
    permits.splice(index, 1)
    handleChange({
      spec: {
        ...currentPeering.spec,
        permit: permits
      }
    })
    if (activePermit === index) {
      setActivePermit(null)
    }
  }, [currentPeering, handleChange, activePermit])

  const updatePermit = useCallback((index: number, updates: Partial<VPCPeeringPermit>) => {
    const permits = [...(currentPeering.spec.permit || [])]
    permits[index] = { ...permits[index], ...updates }
    handleChange({
      spec: {
        ...currentPeering.spec,
        permit: permits
      }
    })
  }, [currentPeering, handleChange])

  const toggleSubnet = useCallback((permitIndex: number, subnet: string, isLocal: boolean) => {
    const permits = [...(currentPeering.spec.permit || [])]
    const permit = permits[permitIndex]
    const subnets = isLocal ? [...permit.localSubnets] : [...permit.remoteSubnets]
    
    const subnetIndex = subnets.indexOf(subnet)
    if (subnetIndex >= 0) {
      subnets.splice(subnetIndex, 1)
    } else {
      subnets.push(subnet)
    }

    updatePermit(permitIndex, {
      [isLocal ? 'localSubnets' : 'remoteSubnets']: subnets
    })
  }, [currentPeering, updatePermit])

  const getVPCName = (vpcSubnetName: string): string => {
    return vpcSubnetName.split('/')[0] || ''
  }

  const currentVPCName = Object.keys(availableSubnets)[0] || 'vpc-1' // Assume first VPC is current
  const remoteVPCName = currentPeering.spec.remote || ''

  return (
    <div className="vpc-peering-editor" style={{ border: '1px solid #ccc', borderRadius: '4px', padding: '20px' }}>
      <div style={{ marginBottom: '20px' }}>
        <h3>VPC Peering Configuration</h3>
        <p style={{ color: '#6c757d', fontSize: '14px' }}>
          Configure connectivity policies between VPCs and their subnets
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

      {/* Basic Settings */}
      <div style={{ marginBottom: '30px' }}>
        <h4>Basic Settings</h4>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
          <div>
            <label>
              <strong>Peering Name:</strong>
              <input
                type="text"
                value={currentPeering.metadata.name || ''}
                onChange={(e) => handleChange({
                  metadata: { ...currentPeering.metadata, name: e.target.value }
                })}
                disabled={readonly}
                style={{ width: '100%', padding: '8px', marginTop: '5px' }}
                placeholder="vpc-peering-1"
                data-testid="peering-name-input"
              />
            </label>
          </div>

          <div>
            <label>
              <strong>Remote VPC:</strong>
              <select
                value={currentPeering.spec.remote || ''}
                onChange={(e) => handleChange({
                  spec: { ...currentPeering.spec, remote: e.target.value }
                })}
                disabled={readonly}
                style={{ width: '100%', padding: '8px', marginTop: '5px' }}
                data-testid="remote-vpc-select"
              >
                <option value="">Select remote VPC</option>
                {availableVPCs.map((vpc) => (
                  <option key={vpc} value={vpc}>
                    {vpc}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </div>
      </div>

      {/* Peering Policies */}
      <div style={{ marginBottom: '30px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <h4>Peering Policies</h4>
          {!readonly && (
            <button
              onClick={addPermit}
              style={{
                padding: '8px 16px',
                backgroundColor: '#28a745',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer'
              }}
              data-testid="add-permit-button"
            >
              Add Policy
            </button>
          )}
        </div>

        {currentPeering.spec.permit?.map((permit, index) => (
          <div key={index} style={{ 
            border: '1px solid #ddd', 
            borderRadius: '4px', 
            marginBottom: '20px',
            overflow: 'hidden'
          }}>
            {/* Policy Header */}
            <div 
              style={{ 
                padding: '15px', 
                backgroundColor: activePermit === index ? '#e7f3ff' : '#f8f9fa',
                borderBottom: '1px solid #ddd',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                cursor: 'pointer'
              }}
              onClick={() => setActivePermit(activePermit === index ? null : index)}
            >
              <div>
                <h5 style={{ margin: '0 0 5px 0' }}>Policy {index + 1}</h5>
                <div style={{ fontSize: '12px', color: '#6c757d' }}>
                  {permit.localSubnets.length} local ↔ {permit.remoteSubnets.length} remote subnets
                  {permit.bidirectional ? ' (bidirectional)' : ' (unidirectional)'}
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span style={{ fontSize: '12px', color: '#6c757d' }}>
                  {activePermit === index ? 'Collapse' : 'Expand'}
                </span>
                {!readonly && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      removePermit(index)
                    }}
                    style={{
                      padding: '4px 8px',
                      backgroundColor: '#dc3545',
                      color: 'white',
                      border: 'none',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      fontSize: '12px'
                    }}
                    data-testid={`remove-permit-${index}`}
                  >
                    Remove
                  </button>
                )}
              </div>
            </div>

            {/* Policy Details */}
            {activePermit === index && (
              <div style={{ padding: '20px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '30px' }}>
                  {/* Local Subnets */}
                  <div>
                    <h5>Local Subnets ({currentVPCName})</h5>
                    <div style={{ 
                      border: '1px solid #ddd', 
                      borderRadius: '4px', 
                      maxHeight: '200px', 
                      overflowY: 'auto',
                      padding: '10px'
                    }}>
                      {availableSubnets[currentVPCName]?.map((subnet) => (
                        <label 
                          key={subnet}
                          style={{ 
                            display: 'flex', 
                            alignItems: 'center', 
                            gap: '8px', 
                            marginBottom: '8px',
                            cursor: readonly ? 'default' : 'pointer'
                          }}
                        >
                          <input
                            type="checkbox"
                            checked={permit.localSubnets.includes(`${currentVPCName}/${subnet}`)}
                            onChange={() => toggleSubnet(index, `${currentVPCName}/${subnet}`, true)}
                            disabled={readonly}
                            data-testid={`local-subnet-${index}-${subnet}`}
                          />
                          <span style={{ fontSize: '14px' }}>{subnet}</span>
                        </label>
                      )) || (
                        <div style={{ color: '#6c757d', fontStyle: 'italic' }}>
                          No subnets available
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Remote Subnets */}
                  <div>
                    <h5>Remote Subnets ({remoteVPCName || 'Select remote VPC'})</h5>
                    <div style={{ 
                      border: '1px solid #ddd', 
                      borderRadius: '4px', 
                      maxHeight: '200px', 
                      overflowY: 'auto',
                      padding: '10px'
                    }}>
                      {remoteVPCName && availableSubnets[remoteVPCName]?.map((subnet) => (
                        <label 
                          key={subnet}
                          style={{ 
                            display: 'flex', 
                            alignItems: 'center', 
                            gap: '8px', 
                            marginBottom: '8px',
                            cursor: readonly ? 'default' : 'pointer'
                          }}
                        >
                          <input
                            type="checkbox"
                            checked={permit.remoteSubnets.includes(`${remoteVPCName}/${subnet}`)}
                            onChange={() => toggleSubnet(index, `${remoteVPCName}/${subnet}`, false)}
                            disabled={readonly}
                            data-testid={`remote-subnet-${index}-${subnet}`}
                          />
                          <span style={{ fontSize: '14px' }}>{subnet}</span>
                        </label>
                      )) || (
                        <div style={{ color: '#6c757d', fontStyle: 'italic' }}>
                          {remoteVPCName ? 'No subnets available' : 'Select a remote VPC first'}
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Bidirectional Toggle */}
                <div style={{ marginTop: '20px', paddingTop: '15px', borderTop: '1px solid #eee' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <input
                      type="checkbox"
                      checked={permit.bidirectional !== false}
                      onChange={(e) => updatePermit(index, { bidirectional: e.target.checked })}
                      disabled={readonly}
                      data-testid={`bidirectional-${index}`}
                    />
                    <span>
                      <strong>Bidirectional Communication</strong>
                      <div style={{ fontSize: '12px', color: '#6c757d', marginTop: '2px' }}>
                        When enabled, both VPCs can initiate connections to each other
                      </div>
                    </span>
                  </label>
                </div>

                {/* Policy Preview */}
                <div style={{ 
                  marginTop: '20px', 
                  padding: '15px', 
                  backgroundColor: '#f8f9fa',
                  border: '1px solid #dee2e6',
                  borderRadius: '4px'
                }}>
                  <h6 style={{ margin: '0 0 10px 0' }}>Communication Flow:</h6>
                  <div style={{ fontSize: '14px', fontFamily: 'monospace' }}>
                    {permit.localSubnets.map(ls => 
                      permit.remoteSubnets.map(rs => (
                        <div key={`${ls}-${rs}`} style={{ marginBottom: '5px' }}>
                          {ls} {permit.bidirectional !== false ? '↔' : '→'} {rs}
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        ))}

        {(!currentPeering.spec.permit || currentPeering.spec.permit.length === 0) && (
          <div style={{ 
            padding: '20px', 
            textAlign: 'center', 
            color: '#6c757d',
            border: '2px dashed #dee2e6',
            borderRadius: '4px'
          }}>
            No peering policies configured. Click "Add Policy" to create one.
          </div>
        )}
      </div>

      {/* Configuration Summary */}
      {currentPeering.spec.remote && currentPeering.spec.permit && currentPeering.spec.permit.length > 0 && (
        <div style={{ 
          marginTop: '30px', 
          padding: '20px', 
          backgroundColor: '#e7f3ff',
          border: '1px solid #b3d7ff',
          borderRadius: '4px'
        }}>
          <h4 style={{ margin: '0 0 15px 0' }}>Peering Summary</h4>
          <div style={{ fontSize: '14px' }}>
            <div><strong>Connection:</strong> {currentVPCName} ↔ {currentPeering.spec.remote}</div>
            <div><strong>Policies:</strong> {currentPeering.spec.permit.length} active</div>
            <div><strong>Total Subnet Pairs:</strong> {
              currentPeering.spec.permit.reduce((total, permit) => 
                total + (permit.localSubnets.length * permit.remoteSubnets.length), 0
              )
            }</div>
            <div><strong>Status:</strong> {errors.length === 0 ? '✓ Valid configuration' : '⚠ Has validation errors'}</div>
          </div>
        </div>
      )}

      {/* Help Section */}
      <div style={{ 
        marginTop: '30px', 
        padding: '15px', 
        backgroundColor: '#fff3cd',
        border: '1px solid #ffeaa7',
        borderRadius: '4px'
      }}>
        <h5 style={{ margin: '0 0 10px 0' }}>💡 Peering Tips</h5>
        <ul style={{ margin: 0, paddingLeft: '20px', fontSize: '14px' }}>
          <li><strong>Security:</strong> Only allow necessary subnet-to-subnet communication</li>
          <li><strong>Bidirectional:</strong> Enable for services that need to respond to requests</li>
          <li><strong>Granular Control:</strong> Create separate policies for different security zones</li>
          <li><strong>Performance:</strong> Fewer, broader policies can reduce overhead</li>
        </ul>
      </div>
    </div>
  )
}

export default VPCPeeringEditor