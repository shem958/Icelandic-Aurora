# Icelandic Aurora Terrain Generator

A modern, high-performance hybrid desktop-and-web 3D landscape terrain generator illuminated by animated, dancing aurora curtains.

This project combines a **JIT-compiled Python CLI backend** for batch production-grade heightmap exporting, and an **interactive WebGL 3D showcase** for real-time visual design and configuration sharing.

---

## 🌟 Key Features

### 1. Python CLI Backend
- **NumPy Vectorization**: Vectorized coordinate evaluation utilizing `opensimplex.noise2array()` to eliminate slow Python nested loops.
- **Numba JIT Compilation**: Compiles noise calculations to native machine code on-the-fly, yielding a **22x speedup** (generating a $256 \times 256$ grid in **0.76 seconds**).
- **Advanced Noise Layering**: Includes standard Simplex, **Ridge noise** (`1.0 - abs(noise)`) for sharp mountains, and **Billow noise** (`abs(noise)`) for cloud/light profiles.
- **Biome Blending**: Blends valleys and mountain ranges smoothly using a secondary large-scale noise mask.
- **Normal Shading**: Implements a GIS-standard Lambertian hillshade model to give 2D heightmap outputs depth and shadow detail.
- **Production Exports**: Saves terrain as high-precision 16-bit Grayscale PNGs (ideal for game engines like Unity/Unreal) and Wavefront `.obj` 3D meshes.
- **State Configuration**: Supports saving and loading parameter states via JSON configuration files.

### 2. Interactive WebGL Client (Vite + React + Three.js)
- **Live 3D Viewport**: An interactive 3D mesh that responds instantly to parameter adjustments.
- **Animated Aurora Shaders**: Three-layered light ribbons displaced and animated using custom GLSL shaders to ripple and shimmer dynamically above the landscape.
- **Aesthetic Profiles**: Preset color gradients (*Green Neon Sky*, *Solar Flare*, *Nordic Ice*) alongside custom color pickers.
- **Exporting Suite**: Downloads custom `.obj` meshes and JSON parameter configs directly from the browser.
- **CLI Command Alignment**: Generates the exact Python command for your current web configuration in real-time.

---

## 🛠️ Installation & Setup

### Prerequisites
- Node.js (v24+) & npm (v11+)
- Python (3.13+)

### 1. Python CLI Environment Setup
1. Create a virtual environment and activate it:
   ```bash
   py -m venv venv
   # On Windows:
   venv\Scripts\activate
   # On macOS/Linux:
   source venv/bin/activate
   ```
2. Install dependencies:
   ```bash
   pip install numpy opensimplex matplotlib pillow numba
   ```

### 2. Run the Python CLI Generator
Generate terrain using custom parameters:
```bash
python icelandic_aurora_terrain_generator.py --width 512 --height 512 --scale 100 --octaves 5 --export my_terrain.png --export-obj my_terrain.obj --config config.json
```
For a parameter comparison visualization, run:
```bash
python icelandic_aurora_terrain_generator.py --compare-mode
```

---

## 🌐 Running the Web Application Locally

1. Navigate to the `web-viewer` directory:
   ```bash
   cd web-viewer
   ```
2. Install npm packages:
   ```bash
   npm install
   ```
3. Boot the development server:
   ```bash
   npm run dev
   ```
4. Open your browser and navigate to **[http://localhost:5173/](http://localhost:5173/)**.

---

## 🔄 Dynamic Workflow

1. **Design Visually**: Open the Web App locally and adjust the sliders (Scale, Octaves, Height, Seed) to craft your landscape.
2. **Select Color Preset**: Pick a preset or choose custom hex pickers to see the auroras illuminate the landscape.
3. **Generate Python CLI command**: Copy the auto-generated command from the bottom of the sidebar.
4. **Export in High Resolution**: Paste the command into your terminal to generate high-resolution heightmaps and 3D OBJ assets locally using Python!
