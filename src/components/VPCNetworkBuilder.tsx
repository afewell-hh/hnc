/**
 * VPCNetworkBuilder Component - WP-VPC1
 * Detailed network configuration with subnets, DHCP, and validation
 */

import React, { useCallback, useState } from 'react'
import type { VPCNetworkBuilderProps, VPCNetwork, VPCSubnet, DHCPConfig } from '../types/vpc-editor.types'
import { createFieldProvenance } from '../utils/provenance.utils'

const VPCNetworkBuilder: React.FC<VPCNetworkBuilderProps> = ({
  network,
  onChange,
  existingNetworks,
  mode = 'guided'
}) => {
  const [activeSubnetIndex, setActiveSubnetIndex] = useState<number | null>(null)

  const handleNetworkChange = useCallback((field: keyof VPCNetwork, value: any) => {
    onChange({
      ...network,
      [field]: value,
      provenance: createFieldProvenance('user', field)
    })
  }, [network, onChange])

  const handleSubnetChange = useCallback((index: number, subnet: VPCSubnet) => {
    const updatedSubnets = [...network.subnets]
    updatedSubnets[index] = subnet
    
    onChange({
      ...network,
      subnets: updatedSubnets,
      provenance: createFieldProvenance('user', `subnets[${index}]`)
    })
  }, [network, onChange])

  const handleAddSubnet = useCallback(() => {
    const newSubnet: VPCSubnet = {
      name: `subnet-${network.subnets.length + 1}`,
      cidr: '10.0.1.0/28', // Default to smaller subnet
      provenance: createFieldProvenance('user', 'new-subnet')
    }

    onChange({
      ...network,
      subnets: [...network.subnets, newSubnet],
      provenance: createFieldProvenance('user', 'subnets.add')
    })
    
    setActiveSubnetIndex(network.subnets.length)
  }, [network, onChange])

  const handleRemoveSubnet = useCallback((index: number) => {
    const updatedSubnets = network.subnets.filter((_, i) => i !== index)
    
    onChange({
      ...network,
      subnets: updatedSubnets,
      provenance: createFieldProvenance('user', `subnets.remove[${index}]`)
    })
    
    if (activeSubnetIndex === index) {
      setActiveSubnetIndex(null)
    } else if (activeSubnetIndex !== null && activeSubnetIndex > index) {
      setActiveSubnetIndex(activeSubnetIndex - 1)
    }
  }, [network, onChange, activeSubnetIndex])

  const validateNetworkCIDR = (cidr: string): string[] => {
    const warnings: string[] = []
    
    // Check for overlaps with existing networks
    existingNetworks.forEach(existingNet => {
      if (existingNet.name !== network.name && existingNet.cidr === cidr) {
        warnings.push(`CIDR conflicts with network "${existingNet.name}"`)
      }
    })
    
    // Validate CIDR format
    const cidrRegex = /^(\d{1,3}\.){3}\d{1,3}\/\d{1,2}$/
    if (!cidrRegex.test(cidr)) {
      warnings.push('Invalid CIDR format (expected: x.x.x.x/y)')
    }
    
    return warnings
  }

  const renderGuidedMode = () => (
    <div className="guided-mode">
      <div className="form-section">
        <h4>Basic Network Configuration</h4>
        <div className="form-row">
          <label>
            Network Name:
            <input
              type="text"
              value={network.name}
              onChange={(e) => handleNetworkChange('name', e.target.value)}
              className="form-control"
              placeholder="my-network"
            />
          </label>
          <label>
            Description:
            <input
              type="text"
              value={network.description || ''}
              onChange={(e) => handleNetworkChange('description', e.target.value)}
              className="form-control"
              placeholder="Network description"
            />
          </label>
        </div>
      </div>

      <div className="form-section">
        <h4>Network Range</h4>
        <div className="form-row">
          <label>
            CIDR Block:
            <input
              type="text"
              value={network.cidr}
              onChange={(e) => handleNetworkChange('cidr', e.target.value)}
              className="form-control"
              placeholder="10.0.0.0/24"
            />
            <div className="field-help">
              Defines the IP range for this network. Common sizes:
              <br />• /24 = 256 IPs (10.0.0.0-10.0.0.255)
              <br />• /16 = 65,536 IPs (10.0.0.0-10.0.255.255)
            </div>
          </label>
          <label>
            VLAN ID (optional):
            <input
              type="number"
              value={network.vlanId || ''}
              onChange={(e) => handleNetworkChange('vlanId', e.target.value ? parseInt(e.target.value) : undefined)}
              className="form-control"
              min="1"
              max="4094"
              placeholder="100"
            />
            <div className="field-help">
              VLAN for network isolation (1-4094)
            </div>
          </label>
        </div>
        
        {validateNetworkCIDR(network.cidr).map((warning, index) => (
          <div key={index} className="warning">
            ⚠️ {warning}
          </div>
        ))}
      </div>
    </div>
  )

  const renderExpertMode = () => (
    <div className="expert-mode">
      <div className="json-editor">
        <h4>Network Configuration (JSON)</h4>
        <textarea
          value={JSON.stringify(network, null, 2)}
          onChange={(e) => {
            try {
              const parsed = JSON.parse(e.target.value)
              onChange(parsed)
            } catch {
              // Invalid JSON, ignore
            }
          }}
          className="json-textarea"
          rows={20}
        />
      </div>
    </div>
  )

  const renderSubnetsSection = () => (
    <div className="subnets-section">
      <div className="section-header">
        <h4>Subnets ({network.subnets.length})</h4>
        <button onClick={handleAddSubnet} className="btn btn-primary">
          Add Subnet
        </button>
      </div>

      {network.subnets.length === 0 ? (
        <div className="empty-state">
          <p>No subnets configured. Subnets divide the network into smaller segments.</p>
        </div>
      ) : (
        <div className="subnets-list">
          {network.subnets.map((subnet, index) => (
            <SubnetCard
              key={subnet.name}
              subnet={subnet}
              index={index}
              parentNetwork={network}
              onChange={(updatedSubnet) => handleSubnetChange(index, updatedSubnet)}
              onRemove={() => handleRemoveSubnet(index)}
              isActive={activeSubnetIndex === index}
              onSetActive={() => setActiveSubnetIndex(index)}
              mode={mode}
            />
          ))}
        </div>
      )}
    </div>
  )

  return (
    <div className="vpc-network-builder">
      <div className="mode-toggle">
        <span>Mode: {mode === 'guided' ? 'Guided' : 'Expert'}</span>
      </div>

      {mode === 'guided' ? renderGuidedMode() : renderExpertMode()}
      
      {mode === 'guided' && renderSubnetsSection()}
    </div>
  )
}

interface SubnetCardProps {
  subnet: VPCSubnet
  index: number
  parentNetwork: VPCNetwork
  onChange: (subnet: VPCSubnet) => void
  onRemove: () => void
  isActive: boolean
  onSetActive: () => void
  mode: 'guided' | 'expert'
}

const SubnetCard: React.FC<SubnetCardProps> = ({
  subnet,
  parentNetwork,
  onChange,
  onRemove,
  isActive,
  onSetActive,
  mode
}) => {
  const handleSubnetChange = useCallback((field: keyof VPCSubnet, value: any) => {
    onChange({
      ...subnet,
      [field]: value,
      provenance: createFieldProvenance('user', field)
    })
  }, [subnet, onChange])

  const handleDHCPChange = useCallback((field: keyof DHCPConfig, value: any) => {
    const updatedDHCP: DHCPConfig = {
      ...subnet.dhcp,
      [field]: value,
      provenance: createFieldProvenance('user', `dhcp.${field}`)
    } as DHCPConfig

    onChange({
      ...subnet,
      dhcp: updatedDHCP,
      provenance: createFieldProvenance('user', 'dhcp')
    })
  }, [subnet, onChange])

  const validateSubnetCIDR = (cidr: string): string[] => {
    const warnings: string[] = []
    
    // Basic CIDR format validation
    const cidrRegex = /^(\d{1,3}\.){3}\d{1,3}\/\d{1,2}$/
    if (!cidrRegex.test(cidr)) {
      warnings.push('Invalid CIDR format')
      return warnings
    }

    // Check if subnet is within parent network (simplified check)
    if (!cidr.startsWith(parentNetwork.cidr.split('/')[0].split('.').slice(0, 2).join('.'))) {
      warnings.push(`Subnet should be within parent network ${parentNetwork.cidr}`)
    }

    return warnings
  }

  return (
    <div className={`subnet-card ${isActive ? 'active' : ''}`}>
      <div className="card-header" onClick={onSetActive}>
        <h5>{subnet.name}</h5>
        <span className="cidr">{subnet.cidr}</span>
        <button className="toggle">{isActive ? '−' : '+'}</button>
      </div>

      {isActive && (
        <div className="card-content">
          <div className="form-row">
            <label>
              Subnet Name:
              <input
                type="text"
                value={subnet.name}
                onChange={(e) => handleSubnetChange('name', e.target.value)}
                className="form-control"
              />
            </label>
            <label>
              CIDR:
              <input
                type="text"
                value={subnet.cidr}
                onChange={(e) => handleSubnetChange('cidr', e.target.value)}
                className="form-control"
                placeholder="10.0.1.0/28"
              />
            </label>
          </div>

          {validateSubnetCIDR(subnet.cidr).map((warning, index) => (
            <div key={index} className="warning">
              ⚠️ {warning}
            </div>
          ))}

          <div className="form-row">
            <label>
              Gateway (optional):
              <input
                type="text"
                value={subnet.gateway || ''}
                onChange={(e) => handleSubnetChange('gateway', e.target.value)}
                className="form-control"
                placeholder="10.0.1.1"
              />
            </label>
            <label>
              VNI (optional):
              <input
                type="number"
                value={subnet.vni || ''}
                onChange={(e) => handleSubnetChange('vni', e.target.value ? parseInt(e.target.value) : undefined)}
                className="form-control"
                placeholder="1000"
              />
            </label>
          </div>

          <div className="dhcp-section">
            <h6>DHCP Configuration</h6>
            <div className="form-row">
              <label>
                <input
                  type="checkbox"
                  checked={subnet.dhcp?.enabled || false}
                  onChange={(e) => handleDHCPChange('enabled', e.target.checked)}
                />
                Enable DHCP
              </label>
            </div>

            {subnet.dhcp?.enabled && (
              <>
                <div className="form-row">
                  <label>
                    Start IP:
                    <input
                      type="text"
                      value={subnet.dhcp.startIP || ''}
                      onChange={(e) => handleDHCPChange('startIP', e.target.value)}
                      className="form-control"
                      placeholder="10.0.1.10"
                    />
                  </label>
                  <label>
                    End IP:
                    <input
                      type="text"
                      value={subnet.dhcp.endIP || ''}
                      onChange={(e) => handleDHCPChange('endIP', e.target.value)}
                      className="form-control"
                      placeholder="10.0.1.50"
                    />
                  </label>
                </div>
                <div className="form-row">
                  <label>
                    DNS Servers:
                    <input
                      type="text"
                      value={subnet.dhcp.dnsServers?.join(', ') || ''}
                      onChange={(e) => handleDHCPChange('dnsServers', e.target.value.split(',').map(s => s.trim()).filter(s => s))}
                      className="form-control"
                      placeholder="8.8.8.8, 8.8.4.4"
                    />
                  </label>
                  <label>
                    Domain Name:
                    <input
                      type="text"
                      value={subnet.dhcp.domainName || ''}
                      onChange={(e) => handleDHCPChange('domainName', e.target.value)}
                      className="form-control"
                      placeholder="example.com"
                    />
                  </label>
                </div>
              </>
            )}
          </div>

          <div className="card-actions">
            <button onClick={onRemove} className="btn btn-danger">
              Remove Subnet
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export default VPCNetworkBuilder