import { getMuteUnmuteCounts } from '../../state.js';
import { renderInterface } from '../../renderer.js';

// Debounced UI updates with frame timing
const debouncedUpdate = (() => {
    let timeout;
    let frameRequest;
    return (fn) => {
        if (timeout) clearTimeout(timeout);
        if (frameRequest) cancelAnimationFrame(frameRequest);

        timeout = setTimeout(() => {
            frameRequest = requestAnimationFrame(() => {
                console.debug('[debouncedUpdate] Executing update');
                fn();
            });
        }, 16);
    };
})();

// Helper to update button text
function getButtonText() {
    const { toMute, toUnmute } = getMuteUnmuteCounts();
    console.debug('[getButtonText] To mute:', toMute, 'To unmute:', toUnmute);
    const parts = [];

    if (toMute > 0) {
        parts.push(`Mute ${toMute} new`);
    }
    if (toUnmute > 0) {
        parts.push(`Unmute ${toUnmute} existing`);
    }

    const text = parts.length > 0 ? parts.join(', ') : 'No changes';
    console.debug('[getButtonText] Button text:', text);
    return text;
}

export { debouncedUpdate, getButtonText };
