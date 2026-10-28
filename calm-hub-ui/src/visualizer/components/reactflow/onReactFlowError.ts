import type { OnError } from 'reactflow';

// React Flow error 002 ("new nodeTypes or edgeTypes object") is a false positive here.
// Our nodeTypes and edgeTypes are module constants, but StrictMode runs React Flow's
// useMemo twice on mount in development, so the second run warns. Every other
// error is still logged as React Flow would do by default.
export const onReactFlowError: OnError = (id, message) => {
    if (id === '002') {
        return;
    }
    console.warn(`[React Flow]: ${message} Help: https://reactflow.dev/error#${id}`);
};