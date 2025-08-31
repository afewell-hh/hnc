# Expert Overrides Guide - HNC v0.4.1

## Overview

HNC v0.4.1 introduces **Expert Overrides**, a powerful feature that allows experienced users to manually override automatic calculations while maintaining strict safety guardrails. This feature is designed to be purely additive - all existing workflows continue unchanged, but expert users gain the flexibility to customize configurations when needed.

## Philosophy

- **Safety First**: Impossible configurations are blocked, questionable ones generate warnings
- **Expert Friendly**: Power users can override with clear understanding of consequences  
- **Zero Disruption**: Existing automatic workflows remain unchanged
- **Transparent**: All overrides are clearly marked and can be easily reverted

## Core Concepts

### Field Provenance

Every computed value in HNC now tracks its origin:

- **`auto`**: Calculated automatically by HNC's algorithms
- **`user`**: Manually overridden by the user  
- **`import`**: Loaded from an external configuration file

This provenance information is preserved when configurations are saved and loaded.

### Rule Engine

HNC v0.4.1 includes a comprehensive rule engine that evaluates configurations and provides three types of feedback:

#### ❌ **Errors** (Block Save)
These issues prevent saving the configuration:
- **Capacity Exceeded**: Spine or leaf port count exceeds physical switch limits
- **Invalid Port Ranges**: Empty or negative assignable port ranges
- **Impossible Resources**: Configuration cannot physically exist

#### ⚠️ **Warnings** (Allow Save with Notice)
These issues allow saving but should be carefully considered:
- **Uplinks Not Divisible**: Uplinks not evenly divisible by spine count
- **MC-LAG Odd Count**: MC-LAG enabled with odd leaf count  
- **ES-LAG Single-NIC**: ES-LAG endpoints with single NIC
- **Model Mismatch**: Recommended profiles don't match selected switch models

#### ℹ️ **Info** (Informational Only)
These are suggestions for optimization:
- **Sub-optimal Ratios**: Oversubscription outside recommended ranges
- **Port Utilization**: Low or high port utilization notifications

## User Interface

### Issues Panel

A collapsible **Issues** panel displays all current rule evaluations:

- **Color-coded by severity**: Red (errors), orange (warnings), blue (info)
- **Clear descriptions**: Each issue includes specific details and suggested fixes
- **Dismissible**: Warnings and info messages can be dismissed (errors cannot)
- **Save blocking**: Save button is disabled when errors exist

### Override Indicators

Fields that have been manually overridden display:

- **Override chip**: Small indicator showing "Manual Override" 
- **Tooltip on hover**: Shows the original auto-calculated value
- **Reset button**: One-click return to automatic calculation

## How to Use Expert Overrides

### 1. Make Your Configuration

Start with HNC's automatic calculations as usual. The system will compute optimal values for spines, leaves, and port assignments.

### 2. Identify Override Opportunities

Look for fields where you want to deviate from automatic calculations:
- Number of spine switches
- Number of leaf switches  
- Uplinks per leaf
- Port assignments for specific device classes

### 3. Override Values

Simply edit the calculated values directly in the form fields. The system will:
- Mark the field as manually overridden
- Re-evaluate rules based on your changes
- Display any issues in the Issues panel

### 4. Review Issues

Check the Issues panel for:
- **Errors**: Must be fixed before saving
- **Warnings**: Consider carefully but can proceed
- **Info**: Optional optimizations

### 5. Save or Adjust

- If no errors exist, save your configuration
- If errors exist, adjust values or revert overrides until resolved

## Example Scenarios

### Scenario 1: Forcing Specific Spine Count

**Situation**: Auto-calculation suggests 2 spines, but you want 4 for redundancy.

**Steps**:
1. Change spine count from `2` to `4`
2. System shows override indicator on spine field
3. Issues panel may show "Port Utilization: Low spine utilization" (Info)
4. Save proceeds normally with the override

### Scenario 2: Adjusting Uplinks for Special Requirements

**Situation**: Auto-calculation suggests 2 uplinks per leaf, but your cabling requires 4.

**Steps**:
1. Change uplinks per leaf from `2` to `4`  
2. System recalculates spine port requirements
3. Issues panel may show warnings if spine capacity is exceeded
4. Either adjust spine count or select higher-capacity spine switches

### Scenario 3: Handling Warnings

**Situation**: Configuration generates warnings about MC-LAG with odd leaf count.

**Options**:
1. **Accept**: Dismiss warning and save (system allows this)
2. **Fix**: Add one more leaf switch to make count even
3. **Revert**: Reset to auto-calculated values

## Advanced Usage

### Bulk Overrides

When making multiple related overrides:
1. Make all changes before reviewing issues
2. The rule engine evaluates the complete configuration
3. Address any errors that emerge from the combination

### Import/Export with Overrides

Configurations preserve override information:
- Exported YAML includes provenance metadata
- Imported configurations maintain user overrides
- Auto-calculated fields are recalculated on import

### Reset Strategies

**Individual Reset**: Click reset button on specific fields
**Global Reset**: Use "Reset All to Auto" to clear all overrides
**Selective Reset**: Reset only fields causing errors

## Best Practices

### For Network Architects

1. **Start with Auto**: Always begin with automatic calculations
2. **Document Rationale**: Note why specific overrides are necessary  
3. **Review Warnings**: Carefully consider all warnings before proceeding
4. **Test Incrementally**: Make one override at a time to understand impacts

### For Implementation Teams

1. **Validate Physically**: Ensure overridden configurations match physical constraints
2. **Check Cabling**: Verify uplink overrides match actual cable installations
3. **Capacity Planning**: Consider future growth when overriding switch counts

### For Operations Teams

1. **Monitor Issues**: Regularly review configurations for new warnings
2. **Document Exceptions**: Keep records of why overrides were necessary
3. **Review Periodically**: Check if overrides are still needed as requirements change

## Troubleshooting

### Common Issues

**Save Button Disabled**
- Check Issues panel for errors (red items)
- Fix capacity exceeded errors by increasing switch counts or selecting larger models
- Validate port ranges are positive integers

**Unexpected Warnings**
- Review the specific warning message and suggested fix
- Consider if the warning reflects a real concern for your deployment
- Use reset button to see what auto-calculation would suggest

**Override Not Working**
- Ensure you've clicked away from the field to trigger validation
- Check that the value is within reasonable bounds
- Verify field supports manual override (some calculated fields are read-only)

### Getting Help

For complex override scenarios:
1. Export your configuration before making changes
2. Document the specific requirements driving the override
3. Review the Issues panel messages for guidance
4. Consider consulting with network architecture specialists

## Migration from v0.4.0

Existing v0.4.0 configurations automatically work in v0.4.1:
- All values are initially marked as `auto` provenance
- No behavior changes for automatic workflows  
- Override capabilities are available when needed
- No configuration file format changes required

## Limitations

### Current Limitations
- Some complex interdependencies may not be fully captured in rule evaluation
- Performance impact with very large configurations (>1000 endpoints)
- Limited undo/redo for override operations

### Future Enhancements (Roadmap)
- Advanced rule customization for site-specific requirements
- Bulk override operations for similar configurations  
- Integration with external constraint systems
- Enhanced visualization of override impacts

## API Reference

For programmatic usage, the Expert Overrides system exposes:

```typescript
interface FabricSpec {
  // Core configuration
  spineCount: { value: number; origin: 'auto' | 'user' | 'import' }
  leafCount: { value: number; origin: 'auto' | 'user' | 'import' }
  uplinksPerLeaf: { value: number; origin: 'auto' | 'user' | 'import' }
  // ... other fields with provenance
}

interface RuleEvaluation {
  errors: Issue[]     // Block save - must be empty
  warnings: Issue[]   // Allow save - show prominently  
  info: Issue[]       // FYI only
}
```

The rule engine can be invoked directly:

```typescript
import { evaluate } from '@/domain/rules'

const evaluation = evaluate(fabricSpec, derivedTopology, switchCatalog)
const canSave = evaluation.errors.length === 0
```

---

**Expert Overrides** in HNC v0.4.1 provide the flexibility advanced users need while maintaining the safety and simplicity that makes HNC reliable for all users.