import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from 'react';
import { DriftBadge } from './drift/DriftBadge.js';
import { CreateFabricForm } from './components/CreateFabricForm.js';
import { FabricCard } from './components/FabricCard.js';
import { ErrorDisplay } from './components/ErrorDisplay.js';
import { EmptyState } from './components/EmptyState.js';
export function FabricList({ fabrics, onCreateFabric, onSelectFabric, onDeleteFabric, onCheckDrift, onViewDriftDetails, errors, isCreating }) {
    const [showCreateForm, setShowCreateForm] = useState(false);
    const handleCreate = (name) => {
        onCreateFabric(name);
        setShowCreateForm(false);
    };
    const handleCancel = () => {
        setShowCreateForm(false);
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
                        }, children: "Create New Fabric" }))] }), _jsx(ErrorDisplay, { errors: errors }), showCreateForm && (_jsx(CreateFabricForm, { onCreateFabric: handleCreate, onCancel: handleCancel, isCreating: isCreating })), fabrics.length === 0 && !showCreateForm && _jsx(EmptyState, {}), fabrics.length > 0 && (_jsxs("div", { children: [_jsxs("h2", { children: ["Your Fabrics (", fabrics.length, ")"] }), _jsx("div", { style: { display: 'grid', gap: '1rem' }, children: fabrics.map((fabric) => (_jsx(FabricCard, { fabric: fabric, onSelectFabric: onSelectFabric, onDeleteFabric: onDeleteFabric, onCheckDrift: onCheckDrift }, fabric.id))) })] }))] }));
}
