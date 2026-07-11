# Frontend Bootstrap, Chunking, and CTA Visibility

## Overview

MuteSky loads in three deliberate stages:

1. the landing/authentication surface;
2. the authenticated application;
3. Advanced Mode on first use.

Each stage defines the Web Components it owns, loads its CSS, and refreshes the
shared DOM lookup after custom-element upgrade. This keeps the landing page
small without reintroducing the old null-reference race.

The landing-page authentication button remains available whenever its form is
rendered. Viewport intersection is not an authentication or occlusion boundary.

## Chunk Boundaries

### Landing and Authentication

js/main.js and css/landing-entry.css form the initial entry point. The landing
chunk contains:

- the landing-page component and theme-aware screenshots;
- AuthService and the browser OAuth client;
- the landing theme toggle and authentication-form listeners;
- the refreshable DOM lookup.

AuthService exports one shared singleton and coalesces setup calls. If OAuth
restores a session, the authenticated chunk reuses that initialized service
instead of loading or initializing a second OAuth client.

Unauthenticated visitors do not download profile, muting, keyword-state,
settings, Simple Mode, or Advanced Mode code.

### Authenticated Application

After session restoration, main.js dynamically imports
js/authenticatedApp.js. Webpack emits the JavaScript and css/app-entry.css as
asynchronous app chunks. The app stylesheet imports its component styles
directly so it does not repeat the base and landing-only rules that remain
active from css/landing.css.

The authenticated entry:

1. loads the application CSS;
2. defines top-nav, Simple Mode, modal, footer, and intro components;
3. calls refreshElements() after those components upgrade;
4. exposes the event-time global handlers used by existing component markup;
5. initializes the Bluesky services and application state;
6. attaches application event listeners.

The landing bootstrap continues to own the sign-in form listeners. After
logout, it delegates sign-in to the full state-preserving authentication
handler exposed by the authenticated chunk.

### Advanced Mode

Switching to Advanced Mode calls loadAdvancedMode(), which dynamically imports
js/advanced-entry.js. That chunk contains:

- the advanced-mode Web Component;
- advanced rendering and category-list code;
- keyword/category/bulk handlers;
- css/components/advanced-mode.css.

The loader caches its promise, refreshes DOM references after the
advanced-mode element upgrades, and resets the promise if loading fails.
Document-level delegated listeners allow Advanced Mode controls to be created
after the base application listeners were attached.

A saved Advanced Mode preference loads this chunk during authenticated
initialization. Simple Mode sessions do not request it.

## Bootstrap Invariant

Most controls referenced by js/dom.js do not exist in the original index.html.
They are created inside Web Component connectedCallback() methods.

js/dom.js therefore exports one stable elements object plus refreshElements().
Renderers and handlers retain the stable object reference while each loading
stage updates its properties.

Do not turn elements back into a permanent module-evaluation snapshot. If a
chunk boundary changes, verify that component upgrade and DOM refresh complete
before initialization or listener setup uses that stage's controls.

## CSS Extraction

Webpack uses css-loader and mini-css-extract-plugin.

- css/landing.css is linked by index.html and contains only the landing/auth
  surface.
- The authenticated CSS is emitted as an asynchronous app stylesheet and is
  loaded before the authenticated JavaScript import resolves.
- Advanced Mode CSS is emitted with the Advanced Mode chunk.
- callback.html continues to use its small base.css and callback.css files.

The production deploy copies only callback-specific raw CSS/JavaScript plus the
Webpack outputs. The old tree of browser-served CSS source files is no longer
needed at runtime.

CSS import order remains significant. When moving a rule between entry files,
visually verify desktop/mobile and light/dark themes before assuming the split
is behavior-neutral.

## Required Regression Checks

- Landing page renders on a cold navigation.
- Connect to Bluesky works by click and by Enter.
- OAuth setup is initialized once across landing and app chunks.
- OAuth callback and restored-session flows load the authenticated chunk.
- Simple Mode controls have listeners after authentication.
- Advanced Mode JavaScript and CSS load on its first activation.
- Search, category toggles, bulk actions, menus, settings, and modals work.
- Logout returns to the landing form and a second sign-in still works.
- Switching DIDs does not retain state from the previous account.
- Browser console has no duplicate custom-element registration errors.
- An unauthenticated production navigation does not request app or
  advanced-mode chunks.

## Landing CTA Visibility

The initial implementation observed bsky-login-btn with an
IntersectionObserver threshold of 1.0 and set the button to visibility: hidden
unless its complete rectangle intersected the viewport.

Standard IntersectionObserver does not measure whether another element covers
the button. With root: null, it measures geometric intersection with the
viewport. The old observer therefore caused partially clipped and
keyboard-adjacent CTAs to disappear without providing an authentication safety
boundary.

The observer has been removed. The button remains visible in normal document
flow. If a future layout introduces overlap, fix the layout, stacking context,
or pointer-events behavior directly.

The decorative auth-card overlay already uses pointer-events: none, which is
the relevant protection against that pseudo-element intercepting clicks.

## July 2026 Verification Snapshot

A local production build and mobile Chrome trace measured:

- 14 unauthenticated landing requests, down from 85 after the first module
  consolidation and 116 in the original audit;
- one landing stylesheet instead of 72 CSS requests;
- 226 KiB uncompressed initial JavaScript instead of 915 KiB;
- 163 ms local LCP and 0.00 CLS;
- separate authenticated/vendor, app CSS, and Advanced Mode JS/CSS chunks.

Local uncompressed sizes are build diagnostics, not deployed transfer sizes;
GitHub Pages/CDN compression reduces JavaScript and CSS transfer bytes.

## Related Files

- index.html
- callback.html
- webpack.config.js
- js/main.js
- js/auth.js
- js/bluesky.js
- js/authenticatedApp.js
- js/advancedModeLoader.js
- js/advanced-entry.js
- js/dom.js
- js/events.js
- css/landing-entry.css
- css/app-entry.css
- css/components/advanced-mode.css