(function () {
  const { useState, useRef } = React;

  function Acc({ num, title, defaultOpen, children }) {
    const [open, setOpen] = useState(defaultOpen !== false);
    return (
      <div className="vm-acc">
        <div className="vm-acc-head" onClick={() => setOpen(o => !o)}>
          <span className="vm-acc-title">
            <span className="vm-acc-n">{num}</span>{title}
          </span>
          <span className={`vm-acc-arrow${open ? ' open' : ''}`} />
        </div>
        {open && <div className="vm-acc-body">{children}</div>}
      </div>
    );
  }

  function Slider({ label, val, min, max, step, onChange, fmt }) {
    const disp = fmt ? fmt(val) : (Number.isInteger(step) ? Math.round(val) : val.toFixed(2));
    return (
      <div className="vm-sl">
        <div className="vm-sl-head">
          <span className="vm-sl-lbl">{label}</span>
          <span className="vm-sl-val">{disp}</span>
        </div>
        <input type="range" min={min} max={max} step={step} value={val}
          onChange={e => onChange(step < 1 ? parseFloat(e.target.value) : parseInt(e.target.value))} />
      </div>
    );
  }

  function Seg({ options, value, onChange }) {
    return (
      <div className="vm-seg">
        {options.map(o => (
          <button key={o.v} className={`vm-seg-opt${value === o.v ? ' on' : ''}`}
            onClick={() => onChange(o.v)}>{o.l}</button>
        ))}
      </div>
    );
  }

  function Toggle({ label, value, onChange }) {
    return (
      <div className="vm-check" onClick={() => onChange(!value)}>
        <span className="vm-check-lbl">{label}</span>
        <span className={`vm-toggle${value ? ' on' : ''}`} />
      </div>
    );
  }

  function VideoMeshControls({ params, setParam, activeSource, fileName, onLoadFile, onLoadUrl, onLoadWebcam, onLoadSample, onLoadImage, onClear, onReset, recording, onRecord, cameraPreview, onSetCameraFrom, onSetCameraTo, onCameraPreview }) {
    const [urlVal, setUrlVal] = useState('');
    const [showAspect, setShowAspect] = useState(false);
    const [recRemaining, setRecRemaining] = React.useState(0);
    const fileInputRef = useRef(null);
    const imgInputRef = useRef(null);

    React.useEffect(() => {
      if (!recording) { setRecRemaining(0); return; }
      setRecRemaining(recording.duration);
      const id = setInterval(() => {
        const elapsed = (Date.now() - recording.startTime) / 1000;
        const left = Math.max(0, recording.duration - elapsed);
        setRecRemaining(left);
      }, 100);
      return () => clearInterval(id);
    }, [recording]);

    const PRESETS = [
      { l: 'Custom',       v: 'custom',  w: null,  h: null },
      { l: 'HD 16:9',      v: 'hd',      w: 1280,  h: 720 },
      { l: 'Square 1:1',   v: 'sq',      w: 720,   h: 720 },
      { l: '4:3',          v: 'four3',   w: 960,   h: 720 },
      { l: 'Portrait 9:16',v: 'port',    w: 720,   h: 1280 },
    ];

    function handleFile(e) {
      const f = e.target.files?.[0];
      if (f) onLoadFile(f);
      e.target.value = '';
    }

    function handleImageFile(e) {
      const f = e.target.files?.[0];
      if (f) onLoadImage(f);
      e.target.value = '';
    }

    function handlePreset(p) {
      if (p.w) { setParam('outputWidth', p.w); setParam('outputHeight', p.h); }
      setParam('aspectPreset', p.v);
      setShowAspect(false);
    }

    const srcIcon = { upload: '▶', url: '⌘', webcam: '◉', sample: '◎' };

    return (
      <React.Fragment>
        <div className="vm-panel-head">
          <span className="vm-panel-head-title" style={{ fontFamily: 'var(--mono)', fontSize: '9px', letterSpacing: '.22em', textTransform: 'uppercase', color: 'var(--ink-faint)' }}>Controls</span>
        </div>
        <div className="vm-scroll">

          {/* 1. VIDEO SOURCE */}
          <Acc num="1." title="Video Source">
            {fileName && (
              <div className="vm-file-row">
                <span className="vm-file-name">{fileName}</span>
                <button className="vm-file-clear" onClick={onClear}>✕</button>
              </div>
            )}
            <button className={`vm-src-btn${activeSource === 'upload' ? ' active' : ''}`}
              onClick={() => fileInputRef.current?.click()}>
              <span className="vm-src-icon">▶</span>Upload Video
            </button>
            <input ref={fileInputRef} type="file" accept="video/*" style={{ display: 'none' }} onChange={handleFile} />

            <button className={`vm-src-btn${activeSource === 'image' ? ' active' : ''}`}
              onClick={() => imgInputRef.current?.click()}>
              <span className="vm-src-icon">⬡</span>Upload Image
            </button>
            <input ref={imgInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleImageFile} />

            <div className="vm-url-row">
              <input className="vm-url-in" type="text" placeholder="https://…"
                value={urlVal} onChange={e => setUrlVal(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && onLoadUrl(urlVal)} />
              <button className="vm-url-go" onClick={() => onLoadUrl(urlVal)}>Load</button>
            </div>

            <button className={`vm-src-btn${activeSource === 'webcam' ? ' active' : ''}`} onClick={onLoadWebcam}>
              <span className="vm-src-icon">◉</span>Use Webcam
            </button>
            <button className={`vm-src-btn${activeSource === 'sample' ? ' active' : ''}`} onClick={onLoadSample}>
              <span className="vm-src-icon">◎</span>Load Sample
            </button>
            <button className="vm-src-btn" onClick={onClear}>
              <span className="vm-src-icon" style={{ opacity: .35 }}>✕</span>Clear / Stop
            </button>
          </Acc>

          {/* 2. MESH STYLE */}
          <Acc num="2." title="Mesh Style">
            <Slider label="Resolution" val={params.resolution} min={16} max={256} step={1} onChange={v => setParam('resolution', v)} />
            <Slider label="Mesh Scale" val={params.meshScale} min={0.1} max={2} step={0.01} onChange={v => setParam('meshScale', v)} />
            <Slider label="Point Size" val={params.pointSize} min={1} max={20} step={0.5} onChange={v => setParam('pointSize', v)} />
            <Slider label="Point Aspect" val={params.pointAspect} min={0.1} max={5} step={0.05} onChange={v => setParam('pointAspect', v)} fmt={v => v.toFixed(2) + '×'} />
            <Slider label="Min Visibility" val={params.minVisibility} min={0} max={0.5} step={0.01} onChange={v => setParam('minVisibility', v)} />
          </Acc>

          {/* 3. MOTION & ANIMATION */}
          <Acc num="3." title="Motion &amp; Animation">
            <Slider label="Motion Sensitivity" val={params.motionSensitivity} min={0} max={0.2} step={0.001} onChange={v => setParam('motionSensitivity', v)} />
            <Slider label="Displacement" val={params.displacementStrength} min={0} max={2} step={0.01} onChange={v => setParam('displacementStrength', v)} />
            <Slider label="Motion Damping" val={params.motionDamping} min={0} max={0.99} step={0.01} onChange={v => setParam('motionDamping', v)} />
            <Toggle label="Auto-Rotate Mesh" value={params.autoRotateMesh} onChange={v => setParam('autoRotateMesh', v)} />
            <Slider label="Rotation Speed" val={params.rotationSpeed} min={-1} max={1} step={0.01} onChange={v => setParam('rotationSpeed', v)} />
          </Acc>

          {/* 4. COLORS & VIEW */}
          <Acc num="4." title="Colors &amp; View">
            <Toggle label="Use Video Colors" value={params.useVideoColors} onChange={v => setParam('useVideoColors', v)} />
            {!params.useVideoColors && (
              <React.Fragment>
                <div style={{ marginTop: 2 }}>
                  <Slider label="Global Hue" val={params.globalHue} min={0} max={360} step={1} onChange={v => setParam('globalHue', v)}
                    fmt={v => `${v}°`} />
                  <div style={{ height: 8, borderRadius: 4, marginBottom: 8, border: '1px solid rgba(255,255,255,0.08)',
                    background: 'linear-gradient(to right,hsl(0,100%,50%),hsl(60,100%,50%),hsl(120,100%,50%),hsl(180,100%,50%),hsl(240,100%,50%),hsl(300,100%,50%),hsl(360,100%,50%))' }} />
                  <Slider label="Saturation" val={params.globalSaturation ?? 100} min={0} max={100} step={1} onChange={v => setParam('globalSaturation', v)} fmt={v => `${v}%`} />
                  <Slider label="Lightness" val={params.lightness} min={10} max={90} step={1} onChange={v => setParam('lightness', v)} fmt={v => `${v}%`} />
                  <Slider label="Brightness" val={params.brightness} min={0} max={200} step={1} onChange={v => setParam('brightness', v)} fmt={v => `${v}%`} />
                </div>
              </React.Fragment>
            )}
            <Toggle label="Flip Horizontal" value={params.flipHorizontal} onChange={v => setParam('flipHorizontal', v)} />
            <Toggle label="Show Background Video" value={params.showBackgroundVideo} onChange={v => setParam('showBackgroundVideo', v)} />
          </Acc>

          {/* 5. CAMERA MOVE */}
          <Acc num="5." title="Camera Move">
            <Toggle label="Enable" value={params.cameraMove} onChange={v => setParam('cameraMove', v)} />
            {params.cameraMove && (
              <React.Fragment>
                {/* FROM */}
                <div className="vm-cam-kf">
                  <div className="vm-cam-kf-head">
                    <span className="vm-sl-lbl">From</span>
                    <button className="vm-cam-set" onClick={onSetCameraFrom}>Set Now</button>
                  </div>
                  <Slider label="Z" val={params.cameraFrom.z} min={0.3} max={5} step={0.01} onChange={v => setParam('cameraFrom', { ...params.cameraFrom, z: v })} />
                  <Slider label="Rot X" val={params.cameraFrom.rotX} min={-90} max={90} step={0.5} onChange={v => setParam('cameraFrom', { ...params.cameraFrom, rotX: v })} fmt={v => `${v.toFixed(1)}°`} />
                  <Slider label="Rot Y" val={params.cameraFrom.rotY} min={-180} max={180} step={0.5} onChange={v => setParam('cameraFrom', { ...params.cameraFrom, rotY: v })} fmt={v => `${v.toFixed(1)}°`} />
                </div>
                {/* TO */}
                <div className="vm-cam-kf">
                  <div className="vm-cam-kf-head">
                    <span className="vm-sl-lbl">To</span>
                    <button className="vm-cam-set" onClick={onSetCameraTo}>Set Now</button>
                  </div>
                  <Slider label="Z" val={params.cameraTo.z} min={0.3} max={5} step={0.01} onChange={v => setParam('cameraTo', { ...params.cameraTo, z: v })} />
                  <Slider label="Rot X" val={params.cameraTo.rotX} min={-90} max={90} step={0.5} onChange={v => setParam('cameraTo', { ...params.cameraTo, rotX: v })} fmt={v => `${v.toFixed(1)}°`} />
                  <Slider label="Rot Y" val={params.cameraTo.rotY} min={-180} max={180} step={0.5} onChange={v => setParam('cameraTo', { ...params.cameraTo, rotY: v })} fmt={v => `${v.toFixed(1)}°`} />
                </div>
                {/* Curve */}
                <div style={{ marginTop: 2 }}>
                  <div className="vm-sl-head" style={{ marginBottom: 3 }}><span className="vm-sl-lbl">Curve</span></div>
                  <div className="vm-cam-curves">
                    {[
                      { v: 'linear',    l: 'Linear' },
                      { v: 'easeIn',   l: 'Ease In' },
                      { v: 'easeOut',  l: 'Ease Out' },
                      { v: 'easeInOut', l: 'In-Out' },
                    ].map(c => (
                      <button key={c.v}
                        className={`vm-cam-curve-btn${params.cameraCurve === c.v ? ' on' : ''}`}
                        onClick={() => setParam('cameraCurve', c.v)}>{c.l}</button>
                    ))}
                  </div>
                </div>
                {/* Preview */}
                <button
                  className={`vm-cam-preview${cameraPreview ? ' active' : ''}`}
                  onClick={onCameraPreview}>
                  {cameraPreview ? '■ Stop Preview' : '▶ Preview (3s loop)'}
                </button>
              </React.Fragment>
            )}
          </Acc>

          {/* 6. EXPORT */}
          <Acc num="6." title="Export">
            {/* Resolution & FPS — always visible */}
            <div style={{ marginBottom: 9 }}>
              <div className="vm-sl-head" style={{ marginBottom: 4 }}>
                <span className="vm-sl-lbl">Resolution</span>
                <span className="vm-sl-val" style={{ fontSize: 8, color: 'var(--ink-faint)' }}>
                  {params.outputWidth * params.exportScale} × {params.outputHeight * params.exportScale}
                </span>
              </div>
              <Seg
                options={[{ v: 1, l: '1×' }, { v: 2, l: '2×' }, { v: 3, l: '3×' }]}
                value={params.exportScale}
                onChange={v => setParam('exportScale', v)}
              />
            </div>
            <div style={{ marginBottom: 9 }}>
              <div className="vm-sl-head" style={{ marginBottom: 4 }}>
                <span className="vm-sl-lbl">Frame Rate</span>
              </div>
              <Seg
                options={[{ v: 24, l: '24fps' }, { v: 30, l: '30fps' }, { v: 60, l: '60fps' }]}
                value={params.exportFps}
                onChange={v => setParam('exportFps', v)}
              />
            </div>
            {/* Duration / recording state */}
            {recording ? (
              <div className="vm-rec-active">
                <span className="vm-rec-dot" />
                <span className="vm-rec-label">Recording — {Math.ceil(recRemaining)}s left</span>
                <div className="vm-rec-bar">
                  <div className="vm-rec-fill" style={{ width: `${((recording.duration - recRemaining) / recording.duration) * 100}%` }} />
                </div>
              </div>
            ) : (
              <div>
                <div className="vm-sl-head" style={{ marginBottom: 6 }}>
                  <span className="vm-sl-lbl">Duration</span>
                </div>
                <div className="vm-rec-btns">
                  {[2, 5, 10].map(d => (
                    <button key={d} className="vm-rec-btn" onClick={() => onRecord(d)}>{d}s</button>
                  ))}
                </div>
              </div>
            )}
          </Acc>

          {/* 7. BACKGROUND */}
          <Acc num="7." title="Background">
            <div className="vm-bg-modes">
              {['none', 'solid', 'image'].map(m => (
                <button key={m} className={`vm-bg-mode${params.backgroundMode === m ? ' on' : ''}`}
                  onClick={() => setParam('backgroundMode', m)}>
                  {m.charAt(0).toUpperCase() + m.slice(1)}
                </button>
              ))}
            </div>
            {params.backgroundMode === 'solid' && (
              <React.Fragment>
                <div className="vm-clr-row">
                  <span className="vm-clr-lbl">Color</span>
                  <input type="color" value={params.backgroundColor}
                    onChange={e => setParam('backgroundColor', e.target.value)} />
                </div>
                <Slider label="Opacity" val={params.backgroundOpacity} min={0} max={1} step={0.01}
                  onChange={v => setParam('backgroundOpacity', v)} fmt={v => `${Math.round(v * 100)}%`} />
              </React.Fragment>
            )}
            {params.backgroundMode === 'image' && (
              <div style={{ fontFamily: 'var(--mono)', fontSize: '9px', color: 'var(--ink-faint)', letterSpacing: '.14em', textTransform: 'uppercase', marginTop: 4 }}>
                Image background — coming soon
              </div>
            )}
          </Acc>

        </div>

        {/* BOTTOM ACTIONS */}
        <div className="vm-action-bar">
          <button className="vm-action-btn" onClick={() => {/* edit controllers stub */}}>Edit Controllers</button>
          <button className="vm-action-btn reset" onClick={onReset}>Reset</button>
        </div>

        {/* SIZE BAR rendered in app */}
      </React.Fragment>
    );
  }

  window.VideoMeshControls = VideoMeshControls;
})();
