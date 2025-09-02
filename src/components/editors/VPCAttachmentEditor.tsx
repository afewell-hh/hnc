import React, { useState, useCallback } from 'react'
import type { VPCAttachment, Connection, K8sMetadata } from '../../upstream/types/generated'

export interface VPCAttachmentConfig {
  metadata: K8sMetadata
  spec: {
    connection?: string
    subnet?: string
    nativeVLAN?: boolean
  }
}

export interface VPCAttachmentEditorProps {
  attachment?: VPCAttachmentConfig
  availableConnections?: Connection[]
  availableSubnets?: string[]
  onChange: (attachment: VPCAttachmentConfig) => void
  onValidate?: (isValid: boolean, errors: string[]) => void
  readonly?: boolean
}

export const VPCAttachmentEditor: React.FC<VPCAttachmentEditorProps> = ({
  attachment,
  availableConnections = [],
  availableSubnets = [],
  onChange,
  onValidate,
  readonly = false
}) => {
  const [errors, setErrors] = useState<string[]>([])

  // Initialize default attachment config
  const defaultAttachment: VPCAttachmentConfig = {
    metadata: {
      name: 'vpc-attachment-1',
      labels: {},
      annotations: {}
    },
    spec: {
      connection: '',
      subnet: '',
      nativeVLAN: false
    }
  }

  const currentAttachment = attachment || defaultAttachment

  const validateAttachment = useCallback((config: VPCAttachmentConfig): { isValid: boolean; errors: string[] } => {
    const validationErrors: string[] = []

    // Validate metadata
    if (!config.metadata.name) {
      validationErrors.push('Attachment name is required')
    }

    // Validate connection
    if (!config.spec.connection) {
      validationErrors.push('Connection is required')
    }

    // Validate subnet
    if (!config.spec.subnet) {
      validationErrors.push('Subnet is required')
    } else {
      // Validate subnet format (vpc-name/subnet-name)
      const subnetFormat = /^[\w-]+\/[\w-]+$/
      if (!subnetFormat.test(config.spec.subnet)) {
        validationErrors.push('Subnet must be in format "vpc-name/subnet-name"')
      }
    }

    return { isValid: validationErrors.length === 0, errors: validationErrors }
  }, [])

  const handleChange = useCallback((updates: Partial<VPCAttachmentConfig>) => {
    const newAttachment = {
      ...currentAttachment,
      ...updates,
      spec: {
        ...currentAttachment.spec,
        ...(updates.spec || {})
      },
      metadata: {
        ...currentAttachment.metadata,
        ...(updates.metadata || {})
      }
    }

    const validation = validateAttachment(newAttachment)
    setErrors(validation.errors)
    onValidate?.(validation.isValid, validation.errors)
    onChange(newAttachment)
  }, [currentAttachment, onChange, onValidate, validateAttachment])

  return (
    <div className="vpc-attachment-editor" style={{ border: '1px solid #ccc', borderRadius: '4px', padding: '20px' }}>
      <div style={{ marginBottom: '20px' }}>
        <h3>VPC Attachment Configuration</h3>
        <p style={{ color: '#6c757d', fontSize: '14px' }}>
          Configure how servers and switches connect to VPC subnets
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

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
        {/* Basic Settings */}
        <div>
          <h4>Basic Settings</h4>
          
          <div style={{ marginBottom: '15px' }}>
            <label>
              <strong>Attachment Name:</strong>
              <input
                type="text"
                value={currentAttachment.metadata.name || ''}
                onChange={(e) => handleChange({
                  metadata: { ...currentAttachment.metadata, name: e.target.value }
                })}
                disabled={readonly}
                style={{ width: '100%', padding: '8px', marginTop: '5px' }}
                placeholder="vpc-attachment-1"
                data-testid="attachment-name-input"
              />
            </label>
          </div>

          <div style={{ marginBottom: '15px' }}>
            <label>
              <strong>Connection:</strong>
              <select
                value={currentAttachment.spec.connection || ''}
                onChange={(e) => handleChange({
                  spec: { ...currentAttachment.spec, connection: e.target.value }
                })}
                disabled={readonly}
                style={{ width: '100%', padding: '8px', marginTop: '5px' }}
                data-testid="connection-select"
              >
                <option value="">Select connection</option>
                {availableConnections.map((conn) => (
                  <option key={conn.metadata.name} value={conn.metadata.name}>
                    {conn.metadata.name} ({conn.spec.unbundled ? 'Unbundled' : 
                     conn.spec.bundled ? 'Bundled' : 
                     conn.spec.mclag ? 'MCLAG' : 
                     conn.spec.eslag ? 'ESLAG' : 'Unknown'})
                  </option>
                ))}
              </select>
            </label>
            <div style={{ fontSize: '12px', color: '#6c757d', marginTop: '5px' }}>
              The switch port/connection where the VPC will be attached
            </div>
          </div>

          <div style={{ marginBottom: '15px' }}>
            <label>
              <strong>VPC Subnet:</strong>
              <select
                value={currentAttachment.spec.subnet || ''}
                onChange={(e) => handleChange({
                  spec: { ...currentAttachment.spec, subnet: e.target.value }
                })}
                disabled={readonly}
                style={{ width: '100%', padding: '8px', marginTop: '5px' }}
                data-testid="subnet-select"
              >
                <option value="">Select subnet</option>
                {availableSubnets.map((subnet) => (
                  <option key={subnet} value={subnet}>
                    {subnet}
                  </option>
                ))}
              </select>
            </label>
            <div style={{ fontSize: '12px', color: '#6c757d', marginTop: '5px' }}>
              Format: vpc-name/subnet-name (e.g., "vpc-1/default")
            </div>
          </div>

          <div style={{ marginBottom: '15px' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <input
                type="checkbox"
                checked={currentAttachment.spec.nativeVLAN || false}
                onChange={(e) => handleChange({
                  spec: { ...currentAttachment.spec, nativeVLAN: e.target.checked }
                })}
                disabled={readonly}
                data-testid="native-vlan-checkbox"
              />
              <span>Use Native VLAN</span>
            </label>
            <div style={{ fontSize: '12px', color: '#6c757d', marginTop: '5px' }}>
              When enabled, the subnet will use the native/untagged VLAN on the port
            </div>
          </div>
        </div>

        {/* Connection Details */}
        <div>
          <h4>Connection Details</h4>
          
          {currentAttachment.spec.connection ? (
            <div style={{ 
              padding: '15px', 
              backgroundColor: '#e7f3ff', 
              border: '1px solid #b3d7ff',
              borderRadius: '4px'
            }}>
              <h5 style={{ margin: '0 0 10px 0' }}>Selected Connection</h5>
              <div style={{ fontSize: '14px' }}>
                <div><strong>Name:</strong> {currentAttachment.spec.connection}</div>
                {availableConnections.find(c => c.metadata.name === currentAttachment.spec.connection) && (
                  <>
                    <div><strong>Type:</strong> {
                      (() => {
                        const conn = availableConnections.find(c => c.metadata.name === currentAttachment.spec.connection)
                        if (!conn) return 'Unknown'
                        if (conn.spec.unbundled) return 'Unbundled (Single Link)'
                        if (conn.spec.bundled) return 'Bundled (Port Channel)'
                        if (conn.spec.mclag) return 'MCLAG (Multi-Chassis LAG)'
                        if (conn.spec.eslag) return 'ESLAG (Enhanced Ethernet LAG)'
                        return 'Other'
                      })()
                    }</div>
                    <div><strong>Redundancy:</strong> {
                      (() => {
                        const conn = availableConnections.find(c => c.metadata.name === currentAttachment.spec.connection)
                        if (!conn) return 'Unknown'
                        if (conn.spec.mclag || conn.spec.eslag) return 'High (Multi-Switch)'
                        if (conn.spec.bundled) return 'Medium (Port Channel)'
                        return 'None (Single Link)'
                      })()
                    }</div>
                  </>
                )}
              </div>
            </div>
          ) : (
            <div style={{ 
              padding: '20px', 
              textAlign: 'center', 
              color: '#6c757d',
              border: '2px dashed #dee2e6',
              borderRadius: '4px'
            }}>
              Select a connection to see details
            </div>
          )}

          {currentAttachment.spec.subnet && (
            <div style={{ 
              padding: '15px', 
              backgroundColor: '#f0f8f0', 
              border: '1px solid #b3e5b3',
              borderRadius: '4px',
              marginTop: '15px'
            }}>
              <h5 style={{ margin: '0 0 10px 0' }}>Subnet Assignment</h5>
              <div style={{ fontSize: '14px' }}>
                <div><strong>Full Name:</strong> {currentAttachment.spec.subnet}</div>
                <div><strong>VPC:</strong> {currentAttachment.spec.subnet.split('/')[0]}</div>
                <div><strong>Subnet:</strong> {currentAttachment.spec.subnet.split('/')[1]}</div>
                <div><strong>VLAN Mode:</strong> {
                  currentAttachment.spec.nativeVLAN ? 'Native (Untagged)' : 'Tagged'
                }</div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Preview Section */}
      <div style={{ marginTop: '30px', paddingTop: '20px', borderTop: '1px solid #dee2e6' }}>
        <h4>Configuration Preview</h4>
        <div style={{ 
          padding: '15px', 
          backgroundColor: '#f8f9fa', 
          border: '1px solid #dee2e6',
          borderRadius: '4px',
          fontFamily: 'monospace',
          fontSize: '12px'
        }}>
          <div><strong>Connection:</strong> {currentAttachment.spec.connection || 'Not selected'}</div>
          <div><strong>VPC Subnet:</strong> {currentAttachment.spec.subnet || 'Not selected'}</div>
          <div><strong>VLAN Mode:</strong> {currentAttachment.spec.nativeVLAN ? 'Native' : 'Tagged'}</div>
          <div><strong>Status:</strong> {errors.length === 0 ? '✓ Valid' : '⚠ Has errors'}</div>
        </div>
      </div>

      {/* Help Section */}
      <div style={{ 
        marginTop: '20px', 
        padding: '15px', 
        backgroundColor: '#fff3cd',
        border: '1px solid #ffeaa7',
        borderRadius: '4px'
      }}>
        <h5 style={{ margin: '0 0 10px 0' }}>💡 Configuration Tips</h5>
        <ul style={{ margin: 0, paddingLeft: '20px', fontSize: '14px' }}>
          <li><strong>Connection Selection:</strong> Choose based on redundancy needs and server requirements</li>
          <li><strong>Native VLAN:</strong> Use for default/management traffic, disable for isolated subnets</li>
          <li><strong>Subnet Format:</strong> Always use "vpc-name/subnet-name" format for proper routing</li>
          <li><strong>Multi-homing:</strong> Use MCLAG or ESLAG connections for high availability</li>
        </ul>
      </div>
    </div>
  )
}

export default VPCAttachmentEditor