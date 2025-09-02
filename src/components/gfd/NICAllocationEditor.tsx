/**
 * WP-GPU1: NIC Allocation Editor Component
 * 
 * Visual editor for distributing server NICs between frontend and backend fabrics.
 * Provides drag-and-drop interface, validation feedback, and optimization suggestions.
 */

import React, { useState, useMemo, useCallback } from 'react'
import { Card, CardHeader, CardTitle, CardContent } from '../ui/card'
import { Button } from '../ui/button'
import { Input } from '../ui/input'
import { Label } from '../ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select'
import { Badge } from '../ui/badge'
import { Alert, AlertDescription } from '../ui/alert'
import { Separator } from '../ui/separator'
import { Progress } from '../ui/progress'
import { Tooltip } from '../ui/tooltip'
import type { SharedServerConfig, NicAllocation } from '../../domain/dual-fabric'
import { SharedNicAllocator, createDefaultNicAllocation } from '../../domain/shared-nic-allocator'

interface NICAllocationEditorProps {
  server: SharedServerConfig
  onChange: (allocations: NicAllocation[]) => void
  validationEnabled?: boolean
  showRecommendations?: boolean
}

export const NICAllocationEditor: React.FC<NICAllocationEditorProps> = ({
  server,
  onChange,
  validationEnabled = true,
  showRecommendations = true
}) => {
  const [draggedAllocation, setDraggedAllocation] = useState<number | null>(null)
  
  // Compute validation state
  const validation = useMemo(() => {
    if (!validationEnabled) return { isValid: true, errors: [], warnings: [] }
    return SharedNicAllocator.validateServerAllocation(server)
  }, [server, validationEnabled])
  
  // Compute allocation summary
  const allocationSummary = useMemo(() => {
    const frontend = server.nicAllocations
      .filter(alloc => alloc.targetFabric === 'frontend')
      .reduce((sum, alloc) => sum + alloc.nicCount, 0)
    
    const backend = server.nicAllocations
      .filter(alloc => alloc.targetFabric === 'backend')
      .reduce((sum, alloc) => sum + alloc.nicCount, 0)
    
    const total = frontend + backend
    const unallocated = server.totalNics - total
    
    return {
      frontend,
      backend,
      total,
      unallocated,
      utilizationPercent: server.totalNics > 0 ? (total / server.totalNics) * 100 : 0
    }
  }, [server])
  
  // Handle adding new allocation
  const handleAddAllocation = useCallback((fabricType: 'frontend' | 'backend') => {
    const maxNics = Math.max(1, allocationSummary.unallocated)
    const newAllocation: NicAllocation = {
      nicCount: Math.min(2, maxNics),
      nicSpeed: '25G',
      targetFabric: fabricType,
      purpose: fabricType === 'frontend' ? 'compute' : 'storage'
    }
    
    onChange([...server.nicAllocations, newAllocation])
  }, [server.nicAllocations, allocationSummary.unallocated, onChange])
  
  // Handle removing allocation
  const handleRemoveAllocation = useCallback((index: number) => {
    const updatedAllocations = server.nicAllocations.filter((_, i) => i !== index)
    onChange(updatedAllocations)
  }, [server.nicAllocations, onChange])
  
  // Handle updating allocation
  const handleUpdateAllocation = useCallback((index: number, updates: Partial<NicAllocation>) => {
    const updatedAllocations = server.nicAllocations.map((alloc, i) =>
      i === index ? { ...alloc, ...updates } : alloc
    )
    onChange(updatedAllocations)
  }, [server.nicAllocations, onChange])
  
  // Handle auto-balance
  const handleAutoBalance = useCallback(() => {
    const balanced = createDefaultNicAllocation(server.totalNics, server.serverType)
    onChange(balanced)
  }, [server.totalNics, server.serverType, onChange])
  
  // Handle quick presets
  const handlePreset = useCallback((presetType: 'frontend-heavy' | 'backend-heavy' | 'balanced') => {
    const strategy = {
      strategy: presetType === 'balanced' ? 'balanced' as const : 
                presetType === 'frontend-heavy' ? 'frontend-heavy' as const : 'backend-heavy' as const,
      purposes: []
    }
    
    const allocated = SharedNicAllocator.autoAllocateNics([server], strategy)
    onChange(allocated[0].nicAllocations)
  }, [server, onChange])
  
  return (
    <Card>
      <CardHeader>
        <div className="flex justify-between items-center">
          <CardTitle>NIC Allocation - {server.name}</CardTitle>
          <div className="flex items-center space-x-2">
            <Badge variant={validation.isValid ? 'default' : 'destructive'}>
              {validation.isValid ? 'Valid' : 'Invalid'}
            </Badge>
            <Badge variant="outline">
              {server.totalNics} NICs Total
            </Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Server Info */}
        <div className="grid grid-cols-3 gap-4 text-sm">
          <div>
            <Label>Server Type</Label>
            <div className="font-medium">{server.serverType || 'general-purpose'}</div>
          </div>
          <div>
            <Label>Total NICs</Label>
            <div className="font-medium">{server.totalNics}</div>
          </div>
          <div>
            <Label>Utilization</Label>
            <div className="font-medium">
              {Math.round(allocationSummary.utilizationPercent)}%
            </div>
          </div>
        </div>
        
        {/* Utilization Progress */}
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span>NIC Utilization</span>
            <span>
              {allocationSummary.total}/{server.totalNics} allocated
            </span>
          </div>
          <Progress 
            value={allocationSummary.utilizationPercent} 
            className="h-2"
          />
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>Frontend: {allocationSummary.frontend}</span>
            <span>Backend: {allocationSummary.backend}</span>
            <span>Unallocated: {allocationSummary.unallocated}</span>
          </div>
        </div>
        
        {/* Quick Presets */}
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={() => handlePreset('balanced')}>
            Balanced
          </Button>
          <Button variant="outline" size="sm" onClick={() => handlePreset('frontend-heavy')}>
            Frontend Heavy
          </Button>
          <Button variant="outline" size="sm" onClick={() => handlePreset('backend-heavy')}>
            Backend Heavy
          </Button>
          <Button variant="outline" size="sm" onClick={handleAutoBalance}>
            Auto Balance
          </Button>
        </div>
        
        <Separator />
        
        {/* Validation Messages */}
        {validation.errors.length > 0 && (
          <Alert variant="destructive">
            <AlertDescription>
              <ul className="list-disc list-inside">
                {validation.errors.map((error, idx) => (
                  <li key={idx}>{error}</li>
                ))}
              </ul>
            </AlertDescription>
          </Alert>
        )}
        
        {validation.warnings.length > 0 && (
          <Alert>
            <AlertDescription>
              <ul className="list-disc list-inside">
                {validation.warnings.map((warning, idx) => (
                  <li key={idx}>{warning}</li>
                ))}
              </ul>
            </AlertDescription>
          </Alert>
        )}
        
        {/* NIC Allocations */}
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <Label className="text-base font-medium">NIC Allocations</Label>
            <div className="flex space-x-2">
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => handleAddAllocation('frontend')}
                disabled={allocationSummary.unallocated === 0}
              >
                Add Frontend
              </Button>
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => handleAddAllocation('backend')}
                disabled={allocationSummary.unallocated === 0}
              >
                Add Backend
              </Button>
            </div>
          </div>
          
          <div className="space-y-3">
            {server.nicAllocations.map((allocation, index) => (
              <AllocationRow
                key={index}
                allocation={allocation}
                index={index}
                onUpdate={(updates) => handleUpdateAllocation(index, updates)}
                onRemove={() => handleRemoveAllocation(index)}
                maxNics={server.totalNics}
                isDragging={draggedAllocation === index}
                onDragStart={() => setDraggedAllocation(index)}
                onDragEnd={() => setDraggedAllocation(null)}
              />
            ))}
            
            {server.nicAllocations.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                No NIC allocations configured.
                <br />
                Click "Add Frontend" or "Add Backend" to start.
              </div>
            )}
          </div>
        </div>
        
        {/* Summary */}
        <div className="bg-muted p-4 rounded-lg">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <div className="font-medium text-blue-600">Frontend Fabric</div>
              <div>NICs: {allocationSummary.frontend}</div>
              <div>
                Purposes: {server.nicAllocations
                  .filter(a => a.targetFabric === 'frontend')
                  .map(a => a.purpose || 'general')
                  .join(', ') || 'None'}
              </div>
            </div>
            <div>
              <div className="font-medium text-green-600">Backend Fabric</div>
              <div>NICs: {allocationSummary.backend}</div>
              <div>
                Purposes: {server.nicAllocations
                  .filter(a => a.targetFabric === 'backend')
                  .map(a => a.purpose || 'general')
                  .join(', ') || 'None'}
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

// Individual allocation row component
interface AllocationRowProps {
  allocation: NicAllocation
  index: number
  onUpdate: (updates: Partial<NicAllocation>) => void
  onRemove: () => void
  maxNics: number
  isDragging: boolean
  onDragStart: () => void
  onDragEnd: () => void
}

const AllocationRow: React.FC<AllocationRowProps> = ({
  allocation,
  index,
  onUpdate,
  onRemove,
  maxNics,
  isDragging,
  onDragStart,
  onDragEnd
}) => {
  const fabricColor = allocation.targetFabric === 'frontend' 
    ? 'bg-blue-50 border-blue-200' 
    : 'bg-green-50 border-green-200'
  
  return (
    <div
      className={`p-4 rounded-lg border-2 transition-all ${fabricColor} ${
        isDragging ? 'opacity-50 scale-95' : ''
      }`}
      draggable
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
    >
      <div className="grid grid-cols-5 gap-3 items-center">
        <div>
          <Label className="text-xs">NICs</Label>
          <Input
            type="number"
            min="1"
            max={maxNics}
            value={allocation.nicCount}
            onChange={(e) => onUpdate({ nicCount: parseInt(e.target.value) || 1 })}
            className="h-8"
          />
        </div>
        
        <div>
          <Label className="text-xs">Speed</Label>
          <Select
            value={allocation.nicSpeed}
            onValueChange={(value) => onUpdate({ nicSpeed: value })}
          >
            <SelectTrigger className="h-8">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="1G">1G</SelectItem>
              <SelectItem value="10G">10G</SelectItem>
              <SelectItem value="25G">25G</SelectItem>
              <SelectItem value="40G">40G</SelectItem>
              <SelectItem value="50G">50G</SelectItem>
              <SelectItem value="100G">100G</SelectItem>
              <SelectItem value="200G">200G</SelectItem>
              <SelectItem value="400G">400G</SelectItem>
            </SelectContent>
          </Select>
        </div>
        
        <div>
          <Label className="text-xs">Fabric</Label>
          <Select
            value={allocation.targetFabric}
            onValueChange={(value: 'frontend' | 'backend') => onUpdate({ targetFabric: value })}
          >
            <SelectTrigger className="h-8">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="frontend">Frontend</SelectItem>
              <SelectItem value="backend">Backend</SelectItem>
            </SelectContent>
          </Select>
        </div>
        
        <div>
          <Label className="text-xs">Purpose</Label>
          <Select
            value={allocation.purpose || 'compute'}
            onValueChange={(value: any) => onUpdate({ purpose: value })}
          >
            <SelectTrigger className="h-8">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="compute">Compute</SelectItem>
              <SelectItem value="storage">Storage</SelectItem>
              <SelectItem value="gpu-interconnect">GPU Interconnect</SelectItem>
              <SelectItem value="management">Management</SelectItem>
            </SelectContent>
          </Select>
        </div>
        
        <div className="flex justify-end">
          <Button
            variant="destructive"
            size="sm"
            onClick={onRemove}
          >
            Remove
          </Button>
        </div>
      </div>
      
      {/* LAG Configuration (Future Enhancement) */}
      {allocation.lagConfig?.enabled && (
        <div className="mt-2 p-2 bg-yellow-50 border border-yellow-200 rounded text-xs">
          LAG Enabled: {allocation.lagConfig.minMembers || 2}-{allocation.lagConfig.maxMembers || 8} members
        </div>
      )}
    </div>
  )
}

export default NICAllocationEditor