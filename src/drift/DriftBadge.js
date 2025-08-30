import { jsxs as _jsxs } from "react/jsx-runtime";
export function DriftBadge({ driftCount, onClick, style }) {
    if (driftCount === 0) {
        return null;
    }
    const badgeStyle = {
        display: 'inline-flex',
        alignItems: 'center',
        padding: '0.25rem 0.5rem',
        backgroundColor: '#ff9800',
        color: 'white',
        borderRadius: '12px',
        fontSize: '0.8rem',
        fontWeight: 'bold',
        cursor: onClick ? 'pointer' : 'default',
        gap: '0.25rem',
        ...style
    };
    const handleClick = (e) => {
        e.stopPropagation();
        onClick?.();
    };
    return (_jsxs("span", { style: badgeStyle, onClick: handleClick, title: `${driftCount} fabric${driftCount > 1 ? 's' : ''} have drift`, children: ["\u26A0\uFE0F ", driftCount, " fabric", driftCount > 1 ? 's' : '', " have drift"] }));
}
