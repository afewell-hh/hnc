/**
 * UplinkGroupEditor - Component for managing uplink group configurations
 * Handles LACP, active-backup, and static LAG configurations with monitoring
 */

import React, { useState, useCallback, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Plus,
  Edit2,
  Trash2,
  Link,
  AlertTriangle,
  CheckCircle,
  Info,
  Settings,
  Activity,
  ShieldCheck,
  Zap
} from 'lucide-react';

import { ProvChip } from '@/components/ui/ProvChip';
import type {
  LeafClassConfigUI,
  UplinkGroupConfig
} from '@/types/leaf-class-builder.types';
import type { ProvenanceInfo } from '@/.upstream/fabric/ui/src/types/fabric';
import { cn } from '@/lib/utils';

interface UplinkGroupEditorProps {
  leafClass?: LeafClassConfigUI;
  onUpdate: (updates: Partial<LeafClassConfigUI>) => void;
  readOnly?: boolean;
  className?: string;
}

const UPLINK_MODES = [
  { 
    value: 'lacp', 
    label: 'LACP', 
    description: 'Dynamic link aggregation with IEEE 802.3ad',
    icon: Zap,
    features: ['Dynamic aggregation', 'Automatic failover', 'Load balancing']
  },
  { 
    value: 'active-backup', 
    label: 'Active-Backup', 
    description: 'One active link with backup failover',
    icon: ShieldCheck,
    features: ['Simple failover', 'No load balancing', 'Fast recovery']
  },
  { 
    value: 'static', 
    label: 'Static LAG', 
    description: 'Static link aggregation without LACP',
    icon: Link,
    features: ['Manual configuration', 'Static load balancing', 'Simple setup']
  }
] as const;

const LACP_MODES = [
  { value: 'active', label: 'Active', description: 'Initiates LACP negotiation' },
  { value: 'passive', label: 'Passive', description: 'Responds to LACP negotiation' }
] as const;

const LACP_RATES = [
  { value: 'slow', label: 'Slow (30s)', description: 'LACPDU every 30 seconds' },
  { value: 'fast', label: 'Fast (1s)', description: 'LACPDU every 1 second' }
] as const;

const LOAD_BALANCING_MODES = [
  { value: 'round-robin', label: 'Round Robin', description: 'Packets distributed evenly' },
  { value: 'hash-based', label: 'Hash Based', description: 'Flow-based distribution' },
  { value: 'bandwidth', label: 'Bandwidth', description: 'Weighted by link capacity' }
] as const;

export function UplinkGroupEditor({
  leafClass,
  onUpdate,
  readOnly = false,
  className
}: UplinkGroupEditorProps) {
  const [editingGroup, setEditingGroup] = useState<UplinkGroupConfig | null>(null);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [activeTab, setActiveTab] = useState('basic');
  const [selectedMode, setSelectedMode] = useState<UplinkGroupConfig['mode']>('lacp');

  const uplinkGroups = leafClass?.uplinkGroups || [];

  const groupStats = useMemo(() => {
    const stats = {
      total: uplinkGroups.length,
      lacp: uplinkGroups.filter(g => g.mode === 'lacp').length,
      activeBackup: uplinkGroups.filter(g => g.mode === 'active-backup').length,
      static: uplinkGroups.filter(g => g.mode === 'static').length,
      totalPorts: uplinkGroups.reduce((sum, g) => sum + g.ports.length, 0),
      averagePortsPerGroup: uplinkGroups.length > 0 
        ? Math.round(uplinkGroups.reduce((sum, g) => sum + g.ports.length, 0) / uplinkGroups.length) 
        : 0
    };
    return stats;
  }, [uplinkGroups]);

  const availablePorts = useMemo(() => {
    // Generate available uplink ports based on leaf model and uplinks per leaf
    const totalUplinkPorts = leafClass?.uplinksPerLeaf || 2;
    const usedPorts = new Set(uplinkGroups.flatMap(g => g.ports));
    const allPorts = Array.from({ length: totalUplinkPorts }, (_, i) => `uplink-${i + 1}`);
    return allPorts.filter(port => !usedPorts.has(port));
  }, [leafClass?.uplinksPerLeaf, uplinkGroups]);

  const createDefaultGroup = useCallback((): UplinkGroupConfig => ({
    id: `uplink-group-${Date.now()}`,
    name: `Uplink Group ${uplinkGroups.length + 1}`,
    mode: selectedMode,
    ports: [],
    lacpConfig: selectedMode === 'lacp' ? {
      mode: 'active',
      rate: 'slow',
      systemPriority: 32768,
      portPriority: 32768
    } : undefined,
    redundancy: {
      minLinks: 1,
      maxLinks: leafClass?.uplinksPerLeaf || 2,
      failoverDelay: 1000
    },
    monitoring: {
      linkDetection: true,
      loadBalancing: 'hash-based'
    },
    provenance: {
      source: 'user',
      timestamp: new Date().toISOString(),
      comment: 'Created via Uplink Group Editor'
    }
  }), [selectedMode, uplinkGroups.length, leafClass?.uplinksPerLeaf]);

  const handleCreateGroup = useCallback(() => {
    const newGroup = createDefaultGroup();
    const updatedGroups = [...uplinkGroups, newGroup];
    onUpdate({ uplinkGroups: updatedGroups });
    setEditingGroup(newGroup);
    setShowCreateDialog(false);
  }, [uplinkGroups, onUpdate, createDefaultGroup]);

  const handleUpdateGroup = useCallback((groupId: string, updates: Partial<UplinkGroupConfig>) => {
    const updatedGroups = uplinkGroups.map(group =>
      group.id === groupId
        ? {
            ...group,
            ...updates,
            provenance: {
              ...group.provenance,
              timestamp: new Date().toISOString(),
              comment: 'Updated via Uplink Group Editor'
            }
          }
        : group
    );
    onUpdate({ uplinkGroups: updatedGroups });
  }, [uplinkGroups, onUpdate]);

  const handleDeleteGroup = useCallback((groupId: string) => {
    const updatedGroups = uplinkGroups.filter(group => group.id !== groupId);
    onUpdate({ uplinkGroups: updatedGroups });
  }, [uplinkGroups, onUpdate]);

  const validateGroup = useCallback((group: UplinkGroupConfig): string[] => {
    const errors: string[] = [];
    
    if (!group.name.trim()) {
      errors.push('Group name is required');
    }
    
    if (group.ports.length === 0) {
      errors.push('At least one port must be assigned');
    }
    
    if (group.mode === 'lacp' && group.ports.length < 2) {
      errors.push('LACP requires at least 2 ports');
    }
    
    if (group.redundancy) {
      if (group.redundancy.minLinks > group.ports.length) {
        errors.push('Minimum links cannot exceed assigned ports');
      }
      if (group.redundancy.maxLinks && group.redundancy.maxLinks < group.redundancy.minLinks) {
        errors.push('Maximum links cannot be less than minimum links');
      }
    }

    // Check for duplicate names
    const duplicateNames = uplinkGroups.filter(g => 
      g.id !== group.id && g.name === group.name
    );
    if (duplicateNames.length > 0) {
      errors.push('Group name must be unique');
    }

    // Check for port conflicts
    const usedPorts = uplinkGroups
      .filter(g => g.id !== group.id)
      .flatMap(g => g.ports);
    const conflictingPorts = group.ports.filter(port => usedPorts.includes(port));
    if (conflictingPorts.length > 0) {
      errors.push(`Ports already used: ${conflictingPorts.join(', ')}`);
    }
    
    return errors;
  }, [uplinkGroups]);

  const renderModeSelector = () => (
    <div className="space-y-4">
      <Label>Uplink Mode</Label>
      <div className="grid gap-3">
        {UPLINK_MODES.map(mode => {
          const Icon = mode.icon;
          const isSelected = selectedMode === mode.value;
          
          return (
            <Card 
              key={mode.value}
              className={cn(
                'cursor-pointer transition-colors',
                isSelected && 'ring-2 ring-primary'
              )}
              onClick={() => setSelectedMode(mode.value)}
            >
              <CardContent className="pt-4">
                <div className="flex items-start gap-3">
                  <Icon className="h-5 w-5 mt-0.5 text-primary" />
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <h4 className="font-medium">{mode.label}</h4>
                      {isSelected && <Badge>Selected</Badge>}
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">{mode.description}</p>
                    <div className="flex gap-1 mt-2">
                      {mode.features.map(feature => (
                        <Badge key={feature} variant="outline" className="text-xs">
                          {feature}
                        </Badge>
                      ))}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );

  const renderBasicTab = (group: UplinkGroupConfig) => (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Group Name</Label>
          <Input
            value={group.name}
            onChange={(e) => setEditingGroup({
              ...group,
              name: e.target.value
            })}
            placeholder="Enter group name"
          />
        </div>
        <div className="space-y-2">
          <Label>Mode</Label>
          <Select 
            value={group.mode} 
            onValueChange={(value: UplinkGroupConfig['mode']) => setEditingGroup({
              ...group,
              mode: value,
              lacpConfig: value === 'lacp' ? (group.lacpConfig || {
                mode: 'active',
                rate: 'slow',
                systemPriority: 32768,
                portPriority: 32768
              }) : undefined
            })}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {UPLINK_MODES.map(mode => {
                const Icon = mode.icon;
                return (
                  <SelectItem key={mode.value} value={mode.value}>
                    <div className="flex items-center gap-2">
                      <Icon className="h-4 w-4" />
                      {mode.label}
                    </div>
                  </SelectItem>
                );
              })}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-2">
        <Label>Description</Label>
        <Input
          value={group.description || ''}
          onChange={(e) => setEditingGroup({
            ...group,
            description: e.target.value
          })}
          placeholder="Enter description (optional)"
        />
      </div>

      <div className="space-y-2">
        <Label>Assigned Ports</Label>
        <div className="grid grid-cols-4 gap-2">
          {availablePorts.concat(group.ports).map(port => {
            const isSelected = group.ports.includes(port);
            return (
              <Button
                key={port}
                variant={isSelected ? "default" : "outline"}
                size="sm"
                onClick={() => {
                  const newPorts = isSelected
                    ? group.ports.filter(p => p !== port)
                    : [...group.ports, port];
                  setEditingGroup({
                    ...group,
                    ports: newPorts
                  });
                }}
                className="text-xs"
              >
                {port}
              </Button>
            );
          })}
        </div>
        {group.ports.length === 0 && (
          <p className="text-sm text-muted-foreground">Select ports for this uplink group</p>
        )}
      </div>
    </div>
  );

  const renderLACPTab = (group: UplinkGroupConfig) => {
    if (group.mode !== 'lacp') {
      return (
        <Alert>
          <Info className="h-4 w-4" />
          <AlertTitle>LACP Not Available</AlertTitle>
          <AlertDescription>
            LACP configuration is only available when the group mode is set to LACP.
          </AlertDescription>
        </Alert>
      );
    }

    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>LACP Mode</Label>
            <Select 
              value={group.lacpConfig?.mode || 'active'} 
              onValueChange={(value) => setEditingGroup({
                ...group,
                lacpConfig: {
                  ...group.lacpConfig,
                  mode: value as 'active' | 'passive'
                }
              })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {LACP_MODES.map(mode => (
                  <SelectItem key={mode.value} value={mode.value}>
                    <div>
                      <div>{mode.label}</div>
                      <div className="text-xs text-muted-foreground">{mode.description}</div>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>LACP Rate</Label>
            <Select 
              value={group.lacpConfig?.rate || 'slow'} 
              onValueChange={(value) => setEditingGroup({
                ...group,
                lacpConfig: {
                  ...group.lacpConfig,
                  rate: value as 'slow' | 'fast'
                }
              })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {LACP_RATES.map(rate => (
                  <SelectItem key={rate.value} value={rate.value}>
                    <div>
                      <div>{rate.label}</div>
                      <div className="text-xs text-muted-foreground">{rate.description}</div>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>System Priority</Label>
            <Input
              type="number"
              min={1}
              max={65535}
              value={group.lacpConfig?.systemPriority || 32768}
              onChange={(e) => setEditingGroup({
                ...group,
                lacpConfig: {
                  ...group.lacpConfig,
                  systemPriority: parseInt(e.target.value) || 32768
                }
              })}
            />
          </div>
          <div className="space-y-2">
            <Label>Port Priority</Label>
            <Input
              type="number"
              min={1}
              max={65535}
              value={group.lacpConfig?.portPriority || 32768}
              onChange={(e) => setEditingGroup({
                ...group,
                lacpConfig: {
                  ...group.lacpConfig,
                  portPriority: parseInt(e.target.value) || 32768
                }
              })}
            />
          </div>
        </div>
      </div>
    );
  };

  const renderRedundancyTab = (group: UplinkGroupConfig) => (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-4">
        <div className="space-y-2">
          <Label>Min Links</Label>
          <Input
            type="number"
            min={1}
            max={group.ports.length || 1}
            value={group.redundancy?.minLinks || 1}
            onChange={(e) => setEditingGroup({
              ...group,
              redundancy: {
                ...group.redundancy,
                minLinks: parseInt(e.target.value) || 1
              }
            })}
          />
        </div>
        <div className="space-y-2">
          <Label>Max Links</Label>
          <Input
            type="number"
            min={group.redundancy?.minLinks || 1}
            max={group.ports.length || 1}
            value={group.redundancy?.maxLinks || group.ports.length}
            onChange={(e) => setEditingGroup({
              ...group,
              redundancy: {
                ...group.redundancy,
                maxLinks: parseInt(e.target.value) || group.ports.length
              }
            })}
          />
        </div>
        <div className="space-y-2">
          <Label>Failover Delay (ms)</Label>
          <Input
            type="number"
            min={0}
            max={10000}
            value={group.redundancy?.failoverDelay || 1000}
            onChange={(e) => setEditingGroup({
              ...group,
              redundancy: {
                ...group.redundancy,
                failoverDelay: parseInt(e.target.value) || 1000
              }
            })}
          />
        </div>
      </div>

      <Separator />

      <div className="space-y-3">
        <div className="flex items-center space-x-2">
          <Switch
            checked={group.monitoring?.linkDetection || true}
            onCheckedChange={(checked) => setEditingGroup({
              ...group,
              monitoring: {
                ...group.monitoring,
                linkDetection: checked
              }
            })}
          />
          <Label>Link Detection</Label>
        </div>

        <div className="space-y-2">
          <Label>Load Balancing</Label>
          <Select 
            value={group.monitoring?.loadBalancing || 'hash-based'} 
            onValueChange={(value) => setEditingGroup({
              ...group,
              monitoring: {
                ...group.monitoring,
                loadBalancing: value as UplinkGroupConfig['monitoring']['loadBalancing']
              }
            })}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {LOAD_BALANCING_MODES.map(mode => (
                <SelectItem key={mode.value} value={mode.value}>
                  <div>
                    <div>{mode.label}</div>
                    <div className="text-xs text-muted-foreground">{mode.description}</div>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
    </div>
  );

  if (!leafClass) {
    return (
      <Alert>
        <Info className="h-4 w-4" />
        <AlertTitle>No Leaf Class Selected</AlertTitle>
        <AlertDescription>
          Select a leaf class to configure its uplink groups.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className={cn('uplink-group-editor space-y-6', className)}>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Link className="h-5 w-5" />
                Uplink Groups
              </CardTitle>
              <CardDescription>
                Configure link aggregation and uplink redundancy for spine connectivity
              </CardDescription>
            </div>
            {!readOnly && (
              <Button onClick={() => setShowCreateDialog(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Add Group
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {uplinkGroups.length === 0 ? (
            <Alert>
              <Info className="h-4 w-4" />
              <AlertTitle>No Uplink Groups</AlertTitle>
              <AlertDescription>
                Create uplink groups to manage spine connectivity and link aggregation.
              </AlertDescription>
            </Alert>
          ) : (
            <div className="space-y-4">
              {/* Stats Overview */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Card>
                  <CardContent className="pt-4">
                    <div className="flex items-center gap-2">
                      <Link className="h-4 w-4" />
                      <div>
                        <p className="text-sm font-medium">Total Groups</p>
                        <p className="text-2xl font-bold">{groupStats.total}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-4">
                    <div className="flex items-center gap-2">
                      <Zap className="h-4 w-4" />
                      <div>
                        <p className="text-sm font-medium">LACP Groups</p>
                        <p className="text-2xl font-bold">{groupStats.lacp}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-4">
                    <div className="flex items-center gap-2">
                      <Settings className="h-4 w-4" />
                      <div>
                        <p className="text-sm font-medium">Total Ports</p>
                        <p className="text-2xl font-bold">{groupStats.totalPorts}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-4">
                    <div className="flex items-center gap-2">
                      <Activity className="h-4 w-4" />
                      <div>
                        <p className="text-sm font-medium">Avg Ports/Group</p>
                        <p className="text-2xl font-bold">{groupStats.averagePortsPerGroup}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              <Separator />

              {/* Group List */}
              <div className="space-y-3">
                {uplinkGroups.map((group) => {
                  const errors = validateGroup(group);
                  const hasErrors = errors.length > 0;
                  const modeInfo = UPLINK_MODES.find(m => m.value === group.mode);
                  const ModeIcon = modeInfo?.icon || Link;

                  return (
                    <Card key={group.id} className={cn(
                      'transition-colors',
                      hasErrors && 'border-destructive'
                    )}>
                      <CardContent className="pt-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <ModeIcon className="h-4 w-4" />
                            <div>
                              <div className="flex items-center gap-2">
                                <h4 className="font-medium">{group.name}</h4>
                                <Badge variant="outline">
                                  {group.mode.toUpperCase()}
                                </Badge>
                                <ProvChip provenance={group.provenance} size="sm" />
                              </div>
                              <p className="text-sm text-muted-foreground">
                                {group.ports.length} ports • Min: {group.redundancy?.minLinks || 1} • Max: {group.redundancy?.maxLinks || group.ports.length}
                                {group.description && ` • ${group.description}`}
                              </p>
                            </div>
                          </div>
                          
                          <div className="flex items-center gap-4">
                            <div className="text-right">
                              <div className="flex items-center gap-2">
                                <span className="text-sm font-medium">
                                  {group.ports.join(', ')}
                                </span>
                                {hasErrors && (
                                  <AlertTriangle className="h-4 w-4 text-destructive" />
                                )}
                              </div>
                              {group.monitoring?.linkDetection && (
                                <div className="flex items-center gap-1 text-xs text-green-600">
                                  <Activity className="h-3 w-3" />
                                  Monitoring
                                </div>
                              )}
                            </div>
                            
                            {!readOnly && (
                              <div className="flex items-center gap-2">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => setEditingGroup(group)}
                                >
                                  <Edit2 className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleDeleteGroup(group.id)}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            )}
                          </div>
                        </div>

                        {hasErrors && (
                          <Alert className="mt-3" variant="destructive">
                            <AlertTriangle className="h-4 w-4" />
                            <AlertTitle>Group Issues</AlertTitle>
                            <AlertDescription>
                              <ul className="list-disc list-inside">
                                {errors.map((error, index) => (
                                  <li key={index}>{error}</li>
                                ))}
                              </ul>
                            </AlertDescription>
                          </Alert>
                        )}
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create Group Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Create Uplink Group</DialogTitle>
            <DialogDescription>
              Choose the uplink mode and create a new group
            </DialogDescription>
          </DialogHeader>
          {renderModeSelector()}
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreateGroup}>
              Create {UPLINK_MODES.find(m => m.value === selectedMode)?.label} Group
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Group Dialog */}
      {editingGroup && (
        <Dialog open={!!editingGroup} onOpenChange={() => setEditingGroup(null)}>
          <DialogContent className="max-w-3xl">
            <DialogHeader>
              <DialogTitle>Edit {editingGroup.name}</DialogTitle>
              <DialogDescription>
                Configure uplink group settings
              </DialogDescription>
            </DialogHeader>
            
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="basic">Basic</TabsTrigger>
                <TabsTrigger value="lacp">LACP</TabsTrigger>
                <TabsTrigger value="redundancy">Redundancy</TabsTrigger>
              </TabsList>

              <TabsContent value="basic">
                {renderBasicTab(editingGroup)}
              </TabsContent>

              <TabsContent value="lacp">
                {renderLACPTab(editingGroup)}
              </TabsContent>

              <TabsContent value="redundancy">
                {renderRedundancyTab(editingGroup)}
              </TabsContent>
            </Tabs>

            {/* Validation Errors */}
            {validateGroup(editingGroup).length > 0 && (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>Validation Errors</AlertTitle>
                <AlertDescription>
                  <ul className="list-disc list-inside">
                    {validateGroup(editingGroup).map((error, index) => (
                      <li key={index}>{error}</li>
                    ))}
                  </ul>
                </AlertDescription>
              </Alert>
            )}

            <DialogFooter>
              <Button variant="outline" onClick={() => setEditingGroup(null)}>
                Cancel
              </Button>
              <Button 
                onClick={() => {
                  handleUpdateGroup(editingGroup.id, editingGroup);
                  setEditingGroup(null);
                }}
                disabled={validateGroup(editingGroup).length > 0}
              >
                Save Changes
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

export default UplinkGroupEditor;