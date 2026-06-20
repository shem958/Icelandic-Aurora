import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { SimplexNoise } from '../utils/simplex';

const TerrainViewer = ({ params, colors, exportTrigger, onExported }) => {
  const mountRef = useRef(null);
  const sceneRef = useRef(null);
  const terrainGeoRef = useRef(null);
  const terrainMatRef = useRef(null);
  const auroraMatRef = useRef(null);
  const controlsRef = useRef(null);

  // Trigger OBJ export
  useEffect(() => {
    if (exportTrigger && terrainGeoRef.current) {
      exportToObj(terrainGeoRef.current, params);
      onExported();
    }
  }, [exportTrigger]);

  // Handle color updates
  useEffect(() => {
    if (auroraMatRef.current && terrainMatRef.current) {
      const baseCol = new THREE.Color(colors.base);
      const peakCol = new THREE.Color(colors.peak);
      const terrainCol = new THREE.Color(colors.terrainColor || '#0a0d1a');
      
      auroraMatRef.current.uniforms.uColorBase.value = baseCol;
      auroraMatRef.current.uniforms.uColorPeak.value = peakCol;
      
      terrainMatRef.current.color = terrainCol;
      
      // Update fog color to match base aurora slightly
      if (sceneRef.current) {
        sceneRef.current.fog.color = new THREE.Color('#03050a');
      }
    }
  }, [colors]);

  // Handle geometry updates when parameters change
  useEffect(() => {
    if (terrainGeoRef.current) {
      updateTerrainGeometry(terrainGeoRef.current, params);
    }
  }, [params]);

  useEffect(() => {
    // 1. Setup Scene, Camera, Renderer
    const width = mountRef.current.clientWidth;
    const height = mountRef.current.clientHeight;
    
    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#03050a');
    scene.fog = new THREE.FogExp2('#03050a', 0.003);
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(55, width / height, 0.1, 1000);
    camera.position.set(0, 80, 160);

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    
    // Clear any previous canvas
    mountRef.current.innerHTML = '';
    mountRef.current.appendChild(renderer.domElement);

    // 2. Setup Orbit Controls
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.maxPolarAngle = Math.PI / 2.1; // prevent camera going below floor
    controls.minDistance = 20;
    controls.maxDistance = 400;
    controlsRef.current = controls;

    // 3. Setup Lights
    const ambientLight = new THREE.AmbientLight('#080d24', 1.2);
    scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight('#1aa3ff', 2.0);
    dirLight.position.set(100, 150, 50);
    dirLight.castShadow = true;
    dirLight.shadow.mapSize.width = 1024;
    dirLight.shadow.mapSize.height = 1024;
    dirLight.shadow.camera.near = 0.5;
    dirLight.shadow.camera.far = 500;
    const d = 150;
    dirLight.shadow.camera.left = -d;
    dirLight.shadow.camera.right = d;
    dirLight.shadow.camera.top = d;
    dirLight.shadow.camera.bottom = -d;
    scene.add(dirLight);

    // Subtle aurora-colored ambient point light for glow effect
    const glowLight = new THREE.PointLight(colors.peak, 5.0, 300, 0.5);
    glowLight.position.set(0, 100, 0);
    scene.add(glowLight);

    // 4. Create Terrain Mesh
    // Grid matches backend proportions (X, Y mapped to horizontal plane, Z is height)
    const segments = 128;
    const terrainGeo = new THREE.PlaneGeometry(240, 240, segments, segments);
    terrainGeoRef.current = terrainGeo;
    
    // Rotate geometry so it sits flat in Three.js coordinates (XZ plane is floor, Y is up)
    terrainGeo.rotateX(-Math.PI / 2);
    
    updateTerrainGeometry(terrainGeo, params);

    // Terrain material with Lambertian shading and wireframe options
    const terrainMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color(colors.terrainColor || '#0a0d1a'),
      roughness: 0.85,
      metalness: 0.1,
      flatShading: true,
    });
    terrainMatRef.current = terrainMat;

    const terrainMesh = new THREE.Mesh(terrainGeo, terrainMat);
    terrainMesh.receiveShadow = true;
    terrainMesh.castShadow = true;
    scene.add(terrainMesh);

    // 5. Create Aurora Ribbons (Curtains of Light)
    const auroraGroup = new THREE.Group();
    scene.add(auroraGroup);

    // GLSL Custom Shaders for realistic Aurora effects
    const auroraVertShader = `
      uniform float uTime;
      varying vec2 vUv;
      
      // Simple hash helper
      float hash(vec2 p) {
        return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
      }
      
      // 2D Value Noise
      float noise(vec2 p) {
        vec2 i = floor(p);
        vec2 f = fract(p);
        vec2 u = f*f*(3.0-2.0*f);
        return mix(mix(hash(i + vec2(0.0,0.0)), hash(i + vec2(1.0,0.0)), u.x),
                   mix(hash(i + vec2(0.0,1.0)), hash(i + vec2(1.0,1.0)), u.x), u.y);
      }

      void main() {
        vUv = uv;
        vec3 pos = position;
        
        // Horizontal undulating waves
        float wave = sin(pos.x * 0.03 + uTime * 0.6) * 15.0;
        wave += noise(pos.xy * 0.01 + uTime * 0.2) * 20.0;
        
        pos.z += wave;
        
        // Vertical ripple
        pos.y += sin(pos.x * 0.05 + uTime * 1.2) * 3.0;

        gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
      }
    `;

    const auroraFragShader = `
      uniform vec3 uColorBase;
      uniform vec3 uColorPeak;
      uniform float uTime;
      varying vec2 vUv;
      
      float hash(vec2 p) {
        return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
      }
      
      float noise(vec2 p) {
        vec2 i = floor(p);
        vec2 f = fract(p);
        vec2 u = f*f*(3.0-2.0*f);
        return mix(mix(hash(i + vec2(0.0,0.0)), hash(i + vec2(1.0,0.0)), u.x),
                   mix(hash(i + vec2(0.0,1.0)), hash(i + vec2(1.0,1.0)), u.x), u.y);
      }

      void main() {
        // Vertical fade: fades out close to the bottom (vUv.y=0) and top (vUv.y=1)
        float verticalFade = smoothstep(0.0, 0.15, vUv.y) * smoothstep(1.0, 0.5, vUv.y);
        
        // Shimmering vertical light curtains
        float shimmer = noise(vec2(vUv.x * 45.0 - uTime * 0.5, uTime * 0.1));
        shimmer = pow(shimmer, 2.2) * 1.5;
        
        // Dynamic horizontal movement
        float flow = noise(vec2(vUv.x * 10.0 + uTime * 0.2, vUv.y * 5.0));
        
        vec3 color = mix(uColorBase, uColorPeak, vUv.y + flow * 0.15);
        float alpha = verticalFade * shimmer * 0.8;
        
        gl_FragColor = vec4(color, alpha);
      }
    `;

    const auroraMat = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0.0 },
        uColorBase: { value: new THREE.Color(colors.base) },
        uColorPeak: { value: new THREE.Color(colors.peak) },
      },
      vertexShader: auroraVertShader,
      fragmentShader: auroraFragShader,
      transparent: true,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    auroraMatRef.current = auroraMat;

    // Create 3 layered aurora ribbons for parallax depth
    const ribbonWidth = 320;
    const ribbonHeight = 65;
    const ribbonGeo = new THREE.PlaneGeometry(ribbonWidth, ribbonHeight, 100, 10);
    
    const count = 3;
    for (let i = 0; i < count; i++) {
      const ribbon = new THREE.Mesh(ribbonGeo, auroraMat);
      // Position above terrain, slightly staggered
      ribbon.position.set(0, 35 + i * 15, -40 + i * 35);
      ribbon.rotation.x = -0.05 * i;
      auroraGroup.add(ribbon);
    }

    // 6. Stars background
    const starsGeo = new THREE.BufferGeometry();
    const starsCount = 600;
    const starPositions = new Float32Array(starsCount * 3);
    for (let i = 0; i < starsCount * 3; i += 3) {
      // Place randomly in a hemisphere above the terrain
      const u = Math.random();
      const v = Math.random();
      const theta = u * 2.0 * Math.PI;
      const phi = Math.acos(2.0 * v - 1.0) * 0.5; // only top hemisphere
      const r = 250 + Math.random() * 150;
      
      starPositions[i] = r * Math.sin(phi) * Math.cos(theta);
      starPositions[i + 1] = r * Math.cos(phi) + 15; // bias upwards
      starPositions[i + 2] = r * Math.sin(phi) * Math.sin(theta);
    }
    starsGeo.setAttribute('position', new THREE.BufferAttribute(starPositions, 3));
    
    const starsMat = new THREE.PointsMaterial({
      color: 0xffffff,
      size: 0.8,
      transparent: true,
      opacity: 0.8,
      sizeAttenuation: true
    });
    
    const starField = new THREE.Points(starsGeo, starsMat);
    scene.add(starField);

    // 7. Animation Loop
    const clock = new THREE.Clock();
    let animationFrameId;

    const animate = () => {
      const elapsedTime = clock.getElapsedTime();

      // Update shader time uniforms
      if (auroraMatRef.current) {
        auroraMatRef.current.uniforms.uTime.value = elapsedTime;
      }

      // Update PointLight color and position dynamically for atmospheric aurora reflections on the landscape
      glowLight.color.lerp(new THREE.Color(colors.peak), 0.05);
      glowLight.position.x = Math.sin(elapsedTime * 0.4) * 50;
      glowLight.position.z = Math.cos(elapsedTime * 0.3) * 50;
      
      // Undulate point light intensity
      glowLight.intensity = 4.0 + Math.sin(elapsedTime * 2.0) * 1.5;

      // Slow idle rotation of camera if controls are not actively used
      if (controls.autoRotate) {
        controls.update();
      } else {
        controls.update();
      }

      renderer.render(scene, camera);
      animationFrameId = requestAnimationFrame(animate);
    };
    animate();

    // 8. Handle Window Resize
    const handleResize = () => {
      if (!mountRef.current) return;
      const w = mountRef.current.clientWidth;
      const h = mountRef.current.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener('resize', handleResize);

    // 9. Cleanup
    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener('resize', handleResize);
      if (renderer && renderer.domElement) {
        renderer.dispose();
      }
      starsGeo.dispose();
      starsMat.dispose();
      terrainGeo.dispose();
      terrainMat.dispose();
      auroraMat.dispose();
      ribbonGeo.dispose();
    };
  }, []);

  return <div ref={mountRef} style={{ width: '100%', height: '100%', borderRadius: '16px', overflow: 'hidden' }} />;
};

// Generates the geometry grid based on current user parameters
const updateTerrainGeometry = (geometry, params) => {
  const position = geometry.attributes.position;
  const count = position.count;
  const sizeX = 240; // width of mesh in scene
  const sizeY = 240; // depth of mesh in scene
  
  const segmentsX = geometry.parameters.widthSegments;
  const segmentsY = geometry.parameters.heightSegments;
  
  const simplex = new SimplexNoise(params.seed);
  const simplexRidge = new SimplexNoise(params.seed + 12345);
  const simplexMask = new SimplexNoise(params.seed + 54321);

  for (let i = 0; i <= segmentsX; i++) {
    for (let j = 0; j <= segmentsY; j++) {
      // Map mesh coords to generator space [0, width]
      const gx = (i / segmentsX) * params.width;
      const gy = (j / segmentsY) * params.height;
      
      let heightVal = 0;
      
      if (params.biomeBlend) {
        // Valleys: low-frequency standard simplex
        let valleyVal = 0;
        for (let o = 0; o < params.octaves; o++) {
          const freq = Math.pow(params.lacunarity, o);
          const amp = Math.pow(params.persistence, o);
          valleyVal += simplex.noise2D((gx / params.scale) * freq, (gy / params.scale) * freq) * amp;
        }
        
        // Ridges: inverted absolute values
        let ridgeVal = 0;
        for (let o = 0; o < params.octaves; o++) {
          const freq = Math.pow(params.lacunarity, o);
          const amp = Math.pow(params.persistence, o);
          const raw = simplexRidge.noise2D((gx / (params.scale * 0.75)) * freq, (gy / (params.scale * 0.75)) * freq);
          ridgeVal += (1.0 - Math.abs(raw)) * amp;
        }
        
        // Blending mask using a large-scale noise map
        let mask = 0;
        for (let o = 0; o < 3; o++) {
          const freq = Math.pow(2.0, o);
          const amp = Math.pow(0.5, o);
          mask += simplexMask.noise2D((gx / params.blendScale) * freq, (gy / params.blendScale) * freq) * amp;
        }
        // Scale mask to [0, 1]
        const maskNorm = Math.min(Math.max((mask / 1.75 + 1.0) / 2.0, 0.0), 1.0);
        
        heightVal = valleyVal * maskNorm + ridgeVal * (1.0 - maskNorm);
      } else {
        // Standard multi-octave generation
        for (let o = 0; o < params.octaves; o++) {
          const freq = Math.pow(params.lacunarity, o);
          const amp = Math.pow(params.persistence, o);
          const raw = simplex.noise2D((gx / params.scale) * freq, (gy / params.scale) * freq);
          
          if (params.noiseType === 'ridge') {
            heightVal += (1.0 - Math.abs(raw)) * amp;
          } else if (params.noiseType === 'billow') {
            heightVal += Math.abs(raw) * amp;
          } else { // simplex
            heightVal += raw * amp;
          }
        }
      }
      
      // Scale height and write to geometry y-component (vertical axis in rotated PlaneGeometry)
      // PlaneGeometry vertices are stored in a 1D array: [x1, y1, z1, x2, y2, z2...]
      // Because we rotated the geometry (-90deg on X), the 'z' value becomes height 'y' in the world
      const index = (j * (segmentsX + 1) + i) * 3;
      
      // Normalise heightVal: simplex noise range varies with octaves, persistence.
      // We divide by theoretical maximum sum of octaves to normalize, then scale by heightMultiplier.
      let maxAmp = 0;
      for (let o = 0; o < params.octaves; o++) {
        maxAmp += Math.pow(params.persistence, o);
      }
      const normalisedHeight = (heightVal / (maxAmp || 1.0) + 1.0) / 2.0;
      
      position.array[index + 1] = normalisedHeight * params.heightMultiplier; 
    }
  }
  
  position.needsUpdate = true;
  geometry.computeVertexNormals();
};

// Exports the buffer geometry vertices and indices directly to a Wavefront .obj file
const exportToObj = (geometry, params) => {
  const position = geometry.attributes.position;
  const segmentsX = geometry.parameters.widthSegments;
  const segmentsY = geometry.parameters.heightSegments;
  
  let objText = "# Wavefront OBJ exported from Icelandic Aurora 3D Web Visualizer\n";
  objText += `# Seed: ${params.seed}, Scale: ${params.scale}, Noise: ${params.noiseType}\n\n`;
  
  // Write vertices
  const count = position.count;
  for (let i = 0; i < count; i++) {
    const vx = position.getX(i);
    const vy = position.getY(i);
    const vz = position.getZ(i);
    // In our rotated geometry:
    // vx is X, vy is Y (height), vz is Z
    objText += `v ${vx.toFixed(4)} ${vy.toFixed(4)} ${vz.toFixed(4)}\n`;
  }
  
  // Write faces
  for (let i = 0; i < segmentsX; i++) {
    for (let j = 0; j < segmentsY; j++) {
      // 1-based vertex indices
      const idx1 = i * (segmentsY + 1) + j + 1;
      const idx2 = i * (segmentsY + 1) + (j + 1) + 1;
      const idx3 = (i + 1) * (segmentsY + 1) + j + 1;
      const idx4 = (i + 1) * (segmentsY + 1) + (j + 1) + 1;
      
      // Face Triangles
      objText += `f ${idx1} ${idx3} ${idx2}\n`;
      objText += `f ${idx2} ${idx3} ${idx4}\n`;
    }
  }
  
  // Create download link
  const blob = new Blob([objText], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `aurora_terrain_seed_${params.seed}.obj`;
  link.click();
  URL.revokeObjectURL(url);
};

export default TerrainViewer;
