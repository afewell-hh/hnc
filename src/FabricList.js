import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from 'react';
import { DriftBadge } from './drift/DriftBadge.js';
import { DriftIndicator } from './drift/DriftIndicator.js';
export function FabricList({ fabrics, onCreateFabric, onSelectFabric, onDeleteFabric, onCheckDrift, onViewDriftDetails, errors, isCreating }) {
    const [newFabricName, setNewFabricName] = useState('');
    const [showCreateForm, setShowCreateForm] = useState(false);
    const handleCreate = () => {
        if (newFabricName.trim()) {
            onCreateFabric(newFabricName.trim());
            setNewFabricName('');
            setShowCreateForm(false);
        }
    };
    const handleCancel = () => {
        setNewFabricName('');
        setShowCreateForm(false);
    };
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
    // Calculate drift count for workspace badge
    const fabricsWithDrift = fabrics.filter(f => f.driftStatus?.hasDrift).length;
    return (_jsxs("div", { style: { padding: '2rem', maxWidth: '800px', margin: '0 auto' }, children: [_jsxs("div", { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }, children: [_jsxs("div", { style: { display: 'flex', alignItems: 'center', gap: '1rem' }, children: [_jsx("h1", { children: "HNC Fabric Workspace" }), _jsx(DriftBadge, { driftCount: fabricsWithDrift, onClick: onViewDriftDetails })] }), !showCreateForm && (_jsx("button", { onClick: () => setShowCreateForm(true), style: {
                            padding: '0.5rem 1rem',
                            backgroundColor: '#1976d2',
                            color: 'white',
                            border: 'none',
                            borderRadius: '4px',
                            cursor: 'pointer'
                        }, children: "Create New Fabric" }))] }), errors.length > 0 && (_jsxs("div", { style: {
                    color: 'red',
                    backgroundColor: '#ffebee',
                    padding: '1rem',
                    borderRadius: '4px',
                    marginBottom: '1rem'
                }, children: [_jsx("h3", { style: { margin: '0 0 0.5rem 0' }, children: "Errors:" }), _jsx("ul", { style: { margin: 0, paddingLeft: '1.5rem' }, children: errors.map((error, i) => (_jsx("li", { children: error }, i))) })] })), showCreateForm && (_jsxs("div", { style: {
                    border: '1px solid #ddd',
                    borderRadius: '4px',
                    padding: '1rem',
                    marginBottom: '2rem',
                    backgroundColor: '#f9f9f9'
                }, children: [_jsx("h3", { children: "Create New Fabric" }), _jsxs("div", { style: { marginBottom: '1rem' }, children: [_jsx("input", { type: "text", placeholder: "Enter fabric name...", value: newFabricName, onChange: (e) => setNewFabricName(e.target.value), onKeyPress: (e) => e.key === 'Enter' && handleCreate(), style: {
                                    width: '300px',
                                    padding: '0.5rem',
                                    border: '1px solid #ddd',
                                    borderRadius: '4px',
                                    marginRight: '0.5rem'
                                }, autoFocus: true, disabled: isCreating }), _jsx("button", { onClick: handleCreate, disabled: !newFabricName.trim() || isCreating, style: {
                                    padding: '0.5rem 1rem',
                                    backgroundColor: '#4caf50',
                                    color: 'white',
                                    border: 'none',
                                    borderRadius: '4px',
                                    cursor: 'pointer',
                                    marginRight: '0.5rem',
                                    opacity: (!newFabricName.trim() || isCreating) ? 0.6 : 1
                                }, children: isCreating ? 'Creating...' : 'Create' }), _jsx("button", { onClick: handleCancel, disabled: isCreating, style: {
                                    padding: '0.5rem 1rem',
                                    backgroundColor: '#757575',
                                    color: 'white',
                                    border: 'none',
                                    borderRadius: '4px',
                                    cursor: 'pointer'
                                }, children: "Cancel" })] })] })), fabrics.length === 0 && !showCreateForm && (_jsxs("div", { style: {
                    textAlign: 'center',
                    padding: '3rem',
                    color: '#666',
                    backgroundColor: '#f5f5f5',
                    borderRadius: '4px'
                }, children: [_jsx("h3", { children: "No fabrics created yet" }), _jsx("p", { children: "Create your first fabric to get started with network design" })] })), fabrics.length > 0 && (_jsxs("div", { children: [_jsxs("h2", { children: ["Your Fabrics (", fabrics.length, ")"] }), _jsx("div", { style: { display: 'grid', gap: '1rem' }, children: fabrics.map((fabric) => (_jsx("div", { style: {
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
                                                }, children: "Delete" })] })] }) }, fabric.id))) })] }))] }));
}
