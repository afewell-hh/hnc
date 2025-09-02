/**
 * WP-GPU1: Dual-Fabric Validation Panel Component
 * 
 * Comprehensive validation panel for dual-fabric configurations.
 * Shows cross-fabric constraints, NIC allocation issues, and optimization recommendations.
 */

import React, { useMemo } from 'react'
import { Card, CardHeader, CardTitle, CardContent } from '../ui/card'
import { Badge } from '../ui/badge'
import { Alert, AlertDescription } from '../ui/alert'
import { Progress } from '../ui/progress'
import { Separator } from '../ui/separator'
import { CheckCircle, XCircle, AlertCircle, Info } from 'lucide-react'
import type { 
  DualFabricSpec, 
  DualFabricValidation 
} from '../../domain/dual-fabric'
import type { NicAllocationAnalysis } from '../../domain/shared-nic-allocator'
import { CrossFabricValidator } from '../../domain/cross-fabric-validator'

interface DualFabricValidationPanelProps {
  spec: DualFabricSpec
  validation: DualFabricValidation
  nicAnalysis: NicAllocationAnalysis
}

export const DualFabricValidationPanel: React.FC<DualFabricValidationPanelProps> = ({
  spec,
  validation,
  nicAnalysis
}) => {
  
  // Generate comprehensive validation report
  const comprehensiveValidation = useMemo(() => {
    return CrossFabricValidator.validate(spec)
  }, [spec])
  
  const getStatusIcon = (passed: boolean, severity: 'error' | 'warning' | 'info') => {
    if (passed) {
      return <CheckCircle className="h-4 w-4 text-green-600" />
    }
    
    switch (severity) {
      case 'error':
        return <XCircle className="h-4 w-4 text-red-600" />
      case 'warning':
        return <AlertCircle className="h-4 w-4 text-yellow-600" />
      default:
        return <Info className="h-4 w-4 text-blue-600" />
    }
  }
  
  const getStatusColor = (passed: boolean, severity: 'error' | 'warning' | 'info') => {
    if (passed) return 'text-green-600'
    
    switch (severity) {
      case 'error':
        return 'text-red-600'
      case 'warning':
        return 'text-yellow-600'
      default:
        return 'text-blue-600'
    }
  }
  
  return (
    <div className="space-y-6">
      {/* Overall Validation Status */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            {getStatusIcon(comprehensiveValidation.overall.passed, 'error')}
            <span>Overall Validation Status</span>
            <Badge variant={comprehensiveValidation.overall.passed ? 'default' : 'destructive'}>
              {comprehensiveValidation.overall.passed ? 'PASSED' : 'FAILED'}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-red-600">
                {comprehensiveValidation.overall.errors}
              </div>
              <div className="text-sm text-muted-foreground">Errors</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-yellow-600">
                {comprehensiveValidation.overall.warnings}
              </div>
              <div className="text-sm text-muted-foreground">Warnings</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">
                {comprehensiveValidation.overall.info}
              </div>
              <div className="text-sm text-muted-foreground">Info</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">
                {Math.round(nicAnalysis.utilizationScore)}%
              </div>
              <div className="text-sm text-muted-foreground">NIC Utilization</div>
            </div>
          </div>
          
          {comprehensiveValidation.summary.length > 0 && (
            <div className="mt-4">
              <Alert>
                <AlertDescription>
                  <ul className="list-disc list-inside space-y-1">
                    {comprehensiveValidation.summary.map((item, idx) => (
                      <li key={idx}>{item}</li>
                    ))}
                  </ul>
                </AlertDescription>
              </Alert>
            </div>
          )}
        </CardContent>
      </Card>
      
      {/* Resource Constraints */}
      <Card>
        <CardHeader>
          <CardTitle>Resource Constraints</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {comprehensiveValidation.categories.resource.map((result, idx) => (
              <div key={idx} className="flex items-start space-x-3 p-3 rounded-lg border">
                {getStatusIcon(result.passed, result.constraint.severity)}
                <div className="flex-1">
                  <div className="flex justify-between items-center">
                    <span className="font-medium">{result.constraint.name}</span>
                    <Badge 
                      variant={result.passed ? 'default' : 
                              result.constraint.severity === 'error' ? 'destructive' : 'secondary'}
                    >
                      {result.constraint.severity.toUpperCase()}
                    </Badge>
                  </div>
                  <div className="text-sm text-muted-foreground mt-1">
                    {result.constraint.description}
                  </div>
                  {!result.passed && (
                    <div className={`text-sm mt-2 ${getStatusColor(result.passed, result.constraint.severity)}`}>
                      {result.message}
                    </div>
                  )}
                  {result.recommendation && (
                    <div className="text-sm text-blue-600 mt-1">
                      💡 {result.recommendation}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
      
      {/* Topology Validation */}
      <Card>
        <CardHeader>
          <CardTitle>Topology Validation</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {comprehensiveValidation.categories.topology.map((result, idx) => (
              <div key={idx} className="flex items-start space-x-3 p-3 rounded-lg border">
                {getStatusIcon(result.passed, result.constraint.severity)}
                <div className="flex-1">
                  <div className="flex justify-between items-center">
                    <span className="font-medium">{result.constraint.name}</span>
                    <Badge 
                      variant={result.passed ? 'default' : 
                              result.constraint.severity === 'error' ? 'destructive' : 'secondary'}
                    >
                      {result.constraint.severity.toUpperCase()}
                    </Badge>
                  </div>
                  <div className="text-sm text-muted-foreground mt-1">
                    {result.constraint.description}
                  </div>
                  {!result.passed && (
                    <div className={`text-sm mt-2 ${getStatusColor(result.passed, result.constraint.severity)}`}>
                      {result.message}
                    </div>
                  )}
                  {result.affectedResources.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {result.affectedResources.map((resource, ridx) => (
                        <Badge key={ridx} variant="outline" className="text-xs">
                          {resource}
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
      
      {/* NIC Allocation Issues */}
      {nicAnalysis.issues.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>NIC Allocation Issues</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {nicAnalysis.issues.map((issue, idx) => (
                <Alert 
                  key={idx} 
                  variant={issue.severity === 'high' ? 'destructive' : 'default'}
                >
                  <AlertDescription>
                    <div className="flex justify-between items-center">
                      <span>
                        <strong>Server {issue.serverId}:</strong> {issue.message}
                      </span>
                      <Badge variant="outline">
                        {issue.type}
                      </Badge>
                    </div>
                  </AlertDescription>
                </Alert>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
      
      {/* Performance Analysis */}
      <Card>
        <CardHeader>
          <CardTitle>Performance Analysis</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {comprehensiveValidation.categories.performance.map((result, idx) => (
              <div key={idx} className="flex items-start space-x-3 p-3 rounded-lg border">
                {getStatusIcon(result.passed, result.constraint.severity)}
                <div className="flex-1">
                  <div className="flex justify-between items-center">
                    <span className="font-medium">{result.constraint.name}</span>
                    <Badge variant="outline">
                      {result.constraint.severity.toUpperCase()}
                    </Badge>
                  </div>
                  <div className="text-sm text-muted-foreground mt-1">
                    {result.constraint.description}
                  </div>
                  {result.message && (
                    <div className={`text-sm mt-2 ${getStatusColor(result.passed, result.constraint.severity)}`}>
                      {result.message}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
      
      {/* Recommendations */}
      {comprehensiveValidation.recommendations.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Optimization Recommendations</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {comprehensiveValidation.recommendations.map((recommendation, idx) => (
                <div key={idx} className="p-3 bg-blue-50 rounded-lg border border-blue-200">
                  <div className="flex items-start space-x-2">
                    <Info className="h-4 w-4 text-blue-600 mt-0.5" />
                    <div className="text-sm text-blue-800">{recommendation}</div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
      
      {/* Server-specific Recommendations */}
      {nicAnalysis.recommendations.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Server Optimization Suggestions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {nicAnalysis.recommendations.map((serverRec, idx) => (
                <div key={idx} className="p-4 border rounded-lg">
                  <div className="flex justify-between items-center mb-2">
                    <span className="font-medium">
                      Server {serverRec.serverId.split('-').pop()}
                    </span>
                    <Badge variant={serverRec.efficiency >= 90 ? 'default' : 'secondary'}>
                      {Math.round(serverRec.efficiency)}% Efficient
                    </Badge>
                  </div>
                  
                  <Progress value={serverRec.efficiency} className="mb-3" />
                  
                  {serverRec.reasoning.length > 0 && (
                    <div className="text-sm text-muted-foreground mb-2">
                      <strong>Reasoning:</strong>
                      <ul className="list-disc list-inside mt-1">
                        {serverRec.reasoning.map((reason, ridx) => (
                          <li key={ridx}>{reason}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  
                  {serverRec.warnings.length > 0 && (
                    <div className="text-sm text-yellow-600">
                      <strong>Warnings:</strong>
                      <ul className="list-disc list-inside mt-1">
                        {serverRec.warnings.map((warning, widx) => (
                          <li key={widx}>{warning}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

export default DualFabricValidationPanel