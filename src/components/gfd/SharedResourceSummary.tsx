/**
 * WP-GPU1: Shared Resource Summary Component
 * 
 * Displays high-level summary of shared resources across dual fabrics.
 * Shows NIC utilization, server distribution, and resource efficiency metrics.
 */

import React from 'react'
import { Card, CardHeader, CardTitle, CardContent } from '../ui/card'
import { Badge } from '../ui/badge'
import { Progress } from '../ui/progress'
import { Alert, AlertDescription } from '../ui/alert'
import type { DualFabricSpec } from '../../domain/dual-fabric'
import type { NicAllocationAnalysis } from '../../domain/shared-nic-allocator'

interface SharedResourceSummaryProps {
  spec: DualFabricSpec
  nicAnalysis: NicAllocationAnalysis
}

export const SharedResourceSummary: React.FC<SharedResourceSummaryProps> = ({
  spec,
  nicAnalysis
}) => {
  
  const utilizationColor = (percent: number) => {
    if (percent >= 90) return 'text-green-600'
    if (percent >= 70) return 'text-yellow-600'
    return 'text-red-600'
  }
  
  const getServerTypeDistribution = () => {
    const distribution = spec.sharedServers.reduce((acc, server) => {
      const type = server.serverType || 'general-purpose'
      acc[type] = (acc[type] || 0) + 1
      return acc
    }, {} as Record<string, number>)
    
    return Object.entries(distribution)
  }
  
  const criticalIssues = nicAnalysis.issues.filter(issue => issue.severity === 'high')
  const hasErrors = criticalIssues.length > 0
  
  return (
    <div className="space-y-6">
      {/* Critical Issues Alert */}
      {hasErrors && (
        <Alert variant="destructive">
          <AlertDescription>
            <strong>Critical Issues Found:</strong>
            <ul className="list-disc list-inside mt-1">
              {criticalIssues.map((issue, idx) => (
                <li key={idx}>{issue.message}</li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      )}
      
      {/* Resource Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold">{nicAnalysis.totalServers}</div>
            <div className="text-sm text-muted-foreground">Shared Servers</div>
            <div className="mt-2">
              {getServerTypeDistribution().map(([type, count]) => (
                <Badge key={type} variant="outline" className="mr-1 text-xs">
                  {type}: {count}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold">{nicAnalysis.totalNics}</div>
            <div className="text-sm text-muted-foreground">Total NICs</div>
            <div className="mt-2 text-xs">
              <div className="flex justify-between">
                <span>Frontend:</span>
                <span className="font-medium">{nicAnalysis.currentAllocations.frontend}</span>
              </div>
              <div className="flex justify-between">
                <span>Backend:</span>
                <span className="font-medium">{nicAnalysis.currentAllocations.backend}</span>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className={`text-2xl font-bold ${utilizationColor(nicAnalysis.utilizationScore)}`}>
              {Math.round(nicAnalysis.utilizationScore)}%
            </div>
            <div className="text-sm text-muted-foreground">NIC Utilization</div>
            <Progress 
              value={nicAnalysis.utilizationScore} 
              className="mt-2 h-2"
            />
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold">{nicAnalysis.currentAllocations.unallocated}</div>
            <div className="text-sm text-muted-foreground">Unallocated NICs</div>
            <div className="mt-2">
              {nicAnalysis.currentAllocations.unallocated > 0 ? (
                <Badge variant="secondary">Available for allocation</Badge>
              ) : (
                <Badge variant="default">Fully allocated</Badge>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
      
      {/* Detailed Resource Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* NIC Distribution Chart */}
        <Card>
          <CardHeader>
            <CardTitle>NIC Distribution</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span>Frontend Fabric</span>
                  <span>{nicAnalysis.currentAllocations.frontend} NICs</span>
                </div>
                <Progress 
                  value={nicAnalysis.totalNics > 0 ? (nicAnalysis.currentAllocations.frontend / nicAnalysis.totalNics) * 100 : 0}
                  className="h-3 bg-blue-100"
                />
              </div>
              
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span>Backend Fabric</span>
                  <span>{nicAnalysis.currentAllocations.backend} NICs</span>
                </div>
                <Progress 
                  value={nicAnalysis.totalNics > 0 ? (nicAnalysis.currentAllocations.backend / nicAnalysis.totalNics) * 100 : 0}
                  className="h-3 bg-green-100"
                />
              </div>
              
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span>Unallocated</span>
                  <span>{nicAnalysis.currentAllocations.unallocated} NICs</span>
                </div>
                <Progress 
                  value={nicAnalysis.totalNics > 0 ? (nicAnalysis.currentAllocations.unallocated / nicAnalysis.totalNics) * 100 : 0}
                  className="h-3 bg-gray-200"
                />
              </div>
            </div>
          </CardContent>
        </Card>
        
        {/* Server Performance Summary */}
        <Card>
          <CardHeader>
            <CardTitle>Server Efficiency</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {nicAnalysis.recommendations.slice(0, 3).map((recommendation, idx) => (
                <div key={idx} className="p-3 bg-muted rounded-lg">
                  <div className="flex justify-between items-center">
                    <div className="font-medium text-sm">
                      Server {recommendation.serverId.split('-').pop()}
                    </div>
                    <Badge 
                      variant={recommendation.efficiency >= 90 ? 'default' : 
                              recommendation.efficiency >= 70 ? 'secondary' : 'destructive'}
                    >
                      {Math.round(recommendation.efficiency)}% efficient
                    </Badge>
                  </div>
                  {recommendation.warnings.length > 0 && (
                    <div className="text-xs text-yellow-600 mt-1">
                      {recommendation.warnings[0]}
                    </div>
                  )}
                </div>
              ))}
              
              {nicAnalysis.recommendations.length > 3 && (
                <div className="text-center text-sm text-muted-foreground">
                  +{nicAnalysis.recommendations.length - 3} more servers
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
      
      {/* Resource Efficiency Insights */}
      <Card>
        <CardHeader>
          <CardTitle>Resource Insights</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
            <div className="p-3 bg-blue-50 rounded-lg">
              <div className="font-medium text-blue-800">Frontend Fabric</div>
              <div className="text-blue-600">
                {Math.round((nicAnalysis.currentAllocations.frontend / nicAnalysis.totalNics) * 100)}% of total NICs
              </div>
              <div className="text-xs text-blue-500 mt-1">
                Optimized for compute workloads
              </div>
            </div>
            
            <div className="p-3 bg-green-50 rounded-lg">
              <div className="font-medium text-green-800">Backend Fabric</div>
              <div className="text-green-600">
                {Math.round((nicAnalysis.currentAllocations.backend / nicAnalysis.totalNics) * 100)}% of total NICs
              </div>
              <div className="text-xs text-green-500 mt-1">
                Optimized for storage and interconnect
              </div>
            </div>
            
            <div className="p-3 bg-gray-50 rounded-lg">
              <div className="font-medium text-gray-800">Overall Efficiency</div>
              <div className="text-gray-600">
                {nicAnalysis.utilizationScore.toFixed(1)}% utilization
              </div>
              <div className="text-xs text-gray-500 mt-1">
                {nicAnalysis.utilizationScore >= 90 ? 'Excellent' : 
                 nicAnalysis.utilizationScore >= 70 ? 'Good' : 'Needs optimization'}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

export default SharedResourceSummary