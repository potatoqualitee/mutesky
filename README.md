# Mutesky - Content Filter Manager for Bluesky

Mutesky is a web app that helps you manage and filter unwanted content on your Bluesky feed. It provides curated keyword groups and context-based filtering to give you more control over your social media experience.

## Features

- **1,500+ Curated Keywords**: A comprehensive collection of keywords that is continuously updated to reflect current events
- **20+ Categories**: Organized filtering across various topics from politics to climate
- **Dual Interface Modes**:
  - **Simple Mode**: Easy-to-use context-based filtering with exceptions
  - **Advanced Mode**: Detailed control over individual keywords and categories
- **Real-time Updates**: Changes take effect immediately on your Bluesky feed
- **Smart Filtering**: Context-aware filtering with the ability to set exceptions
- **Category Management**: Enable/disable entire categories or individual keywords
- **Search Functionality**: Quickly find specific keywords
- **Instant Sync**: Direct integration with Bluesky's muting system

## Getting Started

1. Visit the application in your web browser
2. Enter your Bluesky handle (e.g., @username.bsky.social)
3. Connect to your Bluesky account through the secure authentication process
4. Choose between Simple or Advanced mode:
   - **Simple Mode**: Select the types of content you want to avoid
   - **Advanced Mode**: Fine-tune your filters with individual keyword control

## Usage

### Simple Mode
- Choose broad categories of content you want to avoid
- Set exceptions for specific topics you want to keep seeing
- Perfect for users who want a straightforward filtering experience

### Advanced Mode
- View and manage all keywords organized by categories
- Search through keywords to find specific terms
- Enable/disable individual keywords or entire categories
- See the status of all your filters at a glance

## Technical Details

Built with modern web technologies:
- Frontend: HTML, CSS, JavaScript
- Bluesky Integration: @atproto API
- Build System: Webpack
- Authentication: Bluesky OAuth

## Development

To run the project locally:

1. Clone the repository
2. Install dependencies:
```bash
npm install
```
3. Start the development server:
```bash
npm run dev
```

## Building

To create a production build:
```bash
npm run build
```

## Deployment

The application is automatically deployed to GitHub Pages and is accessible at [mutesky.app](https://mutesky.app). The deployment process is handled through GitHub Actions, which builds and deploys the site whenever changes are pushed to the main branch.
