import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useMachine } from '@xstate/react';
import { fabricDesignMachine } from './app.machine';
export const FabricDesignView = () => {
    const [state, send] = useMachine(fabricDesignMachine, {});
    const handleInputChange = (field, value) => {
        send({ type: 'UPDATE_CONFIG', data: { [field]: value } });
    };
    const handleComputeTopology = () => send({ type: 'COMPUTE_TOPOLOGY' });
    const handleSaveToFgd = () => send({ type: 'SAVE_TO_FGD' });
    const handleReset = () => send({ type: 'RESET' });
    const { config, computedTopology, errors, savedToFgd } = state.context;
    const currentState = String(state.value);
    return (_jsxs("div", { className: "fabric-design-container", style: { padding: '20px', maxWidth: '800px' }, children: [_jsxs("header", { children: [_jsx("h1", { children: "HNC v0.1 - Fabric Design Tool" }), _jsxs("div", { className: "state-indicator", children: ["State: ", _jsx("strong", { children: currentState })] })] }), _jsxs("section", { className: "config-section", style: { marginBottom: '30px', padding: '20px', border: '1px solid #ccc' }, children: [_jsx("h2", { children: "Configuration" }), _jsxs("div", { className: "config-grid", style: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }, children: [[
                                { label: 'Fabric Name', field: 'name', type: 'text', placeholder: 'Enter fabric name' },
                                { label: 'Spine Model ID', field: 'spineModelId', type: 'select', options: [['', 'Select spine model'], ['DS3000', 'DS3000 (32-port)']] },
                                { label: 'Leaf Model ID', field: 'leafModelId', type: 'select', options: [['', 'Select leaf model'], ['DS2000', 'DS2000 (48-port)']] },
                                { label: 'Uplinks Per Leaf (even)', field: 'uplinksPerLeaf', type: 'number', min: 2, step: 2 },
                                { label: 'Endpoint Count', field: 'endpointCount', type: 'number', min: 1 },
                            ].map(({ label, field, type, options, ...props }) => (_jsx("div", { children: _jsxs("label", { children: [label, ":", type === 'select' ? (_jsx("select", { value: config[field] || '', onChange: (e) => handleInputChange(field, e.target.value), style: { width: '100%', padding: '8px', marginTop: '5px' }, children: options?.map(([value, text]) => _jsx("option", { value: value, children: text }, value)) })) : (_jsx("input", { type: type, value: config[field] || '', onChange: (e) => handleInputChange(field, type === 'number' ? parseInt(e.target.value) || 0 : e.target.value), style: { width: '100%', padding: '8px', marginTop: '5px' }, ...props }))] }) }, field))), _jsx("div", { children: _jsxs("label", { children: ["Endpoint Profile:", _jsxs("select", { value: config.endpointProfile?.name || '', onChange: (e) => {
                                                const profiles = { 'Standard Server': { name: 'Standard Server', portsPerEndpoint: 2 },
                                                    'High-Density Server': { name: 'High-Density Server', portsPerEndpoint: 4 } };
                                                handleInputChange('endpointProfile', profiles[e.target.value]);
                                            }, style: { width: '100%', padding: '8px', marginTop: '5px' }, children: [_jsx("option", { value: "", children: "Select profile" }), _jsx("option", { value: "Standard Server", children: "Standard Server (2 ports)" }), _jsx("option", { value: "High-Density Server", children: "High-Density Server (4 ports)" })] })] }) })] }), _jsxs("div", { className: "config-actions", style: { marginTop: '20px' }, children: [_jsx("button", { onClick: handleComputeTopology, disabled: currentState === 'saving', style: {
                                    padding: '10px 20px',
                                    marginRight: '10px',
                                    backgroundColor: '#007bff',
                                    color: 'white',
                                    border: 'none',
                                    borderRadius: '4px',
                                    cursor: currentState !== 'saving' ? 'pointer' : 'not-allowed'
                                }, children: "Compute Topology" }), _jsx("button", { onClick: handleReset, style: {
                                    padding: '10px 20px',
                                    marginRight: '10px',
                                    backgroundColor: '#6c757d',
                                    color: 'white',
                                    border: 'none',
                                    borderRadius: '4px',
                                    cursor: 'pointer'
                                }, children: "Reset" })] })] }), _jsxs("section", { className: "preview-section", style: { marginBottom: '30px', padding: '20px', border: '1px solid #ccc' }, children: [_jsx("h2", { children: "Preview" }), (currentState === 'computed' || currentState === 'saving') && computedTopology && (_jsxs("div", { className: "topology-results", style: { marginBottom: '20px' }, children: [_jsx("h3", { children: "Computed Topology" }), _jsxs("div", { className: "results-grid", style: { display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '15px' }, children: [_jsxs("div", { children: [_jsx("strong", { children: "Leaves Needed:" }), " ", computedTopology.leavesNeeded] }), _jsxs("div", { children: [_jsx("strong", { children: "Spines Needed:" }), " ", computedTopology.spinesNeeded] }), _jsxs("div", { children: [_jsx("strong", { children: "Total Ports:" }), " ", computedTopology.totalPorts] }), _jsxs("div", { children: [_jsx("strong", { children: "Used Ports:" }), " ", computedTopology.usedPorts] }), _jsxs("div", { children: [_jsx("strong", { children: "O/S Ratio:" }), " ", computedTopology.oversubscriptionRatio.toFixed(2), ":1", computedTopology.oversubscriptionRatio > 4 && (_jsx("span", { style: { color: 'red', marginLeft: '5px' }, children: "(Too High!)" }))] }), _jsxs("div", { children: [_jsx("strong", { children: "Valid:" }), _jsx("span", { style: { color: computedTopology.isValid ? 'green' : 'red' }, children: computedTopology.isValid ? 'Yes' : 'No' })] })] }), _jsx("div", { className: "save-section", style: { marginTop: '20px' }, children: _jsx("button", { onClick: handleSaveToFgd, disabled: !computedTopology.isValid || currentState !== 'computed', style: {
                                        padding: '10px 20px',
                                        backgroundColor: computedTopology.isValid ? '#28a745' : '#6c757d',
                                        color: 'white',
                                        border: 'none',
                                        borderRadius: '4px',
                                        cursor: computedTopology.isValid && currentState === 'computed' ? 'pointer' : 'not-allowed'
                                    }, children: currentState === 'saving' ? 'Saving to FGD...' : 'Save to FGD' }) })] })), currentState === 'saved' && (_jsxs("div", { className: "save-success", style: { padding: '15px', backgroundColor: '#d4edda', border: '1px solid #c3e6cb', borderRadius: '4px' }, children: [_jsx("h3", { style: { color: '#155724', margin: '0 0 10px 0' }, children: "\u2713 Saved Successfully" }), _jsx("p", { style: { margin: 0, color: '#155724' }, children: "Fabric design and wiring diagram stub saved to in-memory FGD." })] })), currentState === 'saving' && (_jsxs("div", { className: "saving-indicator", style: { padding: '15px', backgroundColor: '#fff3cd', border: '1px solid #ffeaa7', borderRadius: '4px' }, children: [_jsx("h3", { style: { color: '#856404', margin: '0 0 10px 0' }, children: "\u23F3 Saving..." }), _jsx("p", { style: { margin: 0, color: '#856404' }, children: "Generating wiring diagram and saving to FGD..." })] })), errors.length > 0 && (_jsxs("div", { className: "error-display", style: { marginTop: '15px', padding: '15px', backgroundColor: '#f8d7da', border: '1px solid #f5c6cb', borderRadius: '4px' }, children: [_jsx("h3", { style: { color: '#721c24', margin: '0 0 10px 0' }, children: "\u26A0 Validation Errors" }), _jsx("ul", { style: { margin: 0, paddingLeft: '20px', color: '#721c24' }, children: errors.map((error, index) => (_jsx("li", { children: error }, index))) })] }))] }), process.env.NODE_ENV === 'development' && (_jsxs("section", { className: "debug-section", style: { padding: '20px', border: '1px solid #ddd', backgroundColor: '#f8f9fa' }, children: [_jsx("h3", { children: "Debug Info" }), _jsxs("div", { style: { fontSize: '12px', fontFamily: 'monospace' }, children: [_jsxs("div", { children: [_jsx("strong", { children: "Current State:" }), " ", currentState] }), _jsxs("div", { children: [_jsx("strong", { children: "Config Valid:" }), " ", JSON.stringify(!!config && Object.keys(config).length > 0)] }), _jsxs("div", { children: [_jsx("strong", { children: "Has Topology:" }), " ", JSON.stringify(!!computedTopology)] }), _jsxs("div", { children: [_jsx("strong", { children: "Saved to FGD:" }), " ", JSON.stringify(savedToFgd)] })] })] }))] }));
};
