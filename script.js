// script.js

    // utility to build a THREE.Shape from a sequence of drawing commands
    function buildShape(commands) {
      const shape = new THREE.Shape();
      for (let i = 0; i < commands.length; i++) {
        const cmd = commands[i];
        switch (cmd.type) {
          case `moveTo`:
            shape.moveTo(...cmd.points);
            break;
          case `lineTo`:
            shape.lineTo(...cmd.points);
            break;
          case `bezierCurveTo`:
            shape.bezierCurveTo(...cmd.points);
            break;
          case `quadraticCurveTo`:
            shape.quadraticCurveTo(...cmd.points);
            break;
          case `absarc`:
            // args: x, y, radius, startAngle, endAngle, clockwise
            shape.absarc(...cmd.points);
            break;
          case `closePath`:
            shape.closePath();
            break;
          default:
            console.warn(`Unknown shape command:`, cmd.type);
        }
      }
      return shape;
    }

    // default extrude settings
    const defaultExtrudeSettings = {
      depth: 6,
        bevelEnabled: true,
      bevelSegments: 1,
      steps: 1,
      bevelSize: 0.5,
      bevelThickness: 0.5
    };

    // ensure THREE is loaded (loads from CDN if not present) and OrbitControls
    function loadThree() {
      if (window.THREE && window.THREE.OrbitControls) return Promise.resolve();

      function loadScript(src) {
        return new Promise((resolve, reject) => {
          const s = document.createElement('script');
          s.src = src;
          s.onload = () => resolve();
          s.onerror = () => reject(new Error('Failed to load ' + src));
          document.head.appendChild(s);
        });
      }

      const threeUrl = 'https://unpkg.com/three@0.154.0/build/three.min.js';
      const moduleThreeUrl = 'https://unpkg.com/three@0.154.0/build/three.module.js';
      const orbitControlsModule = 'https://unpkg.com/three@0.154.0/examples/jsm/controls/OrbitControls.js';

      // Load UMD three to get a global THREE if needed, then try to load ESM OrbitControls via import()
      return (window.THREE ? Promise.resolve() : loadScript(threeUrl))
        .then(() => {
          // create an import map that maps the bare "three" specifier to the module build
          try {
            const existing = document.querySelector('script[type="importmap"][data-generated-by="loadThree"]');
            if (!existing) {
              const map = document.createElement('script');
              map.type = 'importmap';
              map.setAttribute('data-generated-by', 'loadThree');
              map.textContent = JSON.stringify({ imports: { three: moduleThreeUrl } });
              document.head.appendChild(map);
            }
          } catch (e) {
            // ignore; some environments may not allow importmap manipulation
          }

          // try dynamic import of the jsm OrbitControls which uses the bare "three" import (mapped above)
          return import(orbitControlsModule)
            .then((mod) => {
              const OrbitControls = mod.OrbitControls || mod.default;
              if (OrbitControls) {
                window.THREE = window.THREE || window.THREE; // ensure THREE exists
                window.THREE.OrbitControls = OrbitControls;
                return;
              }
              throw new Error('OrbitControls export not found in module');
            })
            .catch((err) => {
              // fallback: try known UMD URLs (may still fail if server sets wrong MIME)
              const umdCandidates = [
                'https://unpkg.com/three@0.154.0/examples/js/controls/OrbitControls.js',
                'https://cdn.jsdelivr.net/npm/three@0.154.0/examples/js/controls/OrbitControls.js',
                'https://threejs.org/examples/js/controls/OrbitControls.js' // threejs.org usually serves correct headers
              ];
              // attempt sequentially
              let p = Promise.reject();
              for (const url of umdCandidates) {
                p = p.catch(() => loadScript(url));
              }
              return p
                .then(() => {
                  // UMD builds typically attach OrbitControls globally
                  if (!window.THREE.OrbitControls && window.OrbitControls) {
                    window.THREE = window.THREE || window.THREE;
                    window.THREE.OrbitControls = window.OrbitControls;
                  }
                })
                .catch((e) => {
                  // final failure
                  throw new Error('Failed to load OrbitControls (ESM import and UMD fallbacks failed): ' + (err && err.message) + ' / ' + (e && e.message));
                });
            });
        });
    }

    // builds and returns a Mesh from command list and optional settings/material
    function createExtrudedMeshFromCommands(commands, extrudeSettings = defaultExtrudeSettings, material = null) {
      if (!material) {
        if (typeof THREE === `undefined`) {
          throw new Error(`THREE is not available when creating material`);
        }
        material = new THREE.MeshPhongMaterial({ color: 0xff0000 });
      }
      const shape = buildShape(commands);
      const geometry = new THREE.ExtrudeGeometry(shape, extrudeSettings);
      return new THREE.Mesh(geometry, material);
    }

    // create a box (cube) mesh with given size and position
    function createCubeMesh(size = 20, position = { x: 0, y: 0, z: 0 }, material = null) {
      if (typeof THREE === `undefined`) {
        throw new Error(`THREE is not available when creating cube`);
      }
      const geometry = new THREE.BoxGeometry(size, size, size);
      if (!material) {
        material = new THREE.MeshPhongMaterial({ color: 0x33ccff, shininess: 60 });
      }
      const mesh = new THREE.Mesh(geometry, material);
      mesh.position.set(position.x, position.y, position.z);
      return mesh;
    }

    // convert lat/lon to planar x/y in meters relative to originLat/originLon
    function latLonToXY(lat, lon, originLat, originLon, scale = 1) {
      const latRad = (lat * Math.PI) / 180;
      const originLatRad = (originLat * Math.PI) / 180;
      const metersPerDegLat = 111132.92 - 559.82 * Math.cos(2 * originLatRad) + 1.175 * Math.cos(4 * originLatRad);
      const metersPerDegLon = (Math.PI / 180) * 6378137 * Math.cos(originLatRad);
      const dx = (lon - originLon) * metersPerDegLon * scale;
      const dy = (lat - originLat) * metersPerDegLat * scale;
      return { x: dx, y: dy };
    }

    let scene, camera, renderer, controls;
    let generatedMeshes = []; // store created meshes so they can be removed

    async function init() {
      try {
        await loadThree();
      } catch (err) {
        console.error(err);
        return;
      }

      scene = new THREE.Scene();
      scene.background = new THREE.Color(0x222222);

      camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 10000);
      camera.position.set(0, 0, 800);

      const ambient = new THREE.AmbientLight(0x888888);
      scene.add(ambient);

      const dir = new THREE.DirectionalLight(0xffffff, 0.8);
      dir.position.set(100, 100, 200);
      scene.add(dir);

      renderer = new THREE.WebGLRenderer({ antialias: true });
      renderer.setPixelRatio(window.devicePixelRatio || 1);
      renderer.setSize(window.innerWidth, window.innerHeight);
      document.body.appendChild(renderer.domElement);
      // enable orbit controls if available
      if (THREE.OrbitControls) {
        controls = new THREE.OrbitControls(camera, renderer.domElement);
        controls.enableDamping = true;
        controls.dampingFactor = 0.07;
      }
      window.addEventListener(`resize`, onWindowResize, false);

      // add UI for JSON input
      createJsonInputUI();

      animate();
    }

    function onWindowResize() {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    }

    function animate() {
      requestAnimationFrame(animate);
      if (controls) controls.update();
      renderer.render(scene, camera);
    }

    // UI: textarea + button to input JSON string
    function createJsonInputUI() {
      const container = document.createElement('div');
      Object.assign(container.style, {
        position: 'fixed',
        top: '10px',
        left: '10px',
        width: '360px',
        maxHeight: '60vh',
        overflow: 'auto',
        background: 'rgba(0,0,0,0.6)',
        color: '#fff',
        padding: '8px',
        zIndex: 9999,
        fontFamily: 'monospace',
        fontSize: '12px',
        borderRadius: '4px'
      });

      const textarea = document.createElement('textarea');
      textarea.style.width = '100%';
      textarea.style.height = '180px';
      textarea.value = sampleInput();
      container.appendChild(textarea);

      const controls = document.createElement('div');
      controls.style.display = 'flex';
      controls.style.gap = '6px';
      controls.style.marginTop = '6px';

      const btn = document.createElement('button');
      btn.textContent = 'Load JSON';
      btn.onclick = () => {
        try {
          const parsed = JSON.parse(textarea.value);
          loadGeoJsonArray(parsed);
        } catch (e) {
          console.error('Invalid JSON', e);
          alert('Invalid JSON: ' + e.message);
        }
      };
      controls.appendChild(btn);

      const fileBtn = document.createElement('button');
      fileBtn.textContent = 'Select File';
      controls.appendChild(fileBtn);

      const fileInput = document.createElement('input');
      fileInput.type = 'file';
      fileInput.accept = '.json,application/json';
      fileInput.style.display = 'none';
      const MAX_BYTES = 2000 * 1024 * 1024; // 200 MB

      // progress bar container (create before file handling so it's available)
      const progressContainer = document.createElement('div');
      progressContainer.style.width = '100%';
      progressContainer.style.height = '14px';
      progressContainer.style.background = 'rgba(255,255,255,0.06)';
      progressContainer.style.marginTop = '6px';
      progressContainer.style.borderRadius = '2px';
      const progressBar = document.createElement('div');
      progressBar.style.height = '100%';
      progressBar.style.width = '0%';
      progressBar.style.background = '#4caf50';
      progressBar.style.color = '#000';
      progressBar.style.fontSize = '11px';
      progressBar.style.textAlign = 'center';
      progressBar.style.lineHeight = '14px';
      progressBar.textContent = '';
      progressContainer.appendChild(progressBar);

      function handleFile(file) {
        if (!file) return;
        if (file.size > MAX_BYTES) {
          alert('File too large. Maximum allowed is 200MB.');
          return;
        }
        const reader = new FileReader();
        progressBar.style.width = '0%';
        progressBar.textContent = '0%';
        reader.onprogress = (ev) => {
          if (ev.lengthComputable) {
            const pct = Math.round((ev.loaded / ev.total) * 100);
            progressBar.style.width = pct + '%';
            progressBar.textContent = pct + '%';
          }
        };
        reader.onload = () => {
          try {
            const parsed = JSON.parse(reader.result);
            loadGeoJsonArray(parsed);
          } catch (e) {
            console.error('Invalid JSON file', e);
            alert('Invalid JSON file: ' + e.message);
          }
          progressBar.style.width = '100%';
          progressBar.textContent = 'Done';
        };
        reader.onerror = (e) => {
          console.error('File read error', e);
          alert('Failed to read file');
        };
        reader.readAsText(file);
      }

      fileBtn.onclick = () => fileInput.click();
      fileInput.onchange = (e) => handleFile(e.target.files[0]);
      container.appendChild(fileInput);

      const dropHint = document.createElement('div');
      dropHint.style.marginTop = '6px';
      dropHint.style.fontSize = '11px';
      dropHint.textContent = 'Or drag & drop a .json file onto this box (max 200MB).';
      container.appendChild(dropHint);

      const dropZone = document.createElement('div');
      Object.assign(dropZone.style, {
        border: '1px dashed rgba(255,255,255,0.2)',
        padding: '6px',
        marginTop: '6px',
        textAlign: 'center'
      });
      dropZone.textContent = 'Drop file here';
      dropZone.addEventListener('dragover', (e) => { e.preventDefault(); dropZone.style.background = 'rgba(255,255,255,0.03)'; });
      dropZone.addEventListener('dragleave', () => { dropZone.style.background = ''; });
      dropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropZone.style.background = '';
        const f = e.dataTransfer.files && e.dataTransfer.files[0];
        handleFile(f);
      });
      container.appendChild(dropZone);

      container.appendChild(controls);
      container.appendChild(progressContainer);
      container.appendChild(progressContainer);

      const info = document.createElement('div');
      info.style.marginTop = '6px';
      info.innerText = 'Input expects an array of features: each feature has `geometry` array of {lat, lon}.';
      container.appendChild(info);

      document.body.appendChild(container);
    }

    function sampleInput() {
      // small valid sample based on user's structure
      return JSON.stringify([
        {
          "type": "way",
          "id": 1,
          "geometry": [
            {"lat":55.66973,"lon":12.5750834},
            {"lat":55.6700798,"lon":12.5757186},
            {"lat":55.6697256,"lon":12.5763432},
            {"lat":55.6693707,"lon":12.5757206},
            {"lat":55.66973,"lon":12.5750834}
          ]
        },
        {
          "type": "way",
          "id": 2,
          "geometry": [
            {"lat":55.6682793,"lon":12.5729674},
            {"lat":55.6687528,"lon":12.5738082},
            {"lat":55.6687615,"lon":12.5737928},
            {"lat":55.6690143,"lon":12.5742419},
            {"lat":55.6682793,"lon":12.5729674}
          ]
        }
      ], null, 2);
    }

    // remove previously generated meshes
    function clearGeneratedMeshes() {
      for (const m of generatedMeshes) {
        scene.remove(m);
        if (m.geometry) m.geometry.dispose();
        if (m.material) {
          if (Array.isArray(m.material)) {
            m.material.forEach(mat => mat.dispose && mat.dispose());
          } else {
            m.material.dispose && m.material.dispose();
          }
        }
      }
      generatedMeshes = [];
    }

    // load array of features (not strict GeoJSON, but same idea)
    // load array of features (not strict GeoJSON, but same idea)
    function loadGeoJsonArray(arrOrObj) {
      // accept either an array of features or an object with an "elements" array (Overpass result)
      let arr = arrOrObj;
      if (!Array.isArray(arr)) {
        if (arr && Array.isArray(arr.elements)) {
          arr = arr.elements;
        } else {
          console.error('Expected an array of features or an object with an "elements" array');
          return;
        }
      }

      if (!Array.isArray(arr)) {
        console.error('Expected an array of features');
        return;
      }
      // compute global origin = average of all points
      let sumLat = 0, sumLon = 0, count = 0;
      for (const feat of arr) {
        if (!feat.geometry) continue;
        for (const p of feat.geometry) {
          sumLat += p.lat;
          sumLon += p.lon;
          count++;
        }
      }
      if (count === 0) {
        console.error('No coordinates found');
        return;
      }
      const originLat = sumLat / count;
      const originLon = sumLon / count;

      clearGeneratedMeshes();

      // choose a scale to make meters fit the scene
      const userScale = 0.7; // tweak if needed

      // track bounding box for camera placement
      let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
      // shared material for all vertex cubes: same color and slightly transparent so points don't fully occlude the extrusions
      const sharedCubeMaterial = new THREE.MeshPhongMaterial({ color: 0x3333ff, transparent: true, opacity: 0, depthWrite: false });
      for (const feat of arr) {
        if (!feat.geometry || feat.geometry.length < 2) continue;
        const ptsXY = feat.geometry.map(p => latLonToXY(p.lat, p.lon, originLat, originLon, userScale));
        for (const pt of ptsXY) {
          minX = Math.min(minX, pt.x);
          maxX = Math.max(maxX, pt.x);
          minY = Math.min(minY, pt.y);
          maxY = Math.max(maxY, pt.y);
        }

        // build shape commands from ptsXY
        const commands = [];
        commands.push({ type: 'moveTo', points: [ptsXY[0].x, ptsXY[0].y] });
        for (let i = 1; i < ptsXY.length; i++) {
          commands.push({ type: 'lineTo', points: [ptsXY[i].x, ptsXY[i].y] });
        }
        commands.push({ type: 'closePath' });

        const color = new THREE.Color(Math.random() * 0xffffff);
        const mat = new THREE.MeshPhongMaterial({ color: color, shininess: 30 });
        const mesh = createExtrudedMeshFromCommands(commands, defaultExtrudeSettings, mat);
        mesh.position.z = 0;
        scene.add(mesh);
        generatedMeshes.push(mesh);

        // optional: put small cubes at vertices
        for (const pt of ptsXY) {
          const c = createCubeMesh(4, { x: pt.x, y: pt.y, z: 6 }, sharedCubeMaterial);
          scene.add(c);
          generatedMeshes.push(c);
        }
      }
    }


if (document.readyState === `loading`) {
      window.addEventListener(`DOMContentLoaded`, init);
} else {
      init();
}