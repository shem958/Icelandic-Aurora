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

"""
Importing Libraries:

The code begins by importing necessary libraries:
numpy (as np) for numerical operations.
OpenSimplex from the opensimplex module for generating Perlin noise.
matplotlib.pyplot (as plt) for visualization.
LinearSegmentedColormap from matplotlib.colors for creating a custom colormap.
Function Definitions:

generate_terrain: This function generates Perlin noise to create terrain.

It takes parameters such as width, height, scale, octaves, persistence, lacunarity, and seed.
It initializes an array terrain with zeros of size (width, height).
Using the OpenSimplex object gen, it generates Perlin noise at each point in the array using nested loops.
It returns the generated terrain.
normalize_terrain: This function normalizes the generated terrain to be within the range [0, 1].

It takes the terrain array as input.
It calculates the normalized terrain using numpy operations and returns it.
visualize_terrain: This function visualizes the terrain using Matplotlib.

It takes the terrain array and a colormap function as input.
It uses Matplotlib's imshow() function to display the terrain with the specified colormap.
It adds a colorbar to the plot and displays it.
aurora_colormap: This function defines a custom colormap for the aurora effect.

It creates a colormap using colors defined in a list and returns it.
Setting Parameters:

The code sets up parameters for generating and visualizing the initial terrain:
width and height determine the dimensions of the terrain grid.
scale, octaves, persistence, lacunarity, and seed are parameters for generating the initial terrain.
Generating and Visualizing Initial Terrain:

The code generates terrain using the generate_terrain function with the specified parameters.
It normalizes the terrain using the normalize_terrain function.
It visualizes the normalized terrain using the visualize_terrain function with the custom colormap.
Experimentation Loop:

The code then sets up a nested loop to iterate over different combinations of parameters for scale, octaves, persistence, and lacunarity.
For each combination, it generates terrain, normalizes it, and visualizes it using the same visualize_terrain function.
This loop allows for experimenting with different parameter values to observe their effects on the generated terrain.

"""
