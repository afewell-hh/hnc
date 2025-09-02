/**
 * WP-GPU1: Dual-Fabric Demo Stories
 * 
 * Comprehensive demo showcasing complete dual-fabric functionality including:
 * - Configuration UI with all components
 * - BOM generation and analysis
 * - Integration with existing workflows
 * - End-to-end compilation process
 */

import type { Meta, StoryObj } from '@storybook/react'
import { within, expect, userEvent, waitFor } from '@storybook/test'
import React, { useState, useCallback } from 'react'
import { DualFabricEditor } from '../components/gfd/DualFabricEditor'
import { createDualFabricTemplate, type DualFabricSpec } from '../domain/dual-fabric'
import { DualFabricCompiler } from '../io/dual-fabric-compiler'
import { DualFabricBOMGenerator } from '../domain/dual-fabric-bom'
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/card'
import { Button } from '../components/ui/button'
import { Badge } from '../components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs'

// ====================================================================
// COMPREHENSIVE DEMO COMPONENT
// ====================================================================

interface DualFabricDemoProps {
  initialSpec: DualFabricSpec
}

const DualFabricDemo: React.FC<DualFabricDemoProps> = ({ initialSpec }) => {
  const [spec, setSpec] = useState<DualFabricSpec>(initialSpec)
  const [isCompiling, setIsCompiling] = useState(false)
  const [compilationResult, setCompilationResult] = useState<any>(null)
  const [bomResult, setBomResult] = useState<any>(null)
  const [activeTab, setActiveTab] = useState('config')
  
  const handleSpecChange = useCallback((updatedSpec: DualFabricSpec) => {
    setSpec(updatedSpec)
    // Clear previous results when spec changes
    setCompilationResult(null)
    setBomResult(null)
  }, [])
  
  const handleCompile = useCallback(async () => {
    setIsCompiling(true)
    try {
      // Compile dual-fabric
      const result = await DualFabricCompiler.compile(spec)
      setCompilationResult(result)
      
      // Generate BOM
      const bom = DualFabricBOMGenerator.generateBOM(spec)
      setBomResult(bom)
      
      // Switch to results tab
      setActiveTab('results')
      
    } catch (error) {
      console.error('Compilation failed:', error)
      setCompilationResult({ error: error.toString() })
    } finally {
      setIsCompiling(false)
    }
  }, [spec])
  
  const handleReset = useCallback(() => {
    setSpec(initialSpec)
    setCompilationResult(null)
    setBomResult(null)
    setActiveTab('config')
  }, [initialSpec])
  
  return (
    <div className="dual-fabric-demo max-w-7xl mx-auto p-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2">WP-GPU1: Dual-Fabric Configuration Demo</h1>
        <p className="text-muted-foreground">
          Complete dual-fabric workflow: configuration → validation → compilation → BOM generation
        </p>
      </div>
      
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="config">Configuration</TabsTrigger>
          <TabsTrigger value="validation">Validation</TabsTrigger>
          <TabsTrigger value="results" disabled={!compilationResult}>
            Compilation Results
          </TabsTrigger>
          <TabsTrigger value="bom" disabled={!bomResult}>
            Bill of Materials
          </TabsTrigger>
        </TabsList>
        
        {/* Configuration Tab */}
        <TabsContent value="config" className="space-y-6">
          <DualFabricEditor
            spec={spec}
            onChange={handleSpecChange}
            onCompile={handleCompile}
            onReset={handleReset}
            isComputing={isCompiling}
          />
        </TabsContent>
        
        {/* Validation Tab */}
        <TabsContent value="validation" className="space-y-6">
          <ValidationSummary spec={spec} />
        </TabsContent>
        
        {/* Results Tab */}
        <TabsContent value="results" className="space-y-6">
          {compilationResult && (
            <CompilationResults result={compilationResult} />
          )}
        </TabsContent>
        
        {/* BOM Tab */}
        <TabsContent value="bom" className="space-y-6">
          {bomResult && (
            <BOMSummary bom={bomResult} />
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}

// ====================================================================
// SUPPORTING COMPONENTS
// ====================================================================

const ValidationSummary: React.FC<{ spec: DualFabricSpec }> = ({ spec }) => {
  const validation = React.useMemo(() => {
    // This would use the actual CrossFabricValidator
    return {
      overall: { passed: true, errors: 0, warnings: 1, info: 2 },
      details: [
        { category: 'Resource', status: 'passed', message: 'NIC conservation validated' },
        { category: 'Topology', status: 'passed', message: 'Independent topologies feasible' },
        { category: 'Performance', status: 'warning', message: 'High oversubscription ratio detected' },
        { category: 'Configuration', status: 'info', message: 'Consider optimizing NIC allocation' }
      ]
    }
  }, [spec])
  
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Validation Summary</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-4 gap-4 text-center">
            <div>
              <div className="text-2xl font-bold text-green-600">
                {validation.overall.passed ? 'PASSED' : 'FAILED'}
              </div>
              <div className="text-sm text-muted-foreground">Overall Status</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-red-600">{validation.overall.errors}</div>
              <div className="text-sm text-muted-foreground">Errors</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-yellow-600">{validation.overall.warnings}</div>
              <div className="text-sm text-muted-foreground">Warnings</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-blue-600">{validation.overall.info}</div>
              <div className="text-sm text-muted-foreground">Info</div>
            </div>
          </div>
          
          <div className="mt-6 space-y-3">
            {validation.details.map((detail, idx) => (
              <div key={idx} className="flex items-center justify-between p-3 bg-muted rounded">
                <span className="font-medium">{detail.category}</span>
                <div className="flex items-center space-x-2">
                  <span className="text-sm">{detail.message}</span>
                  <Badge variant={
                    detail.status === 'passed' ? 'default' :
                    detail.status === 'warning' ? 'secondary' : 'outline'
                  }>
                    {detail.status}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

const CompilationResults: React.FC<{ result: any }> = ({ result }) => {
  if (result.error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-red-600">Compilation Failed</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-red-600">{result.error}</p>
        </CardContent>
      </Card>
    )
  }
  
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Frontend Fabric Results */}
        <Card>
          <CardHeader>
            <CardTitle>Frontend Fabric FGD</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex justify-between">
                <span>Fabric ID:</span>
                <span className="font-mono text-sm">{result.frontendFGD?.fabricId || 'N/A'}</span>
              </div>
              <div className="flex justify-between">
                <span>Spines:</span>
                <span>{result.frontendFGD?.devices?.spines?.length || 0}</span>
              </div>
              <div className="flex justify-between">
                <span>Leaves:</span>
                <span>{result.frontendFGD?.devices?.leaves?.length || 0}</span>
              </div>
              <div className="flex justify-between">
                <span>Servers:</span>
                <span>{result.frontendFGD?.devices?.servers?.length || 0}</span>
              </div>
              <div className="flex justify-between">
                <span>Connections:</span>
                <span>{result.frontendFGD?.connections?.length || 0}</span>
              </div>
            </div>
          </CardContent>
        </Card>
        
        {/* Backend Fabric Results */}
        <Card>
          <CardHeader>
            <CardTitle>Backend Fabric FGD</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex justify-between">
                <span>Fabric ID:</span>
                <span className="font-mono text-sm">{result.backendFGD?.fabricId || 'N/A'}</span>
              </div>
              <div className="flex justify-between">
                <span>Spines:</span>
                <span>{result.backendFGD?.devices?.spines?.length || 0}</span>
              </div>
              <div className="flex justify-between">
                <span>Leaves:</span>
                <span>{result.backendFGD?.devices?.leaves?.length || 0}</span>
              </div>
              <div className="flex justify-between">
                <span>Servers:</span>
                <span>{result.backendFGD?.devices?.servers?.length || 0}</span>
              </div>
              <div className="flex justify-between">
                <span>Connections:</span>
                <span>{result.backendFGD?.connections?.length || 0}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
      
      {/* Shared Resources Summary */}
      <Card>
        <CardHeader>
          <CardTitle>Shared Resources Summary</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold">{result.sharedResources?.totalServers || 0}</div>
              <div className="text-sm text-muted-foreground">Total Servers</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold">{result.sharedResources?.frontendNics || 0}</div>
              <div className="text-sm text-muted-foreground">Frontend NICs</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold">{result.sharedResources?.backendNics || 0}</div>
              <div className="text-sm text-muted-foreground">Backend NICs</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold">
                {Math.round(result.sharedResources?.nicUtilization?.total || 0)}%
              </div>
              <div className="text-sm text-muted-foreground">NIC Utilization</div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

const BOMSummary: React.FC<{ bom: any }> = ({ bom }) => {
  const formatCurrency = (amount: number) => 
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount)
  
  return (
    <div className="space-y-6">
      {/* Cost Summary */}
      <Card>
        <CardHeader>
          <CardTitle>Cost Summary</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">
                {formatCurrency(bom.summary?.subtotalByFabric?.frontend || 0)}
              </div>
              <div className="text-sm text-muted-foreground">Frontend Fabric</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">
                {formatCurrency(bom.summary?.subtotalByFabric?.backend || 0)}
              </div>
              <div className="text-sm text-muted-foreground">Backend Fabric</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-gray-600">
                {formatCurrency(bom.summary?.subtotalByFabric?.shared || 0)}
              </div>
              <div className="text-sm text-muted-foreground">Shared Resources</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-purple-600">
                {formatCurrency(bom.summary?.grandTotal || 0)}
              </div>
              <div className="text-sm text-muted-foreground">Grand Total</div>
            </div>
          </div>
        </CardContent>
      </Card>
      
      {/* Component Breakdown */}
      <Card>
        <CardHeader>
          <CardTitle>Component Breakdown</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {Object.entries(bom.summary?.subtotalByCategory || {}).map(([category, cost]) => (
              <div key={category} className="flex justify-between items-center p-3 bg-muted rounded">
                <span className="font-medium capitalize">{category}</span>
                <div className="text-right">
                  <div className="font-bold">{formatCurrency(cost as number)}</div>
                  <div className="text-sm text-muted-foreground">
                    {Math.round(((cost as number) / (bom.summary?.subtotalByFabric?.total || 1)) * 100)}%
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
      
      {/* Infrastructure Summary */}
      <Card>
        <CardHeader>
          <CardTitle>Infrastructure Requirements</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
            <div>
              <div className="text-2xl font-bold">{bom.metadata?.totalDevices || 0}</div>
              <div className="text-sm text-muted-foreground">Total Devices</div>
            </div>
            <div>
              <div className="text-2xl font-bold">{bom.metadata?.totalCables || 0}</div>
              <div className="text-sm text-muted-foreground">Total Cables</div>
            </div>
            <div>
              <div className="text-2xl font-bold">{Math.round((bom.metadata?.estimatedPowerConsumption || 0) / 1000)}kW</div>
              <div className="text-sm text-muted-foreground">Power Required</div>
            </div>
            <div>
              <div className="text-2xl font-bold">{bom.metadata?.rackSpaceRequired || 0}</div>
              <div className="text-sm text-muted-foreground">Racks Required</div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

// ====================================================================
// STORY DEFINITIONS
// ====================================================================

const meta: Meta<typeof DualFabricDemo> = {
  title: 'WP-GPU1/Complete Dual-Fabric Demo',
  component: DualFabricDemo,
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component: 'Complete dual-fabric workflow demonstration with configuration, validation, compilation, and BOM generation'
      }
    }
  },
  tags: ['autodocs']
}

export default meta
type Story = StoryObj<typeof meta>

// AI Training Demo
export const AITrainingClusterDemo: Story = {
  args: {
    initialSpec: createDualFabricTemplate('ai-training') as DualFabricSpec
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    
    // Verify demo loaded
    await expect(canvas.getByText('WP-GPU1: Dual-Fabric Configuration Demo')).toBeInTheDocument()
    await expect(canvas.getByText('AI Training Cluster')).toBeInTheDocument()
    
    // Test navigation between tabs
    await userEvent.click(canvas.getByText('Validation'))
    await expect(canvas.getByText('Validation Summary')).toBeInTheDocument()
    
    // Go back to configuration
    await userEvent.click(canvas.getByText('Configuration'))
    
    // Test compile functionality
    const compileButton = canvas.getByText('Compile Dual Fabric')
    await userEvent.click(compileButton)
    
    // Wait for compilation to complete and results tab to become available
    await waitFor(async () => {
      const resultsTab = canvas.getByText('Compilation Results')
      expect(resultsTab).not.toBeDisabled()
    }, { timeout: 5000 })
    
    // Check results tab
    await userEvent.click(canvas.getByText('Compilation Results'))
    await expect(canvas.getByText('Frontend Fabric FGD')).toBeInTheDocument()
    await expect(canvas.getByText('Backend Fabric FGD')).toBeInTheDocument()
    
    // Check BOM tab
    await userEvent.click(canvas.getByText('Bill of Materials'))
    await expect(canvas.getByText('Cost Summary')).toBeInTheDocument()
    await expect(canvas.getByText('Component Breakdown')).toBeInTheDocument()
  }
}

// GPU Rendering Demo
export const GPURenderingFarmDemo: Story = {
  args: {
    initialSpec: createDualFabricTemplate('gpu-rendering') as DualFabricSpec
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    
    // Verify rendering farm template
    await expect(canvas.getByText('GPU Rendering Farm')).toBeInTheDocument()
    
    // Check higher server count for rendering
    await expect(canvas.getByText('16')).toBeInTheDocument()
    
    // Test server configuration
    await userEvent.click(canvas.getByText('Shared Servers'))
    const renderServer = canvas.getByText(/Render-Node-01/)
    await userEvent.click(renderServer)
    
    // Verify GPU interconnect allocation
    await expect(canvas.getByDisplayValue('gpu-interconnect')).toBeInTheDocument()
  }
}

// HPC Cluster Demo
export const HPCClusterDemo: Story = {
  args: {
    initialSpec: createDualFabricTemplate('hpc') as DualFabricSpec
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    
    // Verify HPC template
    await expect(canvas.getByText('HPC Cluster')).toBeInTheDocument()
    await expect(canvas.getByText('Management Fabric')).toBeInTheDocument()
    
    // Check large server count
    await expect(canvas.getByText('32')).toBeInTheDocument()
    
    // Test management fabric configuration
    await userEvent.click(canvas.getByText('Backend Fabric'))
    await expect(canvas.getByText('Backend Fabric Configuration')).toBeInTheDocument()
  }
}