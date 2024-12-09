import { state } from '../state.js';

function getWeightThreshold(filterLevel) {
    // Get filter level from state if not provided
    const level = filterLevel ?? state?.filterLevel ?? 0;

    // Map levels to thresholds based on keyword weight of 3
    switch(level) {
        case 0: // Minimal (most restrictive)
            return 3;
        case 1: // Moderate
            return 2;
        case 2: // Extensive
            return 1;
        case 3: // Complete (most inclusive)
            return 0;
        default:
            return 3; // Default to most restrictive
    }
}

export { getWeightThreshold };
