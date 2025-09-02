/**
 * VPCEditor Component - WP-VPC1
 * CRD-aligned VPC configuration editor with networks, subnets, VRF, and policy management
 */

import React, { useState, useCallback } from 'react'
import type { VPCEditorProps, VPCConfiguration, VPCNetwork, VRFConfig, VPCPolicy } from '../types/vpc-editor.types'
import { createFieldProvenance } from '../utils/provenance.utils'

const VPCEditor: React.FC<VPCEditorProps> = ({
  configuration,
  onChange,
  onValidate,
  mode = 'guided',
  readOnly = false
}) => {
  const [activeTab, setActiveTab] = useState<'networks' | 'vrfs' | 'policies'>('networks')
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({})

  const toggleSection = useCallback((section: string) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }))
  }, [])

  const handleMetadataChange = useCallback((field: string, value: string) => {
    if (readOnly) return

    const updatedConfig: VPCConfiguration = {
      ...configuration,
      metadata: {
        ...configuration.metadata,
        [field]: value
      },
      provenance: createFieldProvenance('user', `metadata.${field}`)
    }
    onChange(updatedConfig)
  }, [configuration, onChange, readOnly])

  const handleNetworkChange = useCallback((index: number, network: VPCNetwork) => {
    if (readOnly) return

    const updatedNetworks = [...configuration.networks]
    updatedNetworks[index] = network
    
    const updatedConfig: VPCConfiguration = {
      ...configuration,
      networks: updatedNetworks,
      provenance: createFieldProvenance('user', `networks[${index}]`)
    }
    onChange(updatedConfig)
  }, [configuration, onChange, readOnly])

  const handleAddNetwork = useCallback(() => {
    if (readOnly) return

    const newNetwork: VPCNetwork = {
      name: `network-${configuration.networks.length + 1}`,
      cidr: '10.0.0.0/24',
      provenance: createFieldProvenance('user', 'new-network'),
      subnets: [],
      policies: []
    }

    const updatedConfig: VPCConfiguration = {
      ...configuration,
      networks: [...configuration.networks, newNetwork],
      provenance: createFieldProvenance('user', 'networks.add')
    }
    onChange(updatedConfig)
  }, [configuration, onChange, readOnly])

  const handleRemoveNetwork = useCallback((index: number) => {
    if (readOnly) return

    const updatedNetworks = configuration.networks.filter((_, i) => i !== index)
    const updatedConfig: VPCConfiguration = {
      ...configuration,
      networks: updatedNetworks,
      provenance: createFieldProvenance('user', `networks.remove[${index}]`)
    }
    onChange(updatedConfig)
  }, [configuration, onChange, readOnly])

  const renderMetadataSection = () => (
    <div className="vpc-metadata">
      <h3>VPC Metadata</h3>
      <div className="form-row">
        <label>
          Name:
          <input
            type="text"
            value={configuration.metadata.name}
            onChange={(e) => handleMetadataChange('name', e.target.value)}
            disabled={readOnly}
            className="form-control"
          />
        </label>
        <label>
          Namespace:
          <input
            type="text"
            value={configuration.metadata.namespace || ''}
            onChange={(e) => handleMetadataChange('namespace', e.target.value)}
            disabled={readOnly}
            className="form-control"
            placeholder="default"
          />
        </label>
      </div>
    </div>
  )

  const renderNetworksTab = () => (
    <div className="networks-tab">
      <div className="section-header">
        <h3>Networks ({configuration.networks.length})</h3>
        {!readOnly && (
          <button onClick={handleAddNetwork} className="btn btn-primary">
            Add Network
          </button>
        )}
      </div>
      
      {configuration.networks.length === 0 ? (
        <div className="empty-state">
          <p>No networks configured. Add a network to get started.</p>
        </div>
      ) : (
        configuration.networks.map((network, index) => (
          <NetworkCard
            key={network.name}
            network={network}
            index={index}
            onChange={(net) => handleNetworkChange(index, net)}
            onRemove={() => handleRemoveNetwork(index)}
            expanded={expandedSections[`network-${index}`] || false}
            onToggle={() => toggleSection(`network-${index}`)}
            existingNetworks={configuration.networks}
            readOnly={readOnly}
            mode={mode}
          />
        ))
      )}
    </div>
  )

  const renderVRFsTab = () => (
    <div className="vrfs-tab">
      <div className="section-header">
        <h3>VRFs ({configuration.vrfs.length})</h3>
        {!readOnly && (
          <button onClick={() => {/* TODO: Add VRF */}} className="btn btn-primary">
            Add VRF
          </button>
        )}
      </div>
      
      {configuration.vrfs.length === 0 ? (
        <div className="empty-state">
          <p>No VRFs configured. VRFs provide network isolation and routing control.</p>
        </div>
      ) : (
        configuration.vrfs.map((vrf, index) => (
          <VRFCard
            key={vrf.name}
            vrf={vrf}
            index={index}
            availableNetworks={configuration.networks}
            expanded={expandedSections[`vrf-${index}`] || false}
            onToggle={() => toggleSection(`vrf-${index}`)}
            readOnly={readOnly}
            mode={mode}
          />
        ))
      )}
    </div>
  )

  const renderPoliciesTab = () => (
    <div className="policies-tab">
      <div className="section-header">
        <h3>Policies ({configuration.globalPolicies.length})</h3>
        {!readOnly && (
          <button onClick={() => {/* TODO: Add Policy */}} className="btn btn-primary">
            Add Policy
          </button>
        )}
      </div>
      
      {configuration.globalPolicies.length === 0 ? (
        <div className="empty-state">
          <p>No policies configured. Policies control security and routing behavior.</p>
        </div>
      ) : (
        configuration.globalPolicies.map((policy, index) => (
          <PolicyCard
            key={policy.name}
            policy={policy}
            index={index}
            availableNetworks={configuration.networks}
            expanded={expandedSections[`policy-${index}`] || false}
            onToggle={() => toggleSection(`policy-${index}`)}
            readOnly={readOnly}
            mode={mode}
          />
        ))
      )}
    </div>
  )

  return (
    <div className="vpc-editor">
      {renderMetadataSection()}
      
      <div className="tabs">
        <button
          className={`tab ${activeTab === 'networks' ? 'active' : ''}`}
          onClick={() => setActiveTab('networks')}
        >
          Networks
        </button>
        <button
          className={`tab ${activeTab === 'vrfs' ? 'active' : ''}`}
          onClick={() => setActiveTab('vrfs')}
        >
          VRFs
        </button>
        <button
          className={`tab ${activeTab === 'policies' ? 'active' : ''}`}
          onClick={() => setActiveTab('policies')}
        >
          Policies
        </button>
      </div>

      <div className="tab-content">
        {activeTab === 'networks' && renderNetworksTab()}
        {activeTab === 'vrfs' && renderVRFsTab()}
        {activeTab === 'policies' && renderPoliciesTab()}
      </div>
    </div>
  )
}

// Placeholder components for network cards, VRF cards, and policy cards
interface NetworkCardProps {
  network: VPCNetwork
  index: number
  onChange: (network: VPCNetwork) => void
  onRemove: () => void
  expanded: boolean
  onToggle: () => void
  existingNetworks: VPCNetwork[]
  readOnly: boolean
  mode: 'guided' | 'expert'
}

const NetworkCard: React.FC<NetworkCardProps> = ({
  network,
  onChange,
  onRemove,
  expanded,
  onToggle,
  readOnly,
  mode
}) => {
  const handleChange = (field: keyof VPCNetwork, value: any) => {
    if (readOnly) return
    onChange({
      ...network,
      [field]: value,
      provenance: createFieldProvenance('user', field)
    })
  }

  return (
    <div className="network-card">
      <div className="card-header" onClick={onToggle}>
        <h4>{network.name}</h4>
        <span className="cidr">{network.cidr}</span>
        <button className="toggle">{expanded ? '−' : '+'}</button>
      </div>
      
      {expanded && (
        <div className="card-content">
          <div className="form-row">
            <label>
              Name:
              <input
                type="text"
                value={network.name}
                onChange={(e) => handleChange('name', e.target.value)}
                disabled={readOnly}
                className="form-control"
              />
            </label>
            <label>
              CIDR:
              <input
                type="text"
                value={network.cidr}
                onChange={(e) => handleChange('cidr', e.target.value)}
                disabled={readOnly}
                className="form-control"
                placeholder="10.0.0.0/24"
              />
            </label>
          </div>
          
          <div className="form-row">
            <label>
              VLAN ID (optional):
              <input
                type="number"
                value={network.vlanId || ''}
                onChange={(e) => handleChange('vlanId', e.target.value ? parseInt(e.target.value) : undefined)}
                disabled={readOnly}
                className="form-control"
                min="1"
                max="4094"
              />
            </label>
            <label>
              Description:
              <input
                type="text"
                value={network.description || ''}
                onChange={(e) => handleChange('description', e.target.value)}
                disabled={readOnly}
                className="form-control"
                placeholder="Network description"
              />
            </label>
          </div>

          <div className="subnets-section">
            <h5>Subnets ({network.subnets.length})</h5>
            {network.subnets.length === 0 ? (
              <p className="text-muted">No subnets defined</p>
            ) : (
              network.subnets.map((subnet, index) => (
                <div key={subnet.name} className="subnet-item">
                  <span>{subnet.name}</span>
                  <span>{subnet.cidr}</span>
                  {subnet.gateway && <span>GW: {subnet.gateway}</span>}
                </div>
              ))
            )}
          </div>

          {!readOnly && (
            <div className="card-actions">
              <button onClick={onRemove} className="btn btn-danger">
                Remove Network
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// Placeholder VRF and Policy components
const VRFCard: React.FC<any> = ({ vrf, expanded, onToggle }) => (
  <div className="vrf-card">
    <div className="card-header" onClick={onToggle}>
      <h4>{vrf.name}</h4>
      <span>{vrf.routeDistinguisher}</span>
      <button className="toggle">{expanded ? '−' : '+'}</button>
    </div>
    {expanded && (
      <div className="card-content">
        <p>VRF configuration details...</p>
      </div>
    )}
  </div>
)

const PolicyCard: React.FC<any> = ({ policy, expanded, onToggle }) => (
  <div className="policy-card">
    <div className="card-header" onClick={onToggle}>
      <h4>{policy.name}</h4>
      <span>{policy.type}</span>
      <button className="toggle">{expanded ? '−' : '+'}</button>
    </div>
    {expanded && (
      <div className="card-content">
        <p>Policy configuration details...</p>
      </div>
    )}
  </div>
)

export default VPCEditor