/**
 * Class Builder Selector - WP-GFD3
 * Leaf model selection with capability filtering and feasibility analysis
 */

import React, { useMemo, useState } from 'react'
import { 
  checkLeafCapability, 
  type LeafModel, 
  type EndpointProfile,
  type CapabilityCheckResult,
  DEFAULT_LEAF_MODELS 
} from '../../domain/leaf-capability-filter.js'

interface ClassBuilderSelectorProps {
  endpointProfiles: EndpointProfile[]
  uplinksPerLeaf?: number
  selectedLeafModel?: string
  onLeafModelSelect: (leafModelId: string) => void
  className?: string
}

interface ModelAnalysis extends CapabilityCheckResult {
  model: LeafModel
}

export function ClassBuilderSelector({
  endpointProfiles,
  uplinksPerLeaf = 4,
  selectedLeafModel,
  onLeafModelSelect,
  className = ''
}: ClassBuilderSelectorProps) {
  const [showDetails, setShowDetails] = useState<string | null>(null)

  const modelAnalyses = useMemo<ModelAnalysis[]>(() => {
    return DEFAULT_LEAF_MODELS.map(model => ({
      model,
      ...checkLeafCapability(model, endpointProfiles, uplinksPerLeaf)
    }))
  }, [endpointProfiles, uplinksPerLeaf])

  const viableModels = modelAnalyses.filter(analysis => analysis.feasible)
  const hasAnyViable = viableModels.length > 0

  const getStatusColor = (analysis: ModelAnalysis): string => {
    if (!analysis.feasible) return 'border-red-200 bg-red-50'
    if (analysis.warnings.length > 0) return 'border-yellow-200 bg-yellow-50'
    return 'border-green-200 bg-green-50'
  }

  const getStatusIcon = (analysis: ModelAnalysis): string => {
    if (!analysis.feasible) return '❌'
    if (analysis.warnings.length > 0) return '⚠️'
    return '✅'
  }

  const formatPortUtilization = (used: number, total: number): string => {
    const percentage = Math.round((used / total) * 100)
    return `${used}/${total} (${percentage}%)`
  }

  const formatBreakouts = (breakouts: Record<string, number>): string => {
    const entries = Object.entries(breakouts)
    if (entries.length === 0) return 'None'
    return entries.map(([speed, count]) => `${count}×${speed}`).join(', ')
  }

  if (endpointProfiles.length === 0) {
    return (
      <div className={`p-4 border border-gray-200 rounded-lg bg-gray-50 ${className}`}>
        <p className="text-sm text-gray-600">
          Configure endpoint profiles first to see viable leaf models
        </p>
      </div>
    )
  }

  if (!hasAnyViable) {
    return (
      <div className={`p-4 border border-red-200 rounded-lg bg-red-50 ${className}`}>
        <h3 className="font-medium text-red-800 mb-2">❌ No Viable Leaf Models</h3>
        <p className="text-sm text-red-700 mb-3">
          Current endpoint requirements cannot be satisfied by any available leaf model.
        </p>
        <div className="space-y-2">
          {modelAnalyses.map(analysis => (
            <div key={analysis.model.id} className="text-xs text-red-600">
              <strong>{analysis.model.name}:</strong> {analysis.errors.join(', ')}
            </div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className={`space-y-3 ${className}`}>
      <div className="flex items-center justify-between">
        <h3 className="font-medium text-gray-900">
          Leaf Model Selection ({viableModels.length} viable)
        </h3>
        <div className="text-xs text-gray-500">
          Profiles: {endpointProfiles.length} | Uplinks: {uplinksPerLeaf}
        </div>
      </div>

      <div className="space-y-2">
        {modelAnalyses
          .filter(analysis => analysis.feasible)
          .map(analysis => {
            const isSelected = selectedLeafModel === analysis.model.id
            const hasWarnings = analysis.warnings.length > 0

            return (
              <div
                key={analysis.model.id}
                className={`
                  border rounded-lg p-3 cursor-pointer transition-all
                  ${getStatusColor(analysis)}
                  ${isSelected ? 'ring-2 ring-blue-500 ring-offset-1' : ''}
                  hover:shadow-sm
                `}
                onClick={() => onLeafModelSelect(analysis.model.id)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-lg">{getStatusIcon(analysis)}</span>
                    <div>
                      <h4 className="font-medium text-gray-900">
                        {analysis.model.name}
                      </h4>
                      <p className="text-xs text-gray-600">
                        {analysis.model.totalPorts} ports • {analysis.model.portTypes.join(', ')} speeds
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-medium text-gray-900">
                      {formatPortUtilization(analysis.portsUsed, analysis.model.totalPorts)}
                    </div>
                    <button
                      className="text-xs text-blue-600 hover:text-blue-800"
                      onClick={(e) => {
                        e.stopPropagation()
                        setShowDetails(showDetails === analysis.model.id ? null : analysis.model.id)
                      }}
                    >
                      {showDetails === analysis.model.id ? 'Hide' : 'Details'}
                    </button>
                  </div>
                </div>

                {hasWarnings && (
                  <div className="mt-2 pt-2 border-t border-yellow-300">
                    <div className="text-xs text-yellow-800">
                      <strong>Warnings:</strong> {analysis.warnings.join(', ')}
                    </div>
                  </div>
                )}

                {showDetails === analysis.model.id && (
                  <div className="mt-3 pt-3 border-t border-gray-300 space-y-2 text-xs">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <div className="font-medium text-gray-700 mb-1">Port Usage</div>
                        <div className="space-y-1">
                          {Object.entries(analysis.portAllocation).map(([speed, count]) => (
                            <div key={speed} className="flex justify-between">
                              <span>{speed}:</span>
                              <span>{count} ports</span>
                            </div>
                          ))}
                        </div>
                      </div>
                      <div>
                        <div className="font-medium text-gray-700 mb-1">Breakouts</div>
                        <div>{formatBreakouts(analysis.breakoutsUsed)}</div>
                      </div>
                    </div>
                    
                    <div>
                      <div className="font-medium text-gray-700 mb-1">Model Specifications</div>
                      <div className="grid grid-cols-2 gap-2">
                        <div>Total Ports: {analysis.model.totalPorts}</div>
                        <div>Port Types: {analysis.model.portTypes.join(', ')}</div>
                        <div>LAG Support: {analysis.model.lagSupport ? 'Yes' : 'No'}</div>
                        <div>LACP Support: {analysis.model.lacpSupport ? 'Yes' : 'No'}</div>
                      </div>
                    </div>

                    {analysis.model.breakoutOptions && (
                      <div>
                        <div className="font-medium text-gray-700 mb-1">Breakout Options</div>
                        <div className="space-y-1">
                          {Object.entries(analysis.model.breakoutOptions).map(([from, options]) => (
                            <div key={from}>
                              <span className="font-medium">{from}:</span> {options.join(', ')}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
      </div>

      {/* Show non-viable models in collapsed section */}
      <div className="border-t border-gray-200 pt-3">
        <details className="group">
          <summary className="cursor-pointer text-sm text-gray-600 hover:text-gray-800">
            Show incompatible models ({modelAnalyses.length - viableModels.length})
          </summary>
          <div className="mt-2 space-y-2">
            {modelAnalyses
              .filter(analysis => !analysis.feasible)
              .map(analysis => (
                <div
                  key={analysis.model.id}
                  className="border border-red-200 rounded-lg p-3 bg-red-50 opacity-60"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-lg">❌</span>
                      <div>
                        <h4 className="font-medium text-red-800">
                          {analysis.model.name}
                        </h4>
                        <p className="text-xs text-red-600">
                          {analysis.errors.join(', ')}
                        </p>
                      </div>
                    </div>
                    <div className="text-xs text-red-600">
                      {analysis.model.totalPorts} ports
                    </div>
                  </div>
                </div>
              ))}
          </div>
        </details>
      </div>
    </div>
  )
}