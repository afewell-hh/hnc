import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { DriftIndicator } from '../drift/DriftIndicator.js';
import { DriftSection } from '../drift/DriftSection.js';
import { DriftBadge } from '../drift/DriftBadge.js';
import { DriftListView } from '../drift/DriftListView.js';
// Sample drift status data
const noDriftStatus = {
    hasDrift: false,
    driftSummary: ['No drift detected - in-memory topology matches files on disk'],
    lastChecked: new Date(),
    affectedFiles: []
};
const minorDriftStatus = {
    hasDrift: true,
    driftSummary: [
        'switches: 1 modified',
        'connections: 2 added'
    ],
    lastChecked: new Date(),
    affectedFiles: [
        './fgd/test-fabric/switches.yaml',
        './fgd/test-fabric/connections.yaml'
    ]
};
const majorDriftStatus = {
    hasDrift: true,
    driftSummary: [
        'switches: 2 added, 1 removed, 3 modified',
        'endpoints: 5 added, 2 modified',
        'connections: 8 added, 3 removed, 4 modified'
    ],
    lastChecked: new Date(),
    affectedFiles: [
        './fgd/prod-fabric/servers.yaml',
        './fgd/prod-fabric/switches.yaml',
        './fgd/prod-fabric/connections.yaml'
    ]
};
// Mock functions for interactive stories
const mockFunctions = {
    onRefreshDrift: () => console.log('Refreshing drift...'),
    onShowDetails: () => console.log('Showing drift details...'),
    onClick: () => console.log('Drift indicator clicked'),
    onGetDriftStatus: async (fabricId) => {
        console.log(`Getting drift status for ${fabricId}`);
        // Simulate API call delay
        await new Promise(resolve => setTimeout(resolve, 1000));
        // Return different drift statuses based on fabric ID
        if (fabricId.includes('drift'))
            return majorDriftStatus;
        if (fabricId.includes('minor'))
            return minorDriftStatus;
        return noDriftStatus;
    },
    onSelectFabric: (fabricId) => console.log(`Selecting fabric: ${fabricId}`)
};
// Meta configuration
const meta = {
    title: 'Drift/FabricDriftStatus',
    component: DriftIndicator,
    parameters: {
        layout: 'padded',
        docs: {
            description: {
                component: 'Components for displaying fabric drift status and detection results'
            }
        }
    }
};
export default meta;
export const IndicatorNoDrift = {
    name: 'Indicator - No Drift',
    args: {
        driftStatus: noDriftStatus,
        isChecking: false,
        onClick: mockFunctions.onClick
    }
};
export const IndicatorMinorDrift = {
    name: 'Indicator - Minor Drift',
    args: {
        driftStatus: minorDriftStatus,
        isChecking: false,
        onClick: mockFunctions.onClick
    }
};
export const IndicatorMajorDrift = {
    name: 'Indicator - Major Drift',
    args: {
        driftStatus: majorDriftStatus,
        isChecking: false,
        onClick: mockFunctions.onClick
    }
};
export const IndicatorChecking = {
    name: 'Indicator - Checking',
    args: {
        driftStatus: null,
        isChecking: true,
        onClick: mockFunctions.onClick,
        compact: true
    }
};
export const IndicatorCompact = {
    name: 'Indicator - Compact Mode',
    args: {
        driftStatus: minorDriftStatus,
        isChecking: false,
        onClick: mockFunctions.onClick,
        compact: true
    }
};
export const BadgeNoDrift = {
    name: 'Badge - No Drift',
    render: () => (_jsx(DriftBadge, { driftCount: 0, onClick: mockFunctions.onClick }))
};
export const BadgeSingleFabric = {
    name: 'Badge - Single Fabric',
    render: () => (_jsx(DriftBadge, { driftCount: 1, onClick: mockFunctions.onClick }))
};
export const BadgeMultipleFabrics = {
    name: 'Badge - Multiple Fabrics',
    render: () => (_jsx(DriftBadge, { driftCount: 3, onClick: mockFunctions.onClick }))
};
export const SectionNoDriftStatus = {
    name: 'Section - No Status',
    render: () => (_jsx("div", { style: { maxWidth: '600px' }, children: _jsx(DriftSection, { fabricId: "test-fabric", driftStatus: null, onRefreshDrift: mockFunctions.onRefreshDrift, onShowDetails: mockFunctions.onShowDetails, isRefreshing: false }) }))
};
export const SectionNoDrift = {
    name: 'Section - No Drift',
    render: () => (_jsx("div", { style: { maxWidth: '600px' }, children: _jsx(DriftSection, { fabricId: "test-fabric", driftStatus: noDriftStatus, onRefreshDrift: mockFunctions.onRefreshDrift, onShowDetails: mockFunctions.onShowDetails, isRefreshing: false }) }))
};
export const SectionMinorDrift = {
    name: 'Section - Minor Drift',
    render: () => (_jsx("div", { style: { maxWidth: '600px' }, children: _jsx(DriftSection, { fabricId: "test-fabric", driftStatus: minorDriftStatus, onRefreshDrift: mockFunctions.onRefreshDrift, onShowDetails: mockFunctions.onShowDetails, isRefreshing: false }) }))
};
export const SectionMajorDrift = {
    name: 'Section - Major Drift',
    render: () => (_jsx("div", { style: { maxWidth: '600px' }, children: _jsx(DriftSection, { fabricId: "prod-fabric", driftStatus: majorDriftStatus, onRefreshDrift: mockFunctions.onRefreshDrift, onShowDetails: mockFunctions.onShowDetails, isRefreshing: false }) }))
};
export const SectionRefreshing = {
    name: 'Section - Refreshing',
    render: () => (_jsx("div", { style: { maxWidth: '600px' }, children: _jsx(DriftSection, { fabricId: "test-fabric", driftStatus: minorDriftStatus, onRefreshDrift: mockFunctions.onRefreshDrift, onShowDetails: mockFunctions.onShowDetails, isRefreshing: true }) }))
};
export const ListView = {
    name: 'List View - Multiple Fabrics',
    render: () => (_jsx("div", { style: { maxWidth: '800px' }, children: _jsx(DriftListView, { fabrics: [
                { id: 'fabric-with-drift', name: 'Production Fabric' },
                { id: 'fabric-minor-drift', name: 'Staging Fabric' },
                { id: 'fabric-clean', name: 'Development Fabric' },
                { id: 'fabric-unchecked', name: 'Test Fabric' }
            ], onGetDriftStatus: mockFunctions.onGetDriftStatus, onSelectFabric: mockFunctions.onSelectFabric }) }))
};
export const ListViewEmpty = {
    name: 'List View - No Fabrics',
    render: () => (_jsx("div", { style: { maxWidth: '800px' }, children: _jsx(DriftListView, { fabrics: [], onGetDriftStatus: mockFunctions.onGetDriftStatus, onSelectFabric: mockFunctions.onSelectFabric }) }))
};
// Combined Demo Story
export const CombinedDemo = {
    name: 'Combined Demo',
    render: () => (_jsxs("div", { style: { maxWidth: '800px', padding: '1rem' }, children: [_jsx("h2", { children: "Drift Detection Components Demo" }), _jsx("h3", { children: "Workspace Badge" }), _jsx("div", { style: { marginBottom: '1rem', padding: '1rem', backgroundColor: '#f5f5f5', borderRadius: '4px' }, children: _jsx(DriftBadge, { driftCount: 2, onClick: mockFunctions.onClick }) }), _jsx("h3", { children: "Fabric Card Indicators" }), _jsxs("div", { style: { marginBottom: '1rem', display: 'flex', gap: '1rem', flexWrap: 'wrap' }, children: [_jsxs("div", { style: { padding: '0.5rem', border: '1px solid #ddd', borderRadius: '4px' }, children: ["No drift: ", _jsx(DriftIndicator, { driftStatus: noDriftStatus, compact: true })] }), _jsxs("div", { style: { padding: '0.5rem', border: '1px solid #ddd', borderRadius: '4px' }, children: ["Minor drift: ", _jsx(DriftIndicator, { driftStatus: minorDriftStatus, compact: true })] }), _jsxs("div", { style: { padding: '0.5rem', border: '1px solid #ddd', borderRadius: '4px' }, children: ["Checking: ", _jsx(DriftIndicator, { driftStatus: null, isChecking: true, compact: true })] })] }), _jsx("h3", { children: "Fabric Designer Section" }), _jsx(DriftSection, { fabricId: "demo-fabric", driftStatus: majorDriftStatus, onRefreshDrift: mockFunctions.onRefreshDrift, onShowDetails: mockFunctions.onShowDetails })] }))
};
