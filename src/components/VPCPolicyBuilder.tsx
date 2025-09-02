/**
 * VPCPolicyBuilder Component - WP-VPC1
 * Network policy configuration for security, routing, and QoS rules
 */

import React, { useCallback, useMemo } from 'react'
import type { VPCPolicyBuilderProps, VPCPolicy, PolicyRule, VPCNetwork } from '../types/vpc-editor.types'
import { createFieldProvenance } from '../utils/provenance.utils'

const VPCPolicyBuilder: React.FC<VPCPolicyBuilderProps> = ({
  policy,
  onChange,
  availableNetworks,
  existingPolicies,
  mode = 'guided'
}) => {
  const handlePolicyChange = useCallback((field: keyof VPCPolicy, value: any) => {
    onChange({
      ...policy,
      [field]: value,
      provenance: createFieldProvenance('user', field)
    })
  }, [policy, onChange])

  const handleRuleChange = useCallback((index: number, rule: PolicyRule) => {
    const updatedRules = [...policy.rules]
    updatedRules[index] = rule
    
    onChange({
      ...policy,
      rules: updatedRules,
      provenance: createFieldProvenance('user', `rules[${index}]`)
    })
  }, [policy, onChange])

  const handleAddRule = useCallback(() => {
    const newRule: PolicyRule = {
      id: `rule-${Date.now()}`,
      action: 'allow',
      protocol: 'tcp',
      priority: 1000,
      provenance: createFieldProvenance('user', 'new-rule')
    }

    onChange({
      ...policy,
      rules: [...policy.rules, newRule],
      provenance: createFieldProvenance('user', 'rules.add')
    })
  }, [policy, onChange])

  const handleRemoveRule = useCallback((index: number) => {
    const updatedRules = policy.rules.filter((_, i) => i !== index)
    
    onChange({
      ...policy,
      rules: updatedRules,
      provenance: createFieldProvenance('user', `rules.remove[${index}]`)
    })
  }, [policy, onChange])

  const handleAppliedToChange = useCallback((networkName: string, applied: boolean) => {
    const updatedAppliedTo = applied
      ? [...policy.appliedTo, networkName]
      : policy.appliedTo.filter(n => n !== networkName)
    
    onChange({
      ...policy,
      appliedTo: updatedAppliedTo,
      provenance: createFieldProvenance('user', 'appliedTo')
    })
  }, [policy, onChange])

  const validationMessages = useMemo(() => {
    return validatePolicy(policy, availableNetworks, existingPolicies)
  }, [policy, availableNetworks, existingPolicies])

  const renderGuidedMode = () => (
    <div className="guided-mode">
      <div className="form-section">
        <h4>Policy Basics</h4>
        <div className="form-row">
          <label>
            Policy Name:
            <input
              type="text"
              value={policy.name}
              onChange={(e) => handlePolicyChange('name', e.target.value)}
              className="form-control"
              placeholder="web-security-policy"
            />
            <div className="field-help">
              Descriptive name for this network policy
            </div>
          </label>
          <label>
            Policy Type:
            <select
              value={policy.type}
              onChange={(e) => handlePolicyChange('type', e.target.value as 'security' | 'routing' | 'qos')}
              className="form-control"
            >
              <option value="security">Security</option>
              <option value="routing">Routing</option>
              <option value="qos">Quality of Service</option>
            </select>
            <div className="field-help">
              {getPolicyTypeDescription(policy.type)}
            </div>
          </label>
        </div>
        
        <div className="form-row">
          <label>
            Priority:
            <input
              type="number"
              value={policy.priority}
              onChange={(e) => handlePolicyChange('priority', parseInt(e.target.value) || 1000)}
              className="form-control"
              min="1"
              max="9999"
              placeholder="1000"
            />
            <div className="field-help">
              Lower numbers = higher priority (1-9999)
            </div>
          </label>
          <label>
            Description:
            <input
              type="text"
              value={policy.description || ''}
              onChange={(e) => handlePolicyChange('description', e.target.value)}
              className="form-control"
              placeholder="Policy description"
            />
          </label>
        </div>
      </div>

      <div className="form-section">
        <h4>Applied Networks</h4>
        <p className="section-help">
          Select which networks this policy applies to
        </p>
        
        <div className="network-selection">
          {availableNetworks.length === 0 ? (
            <div className="empty-state">
              <p>No networks available. Create networks first to apply policies.</p>
            </div>
          ) : (
            availableNetworks.map(network => (
              <NetworkPolicyItem
                key={network.name}
                network={network}
                applied={policy.appliedTo.includes(network.name)}
                onToggle={(applied) => handleAppliedToChange(network.name, applied)}
              />
            ))
          )}
        </div>
      </div>

      <div className="form-section">
        <h4>Policy Rules ({policy.rules.length})</h4>
        <div className="section-header">
          <p className="section-help">
            Define the specific rules for this policy
          </p>
          <button onClick={handleAddRule} className="btn btn-primary">
            Add Rule
          </button>
        </div>
        
        {policy.rules.length === 0 ? (
          <div className="empty-state">
            <p>No rules defined. Add rules to specify policy behavior.</p>
          </div>
        ) : (
          <div className="rules-list">
            {policy.rules.map((rule, index) => (
              <PolicyRuleCard
                key={rule.id}
                rule={rule}
                index={index}
                availableNetworks={availableNetworks}
                onChange={(updatedRule) => handleRuleChange(index, updatedRule)}
                onRemove={() => handleRemoveRule(index)}
                policyType={policy.type}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )

  const renderExpertMode = () => (
    <div className="expert-mode">
      <div className="json-editor">
        <h4>Policy Configuration (JSON)</h4>
        <textarea
          value={JSON.stringify(policy, null, 2)}
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
          <h5>Policy Schema:</h5>
          <pre>{`{
  "name": "string",
  "type": "security" | "routing" | "qos",
  "priority": number,
  "appliedTo": ["network1", "network2"],
  "rules": [{
    "id": "string",
    "action": "allow" | "deny" | "redirect",
    "protocol": "tcp" | "udp" | "icmp" | "any",
    "sourceNet": "network-name | CIDR",
    "destNet": "network-name | CIDR", 
    "sourcePorts": "port | port-range",
    "destPorts": "port | port-range",
    "priority": number
  }]
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
    <div className="vpc-policy-builder">
      <div className="builder-header">
        <h3>Network Policy Configuration</h3>
        <div className="mode-indicator">
          Mode: <span className="mode-badge">{mode}</span>
        </div>
      </div>

      {validationMessages.errors.length > 0 || validationMessages.warnings.length > 0 ? (
        renderValidationMessages()
      ) : null}

      {mode === 'guided' ? renderGuidedMode() : renderExpertMode()}
    </div>
  )
}

interface NetworkPolicyItemProps {
  network: VPCNetwork
  applied: boolean
  onToggle: (applied: boolean) => void
}

const NetworkPolicyItem: React.FC<NetworkPolicyItemProps> = ({
  network,
  applied,
  onToggle
}) => {
  return (
    <div className="network-policy-item">
      <label className="checkbox-label">
        <input
          type="checkbox"
          checked={applied}
          onChange={(e) => onToggle(e.target.checked)}
        />
        <div className="network-info">
          <div className="network-name">{network.name}</div>
          <div className="network-cidr">{network.cidr}</div>
          {network.description && (
            <div className="network-description">{network.description}</div>
          )}
        </div>
      </label>
    </div>
  )
}

interface PolicyRuleCardProps {
  rule: PolicyRule
  index: number
  availableNetworks: VPCNetwork[]
  onChange: (rule: PolicyRule) => void
  onRemove: () => void
  policyType: 'security' | 'routing' | 'qos'
}

const PolicyRuleCard: React.FC<PolicyRuleCardProps> = ({
  rule,
  index,
  availableNetworks,
  onChange,
  onRemove,
  policyType
}) => {
  const handleRuleChange = useCallback((field: keyof PolicyRule, value: any) => {
    onChange({
      ...rule,
      [field]: value,
      provenance: createFieldProvenance('user', field)
    })
  }, [rule, onChange])

  return (
    <div className="policy-rule-card">
      <div className="card-header">
        <h5>Rule {index + 1}</h5>
        <div className="rule-summary">
          {rule.action} {rule.protocol} traffic
        </div>
        <button onClick={onRemove} className="btn btn-danger btn-sm">
          Remove
        </button>
      </div>
      
      <div className="card-content">
        <div className="form-row">
          <label>
            Action:
            <select
              value={rule.action}
              onChange={(e) => handleRuleChange('action', e.target.value)}
              className="form-control"
            >
              <option value="allow">Allow</option>
              <option value="deny">Deny</option>
              {policyType === 'routing' && <option value="redirect">Redirect</option>}
            </select>
          </label>
          <label>
            Protocol:
            <select
              value={rule.protocol || 'any'}
              onChange={(e) => handleRuleChange('protocol', e.target.value)}
              className="form-control"
            >
              <option value="any">Any</option>
              <option value="tcp">TCP</option>
              <option value="udp">UDP</option>
              <option value="icmp">ICMP</option>
            </select>
          </label>
          <label>
            Priority:
            <input
              type="number"
              value={rule.priority}
              onChange={(e) => handleRuleChange('priority', parseInt(e.target.value) || 1000)}
              className="form-control"
              min="1"
              max="9999"
            />
          </label>
        </div>

        <div className="form-row">
          <label>
            Source Network/CIDR:
            <input
              type="text"
              value={rule.sourceNet || ''}
              onChange={(e) => handleRuleChange('sourceNet', e.target.value)}
              className="form-control"
              placeholder="any, network-name, or 10.0.1.0/24"
              list={`source-networks-${rule.id}`}
            />
            <datalist id={`source-networks-${rule.id}`}>
              <option value="any">Any network</option>
              {availableNetworks.map(net => (
                <option key={net.name} value={net.name}>{net.name} ({net.cidr})</option>
              ))}
            </datalist>
          </label>
          <label>
            Destination Network/CIDR:
            <input
              type="text"
              value={rule.destNet || ''}
              onChange={(e) => handleRuleChange('destNet', e.target.value)}
              className="form-control"
              placeholder="any, network-name, or 10.0.2.0/24"
              list={`dest-networks-${rule.id}`}
            />
            <datalist id={`dest-networks-${rule.id}`}>
              <option value="any">Any network</option>
              {availableNetworks.map(net => (
                <option key={net.name} value={net.name}>{net.name} ({net.cidr})</option>
              ))}
            </datalist>
          </label>
        </div>

        {(rule.protocol === 'tcp' || rule.protocol === 'udp' || rule.protocol === 'any') && (
          <div className="form-row">
            <label>
              Source Ports:
              <input
                type="text"
                value={rule.sourcePorts || ''}
                onChange={(e) => handleRuleChange('sourcePorts', e.target.value)}
                className="form-control"
                placeholder="80, 8080-8090, any"
              />
              <div className="field-help">
                Port numbers, ranges (8080-8090), or "any"
              </div>
            </label>
            <label>
              Destination Ports:
              <input
                type="text"
                value={rule.destPorts || ''}
                onChange={(e) => handleRuleChange('destPorts', e.target.value)}
                className="form-control"
                placeholder="443, 8000-9000, any"
              />
              <div className="field-help">
                Port numbers, ranges (8000-9000), or "any"
              </div>
            </label>
          </div>
        )}

        <div className="rule-description">
          <strong>Rule Effect:</strong> {getRuleDescription(rule, policyType)}
        </div>
      </div>
    </div>
  )
}

/**
 * Get policy type description
 */
function getPolicyTypeDescription(type: 'security' | 'routing' | 'qos'): string {
  switch (type) {
    case 'security':
      return 'Controls network access and traffic filtering'
    case 'routing':
      return 'Manages traffic routing and path selection'
    case 'qos':
      return 'Defines quality of service and bandwidth management'
    default:
      return 'Network policy configuration'
  }
}

/**
 * Get human-readable rule description
 */
function getRuleDescription(rule: PolicyRule, policyType: string): string {
  const action = rule.action.toUpperCase()
  const protocol = rule.protocol || 'any'
  const source = rule.sourceNet || 'any source'
  const dest = rule.destNet || 'any destination'
  
  let ports = ''
  if (rule.sourcePorts || rule.destPorts) {
    const srcPorts = rule.sourcePorts || 'any'
    const dstPorts = rule.destPorts || 'any'
    ports = ` (${srcPorts} → ${dstPorts})`
  }

  return `${action} ${protocol.toUpperCase()} traffic from ${source} to ${dest}${ports}`
}

/**
 * Validate policy configuration
 */
function validatePolicy(
  policy: VPCPolicy,
  availableNetworks: VPCNetwork[],
  existingPolicies: VPCPolicy[]
) {
  const errors: Array<{what: string, how: string, why: string}> = []
  const warnings: Array<{what: string, how: string, why: string}> = []

  // Validate policy name
  if (!policy.name || policy.name.trim().length === 0) {
    errors.push({
      what: 'Policy name is required',
      how: 'Enter a descriptive name for this policy',
      why: 'Policy names are used for identification and management'
    })
  }

  // Check for duplicate policy names
  const duplicateName = existingPolicies.find(p => p.name === policy.name && p !== policy)
  if (duplicateName) {
    errors.push({
      what: `Policy name "${policy.name}" is already used`,
      how: 'Choose a unique name for this policy',
      why: 'Policy names must be unique to avoid conflicts'
    })
  }

  // Validate priority
  if (policy.priority < 1 || policy.priority > 9999) {
    errors.push({
      what: 'Priority must be between 1 and 9999',
      how: 'Set a priority value between 1 (highest) and 9999 (lowest)',
      why: 'Priority determines rule evaluation order'
    })
  }

  // Check applied networks
  if (policy.appliedTo.length === 0) {
    warnings.push({
      what: 'No networks selected for this policy',
      how: 'Select one or more networks where this policy should apply',
      why: 'Policies without target networks have no effect'
    })
  }

  policy.appliedTo.forEach(networkName => {
    const networkExists = availableNetworks.find(n => n.name === networkName)
    if (!networkExists) {
      errors.push({
        what: `Referenced network "${networkName}" does not exist`,
        how: 'Remove the reference or create the network first',
        why: 'Policies can only be applied to existing networks'
      })
    }
  })

  // Validate rules
  if (policy.rules.length === 0) {
    warnings.push({
      what: 'No rules defined for this policy',
      how: 'Add one or more rules to define policy behavior',
      why: 'Policies without rules have no effect on traffic'
    })
  }

  policy.rules.forEach((rule, index) => {
    // Validate rule priority
    if (rule.priority < 1 || rule.priority > 9999) {
      errors.push({
        what: `Rule ${index + 1} priority must be between 1 and 9999`,
        how: 'Set a valid priority for the rule',
        why: 'Rule priorities determine evaluation order within the policy'
      })
    }

    // Validate port ranges
    if (rule.sourcePorts && !isValidPortSpec(rule.sourcePorts)) {
      errors.push({
        what: `Rule ${index + 1} has invalid source ports specification`,
        how: 'Use port numbers (80), ranges (8080-8090), or "any"',
        why: 'Invalid port specifications cannot be enforced'
      })
    }

    if (rule.destPorts && !isValidPortSpec(rule.destPorts)) {
      errors.push({
        what: `Rule ${index + 1} has invalid destination ports specification`,
        how: 'Use port numbers (443), ranges (8000-9000), or "any"',
        why: 'Invalid port specifications cannot be enforced'
      })
    }

    // Check for overly broad rules
    if (rule.sourceNet === 'any' && rule.destNet === 'any' && rule.action === 'allow') {
      warnings.push({
        what: `Rule ${index + 1} allows all traffic (very permissive)`,
        how: 'Consider restricting source, destination, or ports for better security',
        why: 'Overly permissive rules can create security vulnerabilities'
      })
    }

    // Check for conflicting rules with same priority
    const conflictingRules = policy.rules.filter((otherRule, otherIndex) => 
      otherIndex !== index && 
      otherRule.priority === rule.priority &&
      rulesConflict(rule, otherRule)
    )

    if (conflictingRules.length > 0) {
      warnings.push({
        what: `Rule ${index + 1} may conflict with other rules at same priority`,
        how: 'Use different priorities or ensure rules are distinct',
        why: 'Conflicting rules with same priority create unpredictable behavior'
      })
    }
  })

  // Policy-specific validations
  if (policy.type === 'security' && policy.rules.every(r => r.action === 'allow')) {
    warnings.push({
      what: 'Security policy only contains allow rules',
      how: 'Consider adding deny rules for complete security control',
      why: 'Security policies typically need both allow and deny rules'
    })
  }

  return { errors, warnings }
}

/**
 * Validate port specification format
 */
function isValidPortSpec(portSpec: string): boolean {
  if (!portSpec || portSpec.trim() === '') return true
  
  const spec = portSpec.trim().toLowerCase()
  if (spec === 'any') return true
  
  // Single port
  if (/^\d+$/.test(spec)) {
    const port = parseInt(spec)
    return port >= 1 && port <= 65535
  }
  
  // Port range
  if (/^\d+-\d+$/.test(spec)) {
    const [start, end] = spec.split('-').map(p => parseInt(p))
    return start >= 1 && end <= 65535 && start <= end
  }
  
  // Comma-separated ports/ranges
  if (spec.includes(',')) {
    return spec.split(',').every(part => isValidPortSpec(part.trim()))
  }
  
  return false
}

/**
 * Check if two rules conflict
 */
function rulesConflict(rule1: PolicyRule, rule2: PolicyRule): boolean {
  // Simple conflict check - rules with overlapping conditions but different actions
  const sameSource = rule1.sourceNet === rule2.sourceNet || 
                     rule1.sourceNet === 'any' || rule2.sourceNet === 'any'
  const sameDest = rule1.destNet === rule2.destNet || 
                   rule1.destNet === 'any' || rule2.destNet === 'any'
  const sameProtocol = rule1.protocol === rule2.protocol || 
                       rule1.protocol === 'any' || rule2.protocol === 'any'
  
  return sameSource && sameDest && sameProtocol && rule1.action !== rule2.action
}

export default VPCPolicyBuilder