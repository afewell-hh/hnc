/**
 * EndpointProfileEditor - Component for managing endpoint profiles with advanced QoS and security settings
 * Provides comprehensive configuration for server connection profiles
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
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import {
  Plus,
  Edit2,
  Trash2,
  Star,
  StarOff,
  Shield,
  Gauge,
  Network,
  Server,
  AlertTriangle,
  CheckCircle,
  Info,
  Settings
} from 'lucide-react';

import { ProvChip } from '@/components/ui/ProvChip';
import type {
  LeafClassConfigUI,
  EndpointProfileConfig
} from '@/types/leaf-class-builder.types';
import type { ProvenanceInfo } from '@/.upstream/fabric/ui/src/types/fabric';
import { cn } from '@/lib/utils';

interface EndpointProfileEditorProps {
  leafClass?: LeafClassConfigUI;
  onUpdate: (updates: Partial<LeafClassConfigUI>) => void;
  readOnly?: boolean;
  className?: string;
}

const ENDPOINT_TYPES = [
  { value: 'server', label: 'Server', icon: Server },
  { value: 'storage', label: 'Storage', icon: Server },
  { value: 'compute', label: 'Compute', icon: Server },
  { value: 'network', label: 'Network', icon: Network }
] as const;

const VLAN_MODES = [
  { value: 'access', label: 'Access', description: 'Single VLAN, untagged' },
  { value: 'trunk', label: 'Trunk', description: 'Multiple VLANs, tagged' },
  { value: 'hybrid', label: 'Hybrid', description: 'Mix of tagged and untagged' }
] as const;

const QOS_TRUST_MODES = [
  { value: 'none', label: 'None', description: 'No QoS trust' },
  { value: 'cos', label: 'CoS', description: 'Trust Class of Service' },
  { value: 'dscp', label: 'DSCP', description: 'Trust DSCP marking' }
] as const;

export function EndpointProfileEditor({
  leafClass,
  onUpdate,
  readOnly = false,
  className
}: EndpointProfileEditorProps) {
  const [editingProfile, setEditingProfile] = useState<EndpointProfileConfig | null>(null);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [activeTab, setActiveTab] = useState('basic');

  const profiles = leafClass?.endpointProfiles || [];
  const defaultProfile = profiles.find(p => p.isDefault);

  const profileStats = useMemo(() => {
    return {
      total: profiles.length,
      withQoS: profiles.filter(p => p.qos?.queues && p.qos.queues.length > 0).length,
      withSecurity: profiles.filter(p => 
        p.security?.dhcpSnooping || 
        p.security?.arpInspection || 
        p.security?.portSecurity?.enabled
      ).length,
      withStormControl: profiles.filter(p => p.stormControl?.enabled).length
    };
  }, [profiles]);

  const createDefaultProfile = useCallback((): EndpointProfileConfig => ({
    id: `profile-${Date.now()}`,
    name: `Profile ${profiles.length + 1}`,
    type: 'server',
    portsPerEndpoint: 2,
    vlanMode: 'access',
    count: 10,
    bandwidth: 1000,
    redundancy: false,
    provenance: {
      source: 'user',
      timestamp: new Date().toISOString(),
      comment: 'Created via Endpoint Profile Editor'
    }
  }), [profiles.length]);

  const handleCreateProfile = useCallback(() => {
    const newProfile = createDefaultProfile();
    const updatedProfiles = [...profiles, newProfile];
    
    // Set as default if it's the first profile
    if (profiles.length === 0) {
      newProfile.isDefault = true;
    }
    
    onUpdate({ endpointProfiles: updatedProfiles });
    setEditingProfile(newProfile);
    setShowCreateDialog(false);
  }, [profiles, onUpdate, createDefaultProfile]);

  const handleUpdateProfile = useCallback((profileId: string, updates: Partial<EndpointProfileConfig>) => {
    const updatedProfiles = profiles.map(profile =>
      profile.id === profileId
        ? {
            ...profile,
            ...updates,
            provenance: {
              ...profile.provenance,
              timestamp: new Date().toISOString(),
              comment: 'Updated via Endpoint Profile Editor'
            }
          }
        : profile
    );
    onUpdate({ endpointProfiles: updatedProfiles });
  }, [profiles, onUpdate]);

  const handleDeleteProfile = useCallback((profileId: string) => {
    const profileToDelete = profiles.find(p => p.id === profileId);
    const updatedProfiles = profiles.filter(profile => profile.id !== profileId);
    
    // If deleting the default profile, make the first remaining profile default
    if (profileToDelete?.isDefault && updatedProfiles.length > 0) {
      updatedProfiles[0].isDefault = true;
    }
    
    onUpdate({ endpointProfiles: updatedProfiles });
  }, [profiles, onUpdate]);

  const handleSetDefault = useCallback((profileId: string) => {
    const updatedProfiles = profiles.map(profile => ({
      ...profile,
      isDefault: profile.id === profileId
    }));
    onUpdate({ endpointProfiles: updatedProfiles });
  }, [profiles, onUpdate]);

  const validateProfile = useCallback((profile: EndpointProfileConfig): string[] => {
    const errors: string[] = [];
    
    if (!profile.name.trim()) {
      errors.push('Profile name is required');
    }
    
    if (profile.portsPerEndpoint < 1 || profile.portsPerEndpoint > 8) {
      errors.push('Ports per endpoint must be between 1-8');
    }
    
    if (profile.vlanMode === 'access' && profile.allowedVlans && profile.allowedVlans.length > 1) {
      errors.push('Access mode can only have one VLAN');
    }
    
    if (profile.nativeVlan && profile.vlanMode === 'access') {
      errors.push('Access mode cannot have a native VLAN');
    }
    
    if (profile.qos?.queues) {
      const totalWeight = profile.qos.queues.reduce((sum, q) => sum + q.weight, 0);
      if (totalWeight > 100) {
        errors.push('Total queue weights cannot exceed 100');
      }
    }

    // Check for duplicate names
    const duplicateNames = profiles.filter(p => 
      p.id !== profile.id && p.name === profile.name
    );
    if (duplicateNames.length > 0) {
      errors.push('Profile name must be unique');
    }
    
    return errors;
  }, [profiles]);

  const renderBasicTab = (profile: EndpointProfileConfig) => (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Profile Name</Label>
          <Input
            value={profile.name}
            onChange={(e) => setEditingProfile({
              ...profile,
              name: e.target.value
            })}
            placeholder="Enter profile name"
          />
        </div>
        <div className="space-y-2">
          <Label>Endpoint Type</Label>
          <Select 
            value={profile.type || 'server'} 
            onValueChange={(value) => setEditingProfile({
              ...profile,
              type: value as EndpointProfileConfig['type']
            })}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {ENDPOINT_TYPES.map(type => {
                const Icon = type.icon;
                return (
                  <SelectItem key={type.value} value={type.value}>
                    <div className="flex items-center gap-2">
                      <Icon className="h-4 w-4" />
                      {type.label}
                    </div>
                  </SelectItem>
                );
              })}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="space-y-2">
          <Label>Ports per Endpoint</Label>
          <Input
            type="number"
            min={1}
            max={8}
            value={profile.portsPerEndpoint}
            onChange={(e) => setEditingProfile({
              ...profile,
              portsPerEndpoint: parseInt(e.target.value) || 1
            })}
          />
        </div>
        <div className="space-y-2">
          <Label>Endpoint Count</Label>
          <Input
            type="number"
            min={1}
            value={profile.count || 1}
            onChange={(e) => setEditingProfile({
              ...profile,
              count: parseInt(e.target.value) || 1
            })}
          />
        </div>
        <div className="space-y-2">
          <Label>Bandwidth (Mbps)</Label>
          <Input
            type="number"
            min={1}
            value={profile.bandwidth || 1000}
            onChange={(e) => setEditingProfile({
              ...profile,
              bandwidth: parseInt(e.target.value) || 1000
            })}
          />
        </div>
      </div>

      <div className="space-y-4">
        <div className="space-y-2">
          <Label>VLAN Mode</Label>
          <Select 
            value={profile.vlanMode} 
            onValueChange={(value) => setEditingProfile({
              ...profile,
              vlanMode: value as EndpointProfileConfig['vlanMode']
            })}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {VLAN_MODES.map(mode => (
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

        <div className="flex items-center space-x-2">
          <Switch
            checked={profile.redundancy || false}
            onCheckedChange={(checked) => setEditingProfile({
              ...profile,
              redundancy: checked
            })}
          />
          <Label>Enable Redundancy</Label>
        </div>

        <div className="flex items-center space-x-2">
          <Switch
            checked={profile.esLag || false}
            onCheckedChange={(checked) => setEditingProfile({
              ...profile,
              esLag: checked
            })}
          />
          <Label>ES-LAG Support</Label>
        </div>
      </div>
    </div>
  );

  const renderQoSTab = (profile: EndpointProfileConfig) => (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Trust Mode</Label>
          <Select 
            value={profile.qos?.trustMode || 'none'} 
            onValueChange={(value) => setEditingProfile({
              ...profile,
              qos: {
                ...profile.qos,
                trustMode: value as EndpointProfileConfig['qos']['trustMode']
              }
            })}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {QOS_TRUST_MODES.map(mode => (
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
          <Label>Default CoS</Label>
          <Input
            type="number"
            min={0}
            max={7}
            value={profile.qos?.defaultCos || 0}
            onChange={(e) => setEditingProfile({
              ...profile,
              qos: {
                ...profile.qos,
                defaultCos: parseInt(e.target.value) || 0
              }
            })}
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label>Rate Limits</Label>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label className="text-sm">Ingress (Mbps)</Label>
            <Input
              type="number"
              placeholder="No limit"
              value={profile.qos?.rateLimit?.ingress || ''}
              onChange={(e) => setEditingProfile({
                ...profile,
                qos: {
                  ...profile.qos,
                  rateLimit: {
                    ...profile.qos?.rateLimit,
                    ingress: parseInt(e.target.value) || undefined
                  }
                }
              })}
            />
          </div>
          <div className="space-y-2">
            <Label className="text-sm">Egress (Mbps)</Label>
            <Input
              type="number"
              placeholder="No limit"
              value={profile.qos?.rateLimit?.egress || ''}
              onChange={(e) => setEditingProfile({
                ...profile,
                qos: {
                  ...profile.qos,
                  rateLimit: {
                    ...profile.qos?.rateLimit,
                    egress: parseInt(e.target.value) || undefined
                  }
                }
              })}
            />
          </div>
        </div>
      </div>
    </div>
  );

  const renderSecurityTab = (profile: EndpointProfileConfig) => (
    <div className="space-y-4">
      <div className="space-y-3">
        <div className="flex items-center space-x-2">
          <Switch
            checked={profile.security?.dhcpSnooping || false}
            onCheckedChange={(checked) => setEditingProfile({
              ...profile,
              security: {
                ...profile.security,
                dhcpSnooping: checked
              }
            })}
          />
          <Label>DHCP Snooping</Label>
        </div>

        <div className="flex items-center space-x-2">
          <Switch
            checked={profile.security?.arpInspection || false}
            onCheckedChange={(checked) => setEditingProfile({
              ...profile,
              security: {
                ...profile.security,
                arpInspection: checked
              }
            })}
          />
          <Label>ARP Inspection</Label>
        </div>

        <div className="flex items-center space-x-2">
          <Switch
            checked={profile.security?.bpduGuard || false}
            onCheckedChange={(checked) => setEditingProfile({
              ...profile,
              security: {
                ...profile.security,
                bpduGuard: checked
              }
            })}
          />
          <Label>BPDU Guard</Label>
        </div>
      </div>

      <Separator />

      <div className="space-y-3">
        <div className="flex items-center space-x-2">
          <Switch
            checked={profile.security?.portSecurity?.enabled || false}
            onCheckedChange={(checked) => setEditingProfile({
              ...profile,
              security: {
                ...profile.security,
                portSecurity: {
                  ...profile.security?.portSecurity,
                  enabled: checked
                }
              }
            })}
          />
          <Label>Port Security</Label>
        </div>

        {profile.security?.portSecurity?.enabled && (
          <div className="pl-6 space-y-3">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-sm">Max MAC Addresses</Label>
                <Input
                  type="number"
                  min={1}
                  max={10}
                  value={profile.security?.portSecurity?.maxMac || 1}
                  onChange={(e) => setEditingProfile({
                    ...profile,
                    security: {
                      ...profile.security,
                      portSecurity: {
                        ...profile.security?.portSecurity,
                        maxMac: parseInt(e.target.value) || 1
                      }
                    }
                  })}
                />
              </div>
              <div className="space-y-2">
                <Label className="text-sm">Violation Action</Label>
                <Select
                  value={profile.security?.portSecurity?.violation || 'shutdown'}
                  onValueChange={(value) => setEditingProfile({
                    ...profile,
                    security: {
                      ...profile.security,
                      portSecurity: {
                        ...profile.security?.portSecurity,
                        violation: value as 'shutdown' | 'restrict' | 'protect'
                      }
                    }
                  })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="shutdown">Shutdown</SelectItem>
                    <SelectItem value="restrict">Restrict</SelectItem>
                    <SelectItem value="protect">Protect</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );

  if (!leafClass) {
    return (
      <Alert>
        <Info className="h-4 w-4" />
        <AlertTitle>No Leaf Class Selected</AlertTitle>
        <AlertDescription>
          Select a leaf class to configure its endpoint profiles.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className={cn('endpoint-profile-editor space-y-6', className)}>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Server className="h-5 w-5" />
                Endpoint Profiles
              </CardTitle>
              <CardDescription>
                Configure server connection profiles with QoS, security, and VLAN settings
              </CardDescription>
            </div>
            {!readOnly && (
              <Button onClick={() => setShowCreateDialog(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Add Profile
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {profiles.length === 0 ? (
            <Alert>
              <Info className="h-4 w-4" />
              <AlertTitle>No Endpoint Profiles</AlertTitle>
              <AlertDescription>
                Create endpoint profiles to define how servers connect to your leaf switches.
              </AlertDescription>
            </Alert>
          ) : (
            <div className="space-y-4">
              {/* Stats Overview */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Card>
                  <CardContent className="pt-4">
                    <div className="flex items-center gap-2">
                      <Server className="h-4 w-4" />
                      <div>
                        <p className="text-sm font-medium">Total Profiles</p>
                        <p className="text-2xl font-bold">{profileStats.total}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-4">
                    <div className="flex items-center gap-2">
                      <Gauge className="h-4 w-4" />
                      <div>
                        <p className="text-sm font-medium">With QoS</p>
                        <p className="text-2xl font-bold">{profileStats.withQoS}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-4">
                    <div className="flex items-center gap-2">
                      <Shield className="h-4 w-4" />
                      <div>
                        <p className="text-sm font-medium">With Security</p>
                        <p className="text-2xl font-bold">{profileStats.withSecurity}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-4">
                    <div className="flex items-center gap-2">
                      <Network className="h-4 w-4" />
                      <div>
                        <p className="text-sm font-medium">Storm Control</p>
                        <p className="text-2xl font-bold">{profileStats.withStormControl}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              <Separator />

              {/* Profile List */}
              <div className="space-y-3">
                {profiles.map((profile) => {
                  const errors = validateProfile(profile);
                  const hasErrors = errors.length > 0;

                  return (
                    <Card key={profile.id} className={cn(
                      'transition-colors',
                      hasErrors && 'border-destructive',
                      profile.isDefault && 'ring-2 ring-blue-500'
                    )}>
                      <CardContent className="pt-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <Server className="h-4 w-4" />
                            <div>
                              <div className="flex items-center gap-2">
                                <h4 className="font-medium">{profile.name}</h4>
                                {profile.isDefault && (
                                  <Badge variant="default">
                                    <Star className="h-3 w-3 mr-1" />
                                    Default
                                  </Badge>
                                )}
                                <Badge variant="outline">
                                  {profile.type?.toUpperCase() || 'SERVER'}
                                </Badge>
                                <ProvChip provenance={profile.provenance} size="sm" />
                              </div>
                              <p className="text-sm text-muted-foreground">
                                {profile.portsPerEndpoint} ports • {profile.count || 1} endpoints • {profile.vlanMode} VLAN
                              </p>
                            </div>
                          </div>
                          
                          <div className="flex items-center gap-2">
                            {profile.qos?.queues && profile.qos.queues.length > 0 && (
                              <Badge variant="outline" className="text-xs">
                                <Gauge className="h-3 w-3 mr-1" />
                                QoS
                              </Badge>
                            )}
                            {(profile.security?.dhcpSnooping || profile.security?.portSecurity?.enabled) && (
                              <Badge variant="outline" className="text-xs">
                                <Shield className="h-3 w-3 mr-1" />
                                Security
                              </Badge>
                            )}
                            
                            {hasErrors && (
                              <AlertTriangle className="h-4 w-4 text-destructive" />
                            )}
                            
                            {!readOnly && (
                              <div className="flex items-center gap-2">
                                {!profile.isDefault && (
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => handleSetDefault(profile.id)}
                                    title="Set as default"
                                  >
                                    <StarOff className="h-4 w-4" />
                                  </Button>
                                )}
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => setEditingProfile(profile)}
                                >
                                  <Edit2 className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleDeleteProfile(profile.id)}
                                  disabled={profiles.length === 1}
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
                            <AlertTitle>Profile Issues</AlertTitle>
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

      {/* Create Profile Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Endpoint Profile</DialogTitle>
            <DialogDescription>
              Add a new endpoint profile for this leaf class
            </DialogDescription>
          </DialogHeader>
          <div className="text-center py-4">
            <Server className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              A new profile will be created with default settings that you can customize.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreateProfile}>
              Create Profile
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Profile Dialog */}
      {editingProfile && (
        <Dialog open={!!editingProfile} onOpenChange={() => setEditingProfile(null)}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Edit {editingProfile.name}</DialogTitle>
              <DialogDescription>
                Configure endpoint profile settings
              </DialogDescription>
            </DialogHeader>
            
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="basic">Basic</TabsTrigger>
                <TabsTrigger value="qos">QoS</TabsTrigger>
                <TabsTrigger value="security">Security</TabsTrigger>
              </TabsList>

              <TabsContent value="basic">
                {renderBasicTab(editingProfile)}
              </TabsContent>

              <TabsContent value="qos">
                {renderQoSTab(editingProfile)}
              </TabsContent>

              <TabsContent value="security">
                {renderSecurityTab(editingProfile)}
              </TabsContent>
            </Tabs>

            {/* Validation Errors */}
            {validateProfile(editingProfile).length > 0 && (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>Validation Errors</AlertTitle>
                <AlertDescription>
                  <ul className="list-disc list-inside">
                    {validateProfile(editingProfile).map((error, index) => (
                      <li key={index}>{error}</li>
                    ))}
                  </ul>
                </AlertDescription>
              </Alert>
            )}

            <DialogFooter>
              <Button variant="outline" onClick={() => setEditingProfile(null)}>
                Cancel
              </Button>
              <Button 
                onClick={() => {
                  handleUpdateProfile(editingProfile.id, editingProfile);
                  setEditingProfile(null);
                }}
                disabled={validateProfile(editingProfile).length > 0}
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

export default EndpointProfileEditor;