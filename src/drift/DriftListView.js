import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState, useEffect } from 'react';
export function DriftListView({ fabrics, onGetDriftStatus, onSelectFabric, onRefreshAll }) {
    const [fabricDriftInfo, setFabricDriftInfo] = useState(new Map());
    const [isRefreshingAll, setIsRefreshingAll] = useState(false);
    // Initialize fabric drift info
    useEffect(() => {
        const initialMap = new Map();
        fabrics.forEach(fabric => {
            initialMap.set(fabric.id, {
                fabricId: fabric.id,
                fabricName: fabric.name,
                driftStatus: null,
                isLoading: false
            });
        });
        setFabricDriftInfo(initialMap);
    }, [fabrics]);
    const checkDriftForFabric = async (fabricId) => {
        setFabricDriftInfo(prev => {
            const newMap = new Map(prev);
            const info = newMap.get(fabricId);
            if (info) {
                newMap.set(fabricId, { ...info, isLoading: true });
            }
            return newMap;
        });
        try {
            const driftStatus = await onGetDriftStatus(fabricId);
            setFabricDriftInfo(prev => {
                const newMap = new Map(prev);
                const info = newMap.get(fabricId);
                if (info) {
                    newMap.set(fabricId, { ...info, driftStatus, isLoading: false });
                }
                return newMap;
            });
        }
        catch (error) {
            setFabricDriftInfo(prev => {
                const newMap = new Map(prev);
                const info = newMap.get(fabricId);
                if (info) {
                    newMap.set(fabricId, { ...info, isLoading: false });
                }
                return newMap;
            });
        }
    };
    const refreshAllDrifts = async () => {
        setIsRefreshingAll(true);
        try {
            await Promise.all(fabrics.map(fabric => checkDriftForFabric(fabric.id)));
            onRefreshAll?.();
        }
        finally {
            setIsRefreshingAll(false);
        }
    };
    const fabricsWithDrift = Array.from(fabricDriftInfo.values())
        .filter(info => info.driftStatus?.hasDrift);
    const fabricsWithoutDrift = Array.from(fabricDriftInfo.values())
        .filter(info => info.driftStatus && !info.driftStatus.hasDrift);
    const uncheckedFabrics = Array.from(fabricDriftInfo.values())
        .filter(info => !info.driftStatus && !info.isLoading);
    const getStatusIcon = (info) => {
        if (info.isLoading)
            return '🔄';
        if (!info.driftStatus)
            return '❓';
        return info.driftStatus.hasDrift ? '⚠️' : '✅';
    };
    const getStatusColor = (info) => {
        if (info.isLoading)
            return '#1976d2';
        if (!info.driftStatus)
            return '#666';
        return info.driftStatus.hasDrift ? '#f57c00' : '#4caf50';
    };
    return (_jsxs("div", { style: {
            border: '1px solid #e0e0e0',
            borderRadius: '8px',
            backgroundColor: 'white',
            overflow: 'hidden'
        }, children: [_jsxs("div", { style: {
                    padding: '1rem',
                    backgroundColor: '#f5f5f5',
                    borderBottom: '1px solid #e0e0e0',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                }, children: [_jsx("h3", { style: { margin: 0, color: '#333' }, children: "Fabric Drift Status" }), _jsx("button", { onClick: refreshAllDrifts, disabled: isRefreshingAll, style: {
                            padding: '0.5rem 1rem',
                            backgroundColor: '#1976d2',
                            color: 'white',
                            border: 'none',
                            borderRadius: '4px',
                            cursor: 'pointer',
                            fontSize: '0.9rem'
                        }, children: isRefreshingAll ? 'Checking All...' : 'Check All' })] }), _jsxs("div", { style: { padding: '1rem' }, children: [fabrics.length === 0 && (_jsx("p", { style: { color: '#666', textAlign: 'center', margin: 0 }, children: "No fabrics available to check for drift" })), fabricsWithDrift.length > 0 && (_jsxs("div", { style: { marginBottom: '1.5rem' }, children: [_jsxs("h4", { style: { margin: '0 0 0.5rem 0', color: '#f57c00' }, children: ["\u26A0\uFE0F Fabrics with Drift (", fabricsWithDrift.length, ")"] }), fabricsWithDrift.map(info => (_jsx(FabricDriftRow, { info: info, onCheck: () => checkDriftForFabric(info.fabricId), onSelect: onSelectFabric }, info.fabricId)))] })), fabricsWithoutDrift.length > 0 && (_jsxs("div", { style: { marginBottom: '1.5rem' }, children: [_jsxs("h4", { style: { margin: '0 0 0.5rem 0', color: '#4caf50' }, children: ["\u2705 Fabrics without Drift (", fabricsWithoutDrift.length, ")"] }), fabricsWithoutDrift.map(info => (_jsx(FabricDriftRow, { info: info, onCheck: () => checkDriftForFabric(info.fabricId), onSelect: onSelectFabric, compact: true }, info.fabricId)))] })), uncheckedFabrics.length > 0 && (_jsxs("div", { children: [_jsxs("h4", { style: { margin: '0 0 0.5rem 0', color: '#666' }, children: ["\u2753 Unchecked Fabrics (", uncheckedFabrics.length, ")"] }), uncheckedFabrics.map(info => (_jsx(FabricDriftRow, { info: info, onCheck: () => checkDriftForFabric(info.fabricId), onSelect: onSelectFabric, showCheckButton: true }, info.fabricId)))] }))] })] }));
}
function FabricDriftRow({ info, onCheck, onSelect, compact = false, showCheckButton = false }) {
    return (_jsxs("div", { style: {
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: compact ? '0.5rem' : '0.75rem',
            marginBottom: '0.5rem',
            border: '1px solid #e0e0e0',
            borderRadius: '4px',
            backgroundColor: '#fafafa'
        }, children: [_jsxs("div", { style: { display: 'flex', alignItems: 'center', gap: '0.75rem', flex: 1 }, children: [_jsx("span", { style: {
                            fontSize: '1.2rem',
                            color: getStatusColor(info)
                        }, children: getStatusIcon(info) }), _jsxs("div", { children: [_jsx("div", { style: { fontWeight: 500, color: '#333' }, children: info.fabricName }), _jsx("div", { style: { fontSize: '0.8rem', color: '#666' }, children: info.fabricId }), info.driftStatus && !compact && (_jsx("div", { style: { fontSize: '0.8rem', color: '#666', marginTop: '0.25rem' }, children: info.driftStatus.hasDrift
                                    ? `${info.driftStatus.driftSummary.length} changes detected`
                                    : `No drift (checked ${info.driftStatus.lastChecked.toLocaleTimeString()})` }))] })] }), _jsxs("div", { style: { display: 'flex', gap: '0.5rem', alignItems: 'center' }, children: [showCheckButton && (_jsx("button", { onClick: onCheck, disabled: info.isLoading, style: {
                            padding: '0.25rem 0.5rem',
                            fontSize: '0.8rem',
                            border: '1px solid #ddd',
                            borderRadius: '4px',
                            backgroundColor: 'white',
                            cursor: 'pointer'
                        }, children: info.isLoading ? 'Checking...' : 'Check' })), !showCheckButton && (_jsx("button", { onClick: onCheck, disabled: info.isLoading, style: {
                            padding: '0.25rem 0.5rem',
                            fontSize: '0.8rem',
                            border: 'none',
                            backgroundColor: 'transparent',
                            cursor: 'pointer',
                            color: '#1976d2'
                        }, children: "Refresh" })), onSelect && (_jsx("button", { onClick: () => onSelect(info.fabricId), style: {
                            padding: '0.25rem 0.5rem',
                            fontSize: '0.8rem',
                            border: '1px solid #1976d2',
                            borderRadius: '4px',
                            backgroundColor: '#1976d2',
                            color: 'white',
                            cursor: 'pointer'
                        }, children: "Select" }))] })] }));
}
function getStatusIcon(info) {
    if (info.isLoading)
        return '🔄';
    if (!info.driftStatus)
        return '❓';
    return info.driftStatus.hasDrift ? '⚠️' : '✅';
}
function getStatusColor(info) {
    if (info.isLoading)
        return '#1976d2';
    if (!info.driftStatus)
        return '#666';
    return info.driftStatus.hasDrift ? '#f57c00' : '#4caf50';
}
