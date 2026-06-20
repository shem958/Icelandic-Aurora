import React, { useState } from 'react';
import TerrainViewer from './components/TerrainViewer';
import './App.css';

const COLOR_PRESETS = {
  green_neon: {
    name: 'Green Neon Sky',
    base: '#030522',
    peak: '#00ff77',
    terrainColor: '#050714',
  },
  solar_flare: {
    name: 'Solar Flare',
    base: '#3a0055',
    peak: '#ff00aa',
    terrainColor: '#080514',
  },
  nordic_ice: {
    name: 'Nordic Ice',
    base: '#002244',
    peak: '#00e5ff',
    terrainColor: '#020710',
  },
  custom: {
    name: 'Custom Palette',
  }
};

function App() {
  // Terrain state parameters
  const [params, setParams] = useState({
    width: 512,
    height: 512,
    scale: 100.0,
    octaves: 5,
    persistence: 0.45,
    lacunarity: 2.0,
    seed: 42,
    noiseType: 'simplex',
    biomeBlend: false,
    blendScale: 220.0,
    heightMultiplier: 35.0,
  });

  // Colors state
  const [selectedPreset, setSelectedPreset] = useState('green_neon');
  const [colors, setColors] = useState({
    base: COLOR_PRESETS.green_neon.base,
    peak: COLOR_PRESETS.green_neon.peak,
    terrainColor: COLOR_PRESETS.green_neon.terrainColor,
  });

  // UI helpers
  const [exportTrigger, setExportTrigger] = useState(false);
  const [cliCopied, setCliCopied] = useState(false);

  const handleParamChange = (key, val) => {
    setParams(prev => ({
      ...prev,
      [key]: val
    }));
  };

  const handlePresetSelect = (presetKey) => {
    setSelectedPreset(presetKey);
    if (presetKey !== 'custom') {
      setColors({
        base: COLOR_PRESETS[presetKey].base,
        peak: COLOR_PRESETS[presetKey].peak,
        terrainColor: COLOR_PRESETS[presetKey].terrainColor,
      });
    }
  };

  const handleColorChange = (key, val) => {
    setSelectedPreset('custom');
    setColors(prev => ({
      ...prev,
      [key]: val
    }));
  };

  const handleRandomSeed = () => {
    handleParamChange('seed', Math.floor(Math.random() * 10000));
  };

  // Generate python CLI command based on current parameters
  const getCliCommand = () => {
    let cmd = `python icelandic_aurora_terrain_generator.py --width ${params.width} --height ${params.height} --scale ${params.scale} --octaves ${params.octaves} --persistence ${params.persistence} --lacunarity ${params.lacunarity} --seed ${params.seed} --noise-type ${params.noiseType}`;
    if (params.biomeBlend) {
      cmd += ` --biome-blend --blend-scale ${params.blendScale}`;
    }
    cmd += ` --export terrain.png --export-obj terrain.obj`;
    return cmd;
  };

  const handleCopyCli = () => {
    navigator.clipboard.writeText(getCliCommand());
    setCliCopied(true);
    setTimeout(() => setCliCopied(false), 2000);
  };

  // Export current config as JSON
  const handleExportConfig = () => {
    const configData = {
      ...params,
      colors: {
        preset: selectedPreset,
        ...colors
      }
    };
    const blob = new Blob([JSON.stringify(configData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `aurora_config_seed_${params.seed}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  // Import config from JSON
  const handleImportConfig = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const config = JSON.parse(event.target.result);
        
        // Extract parameters
        const newParams = {
          width: config.width || 512,
          height: config.height || 512,
          scale: config.scale || 100.0,
          octaves: config.octaves || 5,
          persistence: config.persistence || 0.45,
          lacunarity: config.lacunarity || 2.0,
          seed: config.seed ?? 42,
          noiseType: config.noiseType || 'simplex',
          biomeBlend: !!config.biomeBlend,
          blendScale: config.blendScale || 220.0,
          heightMultiplier: config.heightMultiplier || 35.0,
        };
        setParams(newParams);

        // Extract colors
        if (config.colors) {
          setSelectedPreset(config.colors.preset || 'custom');
          setColors({
            base: config.colors.base || '#030522',
            peak: config.colors.peak || '#00ff77',
            terrainColor: config.colors.terrainColor || '#050714',
          });
        }
      } catch (err) {
        alert('Invalid configuration JSON file.');
      }
    };
    reader.readAsText(file);
    e.target.value = null; // reset file input
  };

  return (
    <div className="app-container">
      {/* Sidebar Control Panel */}
      <div className="control-panel">
        <header className="panel-header">
          <h1>Icelandic Aurora</h1>
          <p>Interactive 3D Terrain Generator</p>
        </header>

        <div className="scrollable-content">
          {/* Section 1: Noise Settings */}
          <section className="control-section">
            <h2>Noise Architecture</h2>
            
            <div className="control-group">
              <label>Noise Profile</label>
              <select 
                value={params.noiseType} 
                onChange={(e) => handleParamChange('noiseType', e.target.value)}
                disabled={params.biomeBlend}
              >
                <option value="simplex">Simplex (FBM)</option>
                <option value="ridge">Ridge (Mountains)</option>
                <option value="billow">Billow (Clouds/Lights)</option>
              </select>
            </div>

            <div className="control-group checkbox-group">
              <label htmlFor="biomeBlend">Enable Biome Blending</label>
              <input 
                id="biomeBlend"
                type="checkbox" 
                checked={params.biomeBlend} 
                onChange={(e) => handleParamChange('biomeBlend', e.target.checked)}
              />
            </div>

            {params.biomeBlend && (
              <div className="control-group">
                <div className="label-val">
                  <label>Blend Mask Scale</label>
                  <span>{params.blendScale}</span>
                </div>
                <input 
                  type="range" min="50" max="500" step="5"
                  value={params.blendScale} 
                  onChange={(e) => handleParamChange('blendScale', parseFloat(e.target.value))}
                />
              </div>
            )}

            <hr />

            <div className="control-group">
              <div className="label-val">
                <label>Noise Scale (Frequency)</label>
                <span>{params.scale}</span>
              </div>
              <input 
                type="range" min="20" max="250" step="1"
                value={params.scale} 
                onChange={(e) => handleParamChange('scale', parseFloat(e.target.value))}
              />
            </div>

            <div className="control-group">
              <div className="label-val">
                <label>Octaves</label>
                <span>{params.octaves}</span>
              </div>
              <input 
                type="range" min="1" max="8" step="1"
                value={params.octaves} 
                onChange={(e) => handleParamChange('octaves', parseInt(e.target.value))}
              />
            </div>

            <div className="control-group">
              <div className="label-val">
                <label>Persistence (Roughness)</label>
                <span>{params.persistence.toFixed(2)}</span>
              </div>
              <input 
                type="range" min="0.1" max="0.9" step="0.05"
                value={params.persistence} 
                onChange={(e) => handleParamChange('persistence', parseFloat(e.target.value))}
              />
            </div>

            <div className="control-group">
              <div className="label-val">
                <label>Lacunarity (Detail)</label>
                <span>{params.lacunarity.toFixed(2)}</span>
              </div>
              <input 
                type="range" min="1.2" max="3.5" step="0.05"
                value={params.lacunarity} 
                onChange={(e) => handleParamChange('lacunarity', parseFloat(e.target.value))}
              />
            </div>
          </section>

          {/* Section 2: Terrain Settings */}
          <section className="control-section">
            <h2>Heightmap Settings</h2>
            
            <div className="control-group">
              <div className="label-val">
                <label>Height Multiplier</label>
                <span>{params.heightMultiplier}m</span>
              </div>
              <input 
                type="range" min="5" max="100" step="1"
                value={params.heightMultiplier} 
                onChange={(e) => handleParamChange('heightMultiplier', parseFloat(e.target.value))}
              />
            </div>

            <div className="control-group">
              <label>Seed</label>
              <div className="seed-input-row">
                <input 
                  type="number" 
                  value={params.seed} 
                  onChange={(e) => handleParamChange('seed', parseInt(e.target.value) || 0)}
                />
                <button onClick={handleRandomSeed} className="btn btn-secondary">🎲 Roll</button>
              </div>
            </div>
          </section>

          {/* Section 3: Visuals & Aesthetics */}
          <section className="control-section">
            <h2>Aesthetic Profiles</h2>
            
            <div className="control-group">
              <label>Color Preset</label>
              <div className="preset-grid">
                {Object.keys(COLOR_PRESETS).map((key) => (
                  <button 
                    key={key} 
                    className={`btn preset-btn ${selectedPreset === key ? 'active' : ''}`}
                    onClick={() => handlePresetSelect(key)}
                  >
                    {COLOR_PRESETS[key].name}
                  </button>
                ))}
              </div>
            </div>

            <div className="custom-color-pickers">
              <div className="color-picker-item">
                <label>Aurora Base</label>
                <input 
                  type="color" 
                  value={colors.base} 
                  onChange={(e) => handleColorChange('base', e.target.value)}
                />
              </div>
              <div className="color-picker-item">
                <label>Aurora Peak</label>
                <input 
                  type="color" 
                  value={colors.peak} 
                  onChange={(e) => handleColorChange('peak', e.target.value)}
                />
              </div>
              <div className="color-picker-item">
                <label>Terrain Base</label>
                <input 
                  type="color" 
                  value={colors.terrainColor} 
                  onChange={(e) => handleColorChange('terrainColor', e.target.value)}
                />
              </div>
            </div>
          </section>

          {/* Section 4: Production Export */}
          <section className="control-section">
            <h2>Production Export</h2>
            <div className="export-btn-row">
              <button onClick={() => setExportTrigger(true)} className="btn btn-primary">
                💾 Export 3D Mesh (.obj)
              </button>
              <button onClick={handleExportConfig} className="btn btn-secondary">
                📤 Export Config
              </button>
            </div>
            <div className="import-row">
              <label htmlFor="import-config" className="btn btn-secondary btn-full text-center cursor-pointer">
                📥 Import Config (.json)
              </label>
              <input 
                id="import-config" 
                type="file" 
                accept=".json" 
                onChange={handleImportConfig} 
                style={{ display: 'none' }}
              />
            </div>
          </section>
        </div>

        {/* CLI Integration Section */}
        <footer className="panel-footer">
          <div className="cli-container">
            <div className="cli-header">
              <span>Python CLI Equivalent</span>
              <button onClick={handleCopyCli} className="btn btn-copy">
                {cliCopied ? 'Copied!' : 'Copy'}
              </button>
            </div>
            <code className="cli-code">{getCliCommand()}</code>
          </div>
        </footer>
      </div>

      {/* Main 3D Viewport */}
      <div className="viewport-container">
        <div className="viewport-header">
          <div className="badge">WebGL 3D Mode</div>
          <div className="instructions">🖱️ Left Click + Drag to Rotate | 🖱️ Right Click + Drag to Pan | Scroll to Zoom</div>
        </div>
        
        <TerrainViewer 
          params={params} 
          colors={colors} 
          exportTrigger={exportTrigger}
          onExported={() => setExportTrigger(false)}
        />
      </div>
    </div>
  );
}

export default App;
