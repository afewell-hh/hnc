import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from 'react';
export function CreateFabricForm({ onCreateFabric, onCancel, isCreating }) {
    const [newFabricName, setNewFabricName] = useState('');
    const handleCreate = () => {
        if (newFabricName.trim()) {
            onCreateFabric(newFabricName.trim());
            setNewFabricName('');
        }
    };
    return (_jsxs("div", { style: {
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
                        }, children: isCreating ? 'Creating...' : 'Create' }), _jsx("button", { onClick: onCancel, disabled: isCreating, style: {
                            padding: '0.5rem 1rem',
                            backgroundColor: '#757575',
                            color: 'white',
                            border: 'none',
                            borderRadius: '4px',
                            cursor: 'pointer'
                        }, children: "Cancel" })] })] }));
}
