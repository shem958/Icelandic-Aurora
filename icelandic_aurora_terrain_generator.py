import numpy as np
from opensimplex import OpenSimplex
import matplotlib.pyplot as plt
from matplotlib.colors import LinearSegmentedColormap



# Generate Perlin Noise 
def generate_terrain(width, height, scale, octaves, persistence, lacunarity, seed):
    terrain = np.zeros((width, height))
    gen = OpenSimplex(seed)
    
    
    for i in range(width):
       for j in range(height):
           noise = 0
           freq = 1
           amp = 1
           for _ in range(octaves):
               x = i / scale * freq
               y = j / scale * freq
               noise += gen.noise2(x, y) * amp
               freq *= lacunarity
               amp *= persistence
               terrain[i][j] = noise
               
    return terrain

# Normalize Terrain
def normalize_terrain(terrain):
    terrain_normalized = (terrain - np.min(terrain)) / (np.max(terrain) - np.min(terrain))
    return terrain_normalized

# Visualize Terrain
def visualize_terrain(terrain, colormap):
    plt.imshow(terrain, cmap=colormap())
    plt.colorbar()
    plt.show()

# Add color for Aurora effect

def aurora_colormap():
    colors = [(0, 0, 0), (0.1, 0, 0.2), (0.2, 0, 0.4), (0.5, 0, 0.6), (0.8, 0, 0.9), (1, 0, 1)]
    cmap = LinearSegmentedColormap.from_list('aurora', colors)
    return cmap


# Generate and Visualize Terrain
width = 100 
height = 100
scale = 20
octaves = 6
persistence = 0.5
lacunarity = 2.0
seed = 0

terrain = generate_terrain(width, height, scale, octaves, persistence, lacunarity, seed)
terrain_normalized = normalize_terrain(terrain)
visualize_terrain(terrain_normalized, colormap=aurora_colormap)

scale_values = [10, 20, 50, 100]
octave_values = [3, 4, 6, 8]
persistence_values = [0.3, 0.5, 0.7, 0.9]
lacunarity_values = [1.5, 2.0, 2.5, 3.0]

for scale in scale_values:
    for octaves in octave_values:
        for persistence in persistence_values:
            for lacunarity in lacunarity_values:
                terrain = generate_terrain(width, height, scale, octaves, persistence, lacunarity, seed)
                terrain_normalized = normalize_terrain(terrain)
                visualize_terrain(terrain_normalized, colormap=aurora_colormap)

