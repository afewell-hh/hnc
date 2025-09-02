/**
 * WP-GPU1: Fabric Configuration Editor
 * 
 * Component for editing individual fabric specifications within dual-fabric mode.
 * Adapts existing single-fabric UI components for dual-fabric context.
 */

import React, { useCallback } from 'react'
import { Card, CardHeader, CardTitle, CardContent } from '../ui/card'
import { Input } from '../ui/input'
import { Label } from '../ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select'
import { Badge } from '../ui/badge'
import { Separator } from '../ui/separator'
import type { FabricSpec } from '../../app.types'

interface FabricConfigEditorProps {
  fabric: FabricSpec
  fabricType: 'frontend' | 'backend'
  onChange: (fabric: FabricSpec) => void
  allocatedEndpoints: number
}

export const FabricConfigEditor: React.FC<FabricConfigEditorProps> = ({
  fabric,
  fabricType,
  onChange,
  allocatedEndpoints
}) => {
  
  const handleFieldChange = useCallback((field: keyof FabricSpec, value: any) => {
    onChange({
      ...fabric,
      [field]: value
    })
  }, [fabric, onChange])
  
  const handleLeafClassChange = useCallback((classId: string, field: string, value: any) => {
    const updatedLeafClasses = fabric.leafClasses?.map(leafClass =>
      leafClass.id === classId
        ? { ...leafClass, [field]: value }
        : leafClass
    ) || []
    
    onChange({
      ...fabric,
      leafClasses: updatedLeafClasses
    })
  }, [fabric, onChange])
  
  const fabricTypeLabel = fabricType === 'frontend' ? 'Frontend' : 'Backend'
  const primaryLeafClass = fabric.leafClasses?.[0]
  
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>{fabricTypeLabel} Fabric Configuration</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Basic Fabric Info */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor={`${fabricType}-name`}>Fabric Name</Label>
              <Input
                id={`${fabricType}-name`}
                value={fabric.name || ''}
                onChange={(e) => handleFieldChange('name', e.target.value)}
                placeholder={`${fabricTypeLabel} fabric name`}
              />
            </div>
            <div className="flex items-center space-x-4">
              <Badge variant="outline">
                {allocatedEndpoints} Allocated NICs
              </Badge>
              <Badge variant={allocatedEndpoints > 0 ? 'default' : 'secondary'}>
                {allocatedEndpoints > 0 ? 'Active' : 'No Endpoints'}
              </Badge>
            </div>
          </div>
          
          {/* Switch Models */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor={`${fabricType}-spine-model`}>Spine Model</Label>
              <Select
                value={fabric.spineModelId}
                onValueChange={(value) => handleFieldChange('spineModelId', value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select spine model" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="DS3000">DS3000 (32-port)</SelectItem>
                  <SelectItem value="DS5000">DS5000 (64-port)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div>
              <Label htmlFor={`${fabricType}-leaf-model`}>Leaf Model</Label>
              <Select
                value={fabric.leafModelId}
                onValueChange={(value) => handleFieldChange('leafModelId', value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select leaf model" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="DS2000">DS2000 (48-port)</SelectItem>
                  <SelectItem value="DS2500">DS2500 (64-port)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          
          <Separator />
          
          {/* Leaf Class Configuration */}
          {primaryLeafClass && (
            <div className="space-y-4">
              <Label className="text-base font-medium">Primary Leaf Class</Label>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <Label>Class Name</Label>
                  <Input
                    value={primaryLeafClass.name}
                    onChange={(e) => handleLeafClassChange(primaryLeafClass.id, 'name', e.target.value)}
                    placeholder="Leaf class name"
                  />
                </div>
                
                <div>
                  <Label>Uplinks per Leaf</Label>
                  <Select
                    value={primaryLeafClass.uplinksPerLeaf.toString()}
                    onValueChange={(value) => handleLeafClassChange(primaryLeafClass.id, 'uplinksPerLeaf', parseInt(value))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1">1 Uplink</SelectItem>
                      <SelectItem value="2">2 Uplinks</SelectItem>
                      <SelectItem value="4">4 Uplinks</SelectItem>
                      <SelectItem value="8">8 Uplinks</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <div>
                  <Label>Role</Label>
                  <Select
                    value={primaryLeafClass.role}
                    onValueChange={(value) => handleLeafClassChange(primaryLeafClass.id, 'role', value)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="standard">Standard</SelectItem>
                      <SelectItem value="border">Border</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              
              {/* Endpoint Profiles */}
              <div className="space-y-3">
                <Label>Endpoint Profiles</Label>
                {primaryLeafClass.endpointProfiles.map((profile, idx) => (
                  <div key={idx} className="p-3 border rounded-lg bg-muted/50">
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                      <div>
                        <Label className="text-xs">Profile Name</Label>
                        <div className="font-medium">{profile.name}</div>
                      </div>
                      <div>
                        <Label className="text-xs">Ports per Endpoint</Label>
                        <div className="font-medium">{profile.portsPerEndpoint}</div>
                      </div>
                      <div>
                        <Label className="text-xs">Type</Label>
                        <div className="font-medium">{profile.type || 'server'}</div>
                      </div>
                      <div>
                        <Label className="text-xs">Count</Label>
                        <div className="font-medium">
                          {profile.count || Math.floor(allocatedEndpoints / profile.portsPerEndpoint)}
                        </div>
                      </div>
                    </div>
                    
                    {profile.esLag && (
                      <div className="mt-2 text-xs text-blue-600">
                        ES-LAG enabled with {profile.nics || 1} NICs
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
          
          {/* Fabric-specific recommendations */}
          <div className="p-4 bg-muted rounded-lg">
            <Label className="text-sm font-medium">
              {fabricTypeLabel} Fabric Recommendations
            </Label>
            <div className="text-sm text-muted-foreground mt-1">
              {fabricType === 'frontend' ? (
                <ul className="list-disc list-inside space-y-1">
                  <li>Use higher uplink counts for compute-intensive workloads</li>
                  <li>Consider ES-LAG for server redundancy</li>
                  <li>25G/100G speeds typical for compute fabrics</li>
                </ul>
              ) : (
                <ul className="list-disc list-inside space-y-1">
                  <li>Optimize for storage throughput with fewer, higher-speed uplinks</li>
                  <li>100G/400G speeds recommended for storage fabrics</li>
                  <li>Consider MC-LAG for storage redundancy</li>
                </ul>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

export default FabricConfigEditor