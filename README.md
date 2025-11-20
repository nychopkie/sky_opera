# 🚁 Drone Swarm Boid Simulation System

A thousand-scale drone 3D swarm behavior simulation system based on the **Boid algorithm**. Supports real-time parameter adjustment for swarm intelligence, drone formation, and cluster behavior research.

![TypeScript](https://img.shields.io/badge/TypeScript-5.6-blue)
![Three.js](https://img.shields.io/badge/Three.js-0.169-green)
![Vite](https://img.shields.io/badge/Vite-5.4-purple)
![License](https://img.shields.io/badge/License-MIT-yellow)

## ✨ Core Features

### 🎯 Complete Boid Algorithm Parameter System
- **Core behavior weights**: Separation, Alignment, Cohesion, Wander, Target attraction, Obstacle avoidance (reserved)
- **Perception distance control**: Independently set perception ranges for each behavior
- **Motion constraints**: Maximum speed, steering force, acceleration limits
- **Vision system**: Optional vision cone restriction (0-360° adjustable)
- **Boundary behavior**: Wrap-around, bounce, soft boundary modes

### ⚡ High Performance Optimization
- **Spatial hash grid**: O(1) neighbor search, supports thousand-scale Boids
- **Instanced rendering**: Single draw call renders all drones
- **Configurable neighbor count**: Limit maximum neighbor detection
- **Performance monitoring panel**: Real-time FPS, update time, spatial partitioning stats

### 🎨 City Sky Environment
- **Gradient skybox**: Simulates realistic sky colors
- **Procedural buildings**: Randomly generated city architecture
- **Dynamic lighting**: Directional light + ambient light + hemisphere light
- **Real-time shadows**: High-quality soft shadows

### 🎮 Interactive Controls
- **20+ adjustable parameters**: Covers all core algorithm parameters
- **4 preset modes**: Calm flight, chaotic mode, tight formation, exploration mode
- **Mouse interaction**: Drag to rotate view, scroll to zoom
- **Configuration import/export**: Save and load custom configurations

## 🚀 Quick Start

### Install Dependencies

```bash
npm install
```

### Start Development Server

```bash
npm run dev
```

The browser will automatically open `http://localhost:3000`

### Build Production Version

```bash
npm run build
```

### Preview Production Build

```bash
npm run preview
```

## 📦 Technology Stack

| Technology | Purpose | Version |
|------------|---------|---------|
| **TypeScript** | Type-safe development language | 5.6+ |
| **Three.js** | WebGL 3D rendering engine | 0.169+ |
| **Vite** | Modern build tool | 5.4+ |
| **lil-gui** | Parameter debugging panel | 0.19+ |

## 🎛️ Parameter Explanation

### Core Behavior Weights

| Parameter | Description | Recommended Range | Default Value |
|-----------|-------------|-------------------|---------------|
| `separationWeight` | Separation behavior weight (avoid crowding) | 0.5 - 3.0 | 1.5 |
| `alignmentWeight` | Alignment behavior weight (direction consistency) | 0.5 - 2.0 | 1.0 |
| `cohesionWeight` | Cohesion behavior weight (maintain gathering) | 0.5 - 2.0 | 1.0 |
| `wanderWeight` | Wander behavior weight (random exploration) | 0.0 - 2.0 | 0.1 |
| `targetWeight` | Target attraction weight | 0.0 - 2.0 | 0.5 |

### Perception Distances

| Parameter | Description | Recommended Range | Default Value |
|-----------|-------------|-------------------|---------------|
| `separationDistance` | Separation perception distance | 10 - 50 | 25 |
| `alignmentDistance` | Alignment perception distance | 30 - 100 | 50 |
| `cohesionDistance` | Cohesion perception distance | 30 - 100 | 50 |

### Motion Parameters

| Parameter | Description | Recommended Range | Default Value |
|-----------|-------------|-------------------|---------------|
| `maxSpeed` | Maximum speed | 2.0 - 10.0 | 4.0 |
| `maxForce` | Maximum steering force | 0.05 - 0.5 | 0.1 |
| `maxAcceleration` | Maximum acceleration | 0.2 - 1.0 | 0.5 |

### Performance Optimization

| Parameter | Description | Recommended Range | Default Value |
|-----------|-------------|-------------------|---------------|
| `spatialHashCellSize` | Spatial grid cell size | 30 - 100 | 50 |
| `maxNeighbors` | Maximum neighbor detection count | 30 - 100 | 50 |

## 🎨 Preset Modes

### 🕊️ Calm Flight
Suitable for demonstrating stable swarm flight behavior. Drones maintain moderate spacing with coordinated overall movement.

### 🌪️ Chaotic Mode
High speed, high randomness. Suitable for testing system stability under extreme conditions.

### 🎯 Tight Formation
Drones maintain tight formations, suitable for simulating military formations or collaborative operation scenarios.

### 🔍 Exploration Mode
Enhanced random wandering behavior, suitable for simulating search and patrol tasks.

## 📐 Algorithm Principles

### Three Core Boid Rules

1. **Separation**
   - Avoid collisions with nearby Boids
   - Stronger repulsion force at closer distances
   - Formula: `steering = Σ(position - neighbor.position) / distance²`

2. **Alignment**
   - Maintain the same flight direction as neighbors
   - Calculate average neighbor velocity
   - Formula: `steering = avg(neighbor.velocity) - velocity`

3. **Cohesion**
   - Move toward the center of mass of neighbors
   - Maintain group cohesion
   - Formula: `steering = avg(neighbor.position) - position`

### Spatial Optimization

Uses **Spatial Hash Grid** to accelerate neighbor search:

```
Time Complexity: O(n) → O(n/k)
where k is the number of grid cells
```

Divides 3D space into fixed-size grids. Each Boid only checks neighbors in adjacent grid cells, significantly reducing computation.

## 🔧 Advanced Features

### Target Point Attraction

When enabled, all Boids are attracted to the target point, suitable for simulating:
- Formation flight to specific positions
- Rendezvous behavior
- Path planning

### Leader Mode (Reserved)

Supports setting some Boids as leaders that others follow.

### Obstacle Avoidance (Reserved)

Parameters `avoidanceWeight` and `avoidanceDistance` are reserved for future obstacle avoidance functionality.

## 📊 Performance Metrics

Performance in modern browsers:

| Drone Count | FPS | Update Time | Notes |
|-------------|-----|-------------|-------|
| 500 | 60 | ~5ms | Smooth |
| 1000 | 60 | ~10ms | Recommended |
| 2000 | 45-60 | ~20ms | Acceptable |
| 5000 | 30-45 | ~40ms | Reduce quality |

*Test Environment: Chrome 120, M1 Pro, macOS*

## 🛠️ Project Structure

```
Boid/
├── src/
│   ├── main.ts              # Main entry point
│   ├── BoidConfig.ts        # Parameter configuration class
│   ├── Boid.ts              # Individual Boid entity
│   ├── BoidSystem.ts        # Swarm management system
│   ├── SpatialHash.ts       # Spatial hash optimization
│   ├── Scene.ts             # Three.js scene
│   ├── Controls.ts          # GUI control panel
│   └── style.css            # Stylesheet
├── index.html               # HTML template
├── package.json             # Dependency configuration
├── tsconfig.json            # TypeScript configuration
├── vite.config.ts           # Vite configuration
└── README.md                # Project documentation
```

## 🎓 Application Scenarios

- 🚁 **Drone formation research**: Test different formation strategies
- 🐦 **Swarm intelligence simulation**: Study emergent cluster behavior
- 🎮 **Game development**: NPC swarm AI, bird/flock effects
- 📊 **Data visualization**: Particle systems, flow field visualization
- 🎓 **Educational demonstrations**: Algorithm teaching, parameter effect demonstration

## 🔮 Future Extension Directions

- [ ] **Obstacle avoidance system**: Octree spatial partitioning + ray detection
- [ ] **Path planning integration**: A* algorithm combined with Boid
- [ ] **Formation mode library**: V-shaped, arrow, circular preset formations
- [ ] **Multi-species system**: Predator-prey simulation
- [ ] **WebGPU support**: GPU-accelerated computation, supports 10k+ Boids
- [ ] **Data export**: Trajectory data, statistical analysis
- [ ] **VR/AR support**: Immersive experience

## 📝 Configuration Import/Export

### Export Configuration

Click the "💾 Export Config" button in the GUI panel to save current parameters as a JSON file.

### Import Configuration

Click the "📂 Import Config" button and select a previously exported JSON file to restore the configuration.

### Configuration File Format

```json
{
  "separationWeight": 1.5,
  "alignmentWeight": 1.0,
  "cohesionWeight": 1.0,
  "maxSpeed": 4.0,
  "bounds": {
    "min": [-500, 0, -500],
    "max": [500, 500, 500]
  }
}
```

## 🤝 Contribution Guidelines

Welcome to submit Issues and Pull Requests!

## 📄 License

MIT License

## 👨‍💻 Author

VisLab Research Team

## 🙏 Acknowledgments

- [Three.js](https://threejs.org/) - Powerful WebGL engine
- [Craig Reynolds](http://www.red3d.com/cwr/boids/) - Boid algorithm inventor
- [lil-gui](https://lil-gui.georgealways.com/) - Elegant debugging panel

---

**⭐ If this project helps you, please give it a Star!**

