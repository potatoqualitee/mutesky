// Import state and internal handlers
import { state } from '../state.js';
import {
    handleContextToggle as _handleContextToggle,
    handleExceptionToggle as _handleExceptionToggle,
    updateSimpleModeState as _updateSimpleModeState,
    initializeState as _initializeState
} from './context/contextHandlers.js';

// Wrap the imported functions to automatically pass state
export async function handleContextToggle(contextId) {
    return await _handleContextToggle(state, contextId);
}

export async function handleExceptionToggle(category) {
    return await _handleExceptionToggle(state, category);
}

export async function updateSimpleModeState() {
    return await _updateSimpleModeState(state);
}

export async function initializeState() {
    return await _initializeState(state);
}
