import os
import sys
import json
import argparse
import numpy as np
from opensimplex import OpenSimplex
import matplotlib.pyplot as plt
from matplotlib.colors import LinearSegmentedColormap
from concurrent.futures import ProcessPoolExecutor

# Helper function for process pool executor (must be top-level for multiprocessing pickling)
def _generate_octave_worker(o, seed, width, height, scale, lacunarity, persistence, noise_type):
    gen = OpenSimplex(seed + o * 999) # unique seed offset per octave
    freq = lacunarity ** o
    amp = persistence ** o
    
    x_coords = np.arange(width) / scale * freq
    y_coords = np.arange(height) / scale * freq
    
    # noise2array returns shape (height, width), transpose to get (width, height)
    raw_noise = gen.noise2array(x_coords, y_coords).T
    
    if noise_type == 'ridge':
        # Invert absolute noise to get sharp ridges
        octave_data = (1.0 - np.abs(raw_noise)) * amp
    elif noise_type == 'billow':
        # Absolute noise for puffy, cloud-like formations
        octave_data = np.abs(raw_noise) * amp
    else: # 'simplex'
        octave_data = raw_noise * amp
        
    return octave_data


class TerrainGenerator:
    def __init__(self, width=512, height=512, scale=100.0, octaves=6, 
                 persistence=0.5, lacunarity=2.0, seed=0, noise_type='simplex',
                 biome_blend=False, blend_scale=200.0):
        self.width = width
        self.height = height
        self.scale = scale
        self.octaves = octaves
        self.persistence = persistence
        self.lacunarity = lacunarity
        self.seed = seed
        self.noise_type = noise_type
        self.biome_blend = biome_blend
        self.blend_scale = blend_scale
        
        self.terrain = None
        self.terrain_normalized = None

    def generate(self, parallel=False):
        """Generates the heightmap using vectorized Simplex noise."""
        if self.biome_blend:
            # Generate primary terrain (e.g. simplex/billow)
            primary_generator = TerrainGenerator(
                self.width, self.height, self.scale, self.octaves, 
                self.persistence, self.lacunarity, self.seed, self.noise_type, 
                biome_blend=False
            )
            primary_terrain = primary_generator.generate(parallel)
            
            # Generate secondary terrain (e.g. ridge mountains)
            secondary_generator = TerrainGenerator(
                self.width, self.height, self.scale * 0.7, self.octaves, 
                self.persistence, self.lacunarity, self.seed + 12345, 'ridge', 
                biome_blend=False
            )
            secondary_terrain = secondary_generator.generate(parallel)
            
            # Generate a larger-scale blending mask
            mask_generator = TerrainGenerator(
                self.width, self.height, self.blend_scale, 3, 
                0.5, 2.0, self.seed + 54321, 'simplex', 
                biome_blend=False
            )
            mask = mask_generator.generate(parallel)
            # Normalize mask to [0, 1]
            mask_norm = (mask - np.min(mask)) / (np.max(mask) - np.min(mask) + 1e-8)
            
            # Blend terrains: valleys in mask=1, ridges in mask=0
            self.terrain = primary_terrain * mask_norm + secondary_terrain * (1.0 - mask_norm)
        else:
            if parallel and self.octaves > 1:
                # Parallel octave calculation
                with ProcessPoolExecutor() as executor:
                    futures = [
                        executor.submit(
                            _generate_octave_worker,
                            o, self.seed, self.width, self.height, self.scale,
                            self.lacunarity, self.persistence, self.noise_type
                        )
                        for o in range(self.octaves)
                    ]
                    octaves_data = [f.result() for f in futures]
                    self.terrain = sum(octaves_data)
            else:
                # Sequential vectorized octave calculation
                octaves_data = []
                for o in range(self.octaves):
                    octave_data = _generate_octave_worker(
                        o, self.seed, self.width, self.height, self.scale,
                        self.lacunarity, self.persistence, self.noise_type
                    )
                    octaves_data.append(octave_data)
                self.terrain = sum(octaves_data)

        self.normalize()
        return self.terrain

    def normalize(self):
        """Normalizes the terrain values to be strictly within [0, 1]."""
        t_min = np.min(self.terrain)
        t_max = np.max(self.terrain)
        if t_max - t_min > 0:
            self.terrain_normalized = (self.terrain - t_min) / (t_max - t_min)
        else:
            self.terrain_normalized = np.zeros_like(self.terrain)
        return self.terrain_normalized

    def calculate_hillshade(self, azimuth=315, angle_altitude=45):
        """Computes a shaded normal map (Lambertian shading) to add visual depth."""
        if self.terrain_normalized is None:
            self.normalize()
        
        # Calculate gradients
        dy, dx = np.gradient(self.terrain_normalized)
        
        # Calculate slope and aspect
        slope = np.pi/2.0 - np.arctan(np.sqrt(dx*dx + dy*dy))
        aspect = np.arctan2(-dy, dx)
        
        # Convert light source angles to radians
        azimuth_rad = azimuth * np.pi / 180.0
        altitude_rad = angle_altitude * np.pi / 180.0
        
        # Calculate shaded intensity
        shaded = np.sin(altitude_rad) * np.sin(slope) + \
                 np.cos(altitude_rad) * np.cos(slope) * np.cos(azimuth_rad - aspect)
        
        # Scale to [0, 1]
        shaded = (shaded + 1.0) / 2.0
        return np.clip(shaded, 0, 1)

    def export_heightmap_png(self, filepath):
        """Saves the heightmap as a high-precision 16-bit Grayscale PNG."""
        if self.terrain_normalized is None:
            self.normalize()
        from PIL import Image
        # Scale to 16-bit unsigned integer range (0 - 65535)
        data_16bit = (self.terrain_normalized * 65535).astype(np.uint16)
        img = Image.fromarray(data_16bit, mode='I;16')
        img.save(filepath)
        print(f"Heightmap exported as 16-bit PNG: {filepath}")

    def export_wavefront_obj(self, filepath, scale_z=50.0):
        """Exports the heightmap as a Wavefront OBJ 3D mesh."""
        if self.terrain_normalized is None:
            self.normalize()
        
        # We output vertices and triangulated faces
        with open(filepath, 'w') as f:
            f.write("# Wavefront OBJ exported from Icelandic Aurora Terrain Generator\n")
            f.write(f"# Seed: {self.seed}, Noise Type: {self.noise_type}\n\n")
            
            # Write vertices (X, Z as floor; Y as height)
            for i in range(self.width):
                for j in range(self.height):
                    x = i - self.width / 2.0
                    y = self.terrain_normalized[i][j] * scale_z
                    z = j - self.height / 2.0
                    f.write(f"v {x:.4f} {y:.4f} {z:.4f}\n")
            
            # Write faces
            for i in range(self.width - 1):
                for j in range(self.height - 1):
                    # Vertex indices (1-based index)
                    idx1 = i * self.height + j + 1
                    idx2 = i * self.height + (j + 1) + 1
                    idx3 = (i + 1) * self.height + j + 1
                    idx4 = (i + 1) * self.height + (j + 1) + 1
                    
                    # Face triangles
                    f.write(f"f {idx1} {idx3} {idx2}\n")
                    f.write(f"f {idx2} {idx3} {idx4}\n")
        print(f"Mesh exported as Wavefront OBJ: {filepath}")

    def save_config(self, filepath):
        """Saves current generation configurations to a JSON file."""
        config = {
            'width': self.width,
            'height': self.height,
            'scale': self.scale,
            'octaves': self.octaves,
            'persistence': self.persistence,
            'lacunarity': self.lacunarity,
            'seed': self.seed,
            'noise_type': self.noise_type,
            'biome_blend': self.biome_blend,
            'blend_scale': self.blend_scale
        }
        with open(filepath, 'w') as f:
            json.dump(config, f, indent=4)
        print(f"Configuration saved to: {filepath}")

    @classmethod
    def load_config(cls, filepath):
        """Creates a generator instance using parameters loaded from a JSON file."""
        with open(filepath, 'r') as f:
            config = json.load(f)
        return cls(**config)


def get_aurora_colormap(style='green'):
    """Returns custom color maps representing different Aurora styles."""
    if style == 'solar_flare':
        # Violet base blending into magenta and pink
        colors = [(0, 0, 0), (0.1, 0, 0.25), (0.3, 0, 0.5), (0.6, 0.1, 0.5), (0.9, 0.2, 0.4), (1, 0.5, 0.6)]
    else: # 'green' / 'green_neon_sky'
        # Deep black, deep purple, glowing neon greens
        colors = [(0, 0, 0), (0.05, 0, 0.15), (0.1, 0.05, 0.3), (0.2, 0.5, 0.4), (0.4, 0.8, 0.5), (0.6, 1.0, 0.6)]
    return LinearSegmentedColormap.from_list('aurora', colors)


def run_parameter_comparison(seed=0):
    """Generates comparison plots varying one parameter at a time to avoid execution lock."""
    # We will generate a comparison figure for scale and octaves
    print("Generating parameter comparison subplots...")
    fig, axes = plt.subplots(2, 2, figsize=(10, 8))
    
    # Scale comparison (varying scale while keeping other things constant)
    scales = [15, 30, 60, 120]
    for idx, s in enumerate(scales):
        row, col = idx // 2, idx % 2
        gen = TerrainGenerator(width=200, height=200, scale=s, octaves=4, seed=seed)
        terrain = gen.generate()
        shaded = gen.calculate_hillshade()
        
        # Overlay color on hillshade for dynamic 3D look
        cmap = get_aurora_colormap('green')
        colored = cmap(terrain)
        # Multiply RGB channels by hillshade for shading effect
        colored[:, :, :3] *= shaded[:, :, np.newaxis]
        
        axes[row, col].imshow(colored)
        axes[row, col].set_title(f"Scale: {s}")
        axes[row, col].axis('off')
        
    plt.suptitle("Parameter Comparison: Varying scale (Seed 0)")
    plt.tight_layout()
    plt.show()


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description="Modernised Icelandic Aurora Terrain Generator")
    parser.add_argument('--width', type=int, default=512, help="Width of the terrain")
    parser.add_argument('--height', type=int, default=512, help="Height of the terrain")
    parser.add_argument('--scale', type=float, default=100.0, help="Noise frequency scale")
    parser.add_argument('--octaves', type=int, default=6, help="Number of noise octaves")
    parser.add_argument('--persistence', type=float, default=0.5, help="Amplitude persistence")
    parser.add_argument('--lacunarity', type=float, default=2.0, help="Frequency multiplier")
    parser.add_argument('--seed', type=int, default=0, help="Random generation seed")
    parser.add_argument('--noise-type', type=str, choices=['simplex', 'ridge', 'billow'], default='simplex', help="Base noise profile")
    parser.add_argument('--biome-blend', action='store_true', help="Enable biome blending with ridges")
    parser.add_argument('--blend-scale', type=float, default=200.0, help="Scale for biome blending mask")
    parser.add_argument('--parallel', action='store_true', help="Use parallel process pool for octave generation")
    
    parser.add_argument('--export', type=str, default=None, help="Export terrain as 16-bit PNG heightmap to this path")
    parser.add_argument('--export-obj', type=str, default=None, help="Export terrain as OBJ mesh to this path")
    parser.add_argument('--config', type=str, default=None, help="Save/load configurations from this JSON path")
    parser.add_argument('--colormap', type=str, choices=['green', 'solar_flare'], default='green', help="Colormap style")
    parser.add_argument('--compare-mode', action='store_true', help="Run comparison visualization and exit")

    args = parser.parse_args()

    if args.compare_mode:
        run_parameter_comparison(args.seed)
        sys.exit(0)

    # Initialize generator
    if args.config and os.path.exists(args.config):
        print(f"Loading configuration from {args.config}...")
        generator = TerrainGenerator.load_config(args.config)
    else:
        generator = TerrainGenerator(
            width=args.width, height=args.height, scale=args.scale, 
            octaves=args.octaves, persistence=args.persistence, 
            lacunarity=args.lacunarity, seed=args.seed, 
            noise_type=args.noise_type, biome_blend=args.biome_blend,
            blend_scale=args.blend_scale
        )

    # Generate terrain
    print("Generating terrain heightmap...")
    import time
    start_time = time.time()
    terrain = generator.generate(parallel=args.parallel)
    print(f"Terrain generated in {time.time() - start_time:.4f} seconds.")

    # Save outputs if requested
    if args.export:
        generator.export_heightmap_png(args.export)

    if args.export_obj:
        generator.export_wavefront_obj(args.export_obj)

    if args.config and not os.path.exists(args.config):
        generator.save_config(args.config)

    # Visualize result if no exports were requested, or if visualizer was explicitly requested
    # We display the final 3D-shaded terrain in a window
    if not args.export and not args.export_obj:
        print("Visualizing generated terrain...")
        shaded = generator.calculate_hillshade()
        cmap = get_aurora_colormap(args.colormap)
        colored_terrain = cmap(terrain)
        colored_terrain[:, :, :3] *= shaded[:, :, np.newaxis]
        
        plt.figure(figsize=(8, 8))
        plt.imshow(colored_terrain)
        plt.title(f"Icelandic Aurora Terrain ({args.noise_type.capitalize()} Noise, Seed: {args.seed})")
        plt.axis('off')
        plt.show()
