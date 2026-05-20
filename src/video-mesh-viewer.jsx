(function () {
  const { useEffect, useRef, useImperativeHandle, useCallback } = React;

  const MAX_PTS = 300 * 300;

  const VERT = `
    attribute vec3 aCol;
    attribute float aAlpha;
    attribute float aSize;
    varying vec3 vCol;
    varying float vAlpha;
    uniform float uPS;
    void main() {
      vCol = aCol; vAlpha = aAlpha;
      vec4 mv = modelViewMatrix * vec4(position, 1.0);
      gl_PointSize = max(0.5, aSize * uPS);
      gl_Position = projectionMatrix * mv;
    }
  `;
  const FRAG = `
    varying vec3 vCol;
    varying float vAlpha;
    void main() {
      if (vAlpha < 0.004) discard;
      gl_FragColor = vec4(vCol, vAlpha);
    }
  `;

  function hsl(h, s, l) {
    h = ((h % 360) + 360) % 360 / 360;
    if (s === 0) return [l, l, l];
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    const hue = (p, q, t) => {
      if (t < 0) t += 1; if (t > 1) t -= 1;
      if (t < 1/6) return p + (q - p) * 6 * t;
      if (t < 1/2) return q;
      if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
      return p;
    };
    return [hue(p, q, h + 1/3), hue(p, q, h), hue(p, q, h - 1/3)];
  }

  function drawSample(ctx, w, h, t) {
    // Base: dim background so all points are visible (not pure black)
    const bg = ctx.createLinearGradient(0, 0, w, h);
    bg.addColorStop(0,   `hsl(${220 + Math.sin(t * 0.3) * 15},60%,8%)`);
    bg.addColorStop(0.5, `hsl(${240},50%,5%)`);
    bg.addColorStop(1,   `hsl(${260 + Math.sin(t * 0.2) * 10},60%,8%)`);
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, w, h);

    // Large central glow that fills most of the frame
    const cx = w * 0.5, cy = h * 0.5;
    const r = Math.max(w, h) * 0.65;
    const gMain = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
    gMain.addColorStop(0,   `hsla(${220 + Math.sin(t * 0.7) * 25},100%,72%,1)`);
    gMain.addColorStop(0.25,`hsla(${235 + Math.sin(t * 0.5) * 20},100%,55%,0.95)`);
    gMain.addColorStop(0.55,`hsla(${250},90%,35%,0.7)`);
    gMain.addColorStop(1,   `hsla(${260},70%,15%,0)`);
    ctx.fillStyle = gMain;
    ctx.fillRect(0, 0, w, h);

    // Off-center secondary glow for asymmetry / depth variation
    const ox = cx + Math.cos(t * 0.4) * w * 0.22;
    const oy = cy + Math.sin(t * 0.35) * h * 0.18;
    const gSec = ctx.createRadialGradient(ox, oy, 0, ox, oy, Math.min(w, h) * 0.38);
    gSec.addColorStop(0,   `hsla(${190 + Math.sin(t * 0.6) * 30},100%,65%,0.55)`);
    gSec.addColorStop(0.5, `hsla(${210},100%,40%,0.25)`);
    gSec.addColorStop(1,   `hsla(${220},80%,20%,0)`);
    ctx.fillStyle = gSec;
    ctx.fillRect(0, 0, w, h);

    // Animated ring pulses
    const baseR = Math.min(w, h) * 0.38;
    for (let i = 0; i < 4; i++) {
      const phase = t * 1.1 + i * Math.PI * 0.5;
      const rr = baseR * (0.2 + 0.75 * ((Math.sin(phase) + 1) / 2));
      const alpha = 0.35 + 0.25 * Math.sin(phase + 0.5);
      ctx.strokeStyle = `rgba(100,180,255,${alpha})`;
      ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(cx, cy, rr, 0, Math.PI * 2); ctx.stroke();
    }
  }

  const VideoMeshViewer = React.forwardRef(function VideoMeshViewer({ params, onError, onSourceChange }, ref) {
    const mountRef = useRef(null);
    const rendRef = useRef(null);
    const sceneRef = useRef(null);
    const camRef = useRef(null);
    const groupRef = useRef(null);
    const geomRef = useRef(null);
    const matRef = useRef(null);
    const rafRef = useRef(null);
    const vidRef = useRef(null);
    const scvRef = useRef(null); // sample canvas
    const sctxRef = useRef(null);
    const paramsRef = useRef(params);
    const srcRef = useRef(null);
    const streamRef = useRef(null);
    const stRef = useRef(0); // sample time for procedural

    // typed arrays
    const pos = useRef(new Float32Array(MAX_PTS * 3));
    const acol = useRef(new Float32Array(MAX_PTS * 3));
    const aalpha = useRef(new Float32Array(MAX_PTS));
    const asize = useRef(new Float32Array(MAX_PTS));
    const smZ = useRef(new Float32Array(MAX_PTS));
    const smA = useRef(new Float32Array(MAX_PTS));
    const prevPx = useRef(new Uint8ClampedArray(MAX_PTS * 4));
    const dimsRef = useRef({ w: 4, h: 3, n: 12 }); // default 4:3 aspect for camera init
    const fpsRef = useRef(0);

    useEffect(() => { paramsRef.current = params; });

    const calcDims = useCallback((res, aspect) => {
      const w = Math.max(4, Math.min(res, 280));
      const h = Math.max(2, Math.round(w / Math.max(0.1, aspect)));
      return { w, h, n: w * h };
    }, []);

    const updateGeom = useCallback((ctx, sw, sh, p) => {
      const data = ctx.getImageData(0, 0, sw, sh).data;
      const aspect = sw / sh;
      const [br, bg, bb] = hsl(p.globalHue, 1.0, p.lightness / 100);
      const bri = p.brightness / 100;
      const n = sw * sh;
      for (let y = 0; y < sh; y++) {
        for (let x = 0; x < sw; x++) {
          const i = y * sw + x;
          const px = i * 4;
          const r = data[px], g = data[px+1], b = data[px+2];
          const luma = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
          const dr = r - prevPx.current[px];
          const dg = g - prevPx.current[px+1];
          const db = b - prevPx.current[px+2];
          const mot = Math.sqrt(dr*dr + dg*dg + db*db) / 441.67;
          const ma = mot > p.motionSensitivity ? mot : 0;
          prevPx.current[px] = r; prevPx.current[px+1] = g; prevPx.current[px+2] = b;
          const tA = luma < p.minVisibility ? 0 : 1;
          const tZ = (luma * 0.7 + ma * 0.3) * p.displacementStrength;
          const damp = p.motionDamping;
          smZ.current[i] = smZ.current[i] * damp + tZ * (1 - damp);
          smA.current[i] = smA.current[i] * damp + tA * (1 - damp);
          const nx = (x / (sw - 1 || 1)) - 0.5;
          const ny = 0.5 - (y / (sh - 1 || 1));
          pos.current[i*3]   = nx * p.meshScale * aspect;
          pos.current[i*3+1] = ny * p.meshScale;
          pos.current[i*3+2] = smZ.current[i] - p.displacementStrength * 0.3;
          const pi = 0.3 + luma * 0.7;
          const al = smA.current[i];
          if (p.useVideoColors) {
            acol.current[i*3]   = (r/255) * pi * bri;
            acol.current[i*3+1] = (g/255) * pi * bri;
            acol.current[i*3+2] = (b/255) * pi * bri;
          } else {
            acol.current[i*3]   = br * pi * bri;
            acol.current[i*3+1] = bg * pi * bri;
            acol.current[i*3+2] = bb * pi * bri;
          }
          aalpha.current[i] = al;
          asize.current[i] = al > 0.005 ? 1.0 : 0.0;
        }
      }
      const g = geomRef.current;
      g.attributes.position.needsUpdate = true;
      g.attributes.aCol.needsUpdate = true;
      g.attributes.aAlpha.needsUpdate = true;
      g.attributes.aSize.needsUpdate = true;
      g.setDrawRange(0, n);
      g.computeBoundingSphere();
    }, []);

    const clearSrc = useCallback(() => {
      const v = vidRef.current;
      if (!v) return;
      v.pause();
      if (v.srcObject) {
        v.srcObject.getTracks?.().forEach(t => t.stop());
        v.srcObject = null;
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => t.stop());
        streamRef.current = null;
      }
      if (v.src?.startsWith('blob:')) URL.revokeObjectURL(v.src);
      v.removeAttribute('src');
      v.load();
    }, []);

    useEffect(() => {
      if (!mountRef.current) return;
      const container = mountRef.current;
      const p0 = paramsRef.current;

      const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      renderer.setSize(p0.outputWidth, p0.outputHeight);
      container.appendChild(renderer.domElement);
      rendRef.current = renderer;

      const scene = new THREE.Scene();
      sceneRef.current = scene;

      const cam = new THREE.PerspectiveCamera(55, p0.outputWidth / p0.outputHeight, 0.01, 100);
      cam.position.z = 2;
      camRef.current = cam;

      const group = new THREE.Group();
      group.rotation.x = -0.32; // default tilt to reveal Z depth
      scene.add(group);
      groupRef.current = group;

      const geom = new THREE.BufferGeometry();
      geom.setAttribute('position', new THREE.BufferAttribute(pos.current, 3));
      geom.setAttribute('aCol',    new THREE.BufferAttribute(acol.current, 3));
      geom.setAttribute('aAlpha',  new THREE.BufferAttribute(aalpha.current, 1));
      geom.setAttribute('aSize',   new THREE.BufferAttribute(asize.current, 1));
      geom.setDrawRange(0, 0);
      geomRef.current = geom;

      const mat = new THREE.ShaderMaterial({
        vertexShader: VERT, fragmentShader: FRAG,
        transparent: true, depthWrite: false,
        uniforms: { uPS: { value: p0.pointSize } },
      });
      matRef.current = mat;
      group.add(new THREE.Points(geom, mat));

      const scv = document.createElement('canvas');
      document.body.appendChild(scv);
      scv.style.display = 'none';
      scvRef.current = scv;
      sctxRef.current = scv.getContext('2d', { willReadFrequently: true });

      const vid = document.createElement('video');
      vid.loop = true; vid.muted = true; vid.playsInline = true;
      vid.style.display = 'none';
      document.body.appendChild(vid);
      vidRef.current = vid;

      // Drag-to-rotate
      const drag = { active: false, x: 0, y: 0 };
      const el = renderer.domElement;
      el.style.cursor = 'grab';

      function onPointerDown(e) {
        drag.active = true;
        drag.x = e.clientX ?? e.touches?.[0]?.clientX ?? 0;
        drag.y = e.clientY ?? e.touches?.[0]?.clientY ?? 0;
        el.style.cursor = 'grabbing';
        e.preventDefault();
      }
      function onPointerMove(e) {
        if (!drag.active) return;
        const cx = e.clientX ?? e.touches?.[0]?.clientX ?? drag.x;
        const cy = e.clientY ?? e.touches?.[0]?.clientY ?? drag.y;
        const dx = cx - drag.x, dy = cy - drag.y;
        drag.x = cx; drag.y = cy;
        group.rotation.y += dx * 0.007;
        group.rotation.x += dy * 0.007;
        e.preventDefault();
      }
      function onPointerUp() {
        drag.active = false;
        el.style.cursor = 'grab';
      }

      el.addEventListener('mousedown',  onPointerDown);
      el.addEventListener('touchstart', onPointerDown, { passive: false });
      window.addEventListener('mousemove',  onPointerMove);
      window.addEventListener('touchmove',  onPointerMove, { passive: false });
      window.addEventListener('mouseup',  onPointerUp);
      window.addEventListener('touchend', onPointerUp);

      let lastT = 0, fpsCnt = 0, fpsT = 0;

      function loop(ts) {
        rafRef.current = requestAnimationFrame(loop);
        const dt = Math.min((ts - lastT) / 1000, 0.1);
        lastT = ts;
        fpsCnt++; fpsT += dt;
        if (fpsT >= 1) { fpsRef.current = Math.round(fpsCnt / fpsT); fpsCnt = 0; fpsT = 0; }

        const p = paramsRef.current;
        mat.uniforms.uPS.value = p.pointSize;

        // resize if needed
        if (renderer.domElement.width !== p.outputWidth || renderer.domElement.height !== p.outputHeight) {
          renderer.setSize(p.outputWidth, p.outputHeight);
          cam.aspect = p.outputWidth / p.outputHeight;
          cam.updateProjectionMatrix();
        }

        // background
        if (p.backgroundMode === 'solid') {
          renderer.setClearColor(p.backgroundColor, p.backgroundOpacity);
        } else {
          renderer.setClearColor(0x000000, 0);
        }

        // camera z: fit mesh height to ~80% of canvas height
        {
          const tanHalf = Math.tan((55 / 2) * Math.PI / 180);
          cam.position.z = (p.meshScale / 2) / (tanHalf * 0.80);
        }

        // rotation
        if (p.autoRotateMesh) group.rotation.y += p.rotationSpeed * dt;

        // sampling
        const src = srcRef.current;
        if (src === 'sample') {
          stRef.current += dt;
          const { w, h } = calcDims(p.resolution, 4 / 3);
          if (scv.width !== w || scv.height !== h) { scv.width = w; scv.height = h; }
          drawSample(sctxRef.current, w, h, stRef.current);
          dimsRef.current = { w, h, n: w * h };
          updateGeom(sctxRef.current, w, h, p);
        } else if (src && vid.readyState >= 2 && !vid.paused) {
          const vw = vid.videoWidth, vh = vid.videoHeight;
          if (vw > 0 && vh > 0) {
            const { w, h } = calcDims(p.resolution, vw / vh);
            if (scv.width !== w || scv.height !== h) { scv.width = w; scv.height = h; }
            const ctx = sctxRef.current;
            if (p.flipHorizontal) {
              ctx.save(); ctx.scale(-1, 1); ctx.drawImage(vid, -w, 0, w, h); ctx.restore();
            } else {
              ctx.drawImage(vid, 0, 0, w, h);
            }
            dimsRef.current = { w, h, n: w * h };
            updateGeom(ctx, w, h, p);
          }
        }

        renderer.render(scene, cam);
      }
      rafRef.current = requestAnimationFrame(loop);

      return () => {
        cancelAnimationFrame(rafRef.current);
        el.removeEventListener('mousedown',  onPointerDown);
        el.removeEventListener('touchstart', onPointerDown);
        window.removeEventListener('mousemove',  onPointerMove);
        window.removeEventListener('touchmove',  onPointerMove);
        window.removeEventListener('mouseup',  onPointerUp);
        window.removeEventListener('touchend', onPointerUp);
        renderer.dispose();
        if (container.contains(renderer.domElement)) container.removeChild(renderer.domElement);
        scv.remove(); vid.remove();
        if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop());
      };
    }, []);

    useImperativeHandle(ref, () => ({
      captureStill() {
        return rendRef.current?.domElement.toDataURL('image/png') ?? null;
      },
      async loadFile(file) {
        clearSrc();
        const url = URL.createObjectURL(file);
        const v = vidRef.current;
        v.crossOrigin = null;
        v.src = url;
        try { await v.play(); srcRef.current = 'upload'; onSourceChange?.('upload'); }
        catch (e) { onError?.('Could not play video file.'); }
      },
      async loadUrl(url) {
        clearSrc();
        const v = vidRef.current;
        v.crossOrigin = 'anonymous';
        v.src = url;
        try { await v.play(); srcRef.current = 'url'; onSourceChange?.('url'); }
        catch (e) { onError?.('Could not load URL. CORS may be blocking access.'); }
      },
      async loadWebcam() {
        clearSrc();
        try {
          const stream = await navigator.mediaDevices.getUserMedia({ video: true });
          streamRef.current = stream;
          vidRef.current.srcObject = stream;
          await vidRef.current.play();
          srcRef.current = 'webcam'; onSourceChange?.('webcam');
        } catch (e) { onError?.('Camera access denied. Enable camera permission.'); }
      },
      loadSample() {
        clearSrc(); srcRef.current = 'sample'; onSourceChange?.('sample');
      },
      clearVideo() {
        clearSrc();
        srcRef.current = null;
        geomRef.current?.setDrawRange(0, 0);
        smZ.current.fill(0); smA.current.fill(0);
        onSourceChange?.(null);
      },
      getFps() { return fpsRef.current; },
    }), [clearSrc]);

    return <div ref={mountRef} style={{ display: 'contents' }} />;
  });

  window.VideoMeshViewer = VideoMeshViewer;
})();
