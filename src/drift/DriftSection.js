import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useState } from 'react';
export function DriftSection({ fabricId, driftStatus, onRefreshDrift, onShowDetails, isRefreshing = false }) {
    const [isExpanded, setIsExpanded] = useState(false);
    if (!driftStatus) {
        return (_jsxs("div", { style: {
                border: '1px solid #e0e0e0',
                borderRadius: '8px',
                padding: '1rem',
                marginBottom: '1rem',
                backgroundColor: '#f9f9f9'
            }, children: [_jsxs("div", { style: { display: 'flex', alignItems: 'center', gap: '0.5rem' }, children: [_jsx("h4", { style: { margin: 0, color: '#666' }, children: "Drift Status" }), _jsx("button", { onClick: onRefreshDrift, disabled: isRefreshing, style: {
                                padding: '0.25rem 0.5rem',
                                fontSize: '0.8rem',
                                border: '1px solid #ddd',
                                borderRadius: '4px',
                                backgroundColor: 'white',
                                cursor: 'pointer'
                            }, children: isRefreshing ? 'Checking...' : 'Check for Drift' })] }), _jsx("p", { style: { margin: '0.5rem 0 0 0', color: '#666', fontSize: '0.9rem' }, children: "Click \"Check for Drift\" to compare in-memory topology with saved files" })] }));
    }
    const sectionStyle = {
        border: driftStatus.hasDrift ? '1px solid #ffb74d' : '1px solid #c8e6c9',
        borderRadius: '8px',
        padding: '1rem',
        marginBottom: '1rem',
        backgroundColor: driftStatus.hasDrift ? '#fff8e1' : '#f1f8e9'
    };
    const headerStyle = {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: driftStatus.hasDrift ? '0.5rem' : 0
    };
    return (_jsxs("div", { style: sectionStyle, children: [_jsxs("div", { style: headerStyle, children: [_jsxs("div", { style: { display: 'flex', alignItems: 'center', gap: '0.5rem' }, children: [_jsx("h4", { style: { margin: 0, color: driftStatus.hasDrift ? '#f57c00' : '#4caf50' }, children: driftStatus.hasDrift ? '🔄 Drift Detected' : '✅ No Drift' }), driftStatus.hasDrift && (_jsx("button", { onClick: () => setIsExpanded(!isExpanded), style: {
                                    padding: '0.25rem 0.5rem',
                                    fontSize: '0.8rem',
                                    border: 'none',
                                    backgroundColor: 'transparent',
                                    cursor: 'pointer',
                                    color: '#f57c00'
                                }, children: isExpanded ? 'Hide Details' : 'Show Details' }))] }), _jsxs("div", { style: { display: 'flex', gap: '0.5rem' }, children: [_jsx("button", { onClick: onRefreshDrift, disabled: isRefreshing, style: {
                                    padding: '0.25rem 0.5rem',
                                    fontSize: '0.8rem',
                                    border: '1px solid #ddd',
                                    borderRadius: '4px',
                                    backgroundColor: 'white',
                                    cursor: 'pointer'
                                }, children: isRefreshing ? 'Refreshing...' : 'Refresh' }), onShowDetails && driftStatus.hasDrift && (_jsx("button", { onClick: onShowDetails, style: {
                                    padding: '0.25rem 0.5rem',
                                    fontSize: '0.8rem',
                                    border: '1px solid #f57c00',
                                    borderRadius: '4px',
                                    backgroundColor: '#f57c00',
                                    color: 'white',
                                    cursor: 'pointer'
                                }, children: "View Details" }))] })] }), !driftStatus.hasDrift && (_jsxs("p", { style: { margin: '0.5rem 0 0 0', color: '#4caf50', fontSize: '0.9rem' }, children: ["In-memory topology matches saved files. Last checked: ", driftStatus.lastChecked.toLocaleTimeString()] })), driftStatus.hasDrift && (_jsxs(_Fragment, { children: [_jsxs("div", { style: { marginBottom: '0.5rem', fontSize: '0.9rem', color: '#666' }, children: ["Last checked: ", driftStatus.lastChecked.toLocaleTimeString()] }), isExpanded && (_jsxs("div", { style: {
                            backgroundColor: 'white',
                            padding: '0.75rem',
                            borderRadius: '4px',
                            border: '1px solid #e0e0e0'
                        }, children: [_jsx("h5", { style: { margin: '0 0 0.5rem 0', color: '#333' }, children: "Changes Detected:" }), _jsx("ul", { style: { margin: 0, paddingLeft: '1.5rem', color: '#666' }, children: driftStatus.driftSummary.map((summary, index) => (_jsx("li", { style: { marginBottom: '0.25rem' }, children: summary }, index))) }), driftStatus.affectedFiles.length > 0 && (_jsxs("div", { style: { marginTop: '0.5rem' }, children: [_jsx("h6", { style: { margin: '0 0 0.25rem 0', color: '#333' }, children: "Affected Files:" }), _jsx("ul", { style: { margin: 0, paddingLeft: '1.5rem', fontSize: '0.8rem', color: '#666' }, children: driftStatus.affectedFiles.map((file, index) => (_jsx("li", { children: file }, index))) })] }))] }))] }))] }));
}
