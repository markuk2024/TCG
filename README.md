# TCG Vault Protocol

A modern, multi-page website for a trading card collecting platform combining live card breaks, fractional ownership, and a treasury-backed ecosystem.

## Project Structure

```
lee project/
├── index.html          # Home page (Hero + How It Works)
├── breaks.html         # Live Breaks page
├── vault.html          # Vault Treasury page
├── marketplace.html    # Fractional Marketplace page
├── token.html          # Platform Token + Staking page
├── roadmap.html        # Development Roadmap page
├── styles.css          # Shared stylesheet
├── script.js           # Shared JavaScript (animations, timers)
├── netlify.toml        # Netlify deployment config
└── README.md           # This file
```

## Pages Overview

| Page | Description |
|------|-------------|
| **Home** | Landing page with hero section, stats, and How It Works |
| **Live Breaks** | Upcoming box breaks with countdown timers |
| **Vault** | Treasury assets display with revenue flywheel |
| **Marketplace** | Fractional card ownership trading |
| **Token** | $VAULT token info and staking rewards |
| **Roadmap** | Development phases (Completed, Active, Upcoming) |

## Features

- **Multi-page architecture** - Each section has its own dedicated page
- **Pokemon-themed design** - Blue (#3B4CCA) and Yellow (#FFDE00) color scheme
- **Pokemon watermarks** - Character silhouettes (Pikachu, Charmander, Mewtwo, Squirtle, Charizard, Bulbasaur) on each page
- **Responsive design** - Mobile-friendly layout
- **Animations** - Count-up stats, countdown timers, hover effects
- **Modern UI** - Card-based layouts with gradients and shadows

## Tech Stack

- **HTML5** - Semantic markup
- **CSS3** - Custom properties, flexbox, grid, animations
- **JavaScript** - Vanilla JS for interactivity
- **Google Fonts** - Inter font family
- **Netlify** - Hosting platform

## Local Development

1. Open any `.html` file in your browser
2. No build process required - pure static site
3. Edit `styles.css` for global style changes
4. Edit individual `.html` files for page-specific content

## Deployment

### Option 1: Netlify CLI (if installed)
```bash
netlify deploy --prod --dir=.
```

### Option 2: Manual Deploy
1. Go to [app.netlify.com](https://app.netlify.com)
2. Log in with account: **markuk2024**
3. Find site: **marvelous-brioche-66e**
4. Drag and drop the entire project folder

### Option 3: Netlify Drop
1. Go to [netlify.com/drop](https://netlify.com/drop)
2. Drag your `lee project` folder
3. Site goes live instantly

## Recent Changes

- Converted from single-page to multi-page site
- Updated site name from "CardVault" to "TCG Vault Protocol"
- Added Pokemon character watermarks to all pages
- Enhanced staking section with card-style layout
- Pokemon blue/yellow color scheme applied throughout

## Color Scheme

```css
--bg-primary: #0a0a1f      /* Dark blue-black */
--bg-secondary: #121230    /* Slightly lighter */
--bg-card: #1a1a40         /* Card backgrounds */
--accent-blue: #3B4CCA     /* Pokemon blue */
--accent-yellow: #FFDE00   /* Pokemon yellow */
--accent-yellow-light: #FFE94D
```

## Pokemon Watermarks by Page

- **Home (index)** - Pikachu
- **Breaks** - Charmander
- **Vault** - Mewtwo
- **Marketplace** - Squirtle
- **Token** - Charizard
- **Roadmap** - Bulbasaur

## Notes

- All pages share the same `styles.css` and `script.js`
- Navigation links point to `.html` files (not sections)
- Countdown timers auto-update via JavaScript
- Treasury value animates on page load
- Site is already configured for Netlify deployment

---

**Last Updated:** March 8, 2026
**Project Path:** `C:\Users\mb202\OneDrive\Desktop\lee project`
