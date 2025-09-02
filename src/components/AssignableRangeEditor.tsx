/**
 * AssignableRangeEditor - Component for managing VLAN ranges, port ranges, and other assignable resources
 * Provides visual feedback for range conflicts and utilization
 */

import React, { useState, useCallback, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
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
  AlertTriangle,
  CheckCircle,
  Info,
  Network,
  Hash,
  Server,
  Router
} from 'lucide-react';

import { ProvChip } from '@/components/ui/ProvChip';
import type {
  LeafClassConfigUI,
  AssignableRangeConfig
} from '@/types/leaf-class-builder.types';
import type { ProvenanceInfo } from '@/.upstream/fabric/ui/src/types/fabric';
import { cn } from '@/lib/utils';

interface AssignableRangeEditorProps {
  leafClass?: LeafClassConfigUI;
  onUpdate: (updates: Partial<LeafClassConfigUI>) => void;
  readOnly?: boolean;
  className?: string;
}

const RANGE_TYPE_ICONS = {
  vlan: Network,
  port: Hash,
  subnet: Server,
  asn: Router
} as const;

const RANGE_TYPE_LABELS = {
  vlan: 'VLAN Range',
  port: 'Port Range', 
  subnet: 'Subnet Range',
  asn: 'ASN Range'
} as const;

const RANGE_TYPE_DESCRIPTIONS = {
  vlan: 'VLAN IDs for network segmentation (1-4094)',
  port: 'Physical port assignments (1-48)',
  subnet: 'IP subnet allocations',
  asn: 'Autonomous System Numbers for BGP routing'
} as const;

export function AssignableRangeEditor({
  leafClass,
  onUpdate,
  readOnly = false,
  className
}: AssignableRangeEditorProps) {
  const [editingRange, setEditingRange] = useState<AssignableRangeConfig | null>(null);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [newRangeType, setNewRangeType] = useState<AssignableRangeConfig['type']>('vlan');

  const ranges = leafClass?.assignableRanges || [];

  const rangeStats = useMemo(() => {
    return ranges.reduce((acc, range) => {
      acc[range.type] = (acc[range.type] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
  }, [ranges]);

  const handleCreateRange = useCallback(() => {
    const newRange: AssignableRangeConfig = {
      id: `range-${Date.now()}`,
      name: `${RANGE_TYPE_LABELS[newRangeType]} ${(rangeStats[newRangeType] || 0) + 1}`,
      type: newRangeType,
      range: {
        start: newRangeType === 'vlan' ? 100 : 1,
        end: newRangeType === 'vlan' ? 200 : 10
      },
      allocated: 0,
      available: newRangeType === 'vlan' ? 101 : 10,
      utilization: 0,
      conflicts: [],
      provenance: {
        source: 'user',
        timestamp: new Date().toISOString(),
        comment: 'Created via Assignable Range Editor'
      }
    };

    const updatedRanges = [...ranges, newRange];
    onUpdate({ assignableRanges: updatedRanges });
    setShowCreateDialog(false);
  }, [newRangeType, ranges, rangeStats, onUpdate]);

  const handleUpdateRange = useCallback((rangeId: string, updates: Partial<AssignableRangeConfig>) => {
    const updatedRanges = ranges.map(range =>
      range.id === rangeId
        ? {
            ...range,
            ...updates,
            provenance: {
              ...range.provenance,
              timestamp: new Date().toISOString(),
              comment: 'Updated via Assignable Range Editor'
            }
          }
        : range
    );
    onUpdate({ assignableRanges: updatedRanges });
  }, [ranges, onUpdate]);

  const handleDeleteRange = useCallback((rangeId: string) => {
    const updatedRanges = ranges.filter(range => range.id !== rangeId);
    onUpdate({ assignableRanges: updatedRanges });
  }, [ranges, onUpdate]);

  const validateRange = useCallback((range: AssignableRangeConfig): string[] => {
    const errors: string[] = [];
    
    if (range.range.start >= range.range.end) {
      errors.push('Start value must be less than end value');
    }

    if (range.type === 'vlan') {
      if (range.range.start < 1 || range.range.end > 4094) {
        errors.push('VLAN range must be between 1-4094');
      }
    }

    if (range.type === 'port') {
      if (range.range.start < 1 || range.range.end > 48) {
        errors.push('Port range must be between 1-48');
      }
    }

    // Check for conflicts with other ranges of the same type
    const conflictingRanges = ranges.filter(r => 
      r.id !== range.id && 
      r.type === range.type &&
      ((r.range.start <= range.range.end && r.range.end >= range.range.start))
    );

    if (conflictingRanges.length > 0) {
      errors.push(`Overlaps with ${conflictingRanges.map(r => r.name).join(', ')}`);
    }

    return errors;
  }, [ranges]);

  const getRangeIcon = (type: AssignableRangeConfig['type']) => {
    const Icon = RANGE_TYPE_ICONS[type];
    return <Icon className="h-4 w-4" />;
  };

  const getRangeColor = (utilization: number, hasConflicts: boolean) => {
    if (hasConflicts) return 'text-destructive';
    if (utilization > 80) return 'text-amber-600';
    if (utilization > 50) return 'text-blue-600';
    return 'text-green-600';
  };

  if (!leafClass) {
    return (
      <Alert>
        <Info className="h-4 w-4" />
        <AlertTitle>No Leaf Class Selected</AlertTitle>
        <AlertDescription>
          Select a leaf class to configure its assignable ranges.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className={cn('assignable-range-editor space-y-6', className)}>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Network className="h-5 w-5" />
                Assignable Ranges
              </CardTitle>
              <CardDescription>
                Configure VLAN ranges, port assignments, and other resource allocations
              </CardDescription>
            </div>
            {!readOnly && (
              <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
                <DialogTrigger asChild>
                  <Button>
                    <Plus className="h-4 w-4 mr-2" />
                    Add Range
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Create Assignable Range</DialogTitle>
                    <DialogDescription>
                      Add a new resource range for this leaf class
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label>Range Type</Label>
                      <Select value={newRangeType} onValueChange={(value: AssignableRangeConfig['type']) => setNewRangeType(value)}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="vlan">
                            <div className="flex items-center gap-2">
                              {getRangeIcon('vlan')}
                              VLAN Range
                            </div>
                          </SelectItem>
                          <SelectItem value="port">
                            <div className="flex items-center gap-2">
                              {getRangeIcon('port')}
                              Port Range
                            </div>
                          </SelectItem>
                          <SelectItem value="subnet">
                            <div className="flex items-center gap-2">
                              {getRangeIcon('subnet')}
                              Subnet Range
                            </div>
                          </SelectItem>
                          <SelectItem value="asn">
                            <div className="flex items-center gap-2">
                              {getRangeIcon('asn')}
                              ASN Range
                            </div>
                          </SelectItem>
                        </SelectContent>
                      </Select>
                      <p className="text-sm text-muted-foreground">
                        {RANGE_TYPE_DESCRIPTIONS[newRangeType]}
                      </p>
                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
                      Cancel
                    </Button>
                    <Button onClick={handleCreateRange}>
                      Create Range
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {ranges.length === 0 ? (
            <Alert>
              <Info className="h-4 w-4" />
              <AlertTitle>No Assignable Ranges</AlertTitle>
              <AlertDescription>
                Add resource ranges to enable automatic allocation and management.
              </AlertDescription>
            </Alert>
          ) : (
            <div className="space-y-4">
              {/* Summary Cards */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {Object.entries(RANGE_TYPE_LABELS).map(([type, label]) => {
                  const count = rangeStats[type] || 0;
                  return (
                    <Card key={type}>
                      <CardContent className="pt-4">
                        <div className="flex items-center gap-2">
                          {getRangeIcon(type as AssignableRangeConfig['type'])}
                          <div>
                            <p className="text-sm font-medium">{label}</p>
                            <p className="text-2xl font-bold">{count}</p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>

              <Separator />

              {/* Range List */}
              <div className="space-y-3">
                {ranges.map((range) => {
                  const errors = validateRange(range);
                  const hasConflicts = errors.length > 0;
                  const utilization = range.utilization || 0;

                  return (
                    <Card key={range.id} className={cn(
                      'transition-colors',
                      hasConflicts && 'border-destructive'
                    )}>
                      <CardContent className="pt-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            {getRangeIcon(range.type)}
                            <div>
                              <div className="flex items-center gap-2">
                                <h4 className="font-medium">{range.name}</h4>
                                <Badge variant="outline">
                                  {range.type.toUpperCase()}
                                </Badge>
                                <ProvChip provenance={range.provenance} size="sm" />
                              </div>
                              <p className="text-sm text-muted-foreground">
                                Range: {range.range.start} - {range.range.end}
                                {range.description && ` • ${range.description}`}
                              </p>
                            </div>
                          </div>
                          
                          <div className="flex items-center gap-4">
                            <div className="text-right">
                              <div className="flex items-center gap-2">
                                <span className={cn(
                                  "text-sm font-medium",
                                  getRangeColor(utilization, hasConflicts)
                                )}>
                                  {range.allocated || 0} / {range.available || (range.range.end - range.range.start + 1)}
                                </span>
                                {hasConflicts && (
                                  <AlertTriangle className="h-4 w-4 text-destructive" />
                                )}
                              </div>
                              <Progress 
                                value={utilization} 
                                className="w-20"
                                data-utilization={utilization}
                              />
                            </div>
                            
                            {!readOnly && (
                              <div className="flex items-center gap-2">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => setEditingRange(range)}
                                >
                                  <Edit2 className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleDeleteRange(range.id)}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Conflicts Display */}
                        {hasConflicts && (
                          <Alert className="mt-3" variant="destructive">
                            <AlertTriangle className="h-4 w-4" />
                            <AlertTitle>Range Conflicts</AlertTitle>
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

      {/* Edit Range Dialog */}
      {editingRange && (
        <Dialog open={!!editingRange} onOpenChange={() => setEditingRange(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Edit {editingRange.name}</DialogTitle>
              <DialogDescription>
                Modify the assignable range configuration
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Name</Label>
                  <Input
                    value={editingRange.name}
                    onChange={(e) => setEditingRange({
                      ...editingRange,
                      name: e.target.value
                    })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Type</Label>
                  <Select 
                    value={editingRange.type} 
                    onValueChange={(value: AssignableRangeConfig['type']) => 
                      setEditingRange({
                        ...editingRange,
                        type: value
                      })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="vlan">VLAN Range</SelectItem>
                      <SelectItem value="port">Port Range</SelectItem>
                      <SelectItem value="subnet">Subnet Range</SelectItem>
                      <SelectItem value="asn">ASN Range</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Description</Label>
                <Input
                  value={editingRange.description || ''}
                  onChange={(e) => setEditingRange({
                    ...editingRange,
                    description: e.target.value
                  })}
                  placeholder="Enter description (optional)"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Start</Label>
                  <Input
                    type="number"
                    value={editingRange.range.start}
                    onChange={(e) => setEditingRange({
                      ...editingRange,
                      range: {
                        ...editingRange.range,
                        start: parseInt(e.target.value) || 1
                      }
                    })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>End</Label>
                  <Input
                    type="number"
                    value={editingRange.range.end}
                    onChange={(e) => setEditingRange({
                      ...editingRange,
                      range: {
                        ...editingRange.range,
                        end: parseInt(e.target.value) || 1
                      }
                    })}
                  />
                </div>
              </div>

              {/* Validation Errors */}
              {validateRange(editingRange).length > 0 && (
                <Alert variant="destructive">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertTitle>Validation Errors</AlertTitle>
                  <AlertDescription>
                    <ul className="list-disc list-inside">
                      {validateRange(editingRange).map((error, index) => (
                        <li key={index}>{error}</li>
                      ))}
                    </ul>
                  </AlertDescription>
                </Alert>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setEditingRange(null)}>
                Cancel
              </Button>
              <Button 
                onClick={() => {
                  handleUpdateRange(editingRange.id, editingRange);
                  setEditingRange(null);
                }}
                disabled={validateRange(editingRange).length > 0}
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

export default AssignableRangeEditor;