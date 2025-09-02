/**
 * BOM Panel Component - WP-BOM2
 * Displays comprehensive Bill of Materials with CSV export functionality
 */

import React, { useState, useMemo } from 'react'
import { Button } from './ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card'
import { Badge } from './ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs'
import { Separator } from './ui/separator'
import { Download, Package, Zap, Cable, Router } from 'lucide-react'
import { compileBOM, type BOMAnalysis, type BOMItem } from '../domain/bom-compiler'
import { countTransceivers, type TransceiverAnalysis } from '../domain/transceiver-counter'
import { type WiringDiagram } from '../app.types'
import { type ExternalLink } from '../domain/external-link'
import { type LeafModel } from '../domain/leaf-capability-filter'

interface BOMPanelProps {
  wiringDiagram: WiringDiagram
  externalLinks?: ExternalLink[]
  leafModels?: LeafModel[]
  spineModels?: LeafModel[]
  showPricing?: boolean
  showDetailedBreakdown?: boolean
  onExportCSV?: (bomData: BOMAnalysis) => void
}

export function BOMPanel({
  wiringDiagram,
  externalLinks = [],
  leafModels = [],
  spineModels = [],
  showPricing = true,
  showDetailedBreakdown = false,
  onExportCSV
}: BOMPanelProps) {
  const [activeTab, setActiveTab] = useState('summary')
  const [isExporting, setIsExporting] = useState(false)

  // Calculate BOM analysis
  const bomAnalysis = useMemo(() => {
    try {
      return compileBOM(wiringDiagram, externalLinks, leafModels, spineModels)
    } catch (error) {
      console.error('BOM compilation failed:', error)
      return null
    }
  }, [wiringDiagram, externalLinks, leafModels, spineModels])

  // Calculate detailed transceiver analysis
  const transceiverAnalysis = useMemo(() => {
    try {
      return countTransceivers(wiringDiagram, externalLinks)
    } catch (error) {
      console.error('Transceiver analysis failed:', error)
      return null
    }
  }, [wiringDiagram, externalLinks])

  const handleExportCSV = async () => {
    if (!bomAnalysis) return
    
    setIsExporting(true)
    try {
      if (onExportCSV) {
        onExportCSV(bomAnalysis)
      } else {
        // Default CSV export
        const csvContent = generateCSV(bomAnalysis)
        downloadCSV(csvContent, `${bomAnalysis.metadata.fabricName}-BOM.csv`)
      }
    } catch (error) {
      console.error('CSV export failed:', error)
    } finally {
      setIsExporting(false)
    }
  }

  if (!bomAnalysis) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center text-muted-foreground">
            Unable to generate BOM. Please check your wiring diagram configuration.
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Package className="h-5 w-5" />
              Bill of Materials
            </CardTitle>
            <CardDescription>
              Hardware requirements for {bomAnalysis.metadata.fabricName}
            </CardDescription>
          </div>
          <Button 
            onClick={handleExportCSV}
            disabled={isExporting}
            variant="outline"
            size="sm"
          >
            <Download className="h-4 w-4 mr-2" />
            Export CSV
          </Button>
        </CardHeader>

        <CardContent>
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="summary">Summary</TabsTrigger>
              <TabsTrigger value="switches">Switches</TabsTrigger>
              <TabsTrigger value="transceivers">Transceivers</TabsTrigger>
              <TabsTrigger value="breakouts">Breakouts</TabsTrigger>
            </TabsList>

            <TabsContent value="summary" className="space-y-4">
              <BOMSummaryView 
                analysis={bomAnalysis} 
                showPricing={showPricing}
                transceiverAnalysis={transceiverAnalysis}
              />
            </TabsContent>

            <TabsContent value="switches" className="space-y-4">
              <BOMCategoryView 
                items={bomAnalysis.switches}
                title="Switch Hardware"
                icon={Router}
                showPricing={showPricing}
              />
            </TabsContent>

            <TabsContent value="transceivers" className="space-y-4">
              <BOMCategoryView 
                items={bomAnalysis.transceivers}
                title="Optical Transceivers"
                icon={Zap}
                showPricing={showPricing}
                showDetailedBreakdown={showDetailedBreakdown}
                transceiverAnalysis={transceiverAnalysis}
              />
            </TabsContent>

            <TabsContent value="breakouts" className="space-y-4">
              <BOMCategoryView 
                items={bomAnalysis.breakouts}
                title="Breakout Cables"
                icon={Cable}
                showPricing={showPricing}
              />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  )
}

// Summary view component
function BOMSummaryView({ 
  analysis, 
  showPricing,
  transceiverAnalysis
}: { 
  analysis: BOMAnalysis
  showPricing: boolean
  transceiverAnalysis: TransceiverAnalysis | null
}) {
  return (
    <div className="space-y-6">
      {/* Key Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="text-center p-4 bg-muted/50 rounded-lg">
          <div className="text-2xl font-bold">{analysis.summary.totalSwitches}</div>
          <div className="text-sm text-muted-foreground">Switches</div>
        </div>
        <div className="text-center p-4 bg-muted/50 rounded-lg">
          <div className="text-2xl font-bold">{analysis.summary.totalTransceivers}</div>
          <div className="text-sm text-muted-foreground">Transceivers</div>
        </div>
        <div className="text-center p-4 bg-muted/50 rounded-lg">
          <div className="text-2xl font-bold">{analysis.summary.totalBreakouts}</div>
          <div className="text-sm text-muted-foreground">Breakouts</div>
        </div>
        <div className="text-center p-4 bg-muted/50 rounded-lg">
          <div className="text-2xl font-bold">
            {showPricing ? `$${Math.round(analysis.summary.totalCost).toLocaleString()}` : '---'}
          </div>
          <div className="text-sm text-muted-foreground">Total Cost</div>
        </div>
      </div>

      {/* Cost Breakdown */}
      {showPricing && (
        <div>
          <h3 className="text-lg font-semibold mb-3">Cost Breakdown</h3>
          <div className="space-y-2">
            {Object.entries(analysis.summary.costBreakdown).map(([category, cost]) => (
              <div key={category} className="flex justify-between items-center">
                <span className="capitalize">{category}</span>
                <span className="font-mono">${cost.toLocaleString()}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Utilization Stats */}
      <div>
        <h3 className="text-lg font-semibold mb-3">Utilization Statistics</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="flex justify-between items-center">
            <span>Port Utilization</span>
            <Badge variant="outline">
              {analysis.summary.utilizationStats.averagePortUtilization}%
            </Badge>
          </div>
          <div className="flex justify-between items-center">
            <span>Transceiver Efficiency</span>
            <Badge variant="outline">
              {analysis.summary.utilizationStats.transceiverEfficiency}%
            </Badge>
          </div>
        </div>
      </div>

      {/* Metadata */}
      <div className="text-sm text-muted-foreground border-t pt-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <strong>Fabric:</strong> {analysis.metadata.fabricName}
          </div>
          <div>
            <strong>Generated:</strong> {analysis.metadata.generatedAt.toLocaleString()}
          </div>
          <div>
            <strong>Devices:</strong> {analysis.metadata.wiringDeviceCount}
          </div>
          <div>
            <strong>Connections:</strong> {analysis.metadata.connectionCount}
          </div>
        </div>
      </div>
    </div>
  )
}

// Category view component
function BOMCategoryView({ 
  items, 
  title, 
  icon: Icon,
  showPricing,
  showDetailedBreakdown,
  transceiverAnalysis
}: { 
  items: BOMItem[]
  title: string
  icon: any
  showPricing: boolean
  showDetailedBreakdown?: boolean
  transceiverAnalysis?: TransceiverAnalysis | null
}) {
  if (items.length === 0) {
    return (
      <div className="text-center text-muted-foreground py-8">
        No {title.toLowerCase()} required
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 mb-4">
        <Icon className="h-5 w-5" />
        <h3 className="text-lg font-semibold">{title}</h3>
      </div>

      <div className="space-y-2">
        {items.map((item, index) => (
          <div key={index} className="flex items-center justify-between p-3 border rounded-lg">
            <div className="flex-1">
              <div className="font-medium">{item.sku}</div>
              <div className="text-sm text-muted-foreground">{item.description}</div>
              {item.details && (
                <div className="text-xs text-muted-foreground mt-1">
                  {Object.entries(item.details).map(([key, value]) => (
                    <span key={key} className="mr-3">
                      {key}: {value}
                    </span>
                  ))}
                </div>
              )}
            </div>
            
            <div className="flex items-center gap-4">
              <Badge variant="secondary">{item.quantity}x</Badge>
              {showPricing && item.unitPrice && (
                <div className="text-right">
                  <div className="text-sm font-mono">${item.unitPrice.toLocaleString()}</div>
                  <div className="text-xs text-muted-foreground">
                    Total: ${(item.totalPrice || 0).toLocaleString()}
                  </div>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Detailed breakdown for transceivers */}
      {showDetailedBreakdown && transceiverAnalysis && title.includes('Transceiver') && (
        <div className="mt-6 p-4 bg-muted/50 rounded-lg">
          <h4 className="font-semibold mb-3">Detailed Transceiver Breakdown</h4>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
            <div>
              <strong>By Speed:</strong>
              {Object.entries(transceiverAnalysis.summary.bySpeed).map(([speed, count]) => (
                <div key={speed} className="ml-2">{speed}: {count}</div>
              ))}
            </div>
            <div>
              <strong>By Medium:</strong>
              {Object.entries(transceiverAnalysis.summary.byMedium).map(([medium, count]) => (
                <div key={medium} className="ml-2 capitalize">{medium}: {count}</div>
              ))}
            </div>
            <div>
              <strong>By Source:</strong>
              {Object.entries(transceiverAnalysis.summary.bySource).map(([source, count]) => (
                <div key={source} className="ml-2 capitalize">{source.replace('-', ' ')}: {count}</div>
              ))}
            </div>
          </div>
        </div>
      )}

      <Separator />
      
      <div className="flex justify-between items-center font-semibold">
        <span>Total {title}</span>
        <div className="flex items-center gap-4">
          <span>{items.reduce((sum, item) => sum + item.quantity, 0)} items</span>
          {showPricing && (
            <span>${items.reduce((sum, item) => sum + (item.totalPrice || 0), 0).toLocaleString()}</span>
          )}
        </div>
      </div>
    </div>
  )
}

// CSV export utilities
function generateCSV(analysis: BOMAnalysis): string {
  const headers = ['Category', 'SKU', 'Description', 'Quantity', 'Unit Price', 'Total Price', 'Source']
  const rows: string[] = [headers.join(',')]

  const allItems = [
    ...analysis.switches.map(item => ({ ...item, category: 'Switch' })),
    ...analysis.transceivers.map(item => ({ ...item, category: 'Transceiver' })),
    ...analysis.breakouts.map(item => ({ ...item, category: 'Breakout' })),
    ...analysis.cables.map(item => ({ ...item, category: 'Cable' }))
  ]

  for (const item of allItems) {
    const row = [
      item.category,
      item.sku,
      `"${item.description}"`,
      item.quantity.toString(),
      (item.unitPrice || 0).toString(),
      (item.totalPrice || 0).toString(),
      item.source
    ]
    rows.push(row.join(','))
  }

  // Add summary row
  rows.push('')
  rows.push('Summary')
  rows.push(`Total Items,${allItems.reduce((sum, item) => sum + item.quantity, 0)}`)
  rows.push(`Total Cost,$${analysis.summary.totalCost.toLocaleString()}`)

  return rows.join('\n')
}

function downloadCSV(content: string, filename: string) {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' })
  const link = document.createElement('a')
  
  if (link.download !== undefined) {
    const url = URL.createObjectURL(blob)
    link.setAttribute('href', url)
    link.setAttribute('download', filename)
    link.style.visibility = 'hidden'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }
}

export default BOMPanel