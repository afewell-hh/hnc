import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { DriftIndicator } from '../drift/DriftIndicator.js';
const getStatusColor = (status) => {
    switch (status) {
        case 'draft': return '#666';
        case 'computed': return '#1976d2';
        case 'saved': return '#388e3c';
        default: return '#666';
    }
};
const getStatusLabel = (status) => {
    switch (status) {
        case 'draft': return 'Draft';
        case 'computed': return 'Computed';
        case 'saved': return 'Saved';
        default: return 'Unknown';
    }
};
export function FabricCard({ fabric, onSelectFabric, onDeleteFabric, onCheckDrift }) {
    return (_jsx("div", { style: {
            border: '1px solid #ddd',
            borderRadius: '8px',
            padding: '1.5rem',
            backgroundColor: 'white',
            boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
        }, children: _jsxs("div", { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }, children: [_jsxs("div", { style: { flex: 1 }, children: [_jsx("h3", { style: { margin: '0 0 0.5rem 0', color: '#333' }, children: fabric.name }), _jsxs("div", { style: { display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '0.5rem' }, children: [_jsx("span", { style: {
                                        padding: '0.25rem 0.5rem',
                                        borderRadius: '12px',
                                        fontSize: '0.8rem',
                                        fontWeight: 'bold',
                                        color: 'white',
                                        backgroundColor: getStatusColor(fabric.status)
                                    }, children: getStatusLabel(fabric.status) }), _jsx(DriftIndicator, { driftStatus: fabric.driftStatus || null, onClick: onCheckDrift ? () => onCheckDrift(fabric.id) : undefined, compact: true })] }), _jsxs("div", { style: { fontSize: '0.85rem', color: '#666' }, children: [_jsxs("div", { children: ["Created: ", fabric.createdAt.toLocaleDateString()] }), _jsxs("div", { children: ["Modified: ", fabric.lastModified.toLocaleDateString()] })] })] }), _jsxs("div", { style: { display: 'flex', gap: '0.5rem', flexShrink: 0 }, children: [_jsx("button", { onClick: () => onSelectFabric(fabric.id), style: {
                                padding: '0.5rem 1rem',
                                backgroundColor: '#1976d2',
                                color: 'white',
                                border: 'none',
                                borderRadius: '4px',
                                cursor: 'pointer',
                                fontSize: '0.9rem'
                            }, children: "Select" }), _jsx("button", { onClick: () => {
                                if (confirm(`Are you sure you want to delete "${fabric.name}"?`)) {
                                    onDeleteFabric(fabric.id);
                                }
                            }, style: {
                                padding: '0.5rem 1rem',
                                backgroundColor: '#d32f2f',
                                color: 'white',
                                border: 'none',
                                borderRadius: '4px',
                                cursor: 'pointer',
                                fontSize: '0.9rem'
                            }, children: "Delete" })] })] }) }));
}
