/**
 * VPCSubnetBuilder Component - WP-VPC1
 * Detailed subnet configuration with DHCP, validation, and IP range management
 */

import React, { useCallback, useMemo } from 'react'
import type { VPCSubnetBuilderProps, VPCSubnet, DHCPConfig, VPCNetwork } from '../types/vpc-editor.types'
import { createFieldProvenance } from '../utils/provenance.utils'

const VPCSubnetBuilder: React.FC<VPCSubnetBuilderProps> = ({
  subnet,
  parentNetwork,
  onChange,
  existingSubnets,
  mode = 'guided'
}) => {
  const handleSubnetChange = useCallback((field: keyof VPCSubnet, value: any) => {
    onChange({
      ...subnet,
      [field]: value,
      provenance: createFieldProvenance('user', field)
    })
  }, [subnet, onChange])

  const handleDHCPChange = useCallback((field: keyof DHCPConfig, value: any) => {
    const currentDHCP = subnet.dhcp || {
      enabled: false,
      provenance: createFieldProvenance('user', 'dhcp')
    }

    const updatedDHCP: DHCPConfig = {
      ...currentDHCP,
      [field]: value,
      provenance: createFieldProvenance('user', `dhcp.${field}`)
    }

    onChange({
      ...subnet,
      dhcp: updatedDHCP,
      provenance: createFieldProvenance('user', 'dhcp')
    })
  }, [subnet, onChange])

  // Calculate subnet information
  const subnetInfo = useMemo(() => {
    return calculateSubnetInfo(subnet.cidr, parentNetwork.cidr)
  }, [subnet.cidr, parentNetwork.cidr])

  const validationMessages = useMemo(() => {
    return validateSubnet(subnet, parentNetwork, existingSubnets)
  }, [subnet, parentNetwork, existingSubnets])

  const renderGuidedMode = () => (
    <div className="guided-mode">
      <div className="form-section">
        <h4>Subnet Basics</h4>
        <div className="form-row">
          <label>
            Subnet Name:
            <input
              type="text"
              value={subnet.name}
              onChange={(e) => handleSubnetChange('name', e.target.value)}
              className="form-control"
              placeholder="web-subnet"
            />
            <div className="field-help">
              Descriptive name for this subnet segment
            </div>
          </label>
          <label>
            Description:
            <input
              type="text"
              value={subnet.description || ''}
              onChange={(e) => handleSubnetChange('description', e.target.value)}
              className="form-control"
              placeholder="Web servers subnet"
            />
          </label>
        </div>
      </div>

      <div className="form-section">
        <h4>IP Range Configuration</h4>
        <div className="form-row">
          <label>
            CIDR Block:
            <input
              type="text"
              value={subnet.cidr}
              onChange={(e) => handleSubnetChange('cidr', e.target.value)}
              className="form-control"
              placeholder="10.0.1.0/28"
            />
            <div className="field-help">
              Must be within parent network: {parentNetwork.cidr}
            </div>
          </label>
          <label>
            Gateway IP:
            <input
              type="text"
              value={subnet.gateway || ''}
              onChange={(e) => handleSubnetChange('gateway', e.target.value)}
              className="form-control"
              placeholder={subnetInfo.suggestedGateway}
            />
            <div className="field-help">
              Usually first IP in range ({subnetInfo.suggestedGateway})
            </div>
          </label>
        </div>

        {/* Subnet Information Display */}
        {subnetInfo.isValid && (
          <div className="subnet-info">
            <h5>Subnet Information</h5>
            <div className="info-grid">
              <div className="info-item">
                <label>Network Address:</label>
                <span>{subnetInfo.networkAddress}</span>
              </div>
              <div className="info-item">
                <label>Broadcast Address:</label>
                <span>{subnetInfo.broadcastAddress}</span>
              </div>
              <div className="info-item">
                <label>Usable IPs:</label>
                <span>{subnetInfo.usableIPs} ({subnetInfo.firstUsable} - {subnetInfo.lastUsable})</span>
              </div>
              <div className="info-item">
                <label>Subnet Mask:</label>
                <span>{subnetInfo.subnetMask}</span>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="form-section">
        <h4>Network Isolation</h4>
        <div className="form-row">
          <label>
            VNI (VXLAN Network Identifier):
            <input
              type="number"
              value={subnet.vni || ''}
              onChange={(e) => handleSubnetChange('vni', e.target.value ? parseInt(e.target.value) : undefined)}
              className="form-control"
              min="1"
              max="16777215"
              placeholder="10000"
            />
            <div className="field-help">
              Optional: VXLAN identifier for overlay networking (1-16777215)
            </div>
          </label>
        </div>
      </div>
    </div>
  )

  const renderDHCPSection = () => (
    <div className="form-section">
      <h4>DHCP Configuration</h4>
      <div className="form-row">
        <label className="checkbox-label">
          <input
            type="checkbox"
            checked={subnet.dhcp?.enabled || false}
            onChange={(e) => handleDHCPChange('enabled', e.target.checked)}
          />
          Enable DHCP Server
          <div className="field-help">
            Automatically assign IP addresses to devices in this subnet
          </div>
        </label>
      </div>

      {subnet.dhcp?.enabled && (
        <>
          <div className="form-row">
            <label>
              DHCP Pool Start:
              <input
                type="text"
                value={subnet.dhcp.startIP || ''}
                onChange={(e) => handleDHCPChange('startIP', e.target.value)}
                className="form-control"
                placeholder={subnetInfo.suggestedDHCPStart}
              />
              <div className="field-help">
                First IP in DHCP pool (suggested: {subnetInfo.suggestedDHCPStart})
              </div>
            </label>
            <label>
              DHCP Pool End:
              <input
                type="text"
                value={subnet.dhcp.endIP || ''}
                onChange={(e) => handleDHCPChange('endIP', e.target.value)}
                className="form-control"
                placeholder={subnetInfo.suggestedDHCPEnd}
              />
              <div className="field-help">
                Last IP in DHCP pool (suggested: {subnetInfo.suggestedDHCPEnd})
              </div>
            </label>
          </div>

          <div className="form-row">
            <label>
              DNS Servers:
              <input
                type="text"
                value={subnet.dhcp.dnsServers?.join(', ') || ''}
                onChange={(e) => handleDHCPChange('dnsServers', 
                  e.target.value.split(',').map(s => s.trim()).filter(s => s)
                )}
                className="form-control"
                placeholder="8.8.8.8, 8.8.4.4"
              />
              <div className="field-help">
                Comma-separated list of DNS server IPs
              </div>
            </label>
            <label>
              Domain Name:
              <input
                type="text"
                value={subnet.dhcp.domainName || ''}
                onChange={(e) => handleDHCPChange('domainName', e.target.value)}
                className="form-control"
                placeholder="internal.company.com"
              />
              <div className="field-help">
                Domain suffix for DHCP clients
              </div>
            </label>
          </div>

          <div className="dhcp-preview">
            <h5>DHCP Pool Summary</h5>
            <div className="pool-info">
              {subnet.dhcp.startIP && subnet.dhcp.endIP ? (
                <span>Pool: {subnet.dhcp.startIP} - {subnet.dhcp.endIP}</span>
              ) : (
                <span className="text-muted">Configure start and end IPs</span>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  )

  const renderExpertMode = () => (
    <div className="expert-mode">
      <div className="json-editor">
        <h4>Subnet Configuration (JSON)</h4>
        <textarea
          value={JSON.stringify(subnet, null, 2)}
          onChange={(e) => {
            try {
              const parsed = JSON.parse(e.target.value)
              onChange(parsed)
            } catch {
              // Invalid JSON, ignore for now
            }
          }}
          className="json-textarea"
          rows={25}
        />
        <div className="json-help">
          <h5>Quick Reference:</h5>
          <pre>{`{
  "name": "string",
  "cidr": "x.x.x.x/y", 
  "gateway": "x.x.x.x",
  "vni": number,
  "dhcp": {
    "enabled": boolean,
    "startIP": "x.x.x.x",
    "endIP": "x.x.x.x",
    "dnsServers": ["x.x.x.x"],
    "domainName": "string"
  }
}`}</pre>
        </div>
      </div>
    </div>
  )

  const renderValidationMessages = () => (
    <div className="validation-section">
      {validationMessages.errors.map((error, index) => (
        <div key={`error-${index}`} className="validation-error">
          <strong>❌ Error:</strong> {error.what}
          <div className="validation-details">
            <div><strong>How to fix:</strong> {error.how}</div>
            <div><strong>Why:</strong> {error.why}</div>
          </div>
        </div>
      ))}
      
      {validationMessages.warnings.map((warning, index) => (
        <div key={`warning-${index}`} className="validation-warning">
          <strong>⚠️ Warning:</strong> {warning.what}
          <div className="validation-details">
            <div><strong>Recommendation:</strong> {warning.how}</div>
            <div><strong>Why:</strong> {warning.why}</div>
          </div>
        </div>
      ))}
    </div>
  )

  return (
    <div className="vpc-subnet-builder">
      <div className="builder-header">
        <h3>Subnet Configuration</h3>
        <div className="mode-indicator">
          Mode: <span className="mode-badge">{mode}</span>
        </div>
      </div>

      {validationMessages.errors.length > 0 || validationMessages.warnings.length > 0 ? (
        renderValidationMessages()
      ) : null}

      {mode === 'guided' ? (
        <>
          {renderGuidedMode()}
          {renderDHCPSection()}
        </>
      ) : (
        renderExpertMode()
      )}
    </div>
  )
}

/**
 * Calculate subnet information from CIDR
 */
function calculateSubnetInfo(subnetCIDR: string, parentCIDR: string) {
  const info = {
    isValid: false,
    networkAddress: '',
    broadcastAddress: '',
    subnetMask: '',
    usableIPs: 0,
    firstUsable: '',
    lastUsable: '',
    suggestedGateway: '',
    suggestedDHCPStart: '',
    suggestedDHCPEnd: '',
    isWithinParent: false
  }

  try {
    const [subnetIP, subnetPrefix] = subnetCIDR.split('/')
    const prefix = parseInt(subnetPrefix)
    
    if (!subnetIP || isNaN(prefix) || prefix < 0 || prefix > 32) {
      return info
    }

    const ipParts = subnetIP.split('.').map(p => parseInt(p))
    if (ipParts.length !== 4 || ipParts.some(p => isNaN(p) || p < 0 || p > 255)) {
      return info
    }

    // Calculate network and broadcast addresses
    const hostBits = 32 - prefix
    const subnetMask = (0xFFFFFFFF << hostBits) >>> 0
    const networkAddr = (
      (ipParts[0] << 24) + (ipParts[1] << 16) + (ipParts[2] << 8) + ipParts[3]
    ) & subnetMask

    const broadcastAddr = networkAddr | ((1 << hostBits) - 1)

    info.networkAddress = longToIP(networkAddr)
    info.broadcastAddress = longToIP(broadcastAddr)
    info.subnetMask = longToIP(subnetMask)
    info.usableIPs = Math.max(0, (1 << hostBits) - 2)
    info.firstUsable = longToIP(networkAddr + 1)
    info.lastUsable = longToIP(broadcastAddr - 1)
    info.suggestedGateway = info.firstUsable
    
    // Suggest DHCP range (middle 50% of usable IPs)
    const dhcpStart = networkAddr + Math.floor((1 << hostBits) * 0.25)
    const dhcpEnd = networkAddr + Math.floor((1 << hostBits) * 0.75)
    info.suggestedDHCPStart = longToIP(dhcpStart)
    info.suggestedDHCPEnd = longToIP(dhcpEnd)
    
    info.isValid = true

    // Check if subnet is within parent network
    info.isWithinParent = isSubnetWithinParent(subnetCIDR, parentCIDR)

  } catch (error) {
    // Invalid CIDR, return default info
  }

  return info
}

/**
 * Convert IP address to long integer
 */
function longToIP(long: number): string {
  return [
    (long >>> 24) & 0xFF,
    (long >>> 16) & 0xFF,
    (long >>> 8) & 0xFF,
    long & 0xFF
  ].join('.')
}

/**
 * Check if subnet is within parent network
 */
function isSubnetWithinParent(subnetCIDR: string, parentCIDR: string): boolean {
  try {
    const [subnetIP, subnetPrefix] = subnetCIDR.split('/')
    const [parentIP, parentPrefix] = parentCIDR.split('/')
    
    const subnetPrefixNum = parseInt(subnetPrefix)
    const parentPrefixNum = parseInt(parentPrefix)
    
    // Subnet prefix must be larger (more specific) than parent
    if (subnetPrefixNum <= parentPrefixNum) {
      return false
    }

    // Check if subnet IP is within parent network
    const parentMask = (0xFFFFFFFF << (32 - parentPrefixNum)) >>> 0
    const parentNetworkAddr = ipToLong(parentIP) & parentMask
    const subnetNetworkAddr = ipToLong(subnetIP) & parentMask

    return parentNetworkAddr === subnetNetworkAddr
  } catch {
    return false
  }
}

/**
 * Convert IP string to long integer
 */
function ipToLong(ip: string): number {
  const parts = ip.split('.').map(p => parseInt(p))
  return (parts[0] << 24) + (parts[1] << 16) + (parts[2] << 8) + parts[3]
}

/**
 * Validate subnet configuration
 */
function validateSubnet(
  subnet: VPCSubnet, 
  parentNetwork: VPCNetwork, 
  existingSubnets: VPCSubnet[]
) {
  const errors: Array<{what: string, how: string, why: string}> = []
  const warnings: Array<{what: string, how: string, why: string}> = []

  // Check subnet name
  if (!subnet.name || subnet.name.trim().length === 0) {
    errors.push({
      what: 'Subnet name is required',
      how: 'Enter a descriptive name for this subnet',
      why: 'Subnet names are used for identification and management'
    })
  }

  // Check for duplicate subnet names
  const duplicateName = existingSubnets.find(s => s.name === subnet.name && s !== subnet)
  if (duplicateName) {
    errors.push({
      what: `Subnet name "${subnet.name}" is already used`,
      how: 'Choose a unique name for this subnet',
      why: 'Subnet names must be unique within the network'
    })
  }

  // Validate CIDR format and parent relationship
  const subnetInfo = calculateSubnetInfo(subnet.cidr, parentNetwork.cidr)
  if (!subnetInfo.isValid) {
    errors.push({
      what: 'Invalid CIDR format',
      how: 'Use format like "10.0.1.0/28" with valid IP and prefix',
      why: 'CIDR notation defines the IP range for the subnet'
    })
  } else if (!subnetInfo.isWithinParent) {
    errors.push({
      what: 'Subnet is not within parent network',
      how: `Use a CIDR that falls within ${parentNetwork.cidr}`,
      why: 'Subnets must be subdivisions of their parent network'
    })
  }

  // Check for CIDR overlaps with other subnets
  existingSubnets.forEach(existingSubnet => {
    if (existingSubnet !== subnet && doSubnetsOverlap(subnet.cidr, existingSubnet.cidr)) {
      errors.push({
        what: `CIDR overlaps with subnet "${existingSubnet.name}"`,
        how: 'Choose a non-overlapping CIDR range',
        why: 'Overlapping subnets can cause routing conflicts'
      })
    }
  })

  // Validate gateway
  if (subnet.gateway && subnetInfo.isValid) {
    if (!isIPInSubnet(subnet.gateway, subnet.cidr)) {
      errors.push({
        what: 'Gateway IP is not within subnet range',
        how: `Use an IP between ${subnetInfo.firstUsable} and ${subnetInfo.lastUsable}`,
        why: 'Gateway must be reachable within the subnet'
      })
    }
  }

  // Validate DHCP configuration
  if (subnet.dhcp?.enabled) {
    if (!subnet.dhcp.startIP || !subnet.dhcp.endIP) {
      errors.push({
        what: 'DHCP pool requires start and end IP addresses',
        how: 'Specify both startIP and endIP for the DHCP pool',
        why: 'DHCP needs a defined range of IPs to assign'
      })
    } else {
      // Validate DHCP range is within subnet
      if (!isIPInSubnet(subnet.dhcp.startIP, subnet.cidr)) {
        errors.push({
          what: 'DHCP start IP is outside subnet range',
          how: `Use an IP between ${subnetInfo.firstUsable} and ${subnetInfo.lastUsable}`,
          why: 'DHCP pool must be within the subnet'
        })
      }
      
      if (!isIPInSubnet(subnet.dhcp.endIP, subnet.cidr)) {
        errors.push({
          what: 'DHCP end IP is outside subnet range',
          how: `Use an IP between ${subnetInfo.firstUsable} and ${subnetInfo.lastUsable}`,
          why: 'DHCP pool must be within the subnet'
        })
      }
    }

    // Validate DNS servers
    if (subnet.dhcp.dnsServers && subnet.dhcp.dnsServers.length > 0) {
      subnet.dhcp.dnsServers.forEach(dns => {
        if (!isValidIP(dns)) {
          warnings.push({
            what: `Invalid DNS server IP: ${dns}`,
            how: 'Use valid IP addresses for DNS servers',
            why: 'Invalid DNS servers will cause name resolution failures'
          })
        }
      })
    }
  }

  // VNI validation
  if (subnet.vni !== undefined) {
    if (subnet.vni < 1 || subnet.vni > 16777215) {
      errors.push({
        what: 'VNI must be between 1 and 16777215',
        how: 'Use a valid VXLAN Network Identifier',
        why: 'VNI range is limited by VXLAN specification'
      })
    }
  }

  return { errors, warnings }
}

/**
 * Check if two subnets overlap
 */
function doSubnetsOverlap(cidr1: string, cidr2: string): boolean {
  try {
    const [ip1, prefix1] = cidr1.split('/')
    const [ip2, prefix2] = cidr2.split('/')
    
    const prefix1Num = parseInt(prefix1)
    const prefix2Num = parseInt(prefix2)
    
    const mask1 = (0xFFFFFFFF << (32 - prefix1Num)) >>> 0
    const mask2 = (0xFFFFFFFF << (32 - prefix2Num)) >>> 0
    
    const network1 = ipToLong(ip1) & mask1
    const network2 = ipToLong(ip2) & mask2
    
    // Check if either network contains the other
    const smallerMask = Math.max(prefix1Num, prefix2Num)
    const testMask = (0xFFFFFFFF << (32 - smallerMask)) >>> 0
    
    return (network1 & testMask) === (network2 & testMask)
  } catch {
    return false
  }
}

/**
 * Check if IP is within subnet
 */
function isIPInSubnet(ip: string, cidr: string): boolean {
  try {
    const [networkIP, prefixStr] = cidr.split('/')
    const prefix = parseInt(prefixStr)
    const mask = (0xFFFFFFFF << (32 - prefix)) >>> 0
    
    const ipLong = ipToLong(ip)
    const networkLong = ipToLong(networkIP) & mask
    
    return (ipLong & mask) === networkLong
  } catch {
    return false
  }
}

/**
 * Validate IP address format
 */
function isValidIP(ip: string): boolean {
  const parts = ip.split('.')
  return parts.length === 4 && parts.every(part => {
    const num = parseInt(part)
    return !isNaN(num) && num >= 0 && num <= 255
  })
}

export default VPCSubnetBuilder