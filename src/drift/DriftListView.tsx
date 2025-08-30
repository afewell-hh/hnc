import React, { useState, useEffect } from 'react'
import type { DriftStatus } from './types.js'

interface FabricDriftInfo {
  fabricId: string
  fabricName: string
  driftStatus: DriftStatus | null
  isLoading: boolean
}

interface DriftListViewProps {
  fabrics: Array<{ id: string; name: string }>
  onGetDriftStatus: (fabricId: string) => Promise<DriftStatus | null>
  onSelectFabric?: (fabricId: string) => void
  onRefreshAll?: () => void
}

export function DriftListView({ 
  fabrics, 
  onGetDriftStatus, 
  onSelectFabric,
  onRefreshAll 
}: DriftListViewProps) {
  const [fabricDriftInfo, setFabricDriftInfo] = useState<Map<string, FabricDriftInfo>>(new Map())
  const [isRefreshingAll, setIsRefreshingAll] = useState(false)

  // Initialize fabric drift info
  useEffect(() => {
    const initialMap = new Map<string, FabricDriftInfo>()
    fabrics.forEach(fabric => {
      initialMap.set(fabric.id, {
        fabricId: fabric.id,
        fabricName: fabric.name,
        driftStatus: null,
        isLoading: false
      })
    })
    setFabricDriftInfo(initialMap)
  }, [fabrics])

  const checkDriftForFabric = async (fabricId: string) => {
    setFabricDriftInfo(prev => {
      const newMap = new Map(prev)
      const info = newMap.get(fabricId)
      if (info) {
        newMap.set(fabricId, { ...info, isLoading: true })
      }
      return newMap
    })

    try {
      const driftStatus = await onGetDriftStatus(fabricId)
      setFabricDriftInfo(prev => {
        const newMap = new Map(prev)
        const info = newMap.get(fabricId)
        if (info) {
          newMap.set(fabricId, { ...info, driftStatus, isLoading: false })
        }
        return newMap
      })
    } catch (error) {
      setFabricDriftInfo(prev => {
        const newMap = new Map(prev)
        const info = newMap.get(fabricId)
        if (info) {
          newMap.set(fabricId, { ...info, isLoading: false })
        }
        return newMap
      })
    }
  }

  const refreshAllDrifts = async () => {
    setIsRefreshingAll(true)
    try {
      await Promise.all(fabrics.map(fabric => checkDriftForFabric(fabric.id)))
      onRefreshAll?.()
    } finally {
      setIsRefreshingAll(false)
    }
  }

  const fabricsWithDrift = Array.from(fabricDriftInfo.values())
    .filter(info => info.driftStatus?.hasDrift)

  const fabricsWithoutDrift = Array.from(fabricDriftInfo.values())
    .filter(info => info.driftStatus && !info.driftStatus.hasDrift)

  const uncheckedFabrics = Array.from(fabricDriftInfo.values())
    .filter(info => !info.driftStatus && !info.isLoading)

  const getStatusIcon = (info: FabricDriftInfo) => {
    if (info.isLoading) return '🔄'
    if (!info.driftStatus) return '❓'
    return info.driftStatus.hasDrift ? '⚠️' : '✅'
  }

  const getStatusColor = (info: FabricDriftInfo) => {
    if (info.isLoading) return '#1976d2'
    if (!info.driftStatus) return '#666'
    return info.driftStatus.hasDrift ? '#f57c00' : '#4caf50'
  }

  return (
    <div style={{
      border: '1px solid #e0e0e0',
      borderRadius: '8px',
      backgroundColor: 'white',
      overflow: 'hidden'
    }}>
      {/* Header */}
      <div style={{
        padding: '1rem',
        backgroundColor: '#f5f5f5',
        borderBottom: '1px solid #e0e0e0',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
      }}>
        <h3 style={{ margin: 0, color: '#333' }}>Fabric Drift Status</h3>
        <button
          onClick={refreshAllDrifts}
          disabled={isRefreshingAll}
          style={{
            padding: '0.5rem 1rem',
            backgroundColor: '#1976d2',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
            fontSize: '0.9rem'
          }}
        >
          {isRefreshingAll ? 'Checking All...' : 'Check All'}
        </button>
      </div>

      {/* Content */}
      <div style={{ padding: '1rem' }}>
        {fabrics.length === 0 && (
          <p style={{ color: '#666', textAlign: 'center', margin: 0 }}>
            No fabrics available to check for drift
          </p>
        )}

        {/* Fabrics with drift */}
        {fabricsWithDrift.length > 0 && (
          <div style={{ marginBottom: '1.5rem' }}>
            <h4 style={{ margin: '0 0 0.5rem 0', color: '#f57c00' }}>
              ⚠️ Fabrics with Drift ({fabricsWithDrift.length})
            </h4>
            {fabricsWithDrift.map(info => (
              <FabricDriftRow 
                key={info.fabricId}
                info={info}
                onCheck={() => checkDriftForFabric(info.fabricId)}
                onSelect={onSelectFabric}
              />
            ))}
          </div>
        )}

        {/* Fabrics without drift */}
        {fabricsWithoutDrift.length > 0 && (
          <div style={{ marginBottom: '1.5rem' }}>
            <h4 style={{ margin: '0 0 0.5rem 0', color: '#4caf50' }}>
              ✅ Fabrics without Drift ({fabricsWithoutDrift.length})
            </h4>
            {fabricsWithoutDrift.map(info => (
              <FabricDriftRow 
                key={info.fabricId}
                info={info}
                onCheck={() => checkDriftForFabric(info.fabricId)}
                onSelect={onSelectFabric}
                compact
              />
            ))}
          </div>
        )}

        {/* Unchecked fabrics */}
        {uncheckedFabrics.length > 0 && (
          <div>
            <h4 style={{ margin: '0 0 0.5rem 0', color: '#666' }}>
              ❓ Unchecked Fabrics ({uncheckedFabrics.length})
            </h4>
            {uncheckedFabrics.map(info => (
              <FabricDriftRow 
                key={info.fabricId}
                info={info}
                onCheck={() => checkDriftForFabric(info.fabricId)}
                onSelect={onSelectFabric}
                showCheckButton
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

interface FabricDriftRowProps {
  info: FabricDriftInfo
  onCheck: () => void
  onSelect?: (fabricId: string) => void
  compact?: boolean
  showCheckButton?: boolean
}

function FabricDriftRow({ info, onCheck, onSelect, compact = false, showCheckButton = false }: FabricDriftRowProps) {
  return (
    <div style={{
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: compact ? '0.5rem' : '0.75rem',
      marginBottom: '0.5rem',
      border: '1px solid #e0e0e0',
      borderRadius: '4px',
      backgroundColor: '#fafafa'
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flex: 1 }}>
        <span style={{
          fontSize: '1.2rem',
          color: getStatusColor(info)
        }}>
          {getStatusIcon(info)}
        </span>
        <div>
          <div style={{ fontWeight: 500, color: '#333' }}>
            {info.fabricName}
          </div>
          <div style={{ fontSize: '0.8rem', color: '#666' }}>
            {info.fabricId}
          </div>
          {info.driftStatus && !compact && (
            <div style={{ fontSize: '0.8rem', color: '#666', marginTop: '0.25rem' }}>
              {info.driftStatus.hasDrift 
                ? `${info.driftStatus.driftSummary.length} changes detected`
                : `No drift (checked ${info.driftStatus.lastChecked.toLocaleTimeString()})`
              }
            </div>
          )}
        </div>
      </div>

      <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
        {showCheckButton && (
          <button
            onClick={onCheck}
            disabled={info.isLoading}
            style={{
              padding: '0.25rem 0.5rem',
              fontSize: '0.8rem',
              border: '1px solid #ddd',
              borderRadius: '4px',
              backgroundColor: 'white',
              cursor: 'pointer'
            }}
          >
            {info.isLoading ? 'Checking...' : 'Check'}
          </button>
        )}
        {!showCheckButton && (
          <button
            onClick={onCheck}
            disabled={info.isLoading}
            style={{
              padding: '0.25rem 0.5rem',
              fontSize: '0.8rem',
              border: 'none',
              backgroundColor: 'transparent',
              cursor: 'pointer',
              color: '#1976d2'
            }}
          >
            Refresh
          </button>
        )}
        {onSelect && (
          <button
            onClick={() => onSelect(info.fabricId)}
            style={{
              padding: '0.25rem 0.5rem',
              fontSize: '0.8rem',
              border: '1px solid #1976d2',
              borderRadius: '4px',
              backgroundColor: '#1976d2',
              color: 'white',
              cursor: 'pointer'
            }}
          >
            Select
          </button>
        )}
      </div>
    </div>
  )
}

function getStatusIcon(info: FabricDriftInfo) {
  if (info.isLoading) return '🔄'
  if (!info.driftStatus) return '❓'
  return info.driftStatus.hasDrift ? '⚠️' : '✅'
}

function getStatusColor(info: FabricDriftInfo) {
  if (info.isLoading) return '#1976d2'
  if (!info.driftStatus) return '#666'
  return info.driftStatus.hasDrift ? '#f57c00' : '#4caf50'
}