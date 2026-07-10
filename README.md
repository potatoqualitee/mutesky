# MuteSky - Bulk manage Bluesky mutes with pre-populated keyword lists

<img align="left" src="images/logo.png" alt="Mutesky Logo" width="245" height="177" style="margin-right: 20px">  MuteSky is a web app that gives you granular control over what appears in your Bluesky feed through curated keyword collections. Working directly with Bluesky's native mute system, it provides an intuitive interface to filter out content you'd rather not see. With over 1,500 pre-populated keywords organized into 20+ smart categories, MuteSky makes content filtering both easy and effective.

&nbsp;

## 🌟 Key Features

- **Instant Setup**: Pre-populated with 1,500+ keywords, continuously updated by AI to reflect current events
- **Smart Categories**: 20+ organized topic groups covering:
  - Political Discord
  - Violence & Security
  - Social Issues
  - Global Affairs
  - Healthcare
  - Economy
  - Environment
  - Religion
  - New Developments
- **Two Ways to Filter**:
  - Simple Mode: Quick topic-based filtering with 4 strength levels
  - Advanced Mode: Fine-tune individual keywords
- **Smart Search**: Filter keywords to find related terms, then enable/disable them all at once or individually
- **Real-Time**: Changes hit your feed instantly
- **Zero Storage**: Works directly with Bluesky's mute system - we never store your data
- **Performance Optimized**: Smart warnings when approaching Bluesky's performance thresholds

## 🖼️ Screenshots

### Simple Mode
<div style="display: flex; gap: 10px;">
  <img src="images/screenshots/light-simple-mode.png" alt="Light Simple Mode" width="400">
  <img src="images/screenshots/dark-simple-mode.png" alt="Dark Simple Mode" width="400">
</div>

### Advanced Mode
<div style="display: flex; gap: 10px;">
  <img src="images/screenshots/light-advanced-mode.png" alt="Light Advanced Mode" width="400">
  <img src="images/screenshots/dark-advanced-mode.png" alt="Dark Advanced Mode" width="400">
</div>

### Smart Search
<div style="display: flex; gap: 10px;">
  <img src="images/screenshots/light-search.png" alt="Light Search" width="400">
  <img src="images/screenshots/dark-search.png" alt="Dark Search" width="400">
</div>

## 🚀 Get Started

1. Visit [mutesky.app](https://mutesky.app)
2. Sign in with your Bluesky account (ex. username.bsky.social)
3. Pick your topics or dive into keyword management
4. Click "Mute" to apply changes

## 📚 Documentation

Comprehensive documentation is available in the [docs](docs/README.md) directory:

### User Guides
- [Understanding Modes](docs/3-guides/1-understanding-modes.md) - Learn when to use Simple vs Advanced mode
- [Muting Explained](docs/3-guides/2-muting-explained.md) - How muting works with Bluesky
- [State Persistence](docs/3-guides/3-state-persistence.md) - Understanding saved changes

### Architecture
- [Core Concepts](docs/1-architecture/1-core-concepts.md) - System overview and state management
- [Authentication](docs/1-architecture/2-authentication.md) - OAuth and session handling
- [Muting System](docs/1-architecture/3-muting-system.md) - Keyword management and API integration
- [Mode System](docs/1-architecture/4-mode-system.md) - Simple/Advanced mode implementation
- [Performance](docs/1-architecture/5-performance.md) - Core optimizations
- [Click Performance](docs/1-architecture/6-click-performance.md) - UI responsiveness

### Development
- [Known Issues](docs/2-development/1-known-issues.md) - Common problems and solutions
- [Troubleshooting Guide](docs/2-development/2-troubleshooting-guide.md) - Debug common issues

## 👩‍💻 Developer Quick Start

### Tech Stack
- Frontend: Vanilla JavaScript with Web Components
- Integration: Bluesky/ATP API
- Deployment: GitHub Pages
- Build: Webpack

### Key Technical Features
1. **State Management**:
   - Centralized state object
   - Local storage persistence
   - Error recovery system
   - Event-driven updates

2. **Performance Optimization**:
   - Critical CSS loading
   - Debounced updates
   - Cached calculations
   - Smart keyword thresholds

3. **Security & Privacy**:
   - Direct Bluesky auth integration
   - Zero data storage
   - Secure credential handling
   - Non-destructive operations

### Local Development

```bash
# Install dependencies
npm install

# Start dev server
npm run dev

# Create production build
npm run build
```

## 🔗 Related Projects

Check out [US Politician Labeler](https://bsky.app/profile/did:plc:bxnuth7kms5l57v2milp5gb3)

And the [Calm the Chaos Browser extension](https://chromewebstore.google.com/detail/calm-the-chaos/cholkigafekgccbkfgcmcigihipbnjoe?authuser=0&hl=en)

## 📈 Trending Now: Automatic Controversy Detection

MuteSky scours political headlines from 15 news feeds across the spectrum
(left, center, and right) every 6 hours and detects "the controversy of the
day" — phrases that are hot on **both** sides of the press at once. Each
detected phrase gets a retention window that scales with how big and how
sustained the story is (a one-day flap expires in ~3 days; a major sustained
story can stay muted for up to 30), and it appears in the app as the
**Trending Now** context.

The engine lives in `scripts/trending/` and runs via GitHub Actions
(`.github/workflows/trending.yml`). It needs no API keys; if a `BRAVE_API_KEY`
repository secret is configured, Brave News search is used as an extra source.
See [Trending System](docs/1-architecture/7-trending-system.md) for the
algorithm details.
