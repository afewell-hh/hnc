import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from 'react';
import { useMachine } from '@xstate/react';
import { workspaceMachine } from './workspace.machine';
import { fabricDesignMachine } from './app.machine';
import { FabricList } from './FabricList';
import { DriftSection } from './drift/DriftSection.js';
import { detectDrift } from './drift/detector.js';
function FabricDesigner({ fabricId, onBackToList }) {
    const [state, send] = useMachine(fabricDesignMachine);
    const [driftStatus, setDriftStatus] = useState(null);
    const [isCheckingDrift, setIsCheckingDrift] = useState(false);
    return (_jsxs("div", { style: { padding: '2rem', maxWidth: '800px', margin: '0 auto' }, children: [_jsxs("div", { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }, children: [_jsx("h1", { children: "HNC Fabric Designer v0.2" }), _jsx("button", { onClick: onBackToList, style: {
                            padding: '0.5rem 1rem',
                            backgroundColor: '#757575',
                            color: 'white',
                            border: 'none',
                            borderRadius: '4px',
                            cursor: 'pointer'
                        }, children: "\u2190 Back to List" })] }), _jsx(DriftSection, { fabricId: fabricId, driftStatus: driftStatus, onRefreshDrift: handleCheckDrift, isRefreshing: isCheckingDrift }), _jsx("div", { style: { marginBottom: '1rem' }, children: _jsxs("label", { children: ["Fabric Name:", _jsx("input", { type: "text", value: state.context.config.name || '', onChange: (e) => send({ type: 'UPDATE_CONFIG', data: { name: e.target.value } }), style: { marginLeft: '0.5rem', padding: '0.25rem' } })] }) }), _jsx("div", { style: { marginBottom: '1rem' }, children: _jsxs("label", { children: ["Spine Model:", _jsx("select", { value: state.context.config.spineModelId || 'DS3000', onChange: (e) => send({ type: 'UPDATE_CONFIG', data: { spineModelId: e.target.value } }), style: { marginLeft: '0.5rem', padding: '0.25rem' }, children: _jsx("option", { value: "DS3000", children: "DS3000" }) })] }) }), _jsx("div", { style: { marginBottom: '1rem' }, children: _jsxs("label", { children: ["Leaf Model:", _jsx("select", { value: state.context.config.leafModelId || 'DS2000', onChange: (e) => send({ type: 'UPDATE_CONFIG', data: { leafModelId: e.target.value } }), style: { marginLeft: '0.5rem', padding: '0.25rem' }, children: _jsx("option", { value: "DS2000", children: "DS2000" }) })] }) }), _jsx("div", { style: { marginBottom: '1rem' }, children: _jsxs("label", { children: ["Uplinks Per Leaf:", _jsx("input", { type: "number", min: "1", max: "4", value: state.context.config.uplinksPerLeaf || 2, onChange: (e) => send({ type: 'UPDATE_CONFIG', data: { uplinksPerLeaf: parseInt(e.target.value) } }), style: { marginLeft: '0.5rem', padding: '0.25rem', width: '60px' } })] }) }), _jsx("div", { style: { marginBottom: '1rem' }, children: _jsxs("label", { children: ["Endpoint Count:", _jsx("input", { type: "number", min: "1", value: state.context.config.endpointCount || 48, onChange: (e) => send({ type: 'UPDATE_CONFIG', data: { endpointCount: parseInt(e.target.value) } }), style: { marginLeft: '0.5rem', padding: '0.25rem', width: '80px' } })] }) }), _jsxs("div", { style: { marginBottom: '1rem' }, children: [_jsx("button", { onClick: () => send({ type: 'COMPUTE_TOPOLOGY' }), disabled: state.matches('computing') || state.matches('saving'), style: { padding: '0.5rem 1rem', marginRight: '0.5rem' }, children: state.matches('computing') ? 'Computing...' : 'Compute Topology' }), state.matches('computed') && (_jsx("button", { onClick: () => send({ type: 'SAVE_TO_FGD' }), disabled: state.matches('saving'), style: { padding: '0.5rem 1rem' }, children: state.matches('saving') ? 'Saving...' : 'Save to FGD' }))] }), state.context.errors.length > 0 && (_jsxs("div", { style: { color: 'red', marginBottom: '1rem' }, children: [_jsx("h3", { children: "Errors:" }), _jsx("ul", { children: state.context.errors.map((error, i) => (_jsx("li", { children: error }, i))) })] })), state.context.computedTopology && (_jsxs("div", { style: { border: '1px solid #ccc', padding: '1rem', marginBottom: '1rem' }, children: [_jsx("h3", { children: "Computed Topology" }), _jsxs("p", { children: ["Leaves needed: ", state.context.computedTopology.leavesNeeded] }), _jsxs("p", { children: ["Spines needed: ", state.context.computedTopology.spinesNeeded] }), _jsxs("p", { children: ["Oversubscription ratio: ", state.context.computedTopology.oversubscriptionRatio, ":1"] }), _jsxs("p", { children: ["Valid: ", state.context.computedTopology.isValid ? 'Yes' : 'No'] })] })), state.matches('saved') && (_jsx("div", { style: { color: 'green', padding: '1rem', border: '1px solid green' }, children: "\u2705 Topology saved to FGD successfully!" })), _jsxs("div", { style: { fontSize: '0.8rem', color: '#666', marginTop: '2rem' }, children: ["Fabric ID: ", fabricId, " | State: ", String(state.value), " | Config: ", JSON.stringify(state.context.config)] })] }));
    // Drift checking function
    async function handleCheckDrift() {
        if (!state.context.loadedDiagram) {
            setDriftStatus({
                hasDrift: false,
                driftSummary: ['No topology loaded - cannot check drift'],
                lastChecked: new Date(),
                affectedFiles: []
            });
            return;
        }
        setIsCheckingDrift(true);
        try {
            const result = await detectDrift(fabricId, state.context.loadedDiagram);
            setDriftStatus(result);
        }
        catch (error) {
            setDriftStatus({
                hasDrift: false,
                driftSummary: [`Error checking drift: ${error instanceof Error ? error.message : 'Unknown error'}`],
                lastChecked: new Date(),
                affectedFiles: []
            });
        }
        finally {
            setIsCheckingDrift(false);
        }
    }
}
function App() {
    const [workspaceState, workspaceSend] = useMachine(workspaceMachine);
    const handleCreateFabric = (name) => {
        workspaceSend({ type: 'CREATE_FABRIC', name });
    };
    const handleSelectFabric = (fabricId) => {
        workspaceSend({ type: 'SELECT_FABRIC', fabricId });
    };
    const handleDeleteFabric = (fabricId) => {
        workspaceSend({ type: 'DELETE_FABRIC', fabricId });
    };
    const handleBackToList = () => {
        workspaceSend({ type: 'BACK_TO_LIST' });
    };
    const handleCheckDrift = async (fabricId) => {
        // This would check drift for a specific fabric in the workspace
        console.log(`Checking drift for fabric: ${fabricId}`);
        // Implementation would depend on having access to the fabric's current state
    };
    const handleViewDriftDetails = () => {
        // This could open a modal or navigate to a dedicated drift view
        console.log('Opening drift details view');
    };
    // Route based on workspace state
    if (workspaceState.matches('selected') && workspaceState.context.selectedFabricId) {
        return (_jsx(FabricDesigner, { fabricId: workspaceState.context.selectedFabricId, onBackToList: handleBackToList }));
    }
    return (_jsx(FabricList, { fabrics: workspaceState.context.fabrics, onCreateFabric: handleCreateFabric, onSelectFabric: handleSelectFabric, onDeleteFabric: handleDeleteFabric, onCheckDrift: handleCheckDrift, onViewDriftDetails: handleViewDriftDetails, errors: workspaceState.context.errors, isCreating: workspaceState.matches('creating') }));
}
export default App;
