import React, { useState, useCallback } from 'react'
import { VPCEditor, type VPCConfig } from './VPCEditor'
import { VPCAttachmentEditor, type VPCAttachmentConfig } from './VPCAttachmentEditor'
import { VPCPeeringEditor, type VPCPeeringConfig } from './VPCPeeringEditor'
import { ExternalConnectivityEditor, type ExternalConfig, type ExternalAttachmentConfig, type ExternalPeeringConfig } from './ExternalConnectivityEditor'
import { VRFEditor, type VRFConfig } from './VRFEditor'
import { RoutePolicyEditor, type RoutePolicyConfig } from './RoutePolicyEditor'
import { serializeVPCConfigToCRDs, validateVPCConfiguration, generateSampleVPCDeployment, type VPCDeploymentConfig, type VPCYAMLs } from '../../io/vpc-yaml'

export interface VPCManagerViewProps {
  onSave?: (yamls: VPCYAMLs) => void
  onLoad?: (config: VPCDeploymentConfig) => void
  initialConfig?: Partial<VPCDeploymentConfig>
  readonly?: boolean
}

export const VPCManagerView: React.FC<VPCManagerViewProps> = ({
  onSave,
  onLoad,
  initialConfig,
  readonly = false
}) => {
  const [activeTab, setActiveTab] = useState<'vpc' | 'attachments' | 'peering' | 'external' | 'vrf' | 'policies' | 'export'>('vpc')
  const [config, setConfig] = useState<VPCDeploymentConfig>(() => ({
    vpcs: initialConfig?.vpcs || [generateSampleVPCDeployment().vpcs[0]],
    vpcAttachments: initialConfig?.vpcAttachments || [],
    vpcPeerings: initialConfig?.vpcPeerings || [],
    externals: initialConfig?.externals || [],
    externalAttachments: initialConfig?.externalAttachments || [],
    externalPeerings: initialConfig?.externalPeerings || []
  }))
  
  const [vrfs, setVRFs] = useState<VRFConfig[]>([])
  const [routePolicies, setRoutePolicies] = useState<RoutePolicyConfig[]>([])
  const [errors, setErrors] = useState<string[]>([])
  const [warnings, setWarnings] = useState<string[]>([])

  // Validate entire configuration
  const validateConfiguration = useCallback(() => {
    const validation = validateVPCConfiguration(config)
    setErrors(validation.errors)
    setWarnings(validation.warnings)
    return validation.isValid
  }, [config])

  // Generate YAML exports
  const generateYAMLs = useCallback((): VPCYAMLs => {
    return serializeVPCConfigToCRDs(config, {
      namespace: 'default',
      generateK8sMetadata: true,
      includeStatus: false
    })
  }, [config])

  // Handle save action
  const handleSave = useCallback(() => {
    if (validateConfiguration()) {
      const yamls = generateYAMLs()
      onSave?.(yamls)
    }
  }, [validateConfiguration, generateYAMLs, onSave])

  // Handle load sample configuration
  const handleLoadSample = useCallback(() => {
    const sampleConfig = generateSampleVPCDeployment()
    setConfig(sampleConfig)
    onLoad?.(sampleConfig)
  }, [onLoad])

  // Update VPC configurations
  const updateVPC = useCallback((index: number, vpc: VPCConfig) => {
    const newVPCs = [...config.vpcs]
    newVPCs[index] = vpc
    setConfig(prev => ({ ...prev, vpcs: newVPCs }))
  }, [config.vpcs])

  const addVPC = useCallback(() => {
    const newVPC: VPCConfig = {
      metadata: {
        name: `vpc-${config.vpcs.length + 1}`,
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
            cidr: `10.${config.vpcs.length + 1}.0.0/24`,
            gateway: `10.${config.vpcs.length + 1}.0.1`,
            isolated: false,
            restricted: false
          }
        },
        permit: [],
        staticRoutes: []
      }
    }
    setConfig(prev => ({ ...prev, vpcs: [...prev.vpcs, newVPC] }))
  }, [config.vpcs.length])

  const removeVPC = useCallback((index: number) => {
    setConfig(prev => ({
      ...prev,
      vpcs: prev.vpcs.filter((_, i) => i !== index)
    }))
  }, [])

  // Similar update functions for other resource types
  const updateAttachment = useCallback((index: number, attachment: VPCAttachmentConfig) => {
    const newAttachments = [...config.vpcAttachments]
    newAttachments[index] = attachment
    setConfig(prev => ({ ...prev, vpcAttachments: newAttachments }))
  }, [config.vpcAttachments])

  const addAttachment = useCallback(() => {
    const newAttachment: VPCAttachmentConfig = {
      metadata: {
        name: `attachment-${config.vpcAttachments.length + 1}`
      },
      spec: {
        connection: '',
        subnet: '',
        nativeVLAN: false
      }
    }
    setConfig(prev => ({ ...prev, vpcAttachments: [...prev.vpcAttachments, newAttachment] }))
  }, [config.vpcAttachments.length])

  // Get available options for dropdowns
  const availableConnections = ['server-conn-1', 'server-conn-2', 'border-conn-1']
  const availableSubnets = config.vpcs.flatMap(vpc => 
    Object.keys(vpc.spec.subnets).map(subnet => `${vpc.metadata.name}/${subnet}`)
  )
  const availableVPCs = config.vpcs.map(vpc => vpc.metadata.name)
  const availableVPCSubnets = config.vpcs.reduce((acc, vpc) => ({
    ...acc,
    [vpc.metadata.name]: Object.keys(vpc.spec.subnets)
  }), {} as Record<string, string[]>)

  const tabStyle = (tab: string) => ({
    padding: '12px 20px',
    backgroundColor: activeTab === tab ? '#007bff' : '#f8f9fa',
    color: activeTab === tab ? 'white' : '#495057',
    border: '1px solid #dee2e6',
    cursor: 'pointer',
    borderBottom: activeTab === tab ? 'none' : '1px solid #dee2e6'
  })

  return (
    <div className="vpc-manager-view" style={{ padding: '20px', maxWidth: '1400px', margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <div>
          <h2 style={{ margin: 0 }}>VPC Network Configuration</h2>
          <p style={{ color: '#6c757d', margin: '5px 0 0 0' }}>
            Manage virtual private clouds, routing, and external connectivity
          </p>
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button
            onClick={handleLoadSample}
            disabled={readonly}
            style={{
              padding: '8px 16px',
              backgroundColor: '#17a2b8',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: readonly ? 'not-allowed' : 'pointer'
            }}
          >
            Load Sample
          </button>
          <button
            onClick={handleSave}
            disabled={readonly || errors.length > 0}
            style={{
              padding: '8px 16px',
              backgroundColor: errors.length === 0 ? '#28a745' : '#6c757d',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: readonly || errors.length > 0 ? 'not-allowed' : 'pointer'
            }}
          >
            Export to CRDs
          </button>
        </div>
      </div>

      {/* Validation Status */}
      {(errors.length > 0 || warnings.length > 0) && (
        <div style={{ marginBottom: '20px' }}>
          {errors.length > 0 && (
            <div style={{ 
              padding: '10px', 
              backgroundColor: '#f8d7da', 
              border: '1px solid #f5c6cb',
              borderRadius: '4px',
              marginBottom: '10px'
            }}>
              <h4 style={{ margin: '0 0 10px 0', color: '#721c24' }}>Configuration Errors:</h4>
              <ul style={{ margin: 0, paddingLeft: '20px' }}>
                {errors.map((error, index) => (
                  <li key={index} style={{ color: '#721c24' }}>{error}</li>
                ))}
              </ul>
            </div>
          )}
          {warnings.length > 0 && (
            <div style={{ 
              padding: '10px', 
              backgroundColor: '#fff3cd', 
              border: '1px solid #ffeaa7',
              borderRadius: '4px'
            }}>
              <h4 style={{ margin: '0 0 10px 0', color: '#856404' }}>Warnings:</h4>
              <ul style={{ margin: 0, paddingLeft: '20px' }}>
                {warnings.map((warning, index) => (
                  <li key={index} style={{ color: '#856404' }}>{warning}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* Tab Navigation */}
      <div style={{ display: 'flex', marginBottom: '20px', borderBottom: '1px solid #dee2e6' }}>
        <button style={tabStyle('vpc')} onClick={() => setActiveTab('vpc')}>
          VPCs ({config.vpcs.length})
        </button>
        <button style={tabStyle('attachments')} onClick={() => setActiveTab('attachments')}>
          Attachments ({config.vpcAttachments.length})
        </button>
        <button style={tabStyle('peering')} onClick={() => setActiveTab('peering')}>
          Peering ({config.vpcPeerings.length})
        </button>
        <button style={tabStyle('external')} onClick={() => setActiveTab('external')}>
          External ({config.externals.length})
        </button>
        <button style={tabStyle('vrf')} onClick={() => setActiveTab('vrf')}>
          VRF ({vrfs.length})
        </button>
        <button style={tabStyle('policies')} onClick={() => setActiveTab('policies')}>
          Policies ({routePolicies.length})
        </button>
        <button style={tabStyle('export')} onClick={() => setActiveTab('export')}>
          Export
        </button>
      </div>

      {/* Tab Content */}
      {activeTab === 'vpc' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <h3>VPC Configurations</h3>
            {!readonly && (
              <button
                onClick={addVPC}
                style={{
                  padding: '8px 16px',
                  backgroundColor: '#28a745',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer'
                }}
              >
                Add VPC
              </button>
            )}
          </div>

          {config.vpcs.map((vpc, index) => (
            <div key={`vpc-${index}`} style={{ marginBottom: '30px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
                <h4>VPC {index + 1}: {vpc.metadata.name}</h4>
                {!readonly && config.vpcs.length > 1 && (
                  <button
                    onClick={() => removeVPC(index)}
                    style={{
                      padding: '4px 8px',
                      backgroundColor: '#dc3545',
                      color: 'white',
                      border: 'none',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      fontSize: '12px'
                    }}
                  >
                    Remove
                  </button>
                )}
              </div>
              <VPCEditor
                vpc={vpc}
                onChange={(updatedVPC) => updateVPC(index, updatedVPC)}
                readonly={readonly}
              />
            </div>
          ))}
        </div>
      )}

      {activeTab === 'attachments' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <h3>VPC Attachments</h3>
            {!readonly && (
              <button
                onClick={addAttachment}
                style={{
                  padding: '8px 16px',
                  backgroundColor: '#28a745',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer'
                }}
              >
                Add Attachment
              </button>
            )}
          </div>

          {config.vpcAttachments.length === 0 && (
            <div style={{ 
              padding: '20px', 
              textAlign: 'center', 
              color: '#6c757d',
              border: '2px dashed #dee2e6',
              borderRadius: '4px'
            }}>
              No VPC attachments configured. Click "Add Attachment" to create one.
            </div>
          )}

          {config.vpcAttachments.map((attachment, index) => (
            <div key={`attachment-${index}`} style={{ marginBottom: '30px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
                <h4>Attachment {index + 1}: {attachment.metadata.name}</h4>
                {!readonly && (
                  <button
                    onClick={() => setConfig(prev => ({
                      ...prev,
                      vpcAttachments: prev.vpcAttachments.filter((_, i) => i !== index)
                    }))}
                    style={{
                      padding: '4px 8px',
                      backgroundColor: '#dc3545',
                      color: 'white',
                      border: 'none',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      fontSize: '12px'
                    }}
                  >
                    Remove
                  </button>
                )}
              </div>
              <VPCAttachmentEditor
                attachment={attachment}
                availableConnections={availableConnections.map(name => ({ metadata: { name }, spec: { unbundled: {} } }))}
                availableSubnets={availableSubnets}
                onChange={(updatedAttachment) => updateAttachment(index, updatedAttachment)}
                readonly={readonly}
              />
            </div>
          ))}
        </div>
      )}

      {activeTab === 'peering' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <h3>VPC Peering</h3>
            {!readonly && (
              <button
                onClick={() => {
                  const newPeering: VPCPeeringConfig = {
                    metadata: { name: `peering-${config.vpcPeerings.length + 1}` },
                    spec: { remote: '', permit: [] }
                  }
                  setConfig(prev => ({ ...prev, vpcPeerings: [...prev.vpcPeerings, newPeering] }))
                }}
                style={{
                  padding: '8px 16px',
                  backgroundColor: '#28a745',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer'
                }}
              >
                Add Peering
              </button>
            )}
          </div>

          {config.vpcPeerings.length === 0 && (
            <div style={{ 
              padding: '20px', 
              textAlign: 'center', 
              color: '#6c757d',
              border: '2px dashed #dee2e6',
              borderRadius: '4px'
            }}>
              No VPC peering relationships configured. Click "Add Peering" to create one.
            </div>
          )}

          {config.vpcPeerings.map((peering, index) => (
            <div key={`peering-${index}`} style={{ marginBottom: '30px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
                <h4>Peering {index + 1}: {peering.metadata.name}</h4>
                {!readonly && (
                  <button
                    onClick={() => setConfig(prev => ({
                      ...prev,
                      vpcPeerings: prev.vpcPeerings.filter((_, i) => i !== index)
                    }))}
                    style={{
                      padding: '4px 8px',
                      backgroundColor: '#dc3545',
                      color: 'white',
                      border: 'none',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      fontSize: '12px'
                    }}
                  >
                    Remove
                  </button>
                )}
              </div>
              <VPCPeeringEditor
                peering={peering}
                availableVPCs={availableVPCs}
                availableSubnets={availableVPCSubnets}
                onChange={(updatedPeering) => {
                  const newPeerings = [...config.vpcPeerings]
                  newPeerings[index] = updatedPeering
                  setConfig(prev => ({ ...prev, vpcPeerings: newPeerings }))
                }}
                readonly={readonly}
              />
            </div>
          ))}
        </div>
      )}

      {activeTab === 'external' && (
        <div>
          <h3>External Connectivity</h3>
          {config.externals.length === 0 ? (
            <div>
              {!readonly && (
                <button
                  onClick={() => {
                    const sample = generateSampleVPCDeployment()
                    setConfig(prev => ({
                      ...prev,
                      externals: [sample.externals[0]],
                      externalAttachments: [sample.externalAttachments[0]],
                      externalPeerings: [sample.externalPeerings[0]]
                    }))
                  }}
                  style={{
                    padding: '8px 16px',
                    backgroundColor: '#28a745',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    marginBottom: '20px'
                  }}
                >
                  Add External Connectivity
                </button>
              )}
              <div style={{ 
                padding: '20px', 
                textAlign: 'center', 
                color: '#6c757d',
                border: '2px dashed #dee2e6',
                borderRadius: '4px'
              }}>
                No external connectivity configured.
              </div>
            </div>
          ) : (
            <ExternalConnectivityEditor
              external={config.externals[0]}
              attachment={config.externalAttachments[0]}
              peering={config.externalPeerings[0]}
              availableConnections={availableConnections}
              availableVPCs={availableVPCs}
              availableSubnets={availableVPCSubnets}
              onChange={(externalConfig) => {
                if (externalConfig.external) {
                  setConfig(prev => ({ ...prev, externals: [externalConfig.external!] }))
                }
                if (externalConfig.attachment) {
                  setConfig(prev => ({ ...prev, externalAttachments: [externalConfig.attachment!] }))
                }
                if (externalConfig.peering) {
                  setConfig(prev => ({ ...prev, externalPeerings: [externalConfig.peering!] }))
                }
              }}
              readonly={readonly}
            />
          )}
        </div>
      )}

      {activeTab === 'vrf' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <h3>VRF Configurations</h3>
            {!readonly && (
              <button
                onClick={() => {
                  const newVRF: VRFConfig = {
                    metadata: { name: `vrf-${vrfs.length + 1}` },
                    spec: {
                      routes: [],
                      routeTargets: { import: [], export: [] },
                      bgp: { neighbors: [] },
                      redistribution: {}
                    }
                  }
                  setVRFs(prev => [...prev, newVRF])
                }}
                style={{
                  padding: '8px 16px',
                  backgroundColor: '#28a745',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer'
                }}
              >
                Add VRF
              </button>
            )}
          </div>

          {vrfs.length === 0 && (
            <div style={{ 
              padding: '20px', 
              textAlign: 'center', 
              color: '#6c757d',
              border: '2px dashed #dee2e6',
              borderRadius: '4px'
            }}>
              No VRF configurations. Click "Add VRF" to create one.
            </div>
          )}

          {vrfs.map((vrf, index) => (
            <div key={`vrf-${index}`} style={{ marginBottom: '30px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
                <h4>VRF {index + 1}: {vrf.metadata.name}</h4>
                {!readonly && (
                  <button
                    onClick={() => setVRFs(prev => prev.filter((_, i) => i !== index))}
                    style={{
                      padding: '4px 8px',
                      backgroundColor: '#dc3545',
                      color: 'white',
                      border: 'none',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      fontSize: '12px'
                    }}
                  >
                    Remove
                  </button>
                )}
              </div>
              <VRFEditor
                vrf={vrf}
                availableVNIs={[10000 + index, 20000 + index, 30000 + index]}
                onChange={(updatedVRF) => {
                  const newVRFs = [...vrfs]
                  newVRFs[index] = updatedVRF
                  setVRFs(newVRFs)
                }}
                readonly={readonly}
              />
            </div>
          ))}
        </div>
      )}

      {activeTab === 'policies' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <h3>Route Policies</h3>
            {!readonly && (
              <button
                onClick={() => {
                  const newPolicy: RoutePolicyConfig = {
                    metadata: { name: `policy-${routePolicies.length + 1}` },
                    spec: {
                      statements: [],
                      defaultAction: 'deny'
                    }
                  }
                  setRoutePolicies(prev => [...prev, newPolicy])
                }}
                style={{
                  padding: '8px 16px',
                  backgroundColor: '#28a745',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer'
                }}
              >
                Add Policy
              </button>
            )}
          </div>

          {routePolicies.length === 0 && (
            <div style={{ 
              padding: '20px', 
              textAlign: 'center', 
              color: '#6c757d',
              border: '2px dashed #dee2e6',
              borderRadius: '4px'
            }}>
              No route policies configured. Click "Add Policy" to create one.
            </div>
          )}

          {routePolicies.map((policy, index) => (
            <div key={`policy-${index}`} style={{ marginBottom: '30px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
                <h4>Policy {index + 1}: {policy.metadata.name}</h4>
                {!readonly && (
                  <button
                    onClick={() => setRoutePolicies(prev => prev.filter((_, i) => i !== index))}
                    style={{
                      padding: '4px 8px',
                      backgroundColor: '#dc3545',
                      color: 'white',
                      border: 'none',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      fontSize: '12px'
                    }}
                  >
                    Remove
                  </button>
                )}
              </div>
              <RoutePolicyEditor
                policy={policy}
                onChange={(updatedPolicy) => {
                  const newPolicies = [...routePolicies]
                  newPolicies[index] = updatedPolicy
                  setRoutePolicies(newPolicies)
                }}
                readonly={readonly}
              />
            </div>
          ))}
        </div>
      )}

      {activeTab === 'export' && (
        <div>
          <h3>Export Configuration</h3>
          <p style={{ color: '#6c757d', marginBottom: '20px' }}>
            Generate Kubernetes CRD YAML files for deployment
          </p>

          {validateConfiguration() ? (
            <div>
              <div style={{ 
                padding: '15px', 
                backgroundColor: '#d4edda', 
                border: '1px solid #c3e6cb',
                borderRadius: '4px',
                marginBottom: '20px'
              }}>
                <h4 style={{ color: '#155724', margin: '0 0 10px 0' }}>✓ Configuration Valid</h4>
                <div style={{ color: '#155724' }}>
                  Ready to export {config.vpcs.length} VPCs, {config.vpcAttachments.length} attachments, 
                  {config.vpcPeerings.length} peerings, and {config.externals.length} external connections.
                </div>
              </div>

              <button
                onClick={handleSave}
                style={{
                  padding: '12px 24px',
                  backgroundColor: '#28a745',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontSize: '16px',
                  marginBottom: '20px'
                }}
              >
                Generate & Export CRD YAMLs
              </button>

              {/* Preview of generated YAML structure */}
              <div style={{ 
                padding: '15px', 
                backgroundColor: '#f8f9fa',
                border: '1px solid #dee2e6',
                borderRadius: '4px'
              }}>
                <h5>Generated Files Preview:</h5>
                <ul style={{ margin: 0, paddingLeft: '20px', fontFamily: 'monospace', fontSize: '14px' }}>
                  <li>vpcs.yaml ({config.vpcs.length} resources)</li>
                  <li>vpcattachments.yaml ({config.vpcAttachments.length} resources)</li>
                  <li>vpcpeerings.yaml ({config.vpcPeerings.length} resources)</li>
                  <li>externals.yaml ({config.externals.length} resources)</li>
                  <li>externalattachments.yaml ({config.externalAttachments.length} resources)</li>
                  <li>externalpeerings.yaml ({config.externalPeerings.length} resources)</li>
                </ul>
              </div>
            </div>
          ) : (
            <div style={{ 
              padding: '15px', 
              backgroundColor: '#f8d7da', 
              border: '1px solid #f5c6cb',
              borderRadius: '4px'
            }}>
              <h4 style={{ color: '#721c24', margin: '0 0 10px 0' }}>⚠ Configuration Invalid</h4>
              <div style={{ color: '#721c24' }}>
                Please fix validation errors before exporting configuration.
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default VPCManagerView