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
├── client/
│   └── src/                      
│       ├── controllers/   
│       │   ├── MapController.js              # Map integration and navigation
│       │   ├── GUIController.js              # UI controls
│       │   ├── CameraController.js           # Camera movement and controls    
│       │   └── SceneController.js            # Scene management and rendering
│       ├── core/
│       │   ├── App.js                        # Main application setup and rendering loop
│       │   └── version.js                    # Version tracking
│       └── services/
│           ├── ApiService.js                 # Data fetching and management
│           ├── FileService.js                # File handling
│           └── ConfigService.js              # Configuration management
├── server/ 
│   ├── src/
│   │   ├── Server.js                         # Express server setup
│   │   └── vite.config.js                    # API route handlers
│   └── data/             
│       ├── config.json                       # Global configuration
│       ├── obj_index.json                    # Object index
│       ├── point_index.json                  # Point data index
│       ├── objects/                          # 3D object data (JSON + geometry)
│       └── points/    
├── index.html                                # Entry point
└── package.json                              # Dependencies and scripts
```

## Getting Started

### Prerequisites

- Node.js (v14 or higher)
- npm or yarn

### Installation

```bash
npm install
```

### Development

Start the development server:

```bash
npm run dev
```

Start the API server (in a separate terminal):

```bash
npm run server
```

Then open your browser to the URL shown in the terminal (typically `http://localhost:5173`).

### Build

```bash
npm run build
```

## Current Challenges

- Shadow border pixelation at high detail levels
- FXAA causing sky color desaturation issues
- Shadow artifacts where objects intersect
- Performance optimization for large scenes with many geometries

## Planned Features

- [ ] **Performance Optimization**
  - [ ] LOD (Level of Detail) system
  - [ ] Frustum culling
  - [ ] Instanced rendering for repeated objects
  - [ ] Occlusion culling
- [ ] **Enhanced Shadow Quality**
  - [ ] PCF (Percentage Closer Filtering) improvements
  - [ ] Contact shadow optimization
  - [ ] Shadow acne and peter-panning fixes
- [ ] **Improved Post-Processing**
  - [ ] Additional anti-aliasing options (TAA, SMAA)
  - [ ] Bloom and tone mapping
  - [ ] Ambient occlusion
- [ ] **Improved User Interface for Map Navigation**
- [x] **Multiple Lighting Scenarios** (Day/Night/Weather)
- [ ] **Texture Support**

## Technologies

- **Three.js** (v0.181.1) - 3D rendering engine
- **three-bvh-csg** - CSG (Constructive Solid Geometry) operations
- **Vite** - Build tool and dev server
- **Leaflet** - Interactive map library
- **lil-gui** - Lightweight GUI controls
- **Express** - Backend API server
- **WebGL** - Hardware-accelerated graphics
- **JavaScript (ES6+)** - Core language

## Configuration

The application uses a configuration system that persists settings in localStorage. Key configurations include:

- Camera position, FOV, and movement speed
- Location (latitude, longitude, radius)
- Color mode (default, dark, special)
- Debug mode
- FXAA settings

## API

The project includes a local Express server that handles:

- Fetching OpenStreetMap data
- Caching object geometries
- Configuration management

## Inspiration

Inspired by: https://github.com/milos-agathon/3d-osm-city

## Contributing

Bug reports and suggestions are welcome! Feel free to open an issue or submit a pull request.

## License

See `LICENSE.md` for licensing information.

---

*Note: This is a personal project, so commit messages may vary in formality. Some are quick notes or auto-generated summaries.* 😊 

