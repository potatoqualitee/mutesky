// Plain re-exports. The previous wrapper prepended the state object as an
// extra first argument, which would have shifted every real argument out of
// place had the toggle handlers ever been called through it.
export {
    handleContextToggle,
    handleExceptionToggle,
    updateSimpleModeState,
    initializeState
} from './context/contextHandlers.js';
