(function () {
  const { useState, useRef, useCallback, useEffect } = React;
  const { VideoMeshViewer, VideoMeshControls, VideoMeshMeta } = window;

  const DEFAULTS = {
    resolution: 137,
    meshScale: 1.4,
    pointSize: 3,
    pointAspect: 1.0,
    minVisibility: 0.11,
    meshType: 'points',
    motionSensitivity: 0.01,
    displacementStrength: 0.7,
    motionDamping: 0.76,
    autoRotateMesh: false,
    rotationSpeed: 0.1,
    useVideoColors: false,
    globalHue: 240,
    lightness: 49,
    brightness: 79,
    flipHorizontal: false,
    showBackgroundVideo: false,
    backgroundMode: 'solid',
    backgroundColor: '#000000',
    backgroundOpacity: 1,
    outputWidth: 800,
    outputHeight: 450,
    aspectPreset: 'custom',
    title: 'Video Mesh',
    description: '3D point cloud on video',
    tags: [],
  };

  const ASPECT_PRESETS = {
    hd:    { w: 1280, h: 720 },
    sq:    { w: 720,  h: 720 },
    four3: { w: 960,  h: 720 },
    port:  { w: 720,  h: 1280 },
  };

  function App() {
    const [params, setParams] = useState(DEFAULTS);
    const [activeSource, setActiveSource] = useState(null);
    const [fileName, setFileName] = useState(null);
    const [staticCover, setStaticCover] = useState(null);
    const [error, setError] = useState(null);
    const [fps, setFps] = useState(0);
    const [showAspect, setShowAspect] = useState(false);
    const [previewScale, setPreviewScale] = useState(1);
    const [recording, setRecording] = useState(null); // null | { duration, startTime }

    const viewerRef = useRef(null);
    const centerRef = useRef(null);
    const errorTimerRef = useRef(null);

    const setParam = useCallback((k, v) => setParams(p => ({ ...p, [k]: v })), []);

    function showError(msg) {
      setError({ msg, key: Date.now() });
      clearTimeout(errorTimerRef.current);
      errorTimerRef.current = setTimeout(() => setError(null), 3500);
    }

    // Compute preview scale from window size minus known panel widths
    const measure = useCallback(() => {
      const aw = window.innerWidth - 216 - 272 - 32;
      const ah = window.innerHeight - 42 - 32;
      const s = Math.min(aw / params.outputWidth, ah / params.outputHeight, 2);
      setPreviewScale(Math.max(0.05, s));
    }, [params.outputWidth, params.outputHeight]);

    useEffect(() => {
      measure();
      window.addEventListener('resize', measure);
      return () => window.removeEventListener('resize', measure);
    }, [measure]);

    // FPS ticker
    useEffect(() => {
      const id = setInterval(() => {
        if (viewerRef.current) setFps(viewerRef.current.getFps());
      }, 800);
      return () => clearInterval(id);
    }, []);

    function handleLoadFile(file) {
      setFileName(file.name);
      viewerRef.current?.loadFile(file);
    }

    function handleLoadImage(file) {
      setFileName(file.name);
      viewerRef.current?.loadImage(file);
    }

    function handleLoadUrl(url) {
      if (!url.trim()) return;
      setFileName(null);
      viewerRef.current?.loadUrl(url.trim());
    }

    function handleLoadWebcam() {
      setFileName(null);
      viewerRef.current?.loadWebcam();
    }

    function handleLoadSample() {
      setFileName(null);
      viewerRef.current?.loadSample();
    }

    function handleClear() {
      setFileName(null);
      viewerRef.current?.clearVideo();
    }

    function handleReset() {
      setParams(p => ({ ...DEFAULTS, title: p.title, description: p.description, tags: p.tags }));
    }

    async function handleRecord(duration) {
      if (recording) return;
      setRecording({ duration, startTime: Date.now() });
      try {
        await viewerRef.current?.startRecording(duration);
      } catch(e) {
        showError(e?.message ?? 'Export failed');
      }
      setRecording(null);
    }

    function handleScreenshot() {
      const url = viewerRef.current?.captureStill();
      if (url) setStaticCover(url);
    }

    function handleAspectPreset(v) {
      const pre = ASPECT_PRESETS[v];
      if (pre) { setParam('outputWidth', pre.w); setParam('outputHeight', pre.h); }
      setParam('aspectPreset', v);
      setShowAspect(false);
    }

    const PRESETS_LIST = [
      { l: 'Custom',        v: 'custom' },
      { l: 'HD 16:9',       v: 'hd' },
      { l: 'Square 1:1',    v: 'sq' },
      { l: '4:3',           v: 'four3' },
      { l: 'Portrait 9:16', v: 'port' },
    ];

    const presetLabel = PRESETS_LIST.find(p => p.v === params.aspectPreset)?.l ?? 'Custom';

    return (
      <div className="vm-layout">

        {/* LEFT: META */}
        <div className="vm-panel vm-panel-l">
          <VideoMeshMeta
            params={params}
            setParam={setParam}
            onScreenshot={handleScreenshot}
            staticCover={staticCover}
          />
        </div>

        {/* CENTER: PREVIEW */}
        <div className="vm-center" ref={centerRef}>
          <div className="vm-preview" onClick={() => showAspect && setShowAspect(false)}>
            {(!activeSource) && (
              <div className="vm-empty-hint">
                Load a video source<br />to see the 3D mesh
              </div>
            )}
            {/* Outer: occupies correct visual space in layout flow */}
            <div style={{
              position: 'relative', flexShrink: 0,
              width: Math.round(params.outputWidth * previewScale),
              height: Math.round(params.outputHeight * previewScale),
            }}>
              <span className="vm-corner tl" />
              <span className="vm-corner tr" />
              <span className="vm-corner bl" />
              <span className="vm-corner br" />
              {/* Inner: full canvas size, scaled from top-left */}
              <div className="vm-canvas-wrap" style={{
                position: 'absolute', top: 0, left: 0,
                width: params.outputWidth, height: params.outputHeight,
                transform: `scale(${previewScale})`,
                transformOrigin: 'top left',
              }}>
                <VideoMeshViewer
                  ref={viewerRef}
                  params={params}
                  onError={showError}
                  onSourceChange={setActiveSource}
                />
              </div>
            </div>
          </div>

          {/* SIZE BAR */}
          <div className="vm-sizebar">
            <input className="vm-dim-input" type="number" min={100} max={3840} value={params.outputWidth}
              onChange={e => { setParam('outputWidth', parseInt(e.target.value) || 400); setParam('aspectPreset', 'custom'); }} />
            <span className="vm-dim-x">×</span>
            <input className="vm-dim-input" type="number" min={100} max={3840} value={params.outputHeight}
              onChange={e => { setParam('outputHeight', parseInt(e.target.value) || 800); setParam('aspectPreset', 'custom'); }} />
            <span className="vm-dim-x" style={{ fontSize: 9, color: 'var(--ink-faint)', letterSpacing: '.1em', textTransform: 'uppercase', fontFamily: 'var(--mono)' }}>px</span>

            <div style={{ position: 'relative' }}>
              <button className="vm-aspect-btn" onClick={() => setShowAspect(s => !s)}>
                {presetLabel} ▾
              </button>
              {showAspect && (
                <div className="vm-aspect-drop">
                  {PRESETS_LIST.map(p => (
                    <button key={p.v}
                      className={`vm-aspect-opt${params.aspectPreset === p.v ? ' on' : ''}`}
                      onClick={() => handleAspectPreset(p.v)}>
                      {p.l}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* RIGHT: CONTROLS */}
        <div className="vm-panel vm-panel-r">
          <VideoMeshControls
            params={params}
            setParam={setParam}
            activeSource={activeSource}
            fileName={fileName}
            onLoadFile={handleLoadFile}
            onLoadImage={handleLoadImage}
            onLoadUrl={handleLoadUrl}
            onLoadWebcam={handleLoadWebcam}
            onLoadSample={handleLoadSample}
            onClear={handleClear}
            onReset={handleReset}
            recording={recording}
            onRecord={handleRecord}
          />
          <div className="vm-status">
            {activeSource
              ? <span className="vm-status-live"><span className="vm-status-dot" />Live · {activeSource}</span>
              : <span style={{ color: 'var(--ink-faint)' }}>No source</span>
            }
            <span className="vm-status-fps">{fps > 0 ? `${fps} fps` : '—'}</span>
          </div>
        </div>

        {/* ERRORS */}
        {error && <div className="vm-err" key={error.key}>{error.msg}</div>}
      </div>
    );
  }

  ReactDOM.createRoot(document.getElementById('root')).render(<App />);
})();
