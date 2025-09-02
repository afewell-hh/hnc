/**
 * LeafClassBuilder - Main component for creating and managing leaf classes
 * Provides a progressive disclosure interface for complex CRD-aligned configuration
 */

import React, { useState, useCallback, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import {
  Plus,
  Settings,
  Network,
  Layers,
  AlertTriangle,
  CheckCircle,
  Info,
  Copy,
  Trash2,
  ChevronDown,
  ChevronRight,
  ExternalLink
} from 'lucide-react';

import { AssignableRangeEditor } from './AssignableRangeEditor';
import { EndpointProfileEditor } from './EndpointProfileEditor';
import { UplinkGroupEditor } from './UplinkGroupEditor';
import { AdvancedCRDDrawer } from './AdvancedCRDDrawer';
import { ProvChip } from '@/components/ui/ProvChip';

import type {
  LeafClassConfigUI,
  TopologyConfig,
  LeafClassBuilderState,
  LeafClassBuilderEvent,
  AssignableRangeConfig,
  EndpointProfileConfig,
  UplinkGroupConfig,
  LeafClassValidationContext
} from '@/types/leaf-class-builder.types';
import type { ValidationError, ProvenanceInfo } from '@/.upstream/fabric/ui/src/types/fabric';
import type { SwitchModel } from '@/schemas/fabric-spec.schema';
import { cn } from '@/lib/utils';

interface LeafClassBuilderProps {
  initialConfig?: TopologyConfig;
  onConfigChange: (config: TopologyConfig) => void;
  onValidate?: (context: LeafClassValidationContext) => ValidationError[];
  enableAdvancedFeatures?: boolean;
  enableCRDExport?: boolean;
  className?: string;
}

export function LeafClassBuilder({
  initialConfig,
  onConfigChange,
  onValidate,
  enableAdvancedFeatures = true,
  enableCRDExport = true,
  className
}: LeafClassBuilderProps) {
  const [state, setState] = useState<LeafClassBuilderState>(() => ({
    currentStep: 'basic',
    leafClasses: initialConfig?.leafClasses || [],
    selectedLeafClassId: undefined,
    showAdvancedDrawer: false,
    hasUnsavedChanges: false,
    validationErrors: [],
    isLoading: false,
    mode: 'create'
  }));

  const [topologyConfig, setTopologyConfig] = useState<TopologyConfig>(
    initialConfig || {
      name: 'New Topology',
      leafClasses: [],
      fabricSettings: {
        spineModel: 'DS3000',
        spineCount: 2,
        fabricASN: 65100
      },
      crdCompliant: true,
      provenance: {
        source: 'user',
        timestamp: new Date().toISOString(),
        comment: 'Created via Leaf Class Builder'
      }
    }
  );

  const selectedLeafClass = useMemo(() => {
    return state.leafClasses.find(lc => lc.id === state.selectedLeafClassId);
  }, [state.leafClasses, state.selectedLeafClassId]);

  const validationProgress = useMemo(() => {
    if (state.leafClasses.length === 0) return 0;
    const validClasses = state.leafClasses.filter(lc => lc.validationState === 'valid').length;
    return (validClasses / state.leafClasses.length) * 100;
  }, [state.leafClasses]);

  const handleEvent = useCallback((event: LeafClassBuilderEvent) => {
    setState(prevState => {
      let newState = { ...prevState };

      switch (event.type) {
        case 'CREATE_LEAF_CLASS':
          const newLeafClass: LeafClassConfigUI = {
            id: `leaf-class-${Date.now()}`,
            name: event.template?.name || `Leaf Class ${prevState.leafClasses.length + 1}`,
            role: 'standard',
            uplinksPerLeaf: 2,
            assignableRanges: [],
            endpointProfiles: [],
            uplinkGroups: [],
            validationState: 'warning',
            hasUnsavedChanges: true,
            provenance: {
              source: 'user',
              timestamp: new Date().toISOString(),
              comment: 'Created via Leaf Class Builder'
            },
            ...event.template
          };
          newState.leafClasses = [...prevState.leafClasses, newLeafClass];
          newState.selectedLeafClassId = newLeafClass.id;
          newState.hasUnsavedChanges = true;
          break;

        case 'SELECT_LEAF_CLASS':
          newState.selectedLeafClassId = event.leafClassId;
          break;

        case 'UPDATE_LEAF_CLASS':
          newState.leafClasses = prevState.leafClasses.map(lc =>
            lc.id === event.leafClassId
              ? {
                  ...lc,
                  ...event.updates,
                  hasUnsavedChanges: true,
                  lastModified: new Date(),
                  provenance: {
                    ...lc.provenance,
                    timestamp: new Date().toISOString(),
                    comment: 'Modified via Leaf Class Builder'
                  }
                }
              : lc
          );
          newState.hasUnsavedChanges = true;
          break;

        case 'DELETE_LEAF_CLASS':
          newState.leafClasses = prevState.leafClasses.filter(lc => lc.id !== event.leafClassId);
          if (newState.selectedLeafClassId === event.leafClassId) {
            newState.selectedLeafClassId = newState.leafClasses[0]?.id;
          }
          newState.hasUnsavedChanges = true;
          break;

        case 'CLONE_LEAF_CLASS':
          const sourceClass = prevState.leafClasses.find(lc => lc.id === event.sourceId);
          if (sourceClass) {
            const clonedClass: LeafClassConfigUI = {
              ...sourceClass,
              id: `leaf-class-${Date.now()}`,
              name: event.newName,
              hasUnsavedChanges: true,
              provenance: {
                source: 'user',
                timestamp: new Date().toISOString(),
                comment: `Cloned from ${sourceClass.name}`
              }
            };
            newState.leafClasses = [...prevState.leafClasses, clonedClass];
            newState.selectedLeafClassId = clonedClass.id;
            newState.hasUnsavedChanges = true;
          }
          break;

        case 'SET_STEP':
          newState.currentStep = event.step;
          break;

        case 'TOGGLE_ADVANCED_DRAWER':
          newState.showAdvancedDrawer = !prevState.showAdvancedDrawer;
          break;

        case 'VALIDATE_ALL':
          // Run validation for all leaf classes
          newState.leafClasses = prevState.leafClasses.map(lc => {
            const context: LeafClassValidationContext = {
              leafClass: lc,
              siblingClasses: prevState.leafClasses.filter(other => other.id !== lc.id),
              fabricSettings: topologyConfig.fabricSettings,
              globalConstraints: {
                maxVlans: 4094,
                maxEndpoints: 1000,
                maxUplinkGroups: 8,
                requiredFields: ['name', 'role', 'uplinksPerLeaf']
              }
            };
            const errors = onValidate ? onValidate(context) : [];
            return {
              ...lc,
              validationState: errors.some(e => e.severity === 'error') 
                ? 'error' 
                : errors.some(e => e.severity === 'warning') 
                  ? 'warning' 
                  : 'valid'
            };
          });
          newState.validationErrors = [];
          break;

        default:
          return prevState;
      }

      return newState;
    });
  }, [onValidate, topologyConfig]);

  const handleConfigUpdate = useCallback(() => {
    const updatedConfig: TopologyConfig = {
      ...topologyConfig,
      leafClasses: state.leafClasses,
      lastValidated: new Date()
    };
    setTopologyConfig(updatedConfig);
    onConfigChange(updatedConfig);
  }, [state.leafClasses, topologyConfig, onConfigChange]);

  const renderLeafClassList = () => (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Layers className="h-5 w-5" />
              Leaf Classes
            </CardTitle>
            <CardDescription>
              Configure leaf switch classes for your fabric topology
            </CardDescription>
          </div>
          <Button onClick={() => handleEvent({ type: 'CREATE_LEAF_CLASS' })}>
            <Plus className="h-4 w-4 mr-2" />
            Add Class
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {state.leafClasses.length === 0 ? (
          <Alert>
            <Info className="h-4 w-4" />
            <AlertTitle>No Leaf Classes</AlertTitle>
            <AlertDescription>
              Start by creating your first leaf class to define switch configurations.
            </AlertDescription>
          </Alert>
        ) : (
          <div className="space-y-3">
            {state.leafClasses.map((leafClass) => (
              <Card
                key={leafClass.id}
                className={cn(
                  'cursor-pointer transition-colors',
                  selectedLeafClass?.id === leafClass.id && 'ring-2 ring-primary',
                  leafClass.validationState === 'error' && 'border-destructive',
                  leafClass.validationState === 'warning' && 'border-amber-500',
                  leafClass.validationState === 'valid' && 'border-green-500'
                )}
                onClick={() => handleEvent({ type: 'SELECT_LEAF_CLASS', leafClassId: leafClass.id })}
              >
                <CardContent className="pt-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-2">
                        <h4 className="font-medium">{leafClass.name}</h4>
                        <Badge variant={leafClass.role === 'standard' ? 'default' : 'secondary'}>
                          {leafClass.role}
                        </Badge>
                        <ProvChip
                          provenance={leafClass.provenance}
                          size="sm"
                        />
                      </div>
                      {leafClass.hasUnsavedChanges && (
                        <Badge variant="outline" className="text-xs">
                          Unsaved
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-xs">
                        {leafClass.endpointProfiles.length} profiles
                      </Badge>
                      <Badge variant="outline" className="text-xs">
                        {leafClass.assignableRanges.length} ranges
                      </Badge>
                      {leafClass.validationState === 'valid' && (
                        <CheckCircle className="h-4 w-4 text-green-600" />
                      )}
                      {leafClass.validationState === 'warning' && (
                        <AlertTriangle className="h-4 w-4 text-amber-600" />
                      )}
                      {leafClass.validationState === 'error' && (
                        <AlertTriangle className="h-4 w-4 text-destructive" />
                      )}
                    </div>
                  </div>
                  <p className="text-sm text-muted-foreground mt-2">
                    {leafClass.description || 'No description provided'}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );

  const renderBasicConfiguration = () => {
    if (!selectedLeafClass) {
      return (
        <Alert>
          <Info className="h-4 w-4" />
          <AlertTitle>Select a Leaf Class</AlertTitle>
          <AlertDescription>
            Choose a leaf class from the list to configure its basic properties.
          </AlertDescription>
        </Alert>
      );
    }

    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Basic Configuration
          </CardTitle>
          <CardDescription>
            Configure the fundamental properties of the leaf class
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="leafclass-name">Name</Label>
              <Input
                id="leafclass-name"
                value={selectedLeafClass.name}
                onChange={(e) =>
                  handleEvent({
                    type: 'UPDATE_LEAF_CLASS',
                    leafClassId: selectedLeafClass.id,
                    updates: { name: e.target.value }
                  })
                }
                placeholder="Enter leaf class name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="leafclass-role">Role</Label>
              <Select
                value={selectedLeafClass.role}
                onValueChange={(value: 'standard' | 'border') =>
                  handleEvent({
                    type: 'UPDATE_LEAF_CLASS',
                    leafClassId: selectedLeafClass.id,
                    updates: { role: value }
                  })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="standard">Standard Leaf</SelectItem>
                  <SelectItem value="border">Border Leaf</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="leafclass-description">Description</Label>
            <Input
              id="leafclass-description"
              value={selectedLeafClass.description || ''}
              onChange={(e) =>
                handleEvent({
                  type: 'UPDATE_LEAF_CLASS',
                  leafClassId: selectedLeafClass.id,
                  updates: { description: e.target.value }
                })
              }
              placeholder="Enter description (optional)"
            />
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="uplinks-per-leaf">Uplinks Per Leaf</Label>
              <Input
                id="uplinks-per-leaf"
                type="number"
                min={1}
                max={4}
                value={selectedLeafClass.uplinksPerLeaf}
                onChange={(e) =>
                  handleEvent({
                    type: 'UPDATE_LEAF_CLASS',
                    leafClassId: selectedLeafClass.id,
                    updates: { uplinksPerLeaf: parseInt(e.target.value) || 2 }
                  })
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="leaf-count">Leaf Count</Label>
              <Input
                id="leaf-count"
                type="number"
                min={1}
                max={100}
                value={selectedLeafClass.count || 1}
                onChange={(e) =>
                  handleEvent({
                    type: 'UPDATE_LEAF_CLASS',
                    leafClassId: selectedLeafClass.id,
                    updates: { count: parseInt(e.target.value) || 1 }
                  })
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="leaf-model">Leaf Model</Label>
              <Select
                value={selectedLeafClass.leafModelId || topologyConfig.fabricSettings.spineModel}
                onValueChange={(value: SwitchModel) =>
                  handleEvent({
                    type: 'UPDATE_LEAF_CLASS',
                    leafClassId: selectedLeafClass.id,
                    updates: { leafModelId: value }
                  })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="DS2000">DS2000 (48-port)</SelectItem>
                  <SelectItem value="DS3000">DS3000 (32-port)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex items-center gap-4 pt-4">
            <Button
              onClick={() => handleEvent({ type: 'VALIDATE_ALL' })}
              variant="outline"
            >
              <CheckCircle className="h-4 w-4 mr-2" />
              Validate
            </Button>
            {enableAdvancedFeatures && (
              <Button
                onClick={() => handleEvent({ type: 'TOGGLE_ADVANCED_DRAWER' })}
                variant="outline"
              >
                <ExternalLink className="h-4 w-4 mr-2" />
                Advanced
              </Button>
            )}
            <div className="flex-1" />
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <span>Validation Progress:</span>
              <Progress value={validationProgress} className="w-20" />
              <span>{Math.round(validationProgress)}%</span>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  };

  return (
    <div className={cn('leaf-class-builder space-y-6', className)}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Leaf Class Builder</h1>
          <p className="text-muted-foreground">
            Create and configure leaf switch classes for your fabric topology
          </p>
        </div>
        {state.hasUnsavedChanges && (
          <Alert className="w-auto">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>You have unsaved changes</AlertDescription>
          </Alert>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Leaf Class List */}
        <div className="lg:col-span-1">
          {renderLeafClassList()}
        </div>

        {/* Configuration Panel */}
        <div className="lg:col-span-2">
          <Tabs value={state.currentStep} onValueChange={(value) => 
            handleEvent({ type: 'SET_STEP', step: value as LeafClassBuilderState['currentStep'] })
          }>
            <TabsList className="grid w-full grid-cols-5">
              <TabsTrigger value="basic">Basic</TabsTrigger>
              <TabsTrigger value="ranges">Ranges</TabsTrigger>
              <TabsTrigger value="profiles">Profiles</TabsTrigger>
              <TabsTrigger value="uplinks">Uplinks</TabsTrigger>
              <TabsTrigger value="validation">Validate</TabsTrigger>
            </TabsList>

            <TabsContent value="basic" className="space-y-4">
              {renderBasicConfiguration()}
            </TabsContent>

            <TabsContent value="ranges" className="space-y-4">
              <AssignableRangeEditor
                leafClass={selectedLeafClass}
                onUpdate={(updates) => selectedLeafClass && handleEvent({
                  type: 'UPDATE_LEAF_CLASS',
                  leafClassId: selectedLeafClass.id,
                  updates
                })}
              />
            </TabsContent>

            <TabsContent value="profiles" className="space-y-4">
              <EndpointProfileEditor
                leafClass={selectedLeafClass}
                onUpdate={(updates) => selectedLeafClass && handleEvent({
                  type: 'UPDATE_LEAF_CLASS',
                  leafClassId: selectedLeafClass.id,
                  updates
                })}
              />
            </TabsContent>

            <TabsContent value="uplinks" className="space-y-4">
              <UplinkGroupEditor
                leafClass={selectedLeafClass}
                onUpdate={(updates) => selectedLeafClass && handleEvent({
                  type: 'UPDATE_LEAF_CLASS',
                  leafClassId: selectedLeafClass.id,
                  updates
                })}
              />
            </TabsContent>

            <TabsContent value="validation" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Validation Results</CardTitle>
                  <CardDescription>
                    Review configuration validation and resolve any issues
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Button
                    onClick={() => handleEvent({ type: 'VALIDATE_ALL' })}
                    className="mb-4"
                  >
                    <CheckCircle className="h-4 w-4 mr-2" />
                    Validate All Classes
                  </Button>
                  
                  {state.validationErrors.length === 0 ? (
                    <Alert>
                      <CheckCircle className="h-4 w-4" />
                      <AlertTitle>All Validations Passed</AlertTitle>
                      <AlertDescription>
                        Your leaf class configuration is ready for deployment.
                      </AlertDescription>
                    </Alert>
                  ) : (
                    <div className="space-y-2">
                      {state.validationErrors.map((error, index) => (
                        <Alert key={index} variant="destructive">
                          <AlertTriangle className="h-4 w-4" />
                          <AlertTitle>Validation Error</AlertTitle>
                          <AlertDescription>{error.message}</AlertDescription>
                        </Alert>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>

      {/* Advanced CRD Drawer */}
      {enableAdvancedFeatures && selectedLeafClass && (
        <AdvancedCRDDrawer
          open={state.showAdvancedDrawer}
          onOpenChange={(open) => !open && handleEvent({ type: 'TOGGLE_ADVANCED_DRAWER' })}
          title={`Advanced Settings - ${selectedLeafClass.name}`}
          description="Edit all CRD fields with full provenance tracking"
          crdObject={selectedLeafClass.crdFields || selectedLeafClass}
          onFieldChange={(fieldPath, value, provenance) => {
            // Handle field changes with provenance tracking
            console.log('CRD field changed:', { fieldPath, value, provenance });
          }}
          onValidate={() => {
            // Return validation errors for the current field state
            return [];
          }}
        />
      )}
    </div>
  );
}

export default LeafClassBuilder;