import React, { useState, useCallback } from 'react'
import type { External, ExternalAttachment, ExternalPeering, K8sMetadata } from '../../upstream/types/generated'

export interface ExternalConfig {
  metadata: K8sMetadata
  spec: {
    ipv4Namespace?: string
    inboundCommunity?: string
    outboundCommunity?: string
  }
}

export interface ExternalAttachmentConfig {
  metadata: K8sMetadata
  spec: {
    connection?: string
    external?: string
    neighbor?: {
      asn?: number
      ip?: string
      password?: string
    }
    switch?: {
      ip?: string
      asn?: number
    }
  }
}

export interface ExternalPeeringConfig {
  metadata: K8sMetadata
  spec: {
    permit?: {
      vpc?: string
      external?: string
      vpcSubnets?: string[]
      externalPrefixes?: string[]
    }
  }
}

export interface ExternalConnectivityEditorProps {
  external?: ExternalConfig
  attachment?: ExternalAttachmentConfig
  peering?: ExternalPeeringConfig
  availableConnections?: string[]
  availableVPCs?: string[]
  availableSubnets?: Record<string, string[]>
  onChange: (config: {
    external?: ExternalConfig
    attachment?: ExternalAttachmentConfig
    peering?: ExternalPeeringConfig
  }) => void
  onValidate?: (isValid: boolean, errors: string[]) => void
  readonly?: boolean
}

export const ExternalConnectivityEditor: React.FC<ExternalConnectivityEditorProps> = ({
  external,
  attachment,
  peering,
  availableConnections = [],
  availableVPCs = [],
  availableSubnets = {},
  onChange,
  onValidate,
  readonly = false
}) => {
  const [activeTab, setActiveTab] = useState<'external' | 'attachment' | 'peering'>('external')
  const [errors, setErrors] = useState<string[]>([])

  // Initialize default configs
  const defaultExternal: ExternalConfig = {
    metadata: {
      name: 'external-1',
      labels: {},
      annotations: {}
    },
    spec: {
      ipv4Namespace: 'default',
      inboundCommunity: '',
      outboundCommunity: ''
    }
  }

  const defaultAttachment: ExternalAttachmentConfig = {
    metadata: {
      name: 'external-attachment-1',
      labels: {},
      annotations: {}
    },
    spec: {
      connection: '',
      external: '',
      neighbor: {
        asn: 65100,
        ip: '',
        password: ''
      },
      switch: {
        ip: '',
        asn: 65000
      }
    }
  }

  const defaultPeering: ExternalPeeringConfig = {
    metadata: {
      name: 'external-peering-1',
      labels: {},
      annotations: {}
    },
    spec: {
      permit: {
        vpc: '',
        external: '',
        vpcSubnets: [],
        externalPrefixes: []
      }
    }
  }

  const currentExternal = external || defaultExternal
  const currentAttachment = attachment || defaultAttachment
  const currentPeering = peering || defaultPeering

  const validateConfig = useCallback(() => {
    const validationErrors: string[] = []

    // Validate External
    if (!currentExternal.metadata.name) {
      validationErrors.push('External name is required')
    }
    if (currentExternal.spec.inboundCommunity && !/^\d+:\d+$/.test(currentExternal.spec.inboundCommunity)) {
      validationErrors.push('Inbound community must be in format "asn:value" (e.g., 65102:5000)')
    }
    if (currentExternal.spec.outboundCommunity && !/^\d+:\d+$/.test(currentExternal.spec.outboundCommunity)) {
      validationErrors.push('Outbound community must be in format "asn:value" (e.g., 50000:50001)')
    }

    // Validate Attachment
    if (!currentAttachment.spec.connection) {
      validationErrors.push('Connection is required for external attachment')
    }
    if (!currentAttachment.spec.external) {
      validationErrors.push('External reference is required')
    }
    if (!currentAttachment.spec.neighbor?.ip || !/^(\d{1,3}\.){3}\d{1,3}$/.test(currentAttachment.spec.neighbor.ip)) {
      validationErrors.push('Valid neighbor IP address is required')
    }
    if (!currentAttachment.spec.neighbor?.asn || currentAttachment.spec.neighbor.asn < 1) {
      validationErrors.push('Valid neighbor ASN is required')
    }
    if (!currentAttachment.spec.switch?.ip || !/^(\d{1,3}\.){3}\d{1,3}$/.test(currentAttachment.spec.switch.ip)) {
      validationErrors.push('Valid switch IP address is required')
    }

    // Validate Peering
    if (!currentPeering.spec.permit?.vpc) {
      validationErrors.push('VPC is required for external peering')
    }
    if (!currentPeering.spec.permit?.external) {
      validationErrors.push('External reference is required for peering')
    }
    if (!currentPeering.spec.permit?.vpcSubnets || currentPeering.spec.permit.vpcSubnets.length === 0) {
      validationErrors.push('At least one VPC subnet is required for peering')
    }
    if (!currentPeering.spec.permit?.externalPrefixes || currentPeering.spec.permit.externalPrefixes.length === 0) {
      validationErrors.push('At least one external prefix is required for peering')
    }

    return { isValid: validationErrors.length === 0, errors: validationErrors }
  }, [currentExternal, currentAttachment, currentPeering])

  const handleChange = useCallback((updates: {
    external?: Partial<ExternalConfig>
    attachment?: Partial<ExternalAttachmentConfig>
    peering?: Partial<ExternalPeeringConfig>
  }) => {
    const newExternal = updates.external ? {
      ...currentExternal,
      ...updates.external,
      spec: { ...currentExternal.spec, ...(updates.external.spec || {}) },
      metadata: { ...currentExternal.metadata, ...(updates.external.metadata || {}) }
    } : currentExternal

    const newAttachment = updates.attachment ? {
      ...currentAttachment,
      ...updates.attachment,
      spec: { ...currentAttachment.spec, ...(updates.attachment.spec || {}) },
      metadata: { ...currentAttachment.metadata, ...(updates.attachment.metadata || {}) }
    } : currentAttachment

    const newPeering = updates.peering ? {
      ...currentPeering,
      ...updates.peering,
      spec: { ...currentPeering.spec, ...(updates.peering.spec || {}) },
      metadata: { ...currentPeering.metadata, ...(updates.peering.metadata || {}) }
    } : currentPeering

    const validation = validateConfig()
    setErrors(validation.errors)
    onValidate?.(validation.isValid, validation.errors)
    
    onChange({
      external: newExternal,
      attachment: newAttachment,
      peering: newPeering
    })
  }, [currentExternal, currentAttachment, currentPeering, onChange, onValidate, validateConfig])

  const addVPCSubnet = useCallback((subnet: string) => {
    const currentSubnets = currentPeering.spec.permit?.vpcSubnets || []
    if (!currentSubnets.includes(subnet)) {
      handleChange({
        peering: {
          spec: {
            ...currentPeering.spec,
            permit: {
              ...currentPeering.spec.permit,
              vpcSubnets: [...currentSubnets, subnet]
            }
          }
        }
      })
    }
  }, [currentPeering, handleChange])

  const removeVPCSubnet = useCallback((subnet: string) => {
    const currentSubnets = currentPeering.spec.permit?.vpcSubnets || []
    handleChange({
      peering: {
        spec: {
          ...currentPeering.spec,
          permit: {
            ...currentPeering.spec.permit,
            vpcSubnets: currentSubnets.filter(s => s !== subnet)
          }
        }
      }
    })
  }, [currentPeering, handleChange])

  const addExternalPrefix = useCallback(() => {
    const currentPrefixes = currentPeering.spec.permit?.externalPrefixes || []
    const newPrefix = '0.0.0.0/0'
    if (!currentPrefixes.includes(newPrefix)) {
      handleChange({
        peering: {
          spec: {
            ...currentPeering.spec,
            permit: {
              ...currentPeering.spec.permit,
              externalPrefixes: [...currentPrefixes, newPrefix]
            }
          }
        }
      })
    }
  }, [currentPeering, handleChange])

  const updateExternalPrefix = useCallback((index: number, value: string) => {
    const currentPrefixes = [...(currentPeering.spec.permit?.externalPrefixes || [])]
    currentPrefixes[index] = value
    handleChange({
      peering: {
        spec: {
          ...currentPeering.spec,
          permit: {
            ...currentPeering.spec.permit,
            externalPrefixes: currentPrefixes
          }
        }
      }
    })
  }, [currentPeering, handleChange])

  const removeExternalPrefix = useCallback((index: number) => {
    const currentPrefixes = [...(currentPeering.spec.permit?.externalPrefixes || [])]
    currentPrefixes.splice(index, 1)
    handleChange({
      peering: {
        spec: {
          ...currentPeering.spec,
          permit: {
            ...currentPeering.spec.permit,
            externalPrefixes: currentPrefixes
          }
        }
      }
    })
  }, [currentPeering, handleChange])

  const tabStyle = (tab: string) => ({
    padding: '8px 16px',
    backgroundColor: activeTab === tab ? '#007bff' : '#f8f9fa',
    color: activeTab === tab ? 'white' : '#495057',
    border: '1px solid #dee2e6',
    cursor: 'pointer',
    borderBottom: activeTab === tab ? 'none' : '1px solid #dee2e6'
  })

  return (
    <div className="external-connectivity-editor" style={{ border: '1px solid #ccc', borderRadius: '4px', padding: '20px' }}>
      <div style={{ marginBottom: '20px' }}>
        <h3>External Connectivity Configuration</h3>
        <p style={{ color: '#6c757d', fontSize: '14px' }}>
          Configure external network connections, BGP peering, and routing policies
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
        <button style={tabStyle('external')} onClick={() => setActiveTab('external')}>
          External Network
        </button>
        <button style={tabStyle('attachment')} onClick={() => setActiveTab('attachment')}>
          BGP Attachment
        </button>
        <button style={tabStyle('peering')} onClick={() => setActiveTab('peering')}>
          VPC Peering
        </button>
      </div>

      {/* External Network Tab */}
      {activeTab === 'external' && (
        <div className="external-section">
          <h4>External Network Definition</h4>
          <p style={{ color: '#6c757d', fontSize: '14px', marginBottom: '20px' }}>
            Define the external network entity and BGP community settings
          </p>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
            <div>
              <label>
                <strong>External Name:</strong>
                <input
                  type="text"
                  value={currentExternal.metadata.name || ''}
                  onChange={(e) => handleChange({
                    external: {
                      metadata: { ...currentExternal.metadata, name: e.target.value }
                    }
                  })}
                  disabled={readonly}
                  style={{ width: '100%', padding: '8px', marginTop: '5px' }}
                  placeholder="external-1"
                  data-testid="external-name-input"
                />
              </label>
            </div>

            <div>
              <label>
                <strong>IPv4 Namespace:</strong>
                <input
                  type="text"
                  value={currentExternal.spec.ipv4Namespace || 'default'}
                  onChange={(e) => handleChange({
                    external: {
                      spec: { ...currentExternal.spec, ipv4Namespace: e.target.value }
                    }
                  })}
                  disabled={readonly}
                  style={{ width: '100%', padding: '8px', marginTop: '5px' }}
                  data-testid="external-ipv4-namespace-input"
                />
              </label>
            </div>

            <div>
              <label>
                <strong>Inbound Community:</strong>
                <input
                  type="text"
                  value={currentExternal.spec.inboundCommunity || ''}
                  onChange={(e) => handleChange({
                    external: {
                      spec: { ...currentExternal.spec, inboundCommunity: e.target.value }
                    }
                  })}
                  disabled={readonly}
                  style={{ width: '100%', padding: '8px', marginTop: '5px' }}
                  placeholder="65102:5000"
                  data-testid="inbound-community-input"
                />
              </label>
              <div style={{ fontSize: '12px', color: '#6c757d', marginTop: '5px' }}>
                Filter routes from external system (format: ASN:value)
              </div>
            </div>

            <div>
              <label>
                <strong>Outbound Community:</strong>
                <input
                  type="text"
                  value={currentExternal.spec.outboundCommunity || ''}
                  onChange={(e) => handleChange({
                    external: {
                      spec: { ...currentExternal.spec, outboundCommunity: e.target.value }
                    }
                  })}
                  disabled={readonly}
                  style={{ width: '100%', padding: '8px', marginTop: '5px' }}
                  placeholder="50000:50001"
                  data-testid="outbound-community-input"
                />
              </label>
              <div style={{ fontSize: '12px', color: '#6c757d', marginTop: '5px' }}>
                Tag all outbound routes with this community
              </div>
            </div>
          </div>
        </div>
      )}

      {/* BGP Attachment Tab */}
      {activeTab === 'attachment' && (
        <div className="attachment-section">
          <h4>BGP Attachment Configuration</h4>
          <p style={{ color: '#6c757d', fontSize: '14px', marginBottom: '20px' }}>
            Configure the physical connection and BGP neighbor settings
          </p>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '30px' }}>
            <div>
              <label>
                <strong>Attachment Name:</strong>
                <input
                  type="text"
                  value={currentAttachment.metadata.name || ''}
                  onChange={(e) => handleChange({
                    attachment: {
                      metadata: { ...currentAttachment.metadata, name: e.target.value }
                    }
                  })}
                  disabled={readonly}
                  style={{ width: '100%', padding: '8px', marginTop: '5px' }}
                  placeholder="external-attachment-1"
                  data-testid="attachment-name-input"
                />
              </label>
            </div>

            <div>
              <label>
                <strong>Connection:</strong>
                <select
                  value={currentAttachment.spec.connection || ''}
                  onChange={(e) => handleChange({
                    attachment: {
                      spec: { ...currentAttachment.spec, connection: e.target.value }
                    }
                  })}
                  disabled={readonly}
                  style={{ width: '100%', padding: '8px', marginTop: '5px' }}
                  data-testid="attachment-connection-select"
                >
                  <option value="">Select connection</option>
                  {availableConnections.map((conn) => (
                    <option key={conn} value={conn}>{conn}</option>
                  ))}
                </select>
              </label>
            </div>

            <div>
              <label>
                <strong>External Reference:</strong>
                <input
                  type="text"
                  value={currentAttachment.spec.external || ''}
                  onChange={(e) => handleChange({
                    attachment: {
                      spec: { ...currentAttachment.spec, external: e.target.value }
                    }
                  })}
                  disabled={readonly}
                  style={{ width: '100%', padding: '8px', marginTop: '5px' }}
                  placeholder="external-1"
                  data-testid="attachment-external-input"
                />
              </label>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '30px' }}>
            {/* BGP Neighbor Settings */}
            <div>
              <h5>BGP Neighbor</h5>
              <div style={{ border: '1px solid #ddd', borderRadius: '4px', padding: '15px' }}>
                <div style={{ marginBottom: '15px' }}>
                  <label>
                    <strong>Neighbor IP:</strong>
                    <input
                      type="text"
                      value={currentAttachment.spec.neighbor?.ip || ''}
                      onChange={(e) => handleChange({
                        attachment: {
                          spec: {
                            ...currentAttachment.spec,
                            neighbor: { ...currentAttachment.spec.neighbor, ip: e.target.value }
                          }
                        }
                      })}
                      disabled={readonly}
                      style={{ width: '100%', padding: '8px', marginTop: '5px' }}
                      placeholder="192.168.1.1"
                      data-testid="neighbor-ip-input"
                    />
                  </label>
                </div>

                <div style={{ marginBottom: '15px' }}>
                  <label>
                    <strong>Neighbor ASN:</strong>
                    <input
                      type="number"
                      value={currentAttachment.spec.neighbor?.asn || ''}
                      onChange={(e) => handleChange({
                        attachment: {
                          spec: {
                            ...currentAttachment.spec,
                            neighbor: { 
                              ...currentAttachment.spec.neighbor, 
                              asn: e.target.value ? parseInt(e.target.value) : undefined 
                            }
                          }
                        }
                      })}
                      disabled={readonly}
                      style={{ width: '100%', padding: '8px', marginTop: '5px' }}
                      min={1}
                      max={4294967295}
                      placeholder="65100"
                      data-testid="neighbor-asn-input"
                    />
                  </label>
                </div>

                <div>
                  <label>
                    <strong>BGP Password:</strong>
                    <input
                      type="password"
                      value={currentAttachment.spec.neighbor?.password || ''}
                      onChange={(e) => handleChange({
                        attachment: {
                          spec: {
                            ...currentAttachment.spec,
                            neighbor: { ...currentAttachment.spec.neighbor, password: e.target.value }
                          }
                        }
                      })}
                      disabled={readonly}
                      style={{ width: '100%', padding: '8px', marginTop: '5px' }}
                      placeholder="Optional BGP password"
                      data-testid="neighbor-password-input"
                    />
                  </label>
                </div>
              </div>
            </div>

            {/* Switch Settings */}
            <div>
              <h5>Switch Configuration</h5>
              <div style={{ border: '1px solid #ddd', borderRadius: '4px', padding: '15px' }}>
                <div style={{ marginBottom: '15px' }}>
                  <label>
                    <strong>Switch IP:</strong>
                    <input
                      type="text"
                      value={currentAttachment.spec.switch?.ip || ''}
                      onChange={(e) => handleChange({
                        attachment: {
                          spec: {
                            ...currentAttachment.spec,
                            switch: { ...currentAttachment.spec.switch, ip: e.target.value }
                          }
                        }
                      })}
                      disabled={readonly}
                      style={{ width: '100%', padding: '8px', marginTop: '5px' }}
                      placeholder="10.0.0.1"
                      data-testid="switch-ip-input"
                    />
                  </label>
                </div>

                <div>
                  <label>
                    <strong>Switch ASN:</strong>
                    <input
                      type="number"
                      value={currentAttachment.spec.switch?.asn || ''}
                      onChange={(e) => handleChange({
                        attachment: {
                          spec: {
                            ...currentAttachment.spec,
                            switch: { 
                              ...currentAttachment.spec.switch, 
                              asn: e.target.value ? parseInt(e.target.value) : undefined 
                            }
                          }
                        }
                      })}
                      disabled={readonly}
                      style={{ width: '100%', padding: '8px', marginTop: '5px' }}
                      min={1}
                      max={4294967295}
                      placeholder="65000"
                      data-testid="switch-asn-input"
                    />
                  </label>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* VPC Peering Tab */}
      {activeTab === 'peering' && (
        <div className="peering-section">
          <h4>VPC-External Peering</h4>
          <p style={{ color: '#6c757d', fontSize: '14px', marginBottom: '20px' }}>
            Configure which VPC subnets can communicate with external prefixes
          </p>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '30px' }}>
            <div>
              <label>
                <strong>Peering Name:</strong>
                <input
                  type="text"
                  value={currentPeering.metadata.name || ''}
                  onChange={(e) => handleChange({
                    peering: {
                      metadata: { ...currentPeering.metadata, name: e.target.value }
                    }
                  })}
                  disabled={readonly}
                  style={{ width: '100%', padding: '8px', marginTop: '5px' }}
                  placeholder="external-peering-1"
                  data-testid="peering-name-input"
                />
              </label>
            </div>

            <div>
              <label>
                <strong>VPC:</strong>
                <select
                  value={currentPeering.spec.permit?.vpc || ''}
                  onChange={(e) => handleChange({
                    peering: {
                      spec: {
                        ...currentPeering.spec,
                        permit: { ...currentPeering.spec.permit, vpc: e.target.value }
                      }
                    }
                  })}
                  disabled={readonly}
                  style={{ width: '100%', padding: '8px', marginTop: '5px' }}
                  data-testid="peering-vpc-select"
                >
                  <option value="">Select VPC</option>
                  {availableVPCs.map((vpc) => (
                    <option key={vpc} value={vpc}>{vpc}</option>
                  ))}
                </select>
              </label>
            </div>

            <div>
              <label>
                <strong>External Reference:</strong>
                <input
                  type="text"
                  value={currentPeering.spec.permit?.external || ''}
                  onChange={(e) => handleChange({
                    peering: {
                      spec: {
                        ...currentPeering.spec,
                        permit: { ...currentPeering.spec.permit, external: e.target.value }
                      }
                    }
                  })}
                  disabled={readonly}
                  style={{ width: '100%', padding: '8px', marginTop: '5px' }}
                  placeholder="external-1"
                  data-testid="peering-external-input"
                />
              </label>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '30px' }}>
            {/* VPC Subnets */}
            <div>
              <h5>VPC Subnets</h5>
              <div style={{ border: '1px solid #ddd', borderRadius: '4px', padding: '15px', minHeight: '200px' }}>
                {currentPeering.spec.permit?.vpc && availableSubnets[currentPeering.spec.permit.vpc] ? (
                  availableSubnets[currentPeering.spec.permit.vpc].map((subnet) => {
                    const fullSubnetName = `${currentPeering.spec.permit?.vpc}/${subnet}`
                    const isSelected = currentPeering.spec.permit?.vpcSubnets?.includes(fullSubnetName) || false
                    
                    return (
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
                          checked={isSelected}
                          onChange={() => isSelected ? removeVPCSubnet(fullSubnetName) : addVPCSubnet(fullSubnetName)}
                          disabled={readonly}
                          data-testid={`vpc-subnet-${subnet}`}
                        />
                        <span style={{ fontSize: '14px' }}>{subnet}</span>
                      </label>
                    )
                  })
                ) : (
                  <div style={{ color: '#6c757d', fontStyle: 'italic', textAlign: 'center', paddingTop: '40px' }}>
                    Select a VPC to see available subnets
                  </div>
                )}
              </div>
            </div>

            {/* External Prefixes */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                <h5>External Prefixes</h5>
                {!readonly && (
                  <button
                    onClick={addExternalPrefix}
                    style={{
                      padding: '4px 8px',
                      backgroundColor: '#28a745',
                      color: 'white',
                      border: 'none',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      fontSize: '12px'
                    }}
                    data-testid="add-external-prefix"
                  >
                    Add Prefix
                  </button>
                )}
              </div>
              <div style={{ border: '1px solid #ddd', borderRadius: '4px', padding: '15px', minHeight: '200px' }}>
                {currentPeering.spec.permit?.externalPrefixes?.map((prefix, index) => (
                  <div key={index} style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                    <input
                      type="text"
                      value={prefix}
                      onChange={(e) => updateExternalPrefix(index, e.target.value)}
                      disabled={readonly}
                      style={{ flex: 1, padding: '6px', fontSize: '14px' }}
                      placeholder="0.0.0.0/0"
                      data-testid={`external-prefix-${index}`}
                    />
                    {!readonly && (
                      <button
                        onClick={() => removeExternalPrefix(index)}
                        style={{
                          padding: '4px 6px',
                          backgroundColor: '#dc3545',
                          color: 'white',
                          border: 'none',
                          borderRadius: '4px',
                          cursor: 'pointer',
                          fontSize: '10px'
                        }}
                        data-testid={`remove-prefix-${index}`}
                      >
                        ×
                      </button>
                    )}
                  </div>
                )) || (
                  <div style={{ color: '#6c757d', fontStyle: 'italic', textAlign: 'center', paddingTop: '40px' }}>
                    No external prefixes configured
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Configuration Summary */}
      <div style={{ 
        marginTop: '30px', 
        paddingTop: '20px',
        borderTop: '1px solid #dee2e6'
      }}>
        <h4>Configuration Summary</h4>
        <div style={{ 
          padding: '15px', 
          backgroundColor: '#f8f9fa',
          border: '1px solid #dee2e6',
          borderRadius: '4px',
          display: 'grid',
          gridTemplateColumns: '1fr 1fr 1fr',
          gap: '20px'
        }}>
          <div>
            <h6>External Network</h6>
            <div style={{ fontSize: '12px' }}>
              <div><strong>Name:</strong> {currentExternal.metadata.name || 'Not set'}</div>
              <div><strong>Namespace:</strong> {currentExternal.spec.ipv4Namespace || 'default'}</div>
              <div><strong>Communities:</strong> {
                [currentExternal.spec.inboundCommunity, currentExternal.spec.outboundCommunity]
                  .filter(Boolean).join(', ') || 'None'
              }</div>
            </div>
          </div>
          <div>
            <h6>BGP Attachment</h6>
            <div style={{ fontSize: '12px' }}>
              <div><strong>Connection:</strong> {currentAttachment.spec.connection || 'Not set'}</div>
              <div><strong>Neighbor:</strong> {currentAttachment.spec.neighbor?.ip || 'Not set'} (AS{currentAttachment.spec.neighbor?.asn || '?'})</div>
              <div><strong>Switch:</strong> {currentAttachment.spec.switch?.ip || 'Not set'} (AS{currentAttachment.spec.switch?.asn || '?'})</div>
            </div>
          </div>
          <div>
            <h6>VPC Peering</h6>
            <div style={{ fontSize: '12px' }}>
              <div><strong>VPC:</strong> {currentPeering.spec.permit?.vpc || 'Not set'}</div>
              <div><strong>VPC Subnets:</strong> {currentPeering.spec.permit?.vpcSubnets?.length || 0}</div>
              <div><strong>External Prefixes:</strong> {currentPeering.spec.permit?.externalPrefixes?.length || 0}</div>
            </div>
          </div>
        </div>
        <div style={{ marginTop: '10px', fontSize: '14px' }}>
          <strong>Status:</strong> {errors.length === 0 ? '✓ Configuration valid' : `⚠ ${errors.length} validation errors`}
        </div>
      </div>
    </div>
  )
}

export default ExternalConnectivityEditor