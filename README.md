# 3D City Renderer

A high-performance WebGL-based renderer for procedural 3D city visualizations built with Three.js and JavaScript.

**Status:** Experimental — more or less actively under development.

![Example Image](https://github.com/TropicSnowJPR/3D_City_Renderer/blob/master/Example.png?raw=true)

## Features

- 🏙️ **Procedural 3D City Generation** - Dynamic loading and rendering of city objects from OpenStreetMap data
- 🎮 **Interactive Camera Controls** - Smooth navigation through the 3D environment
- 🎨 **Advanced Post-Processing** - FXAA anti-aliasing for smooth edges
- 🌅 **Dynamic Lighting & Shadows** - Realistic directional lighting with configurable shadow maps
- 🗺️ **Map Integration** - Interactive map controller for spatial navigation using Leaflet
- ⚙️ **GUI Controls** - Real-time parameter adjustment with lil-gui
- 📦 **Modular Architecture** - Clean separation of concerns with dedicated controllers
- 🎨 **Multiple Color Modes** - Default, dark, and special color schemes
- 🔧 **CSG Operations** - Complex geometry using three-bvh-csg for boolean operations

## Project Structure

```
3D_City_Renderer/
├── src/
│   ├── controllers/
│   │   ├── MapController.ts              # Map integration and navigation
│   │   ├── GuiController.ts              # UI controls
│   │   └── CameraController.ts           # Camera movement and controls
│   ├── core/
│   │   ├── App.ts                        # Main application setup and rendering loop
│   │   └── Version.ts                    # Version tracking
│   ├── services/
│   │   ├── ApiService.ts                 # Data fetching and management
│   │   ├── FileService.ts                # File handling
│   │   └── ConfigService.ts              # Configuration management
│   ├── Server.ts                         # Express server setu
│   └── vite.config.ts                    # API route handlers
├── data/
│   ├── config.json                       # Global configuration
│   ├── obj_index.json                    # Object index
│   └── objects/                          # 3D object data (JSON + geometry)
├── package.json                          # Dependencies and scripts
└── index.html                            # Entry point
```

## Getting Started

### Prerequisites

- Node.js (v14 or higher)
- npm or yarn

### Installation

```bash
npm install
```

### Server

Start the server:

```bash
npm run server
```

Then open your browser to the URL shown in the terminal (typically `http://127.0.0.1:3000`).


## Current Challenges

- Shadow border pixelation at high detail levels
- Shadow artifacts where objects intersect
- Performance optimization for large scenes with many geometries


## Configuration

The application uses a configuration system that persists settings in localStorage. Key configurations include:

- Camera position, FOV, and movement speed
- Location (latitude, longitude, radius)
- Color mode (default, dark, special)
- Debug mode


## Inspiration

Inspired by: https://github.com/milos-agathon/3d-osm-city


## Contributing

Bug reports and suggestions are welcome! Feel free to open an issue or submit a pull request.


## License

See `LICENSE.md` for licensing information.

---

Note: This is a personal project, so commit messages may vary in formality. Some are quick notes or auto-generated summaries. :)
