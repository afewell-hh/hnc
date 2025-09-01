/**
 * AdvancedCRDDrawer - Enhanced CRD field editing interface for WP-TOP1
 * Shows every CRD-mapped field with provenance tracking for leaf class builder
 */

import React, { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ProvChip } from '@/components/ui/ProvChip';
import {
  Settings,
  Search,
  Filter,
  Download,
  Upload,
  AlertTriangle,
  CheckCircle,
  Info,
  Eye,
  EyeOff,
  FileText,
  Database,
  GitBranch,
  Layers,
  RefreshCw,
  Copy
} from 'lucide-react';

import type {
  LeafClassConfigUI,
  CRDFieldMapping
} from '@/types/leaf-class-builder.types';
import type {
  ValidationError,
  ProvenanceInfo,
  CRDField,
  CRDFieldGroup
} from '@/.upstream/fabric/ui/src/types/fabric';
import { CRDFieldEditor } from '@/.upstream/fabric/ui/src/components/CRDFieldEditor';
import { cn } from '@/lib/utils';

interface AdvancedCRDDrawerProps {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  title?: string;
  description?: string;
  crdObject: LeafClassConfigUI | Record<string, unknown>;
  onFieldChange: (fieldPath: string, value: unknown, provenance: ProvenanceInfo) => void;
  onValidate?: () => ValidationError[];
  onExport?: () => void;
  onImport?: (data: Record<string, unknown>) => void;
  enableCRDCompliance?: boolean;
  className?: string;
}

export function AdvancedCRDDrawer({
  open,
  onOpenChange,
  title = 'Advanced CRD Editor',
  description = 'Edit all CRD fields with full provenance tracking',
  crdObject,
  onFieldChange,
  onValidate,
  onExport,
  onImport,
  enableCRDCompliance = true,
  className
}: AdvancedCRDDrawerProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [showOnlyModified, setShowOnlyModified] = useState(false);
  const [activeTab, setActiveTab] = useState('fields');
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set(['metadata', 'spec', 'leafClass']));

  // Generate field groups from CRD object with leaf class specific handling
  const fieldGroups = useMemo(() => {
    const groups: CRDFieldGroup[] = [];

    // CRD Metadata group
    if (crdObject && 'crdFields' in crdObject && crdObject.crdFields?.metadata) {
      groups.push({
        name: 'metadata',
        label: 'CRD Metadata',
        description: 'Kubernetes resource metadata fields',
        fields: generateFieldsFromObject('metadata', crdObject.crdFields.metadata, {
          source: 'auto',
          timestamp: new Date().toISOString(),
          comment: 'CRD metadata fields'
        })
      });
    }

    // CRD Spec group
    if (crdObject && 'crdFields' in crdObject && crdObject.crdFields?.spec) {
      groups.push({
        name: 'spec',
        label: 'CRD Specification',
        description: 'CRD specification fields mapped from leaf class configuration',
        fields: generateFieldsFromObject('spec', crdObject.crdFields.spec, {
          source: 'user',
          timestamp: new Date().toISOString(),
          comment: 'CRD spec fields'
        })
      });
    }

    // Leaf Class specific fields
    if (crdObject && 'id' in crdObject) {
      const leafClass = crdObject as LeafClassConfigUI;
      
      groups.push({
        name: 'leafClass',
        label: 'Leaf Class Configuration',
        description: 'High-level leaf class configuration fields',
        fields: [
          {
            path: 'id',
            label: 'Class ID',
            type: 'string',
            description: 'Unique identifier for this leaf class',
            required: true,
            provenance: leafClass.provenance,
            currentValue: leafClass.id,
            defaultValue: ''
          },
          {
            path: 'name',
            label: 'Class Name',
            type: 'string',
            description: 'Human-readable name for this leaf class',
            required: true,
            provenance: leafClass.provenance,
            currentValue: leafClass.name,
            defaultValue: ''
          },
          {
            path: 'role',
            label: 'Leaf Role',
            type: 'enum',
            enumValues: ['standard', 'border'],
            description: 'Role of leaves in this class within the fabric topology',
            required: true,
            provenance: leafClass.provenance,
            currentValue: leafClass.role,
            defaultValue: 'standard'
          },
          {
            path: 'uplinksPerLeaf',
            label: 'Uplinks Per Leaf',
            type: 'number',
            description: 'Number of uplink connections per leaf switch',
            validation: { min: 1, max: 8 },
            required: true,
            provenance: leafClass.provenance,
            currentValue: leafClass.uplinksPerLeaf,
            defaultValue: 2
          },
          {
            path: 'count',
            label: 'Leaf Count',
            type: 'number',
            description: 'Number of leaf switches in this class',
            validation: { min: 1, max: 100 },
            provenance: leafClass.provenance,
            currentValue: leafClass.count || 1,
            defaultValue: 1
          }
        ]
      });

      // Assignable Ranges group
      if (leafClass.assignableRanges.length > 0) {
        groups.push({
          name: 'ranges',
          label: 'Assignable Ranges',
          description: 'VLAN ranges, port assignments, and resource allocations',
          fields: leafClass.assignableRanges.flatMap((range, index) => [
            {
              path: `assignableRanges.${index}.name`,
              label: `Range ${index + 1} Name`,
              type: 'string' as const,
              description: `Name for ${range.type} range`,
              provenance: range.provenance,
              currentValue: range.name,
              defaultValue: ''
            },
            {
              path: `assignableRanges.${index}.type`,
              label: `Range ${index + 1} Type`,
              type: 'enum' as const,
              enumValues: ['vlan', 'port', 'subnet', 'asn'],
              description: `Type of resource range`,
              provenance: range.provenance,
              currentValue: range.type,
              defaultValue: 'vlan'
            },
            {
              path: `assignableRanges.${index}.range.start`,
              label: `Range ${index + 1} Start`,
              type: 'number' as const,
              description: `Starting value for ${range.type} range`,
              provenance: range.provenance,
              currentValue: range.range.start,
              defaultValue: 1
            },
            {
              path: `assignableRanges.${index}.range.end`,
              label: `Range ${index + 1} End`,
              type: 'number' as const,
              description: `Ending value for ${range.type} range`,
              provenance: range.provenance,
              currentValue: range.range.end,
              defaultValue: 100
            }
          ])
        });
      }

      // Endpoint Profiles group
      if (leafClass.endpointProfiles.length > 0) {
        groups.push({
          name: 'profiles',
          label: 'Endpoint Profiles',
          description: 'Server connection profiles with QoS and security settings',
          fields: leafClass.endpointProfiles.flatMap((profile, index) => [
            {
              path: `endpointProfiles.${index}.name`,
              label: `Profile ${index + 1} Name`,
              type: 'string' as const,
              description: `Name for endpoint profile`,
              provenance: profile.provenance,
              currentValue: profile.name,
              defaultValue: ''
            },
            {
              path: `endpointProfiles.${index}.portsPerEndpoint`,
              label: `Profile ${index + 1} Ports`,
              type: 'number' as const,
              description: `Number of ports per endpoint`,
              validation: { min: 1, max: 8 },
              provenance: profile.provenance,
              currentValue: profile.portsPerEndpoint,
              defaultValue: 2
            },
            {
              path: `endpointProfiles.${index}.vlanMode`,
              label: `Profile ${index + 1} VLAN Mode`,
              type: 'enum' as const,
              enumValues: ['access', 'trunk', 'hybrid'],
              description: `VLAN mode for this profile`,
              provenance: profile.provenance,
              currentValue: profile.vlanMode,
              defaultValue: 'access'
            }
          ])
        });
      }

      // Uplink Groups group
      if (leafClass.uplinkGroups.length > 0) {
        groups.push({
          name: 'uplinks',
          label: 'Uplink Groups',
          description: 'Link aggregation and uplink redundancy configuration',
          fields: leafClass.uplinkGroups.flatMap((group, index) => [
            {
              path: `uplinkGroups.${index}.name`,
              label: `Group ${index + 1} Name`,
              type: 'string' as const,
              description: `Name for uplink group`,
              provenance: group.provenance,
              currentValue: group.name,
              defaultValue: ''
            },
            {
              path: `uplinkGroups.${index}.mode`,
              label: `Group ${index + 1} Mode`,
              type: 'enum' as const,
              enumValues: ['lacp', 'active-backup', 'static'],
              description: `Link aggregation mode`,
              provenance: group.provenance,
              currentValue: group.mode,
              defaultValue: 'lacp'
            }
          ])
        });
      }
    }

    return groups;
  }, [crdObject]);

  const filteredGroups = useMemo(() => {
    return fieldGroups.map(group => ({
      ...group,
      fields: group.fields.filter(field => {
        const matchesSearch = !searchTerm || 
          field.label.toLowerCase().includes(searchTerm.toLowerCase()) ||
          field.path.toLowerCase().includes(searchTerm.toLowerCase());
        
        const matchesFilter = !showOnlyModified || field.provenance.source === 'user';
        
        return matchesSearch && matchesFilter;
      })
    })).filter(group => group.fields.length > 0);
  }, [fieldGroups, searchTerm, showOnlyModified]);

  const validationErrors = useMemo(() => {
    return onValidate ? onValidate() : [];
  }, [onValidate, crdObject]);

  const crdComplianceScore = useMemo(() => {
    const totalFields = fieldGroups.reduce((sum, group) => sum + group.fields.length, 0);
    const crdMappedFields = fieldGroups
      .filter(g => ['metadata', 'spec'].includes(g.name))
      .reduce((sum, group) => sum + group.fields.length, 0);
    return totalFields > 0 ? (crdMappedFields / totalFields) * 100 : 0;
  }, [fieldGroups]);

  const toggleGroupExpansion = (groupName: string) => {
    const newExpanded = new Set(expandedGroups);
    if (newExpanded.has(groupName)) {
      newExpanded.delete(groupName);
    } else {
      newExpanded.add(groupName);
    }
    setExpandedGroups(newExpanded);
  };

  const handleFieldEdit = (field: CRDField, newValue: unknown) => {
    const provenance: ProvenanceInfo = {
      source: 'user',
      timestamp: new Date().toISOString(),
      comment: 'Modified via Advanced CRD Editor'
    };
    onFieldChange(field.path, newValue, provenance);
  };

  const handleFieldReset = (field: CRDField) => {
    const provenance: ProvenanceInfo = {
      source: 'auto',
      timestamp: new Date().toISOString(),
      comment: 'Reset to default value'
    };
    onFieldChange(field.path, field.defaultValue, provenance);
  };

  const handleExportCRD = () => {
    if (onExport) {
      onExport();
    } else {
      // Default export behavior
      const exportData = {
        apiVersion: 'fabric.githedgehog.com/v1beta1',
        kind: 'LeafClass',
        metadata: (crdObject as any).crdFields?.metadata || {},
        spec: (crdObject as any).crdFields?.spec || {},
        status: {}
      };
      console.log('Exporting CRD:', exportData);
      
      // In a real implementation, this would trigger a download
      const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${(crdObject as any).name || 'leaf-class'}-crd.json`;
      link.click();
      URL.revokeObjectURL(url);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className={cn('w-full sm:max-w-4xl', className)}>
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            {title}
          </SheetTitle>
          <SheetDescription>{description}</SheetDescription>
        </SheetHeader>

        <div className="flex flex-col h-full mt-6">
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="fields">Field Editor</TabsTrigger>
              <TabsTrigger value="crd">CRD Preview</TabsTrigger>
              <TabsTrigger value="validation">Validation</TabsTrigger>
            </TabsList>

            <TabsContent value="fields" className="flex-1 flex flex-col">
              {/* Search and Filters */}
              <div className="flex flex-col gap-4 pb-4">
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search fields..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-8"
                    />
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowOnlyModified(!showOnlyModified)}
                    className={showOnlyModified ? 'bg-primary text-primary-foreground' : ''}
                  >
                    <Filter className="h-4 w-4 mr-2" />
                    Modified Only
                  </Button>
                </div>

                {/* Actions */}
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={handleExportCRD}>
                    <Download className="h-4 w-4 mr-2" />
                    Export CRD
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setExpandedGroups(new Set(fieldGroups.map(g => g.name)));
                    }}
                  >
                    <Eye className="h-4 w-4 mr-2" />
                    Expand All
                  </Button>
                  {enableCRDCompliance && (
                    <div className="flex items-center gap-2 text-sm">
                      <span>CRD Compliance:</span>
                      <Progress value={crdComplianceScore} className="w-20" />
                      <span>{Math.round(crdComplianceScore)}%</span>
                    </div>
                  )}
                </div>
              </div>

              <Separator />

              {/* Field Groups */}
              <ScrollArea className="flex-1 mt-4">
                <div className="space-y-4">
                  {filteredGroups.map(group => (
                    <Card key={group.name}>
                      <CardHeader 
                        className="cursor-pointer pb-2" 
                        onClick={() => toggleGroupExpansion(group.name)}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <CardTitle className="text-lg">{group.label}</CardTitle>
                            <Badge variant="secondary">
                              {group.fields.length} fields
                            </Badge>
                          </div>
                          {expandedGroups.has(group.name) ? (
                            <EyeOff className="h-4 w-4" />
                          ) : (
                            <Eye className="h-4 w-4" />
                          )}
                        </div>
                        {group.description && (
                          <p className="text-sm text-muted-foreground">{group.description}</p>
                        )}
                      </CardHeader>

                      {expandedGroups.has(group.name) && (
                        <CardContent className="pt-0">
                          <div className="space-y-4">
                            {group.fields.map(field => (
                              <div key={field.path} className="space-y-2">
                                <div className="flex items-start justify-between">
                                  <div className="flex-1">
                                    <div className="flex items-center gap-2">
                                      <Label className="font-medium">{field.label}</Label>
                                      {field.required && (
                                        <Badge variant="destructive" className="text-xs">Required</Badge>
                                      )}
                                      <ProvChip
                                        provenance={field.provenance}
                                        onEdit={() => console.log('Edit field:', field.path)}
                                        onReset={() => handleFieldReset(field)}
                                        size="sm"
                                      />
                                    </div>
                                    <p className="text-xs text-muted-foreground mt-1">
                                      {field.path}
                                    </p>
                                    {field.description && (
                                      <p className="text-xs text-muted-foreground mt-1">
                                        {field.description}
                                      </p>
                                    )}
                                  </div>
                                </div>

                                <CRDFieldEditor
                                  field={field}
                                  onChange={(value) => handleFieldEdit(field, value)}
                                  validationErrors={validationErrors.filter(e => e.field === field.path)}
                                  readOnly={group.name === 'status'}
                                />
                              </div>
                            ))}
                          </div>
                        </CardContent>
                      )}
                    </Card>
                  ))}
                </div>
              </ScrollArea>
            </TabsContent>

            <TabsContent value="crd" className="flex-1">
              <Card className="h-full">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <FileText className="h-5 w-5" />
                    CRD Preview
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ScrollArea className="h-96">
                    <pre className="text-sm bg-muted p-4 rounded-md overflow-auto">
                      <code>
                        {JSON.stringify({
                          apiVersion: 'fabric.githedgehog.com/v1beta1',
                          kind: 'LeafClass',
                          metadata: (crdObject as any).crdFields?.metadata || {
                            name: (crdObject as any).name || 'leaf-class',
                            namespace: 'default'
                          },
                          spec: (crdObject as any).crdFields?.spec || {
                            role: (crdObject as any).role || 'standard',
                            uplinksPerLeaf: (crdObject as any).uplinksPerLeaf || 2
                          }
                        }, null, 2)}
                      </code>
                    </pre>
                  </ScrollArea>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="validation" className="flex-1">
              <Card className="h-full">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <CheckCircle className="h-5 w-5" />
                    Validation Results
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {validationErrors.length === 0 ? (
                    <Alert>
                      <CheckCircle className="h-4 w-4" />
                      <AlertTitle>All Validations Passed</AlertTitle>
                      <AlertDescription>
                        Your CRD configuration is valid and ready for deployment.
                      </AlertDescription>
                    </Alert>
                  ) : (
                    <div className="space-y-3">
                      {validationErrors.map((error, index) => (
                        <Alert key={index} variant="destructive">
                          <AlertTriangle className="h-4 w-4" />
                          <AlertTitle>Validation Error</AlertTitle>
                          <AlertDescription>
                            <strong>Field:</strong> {error.field}<br />
                            <strong>Message:</strong> {error.message}
                            {error.remediation && (
                              <>
                                <br />
                                <strong>Fix:</strong> {error.remediation}
                              </>
                            )}
                          </AlertDescription>
                        </Alert>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </SheetContent>
    </Sheet>
  );
}

// Helper function to generate fields from object structure
function generateFieldsFromObject(
  basePath: string, 
  obj: Record<string, unknown>, 
  defaultProvenance: ProvenanceInfo
): CRDField[] {
  const fields: CRDField[] = [];

  Object.entries(obj).forEach(([key, value]) => {
    const fieldPath = basePath ? `${basePath}.${key}` : key;
    const fieldType = getFieldType(value);

    fields.push({
      path: fieldPath,
      label: key.charAt(0).toUpperCase() + key.slice(1).replace(/([A-Z])/g, ' $1').trim(),
      type: fieldType,
      description: getFieldDescription(key, fieldType),
      required: isRequiredField(key, basePath),
      provenance: defaultProvenance,
      currentValue: value,
      defaultValue: getDefaultValue(fieldType)
    });

    // Recursively process nested objects (limited depth for UI performance)
    if (fieldType === 'object' && value && typeof value === 'object' && !Array.isArray(value) && basePath.split('.').length < 3) {
      fields.push(...generateFieldsFromObject(fieldPath, value as Record<string, unknown>, defaultProvenance));
    }
  });

  return fields;
}

function getFieldType(value: unknown): CRDField['type'] {
  if (typeof value === 'string') return 'string';
  if (typeof value === 'number') return 'number';
  if (typeof value === 'boolean') return 'boolean';
  if (Array.isArray(value)) return 'array';
  if (typeof value === 'object' && value !== null) return 'object';
  return 'string';
}

function getFieldDescription(fieldName: string, fieldType: CRDField['type']): string {
  const descriptions: Record<string, string> = {
    'name': 'Resource name',
    'namespace': 'Kubernetes namespace',
    'labels': 'Key-value labels for resource identification',
    'annotations': 'Key-value annotations for additional metadata',
    'displayName': 'Human-readable display name',
    'description': 'Resource description',
    'role': 'Switch role in the fabric topology',
    'profile': 'Profile template to apply to this resource',
    'asn': 'Autonomous System Number for BGP routing',
    'ip': 'IP address for management access',
    'vtepIP': 'VXLAN Tunnel Endpoint IP address',
    'protocolIP': 'Protocol IP for routing (BGP Router ID)',
    'uplinksPerLeaf': 'Number of uplink connections per leaf switch',
    'count': 'Number of instances in this class'
  };

  return descriptions[fieldName] || `${fieldType} field`;
}

function isRequiredField(fieldName: string, basePath: string): boolean {
  const requiredFields = {
    'metadata': ['name'],
    'spec': ['role'],
    'leafClass': ['id', 'name', 'role', 'uplinksPerLeaf']
  };

  const pathFields = requiredFields[basePath as keyof typeof requiredFields] || [];
  return pathFields.includes(fieldName);
}

function getDefaultValue(fieldType: CRDField['type']): unknown {
  switch (fieldType) {
    case 'string': return '';
    case 'number': return 0;
    case 'boolean': return false;
    case 'array': return [];
    case 'object': return {};
    default: return null;
  }
}

export default AdvancedCRDDrawer;