import { jsxs as _jsxs, jsx as _jsx } from "react/jsx-runtime";
export function DriftIndicator({ driftStatus, isChecking, onClick, compact = false }) {
    if (isChecking) {
        return (_jsxs("span", { style: {
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.25rem',
                padding: '0.25rem 0.5rem',
                backgroundColor: '#e3f2fd',
                color: '#1976d2',
                borderRadius: '8px',
                fontSize: '0.8rem'
            }, children: ["\uD83D\uDD04 ", compact ? 'Checking...' : 'Checking for drift...'] }));
    }
    if (!driftStatus) {
        return null;
    }
    if (!driftStatus.hasDrift) {
        if (compact) {
            return (_jsx("span", { style: {
                    display: 'inline-flex',
                    alignItems: 'center',
                    color: '#4caf50',
                    fontSize: '0.8rem'
                }, children: "\u2713" }));
        }
        return null; // Don't show "no drift" indicator in non-compact mode
    }
    const indicatorStyle = {
        display: 'inline-flex',
        alignItems: 'center',
        gap: '0.25rem',
        padding: '0.25rem 0.5rem',
        backgroundColor: '#fff3e0',
        color: '#f57c00',
        border: '1px solid #ffb74d',
        borderRadius: '8px',
        fontSize: '0.8rem',
        cursor: onClick ? 'pointer' : 'default'
    };
    const handleClick = (e) => {
        e.stopPropagation();
        onClick?.();
    };
    return (_jsxs("span", { style: indicatorStyle, onClick: handleClick, title: compact ? driftStatus.driftSummary.join(', ') : undefined, children: ["\uD83D\uDD04 ", compact ? 'Drift detected' : `Drift detected (${driftStatus.driftSummary.length} changes)`] }));
}
