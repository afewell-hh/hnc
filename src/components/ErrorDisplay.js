import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
export function ErrorDisplay({ errors }) {
    if (errors.length === 0)
        return null;
    return (_jsxs("div", { style: {
            color: 'red',
            backgroundColor: '#ffebee',
            padding: '1rem',
            borderRadius: '4px',
            marginBottom: '1rem'
        }, children: [_jsx("h3", { style: { margin: '0 0 0.5rem 0' }, children: "Errors:" }), _jsx("ul", { style: { margin: 0, paddingLeft: '1.5rem' }, children: errors.map((error, i) => (_jsx("li", { children: error }, i))) })] }));
}
