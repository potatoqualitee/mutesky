import { state } from './state.js';
import { resetState, loadState } from './statePersistence.js';

// Helper to set current user and load their state
export function setUser(did) {
    // Clear current state first
    resetState();
    // Set new user info
    state.did = did;
    state.authenticated = true;
    // Load state for this user
    loadState();
}
