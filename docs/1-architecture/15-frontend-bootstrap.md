# Frontend Bootstrap and CTA Visibility

## Overview

MuteSky's controls are rendered by Web Components, while most behavior lives
in the main Webpack application graph. The application must not cache its DOM
references until the custom elements have upgraded and their
connectedCallback() methods have rendered the controls.

The landing-page authentication button must remain available whenever its form
is rendered. Viewport intersection is not an authentication or occlusion
boundary.

## Bootstrap Invariant

Most controls referenced by js/dom.js do not exist in the original index.html.
They are created inside components such as landing-page, top-nav, simple-mode,
and advanced-mode.

Historically, index.html protected this ordering by loading
js/components/index.js as native ESM before loading js/bundle.js. That worked,
but it also caused browser modules reachable from the component graph to be
evaluated separately from their bundled copies.

The current bootstrap keeps one module graph:

1. js/main.js imports js/components/index.js, defining and upgrading the custom
   elements.
2. js/dom.js exports one stable elements object plus refreshElements().
3. On DOMContentLoaded, main.js calls refreshElements() before application
   initialization and listener setup.
4. All renderers and handlers keep their existing reference to the stable
   elements object, whose properties now point at the component-owned controls.

### Why refreshElements() Is Required

Deleting the former native component import without replacing the ordering
guarantee would allow js/dom.js to cache null for controls that had not yet
been rendered. Because most listener setup uses optional chaining, this could
fail silently rather than throw.

Do not turn elements back into a permanent module-evaluation snapshot. If the
bootstrap changes again, verify that component upgrade and DOM refresh complete
before init() or setupEventListeners() runs.

### Component Boundary

Web Components should remain primarily rendering shells. Application state,
network access, and mutations belong in bundled handlers reached at event
time. Keeping this boundary narrow reduces import cycles and makes component
upgrade safe.

simple-mode currently reads shared application state directly. This is safe now
that it is part of the same bundle graph, but it remains a coupling to consider
if components are split into a separate entry again.

### Required Regression Checks

- Landing page renders on a cold navigation.
- Connect to Bluesky works by click and by Enter.
- OAuth callback and restored-session flows still work.
- Simple and Advanced Mode controls have listeners after authentication.
- Mode switches, search, category toggles, bulk actions, menus, and modals work.
- Switching DIDs does not retain state from the previous account.
- Browser console has no duplicate custom-element registration errors.
- Production network inspection shows one application JavaScript graph and no
  native requests for js/components/**.

## Landing CTA Visibility

The initial implementation observed bsky-login-btn with an
IntersectionObserver threshold of 1.0 and set the button to visibility: hidden
unless its complete rectangle intersected the viewport.

The accompanying comment described this as checking whether another element
covered the button. Standard IntersectionObserver does not measure occlusion;
with root: null, it measures geometric intersection with the viewport.

The observer therefore caused these behaviors:

- a partially clipped CTA disappeared instead of remaining scrollable;
- opening a mobile keyboard could hide the button beside the focused field;
- browser chrome, zoom, or short landscape viewports could prevent a full
  intersection;
- full-page screenshots could omit the offscreen CTA;
- a visually covered button could still count as intersecting.

The Enter handler invoked authentication independently of button visibility,
so the observer was not a security or confirmation boundary.

The observer has been removed. The button now remains visible in normal
document flow. If a future layout introduces overlap, fix the layout, stacking
context, or pointer-events behavior directly instead of using viewport
intersection as an occlusion test.

The decorative auth-card overlay already uses pointer-events: none, which is
the relevant protection against that pseudo-element intercepting clicks.

### CTA Regression Checks

Test the authentication form at:

- desktop widths with the CTA crossing both viewport edges;
- 320x568 and 390x844 mobile viewports;
- mobile portrait and landscape with the virtual keyboard open;
- 200% browser zoom;
- light and dark themes;
- click and Enter authentication paths.

## Related Files

- index.html
- webpack.config.js
- js/main.js
- js/dom.js
- js/events.js
- js/components/index.js
- js/components/simple-mode.js
- js/components/modals/keywords-modal.js
- css/components/auth.css