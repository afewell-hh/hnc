import React from 'react'
import type { DerivedTopology, AllocationResult, FabricSpec, WiringConnection } from '../app.types'
import { buildWiring, emitYaml, type Wiring, type WiringYamlResult } from '../domain/wiring'
import { getSwitchProfiles } from '../utils/switchProfilesUtil'
import { downloadZip } from '../utils/downloadUtils'

interface WiringDiagramSectionProps {
  computedTopology: DerivedTopology | null
  allocationResult: AllocationResult | null
  config: Partial<FabricSpec>
  isVisible: boolean
  hasCapacityError?: boolean
}

interface WiringTableData {
  switches: Array<{
    name: string
    model: string
    role: 'spine' | 'leaf'
    assignableRanges: string
    classId?: string
  }>
  servers: Array<{
    name: string
    class: string
    nics: number
    type: string
  }>
  connections: Array<{
    id: string
    source: string
    destination: string
    type: 'uplink' | 'endpoint'
  }>
}

export const WiringDiagramSection: React.FC<WiringDiagramSectionProps> = ({
  computedTopology,
  allocationResult,
  config,
  isVisible,
  hasCapacityError = false
}) => {
  const [wiring, setWiring] = React.useState<Wiring | null>(null)
  const [wiringData, setWiringData] = React.useState<WiringTableData>({
    switches: [],
    servers: [],
    connections: []
  })
  const [isGenerating, setIsGenerating] = React.useState(false)

  // Generate wiring diagram when topology and allocation are available
  React.useEffect(() => {
    if (!computedTopology || !allocationResult || !config.name) {
      setWiring(null)
      setWiringData({ switches: [], servers: [], connections: [] })
      return
    }

    try {
      setIsGenerating(true)
      
      // Get switch profiles for wiring generation
      const switchProfiles = getSwitchProfiles()
      
      // Build wiring from allocation
      const generatedWiring = buildWiring(config as FabricSpec, switchProfiles, allocationResult)
      setWiring(generatedWiring)
      
      // Transform wiring into table format
      const tableData = transformWiringToTableData(generatedWiring)
      setWiringData(tableData)
      
    } catch (error) {
      console.error('Failed to generate wiring:', error)
      setWiring(null)
      setWiringData({ switches: [], servers: [], connections: [] })
    } finally {
      setIsGenerating(false)
    }
  }, [computedTopology, allocationResult, config])

  const handleDownloadYaml = async () => {
    if (!wiring) return

    try {
      const yamlResult = emitYaml(wiring)
      await downloadZip({
        'switches.yaml': yamlResult.switchesYaml,
        'servers.yaml': yamlResult.serversYaml,
        'connections.yaml': yamlResult.connectionsYaml
      }, `${config.name || 'fabric'}-wiring.zip`)
    } catch (error) {
      console.error('Failed to download YAML:', error)
    }
  }

  const handleOpenFgdFolder = () => {
    // Dev-only functionality - would open file system folder
    console.log('Opening FGD folder for:', config.name)
    alert(`Dev mode: Would open FGD folder for fabric "${config.name}"`)
  }

  if (!isVisible) {
    return null
  }

  return (
    <div 
      className="wiring-diagram-section" 
      style={{ marginTop: '30px' }}
      data-testid="wiring-diagram-section"
    >
      <h3>Wiring Diagram</h3>
      
      {hasCapacityError ? (
        <div 
          className="wiring-hidden-message"
          style={{ 
            padding: '15px', 
            backgroundColor: '#f8d7da', 
            border: '1px solid #f5c6cb', 
            borderRadius: '4px',
            color: '#721c24'
          }}
          data-testid="wiring-capacity-error"
        >
          ⚠️ Wiring diagram hidden due to capacity errors. Resolve issues to view wiring details.
        </div>
      ) : (
        <>
          {isGenerating && (
            <div 
              className="generating-indicator" 
              style={{ 
                padding: '10px', 
                backgroundColor: '#fff3cd', 
                borderRadius: '4px',
                marginBottom: '15px'
              }}
              data-testid="wiring-generating"
            >
              ⏳ Generating wiring diagram...
            </div>
          )}

          {wiring && (
            <>
              <div className="wiring-actions" style={{ marginBottom: '20px' }}>
                <button
                  onClick={handleDownloadYaml}
                  style={{
                    padding: '8px 16px',
                    backgroundColor: '#17a2b8',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    marginRight: '10px'
                  }}
                  data-testid="download-yaml-button"
                  aria-label="Download YAML files as zip"
                >
                  📦 Download YAML
                </button>
                
                {process.env.NODE_ENV === 'development' && (
                  <button
                    onClick={handleOpenFgdFolder}
                    style={{
                      padding: '8px 16px',
                      backgroundColor: '#6c757d',
                      color: 'white',
                      border: 'none',
                      borderRadius: '4px',
                      cursor: 'pointer'
                    }}
                    data-testid="open-fgd-folder-button"
                    aria-label="Open FGD folder"
                  >
                    📁 Open FGD Folder
                  </button>
                )}
              </div>

              <div className="wiring-tables" style={{ display: 'flex', flexDirection: 'column', gap: '25px' }}>
                {/* Switches Table */}
                <div className="switches-table-container">
                  <h4>Switches</h4>
                  <table 
                    className="switches-table"
                    style={{ width: '100%', borderCollapse: 'collapse', border: '1px solid #ddd' }}
                    data-testid="switches-table"
                    role="table"
                    aria-label="Network switches configuration"
                  >
                    <thead>
                      <tr style={{ backgroundColor: '#f8f9fa' }}>
                        <th style={{ padding: '10px', textAlign: 'left', borderBottom: '1px solid #ddd' }}>Name</th>
                        <th style={{ padding: '10px', textAlign: 'left', borderBottom: '1px solid #ddd' }}>Model</th>
                        <th style={{ padding: '10px', textAlign: 'left', borderBottom: '1px solid #ddd' }}>Role</th>
                        <th style={{ padding: '10px', textAlign: 'left', borderBottom: '1px solid #ddd' }}>Assignable Ranges</th>
                        {hasMultipleClasses(wiringData.switches) && (
                          <th style={{ padding: '10px', textAlign: 'left', borderBottom: '1px solid #ddd' }}>Class</th>
                        )}
                      </tr>
                    </thead>
                    <tbody>
                      {wiringData.switches.map((switchDevice, index) => (
                        <tr key={switchDevice.name} style={{ borderBottom: index < wiringData.switches.length - 1 ? '1px solid #eee' : 'none' }}>
                          <td style={{ padding: '10px' }} data-testid={`switch-name-${index}`}>{switchDevice.name}</td>
                          <td style={{ padding: '10px' }} data-testid={`switch-model-${index}`}>{switchDevice.model}</td>
                          <td style={{ padding: '10px' }} data-testid={`switch-role-${index}`}>{switchDevice.role}</td>
                          <td style={{ padding: '10px' }} data-testid={`switch-ranges-${index}`}>{switchDevice.assignableRanges}</td>
                          {hasMultipleClasses(wiringData.switches) && (
                            <td style={{ padding: '10px' }} data-testid={`switch-class-${index}`}>{switchDevice.classId || 'default'}</td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Servers Table */}
                <div className="servers-table-container">
                  <h4>Servers</h4>
                  <table 
                    className="servers-table"
                    style={{ width: '100%', borderCollapse: 'collapse', border: '1px solid #ddd' }}
                    data-testid="servers-table"
                    role="table"
                    aria-label="Server endpoints configuration"
                  >
                    <thead>
                      <tr style={{ backgroundColor: '#f8f9fa' }}>
                        <th style={{ padding: '10px', textAlign: 'left', borderBottom: '1px solid #ddd' }}>Name</th>
                        <th style={{ padding: '10px', textAlign: 'left', borderBottom: '1px solid #ddd' }}>Class</th>
                        <th style={{ padding: '10px', textAlign: 'left', borderBottom: '1px solid #ddd' }}>NICs</th>
                        <th style={{ padding: '10px', textAlign: 'left', borderBottom: '1px solid #ddd' }}>Type</th>
                      </tr>
                    </thead>
                    <tbody>
                      {wiringData.servers.map((server, index) => (
                        <tr key={server.name} style={{ borderBottom: index < wiringData.servers.length - 1 ? '1px solid #eee' : 'none' }}>
                          <td style={{ padding: '10px' }} data-testid={`server-name-${index}`}>{server.name}</td>
                          <td style={{ padding: '10px' }} data-testid={`server-class-${index}`}>{server.class}</td>
                          <td style={{ padding: '10px' }} data-testid={`server-nics-${index}`}>{server.nics}</td>
                          <td style={{ padding: '10px' }} data-testid={`server-type-${index}`}>{server.type}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Connections Table */}
                <div className="connections-table-container">
                  <h4>Connections</h4>
                  <table 
                    className="connections-table"
                    style={{ width: '100%', borderCollapse: 'collapse', border: '1px solid #ddd' }}
                    data-testid="connections-table"
                    role="table"
                    aria-label="Network connections"
                  >
                    <thead>
                      <tr style={{ backgroundColor: '#f8f9fa' }}>
                        <th style={{ padding: '10px', textAlign: 'left', borderBottom: '1px solid #ddd' }}>Source</th>
                        <th style={{ padding: '10px', textAlign: 'center', borderBottom: '1px solid #ddd', width: '80px' }}>⇄</th>
                        <th style={{ padding: '10px', textAlign: 'left', borderBottom: '1px solid #ddd' }}>Destination</th>
                        <th style={{ padding: '10px', textAlign: 'left', borderBottom: '1px solid #ddd' }}>Type</th>
                      </tr>
                    </thead>
                    <tbody>
                      {wiringData.connections.map((connection, index) => (
                        <tr key={connection.id} style={{ borderBottom: index < wiringData.connections.length - 1 ? '1px solid #eee' : 'none' }}>
                          <td style={{ padding: '10px' }} data-testid={`connection-source-${index}`}>{connection.source}</td>
                          <td style={{ padding: '10px', textAlign: 'center', color: '#666' }}>⇄</td>
                          <td style={{ padding: '10px' }} data-testid={`connection-destination-${index}`}>{connection.destination}</td>
                          <td style={{ padding: '10px' }} data-testid={`connection-type-${index}`}>{connection.type}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}

          {!wiring && !isGenerating && computedTopology && allocationResult && (
            <div 
              className="wiring-error" 
              style={{ 
                padding: '15px', 
                backgroundColor: '#f8d7da', 
                border: '1px solid #f5c6cb', 
                borderRadius: '4px',
                color: '#721c24'
              }}
              data-testid="wiring-generation-error"
            >
              ⚠️ Failed to generate wiring diagram. Check configuration and try again.
            </div>
          )}
        </>
      )}
    </div>
  )
}

/**
 * Transform wiring data into table format for display
 */
function transformWiringToTableData(wiring: Wiring): WiringTableData {
  // Transform switches (spines and leaves)
  const switches = [
    ...wiring.devices.spines.map(spine => ({
      name: spine.id,
      model: spine.modelId,
      role: 'spine' as const,
      assignableRanges: '1-32', // DS3000 default range
      classId: spine.classId
    })),
    ...wiring.devices.leaves.map(leaf => ({
      name: leaf.id,
      model: leaf.modelId,
      role: 'leaf' as const,
      assignableRanges: '1-48', // DS2000 default range
      classId: leaf.classId
    }))
  ]

  // Transform servers
  const servers = wiring.devices.servers.map(server => ({
    name: server.id,
    class: server.classId || 'default',
    nics: server.ports,
    type: server.modelId
  }))

  // Transform connections
  const connections = wiring.connections.map(conn => ({
    id: conn.id,
    source: `${conn.from.device}:${conn.from.port}`,
    destination: `${conn.to.device}:${conn.to.port}`,
    type: conn.type === 'downlink' ? 'uplink' : conn.type // Map downlinks to uplinks for UI consistency
  }))

  return { switches, servers, connections }
}

/**
 * Check if switches have multiple classes for conditional column display
 */
function hasMultipleClasses(switches: Array<{ classId?: string }>): boolean {
  const classes = new Set(switches.map(s => s.classId || 'default'))
  return classes.size > 1
}