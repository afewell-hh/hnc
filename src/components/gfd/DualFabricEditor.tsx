/**
 * WP-GPU1: Dual-Fabric Editor Component
 * 
 * Main UI component for configuring dual-fabric specifications with shared server NICs.
 * Provides intuitive interface for GPU/AI use cases requiring frontend and backend fabrics.
 */

import React, { useState, useCallback, useMemo } from 'react'
import { Card, CardHeader, CardTitle, CardContent } from '../ui/card'
import { Button } from '../ui/button'
import { Input } from '../ui/input'
import { Label } from '../ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select'
import { Badge } from '../ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs'
import { Alert, AlertDescription } from '../ui/alert'
import { Separator } from '../ui/separator'
import { Switch } from '../ui/switch'
import { NICAllocationEditor } from './NICAllocationEditor'
import { FabricConfigEditor } from './FabricConfigEditor'
import { DualFabricValidationPanel } from './DualFabricValidationPanel'
import { SharedResourceSummary } from './SharedResourceSummary'
import type { 
  DualFabricSpec, 
  SharedServerConfig, 
  NicAllocation,
  DualFabricValidation 
} from '../../domain/dual-fabric'
import { createDualFabricTemplate } from '../../domain/dual-fabric'
import { CrossFabricValidator } from '../../domain/cross-fabric-validator'
import { SharedNicAllocator } from '../../domain/shared-nic-allocator'

interface DualFabricEditorProps {
  spec: DualFabricSpec
  onChange: (spec: DualFabricSpec) => void
  onCompile?: () => void
  onReset?: () => void
  validationErrors?: string[]
  isComputing?: boolean
}

export const DualFabricEditor: React.FC<DualFabricEditorProps> = ({
  spec,
  onChange,
  onCompile,
  onReset,
  validationErrors = [],
  isComputing = false
}) => {
  const [activeTab, setActiveTab] = useState('overview')
  const [selectedServerId, setSelectedServerId] = useState<string | null>(null)
  const [autoOptimizeEnabled, setAutoOptimizeEnabled] = useState(false)
  
  // Compute validation in real-time
  const validation = useMemo(() => {
    return CrossFabricValidator.quickValidate(spec)
  }, [spec])
  
  // Compute NIC allocation analysis
  const nicAnalysis = useMemo(() => {
    return SharedNicAllocator.analyzeNicAllocation(spec)
  }, [spec])
  
  // Handle template selection
  const handleTemplateSelect = useCallback((useCase: 'ai-training' | 'gpu-rendering' | 'hpc' | 'custom') => {
    const template = createDualFabricTemplate(useCase)
    onChange({
      ...spec,
      ...template,
      id: spec.id, // Preserve existing ID
      name: template.name || spec.name
    } as DualFabricSpec)
  }, [spec, onChange])
  
  // Handle fabric configuration changes
  const handleFabricChange = useCallback((fabricType: 'frontend' | 'backend', fabricSpec: any) => {
    onChange({
      ...spec,
      [fabricType]: fabricSpec
    })
  }, [spec, onChange])
  
  // Handle server NIC allocation changes
  const handleServerNicChange = useCallback((serverId: string, allocations: NicAllocation[]) => {
    const updatedServers = spec.sharedServers.map(server =>
      server.id === serverId
        ? { ...server, nicAllocations: allocations }
        : server
    )
    
    onChange({
      ...spec,
      sharedServers: updatedServers
    })
  }, [spec, onChange])
  
  // Handle adding new server
  const handleAddServer = useCallback(() => {
    const newServer: SharedServerConfig = {
      id: `server-${Date.now()}`,
      name: `Server-${spec.sharedServers.length + 1}`,
      totalNics: 6,
      serverType: 'gpu-compute',
      nicAllocations: [
        {
          nicCount: 4,
          nicSpeed: '25G',
          targetFabric: 'frontend',
          purpose: 'compute'
        },
        {
          nicCount: 2,
          nicSpeed: '100G',
          targetFabric: 'backend',
          purpose: 'storage'
        }
      ]
    }
    
    onChange({
      ...spec,
      sharedServers: [...spec.sharedServers, newServer]
    })
  }, [spec, onChange])
  
  // Handle removing server
  const handleRemoveServer = useCallback((serverId: string) => {
    const updatedServers = spec.sharedServers.filter(server => server.id !== serverId)
    onChange({
      ...spec,
      sharedServers: updatedServers
    })
    
    if (selectedServerId === serverId) {
      setSelectedServerId(null)
    }
  }, [spec, onChange, selectedServerId])
  
  // Handle auto-optimization
  const handleAutoOptimize = useCallback(() => {
    const optimized = SharedNicAllocator.optimizeNicAllocation(spec)
    onChange(optimized)
  }, [spec, onChange])
  
  // Handle metadata changes
  const handleMetadataChange = useCallback((field: string, value: any) => {
    onChange({
      ...spec,
      metadata: {
        ...spec.metadata,
        [field]: value
      }
    })
  }, [spec, onChange])
  
  const selectedServer = selectedServerId 
    ? spec.sharedServers.find(s => s.id === selectedServerId)
    : null
  
  return (
    <div className="dual-fabric-editor space-y-6">
      {/* Header */}
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <div>
              <CardTitle className="text-2xl">Dual-Fabric Configuration</CardTitle>
              <div className="text-sm text-muted-foreground mt-1">
                GPU/AI use case with shared server NICs across frontend and backend fabrics
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <Badge variant={validation.nicCountMatches ? 'default' : 'destructive'}>
                NIC Conservation: {validation.nicCountMatches ? 'Valid' : 'Invalid'}
              </Badge>
              <Badge variant={validation.independentTopology ? 'default' : 'destructive'}>
                Topology: {validation.independentTopology ? 'Valid' : 'Invalid'}
              </Badge>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <Label htmlFor="fabric-name">Fabric Name</Label>
              <Input
                id="fabric-name"
                value={spec.name || ''}
                onChange={(e) => onChange({ ...spec, name: e.target.value })}
                placeholder="Enter fabric name"
              />
            </div>
            <div>
              <Label htmlFor="use-case">Use Case Template</Label>
              <Select
                value={spec.metadata?.useCase || 'custom'}
                onValueChange={(value) => handleTemplateSelect(value as any)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select use case" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ai-training">AI Training Cluster</SelectItem>
                  <SelectItem value="gpu-rendering">GPU Rendering Farm</SelectItem>
                  <SelectItem value="hpc">HPC Cluster</SelectItem>
                  <SelectItem value="custom">Custom Configuration</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="description">Description</Label>
              <Input
                id="description"
                value={spec.metadata?.description || ''}
                onChange={(e) => handleMetadataChange('description', e.target.value)}
                placeholder="Brief description"
              />
            </div>
          </div>
        </CardContent>
      </Card>
      
      {/* Validation Alerts */}
      {validation.validationErrors.length > 0 && (
        <Alert variant="destructive">
          <AlertDescription>
            <strong>Validation Errors:</strong>
            <ul className="list-disc list-inside mt-1">
              {validation.validationErrors.map((error, idx) => (
                <li key={idx}>{error}</li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      )}
      
      {validation.warnings.length > 0 && (
        <Alert>
          <AlertDescription>
            <strong>Warnings:</strong>
            <ul className="list-disc list-inside mt-1">
              {validation.warnings.map((warning, idx) => (
                <li key={idx}>{warning}</li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      )}
      
      {/* Main Configuration Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="frontend">Frontend Fabric</TabsTrigger>
          <TabsTrigger value="backend">Backend Fabric</TabsTrigger>
          <TabsTrigger value="servers">Shared Servers</TabsTrigger>
          <TabsTrigger value="validation">Validation</TabsTrigger>
        </TabsList>
        
        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-6">
          <SharedResourceSummary 
            spec={spec}
            nicAnalysis={nicAnalysis}
          />
          
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Frontend Fabric Summary</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span>Name:</span>
                    <span>{spec.frontend.name || 'Unnamed'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Spine Model:</span>
                    <span>{spec.frontend.spineModelId}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Leaf Model:</span>
                    <span>{spec.frontend.leafModelId}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Allocated NICs:</span>
                    <span>{nicAnalysis.currentAllocations.frontend}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader>
                <CardTitle>Backend Fabric Summary</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span>Name:</span>
                    <span>{spec.backend.name || 'Unnamed'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Spine Model:</span>
                    <span>{spec.backend.spineModelId}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Leaf Model:</span>
                    <span>{spec.backend.leafModelId}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Allocated NICs:</span>
                    <span>{nicAnalysis.currentAllocations.backend}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
        
        {/* Frontend Fabric Tab */}
        <TabsContent value="frontend" className="space-y-6">
          <FabricConfigEditor
            fabric={spec.frontend}
            fabricType="frontend"
            onChange={(fabricSpec) => handleFabricChange('frontend', fabricSpec)}
            allocatedEndpoints={nicAnalysis.currentAllocations.frontend}
          />
        </TabsContent>
        
        {/* Backend Fabric Tab */}
        <TabsContent value="backend" className="space-y-6">
          <FabricConfigEditor
            fabric={spec.backend}
            fabricType="backend"
            onChange={(fabricSpec) => handleFabricChange('backend', fabricSpec)}
            allocatedEndpoints={nicAnalysis.currentAllocations.backend}
          />
        </TabsContent>
        
        {/* Shared Servers Tab */}
        <TabsContent value="servers" className="space-y-6">
          <Card>
            <CardHeader>
              <div className="flex justify-between items-center">
                <CardTitle>Shared Servers Configuration</CardTitle>
                <div className="flex items-center space-x-2">
                  <div className="flex items-center space-x-2">
                    <Switch
                      checked={autoOptimizeEnabled}
                      onCheckedChange={setAutoOptimizeEnabled}
                    />
                    <Label>Auto Optimize</Label>
                  </div>
                  {autoOptimizeEnabled && (
                    <Button variant="outline" onClick={handleAutoOptimize}>
                      Optimize NICs
                    </Button>
                  )}
                  <Button onClick={handleAddServer}>Add Server</Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Server List */}
                <div className="space-y-4">
                  <Label>Servers ({spec.sharedServers.length})</Label>
                  <div className="space-y-2 max-h-96 overflow-y-auto">
                    {spec.sharedServers.map((server, idx) => (
                      <Card
                        key={server.id}
                        className={`cursor-pointer transition-colors ${
                          selectedServerId === server.id ? 'bg-muted' : 'hover:bg-muted/50'
                        }`}
                        onClick={() => setSelectedServerId(server.id)}
                      >
                        <CardContent className="p-4">
                          <div className="flex justify-between items-center">
                            <div>
                              <div className="font-medium">{server.name}</div>
                              <div className="text-sm text-muted-foreground">
                                {server.totalNics} NICs • {server.serverType}
                              </div>
                            </div>
                            <div className="flex items-center space-x-2">
                              <Badge variant="outline">
                                F: {server.nicAllocations
                                  .filter(a => a.targetFabric === 'frontend')
                                  .reduce((s, a) => s + a.nicCount, 0)}
                              </Badge>
                              <Badge variant="outline">
                                B: {server.nicAllocations
                                  .filter(a => a.targetFabric === 'backend')
                                  .reduce((s, a) => s + a.nicCount, 0)}
                              </Badge>
                              <Button
                                variant="destructive"
                                size="sm"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  handleRemoveServer(server.id)
                                }}
                              >
                                Remove
                              </Button>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>
                
                {/* NIC Allocation Editor */}
                <div>
                  {selectedServer ? (
                    <NICAllocationEditor
                      server={selectedServer}
                      onChange={(allocations) => handleServerNicChange(selectedServer.id, allocations)}
                      validationEnabled={true}
                    />
                  ) : (
                    <Card>
                      <CardContent className="p-8 text-center text-muted-foreground">
                        Select a server to configure NIC allocations
                      </CardContent>
                    </Card>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        
        {/* Validation Tab */}
        <TabsContent value="validation" className="space-y-6">
          <DualFabricValidationPanel
            spec={spec}
            validation={validation}
            nicAnalysis={nicAnalysis}
          />
        </TabsContent>
      </Tabs>
      
      {/* Action Buttons */}
      <Card>
        <CardContent className="p-4">
          <div className="flex justify-between items-center">
            <div className="text-sm text-muted-foreground">
              {nicAnalysis.totalServers} servers • {nicAnalysis.totalNics} total NICs • 
              {Math.round(nicAnalysis.utilizationScore)}% utilization
            </div>
            <div className="flex space-x-2">
              <Button variant="outline" onClick={onReset}>
                Reset
              </Button>
              <Button
                onClick={onCompile}
                disabled={isComputing || !validation.independentTopology || !validation.nicCountMatches}
              >
                {isComputing ? 'Compiling...' : 'Compile Dual Fabric'}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

export default DualFabricEditor