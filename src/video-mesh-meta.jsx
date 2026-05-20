(function () {
  const { useState } = React;

  function VideoMeshMeta({ params, setParam, onScreenshot, staticCover }) {
    const [tagInput, setTagInput] = useState('');

    function addTag(e) {
      if ((e.key === 'Enter' || e.key === ',') && tagInput.trim()) {
        e.preventDefault();
        const t = tagInput.trim().replace(/,$/, '');
        if (t && !params.tags.includes(t)) setParam('tags', [...params.tags, t]);
        setTagInput('');
      }
    }

    function removeTag(t) { setParam('tags', params.tags.filter(x => x !== t)); }

    const desc = params.description || '';

    return (
      <React.Fragment>
        <div className="vm-panel-head">
          <div className="vm-mark">M</div>
          <div>
            <div className="vm-tool-name">{params.title || 'Video Mesh'}</div>
            <div className="vm-tool-sub">3D point cloud tool</div>
          </div>
          <button className="vm-head-action" title="Settings">⚙</button>
        </div>

        <div className="vm-scroll">
          {/* Title */}
          <div className="vm-meta-field">
            <div className="vm-meta-lbl"><span>Tool Title</span></div>
            <input className="vm-meta-input" type="text" value={params.title}
              onChange={e => setParam('title', e.target.value)} placeholder="Untitled" />
          </div>

          {/* Description */}
          <div className="vm-meta-field">
            <div className="vm-meta-lbl">
              <span>Description</span>
              <span className="count">{desc.length}/200</span>
            </div>
            <textarea className="vm-meta-input" style={{ minHeight: 56, lineHeight: 1.5, resize: 'none' }}
              value={desc} maxLength={200}
              onChange={e => setParam('description', e.target.value)}
              placeholder="Describe this tool…" />
          </div>

          {/* Tags */}
          <div className="vm-meta-field">
            <div className="vm-meta-lbl"><span>Tags</span></div>
            <div className="vm-tags">
              {params.tags.map(t => (
                <span key={t} className="vm-tag">
                  {t}
                  <button className="vm-tag-x" onClick={() => removeTag(t)}>✕</button>
                </span>
              ))}
            </div>
            <input className="vm-meta-input" type="text" value={tagInput}
              onChange={e => setTagInput(e.target.value)} onKeyDown={addTag}
              placeholder="Add tag, press Enter" />
          </div>

          {/* Static Cover */}
          <div className="vm-cover">
            <div className="vm-meta-lbl" style={{ marginBottom: 6 }}>
              <span>Static Cover</span>
              <span style={{ color: 'var(--ink-faint)' }}>16:9</span>
            </div>
            <div className="vm-cover-thumb">
              {staticCover
                ? <img src={staticCover} alt="cover" />
                : <div className="vm-cover-empty">No cover yet</div>
              }
            </div>
            <div className="vm-cover-btns">
              <button className="vm-cover-btn">Change</button>
              <button className="vm-cover-btn" onClick={onScreenshot}>Screenshot</button>
            </div>
          </div>

          {/* Dynamic Cover placeholder */}
          <div className="vm-cover">
            <div className="vm-meta-lbl" style={{ marginBottom: 6 }}>
              <span>Dynamic Cover</span>
            </div>
            <div className="vm-cover-thumb">
              <div className="vm-cover-empty">Record a clip</div>
            </div>
            <div className="vm-cover-btns">
              <button className="vm-cover-btn">Change</button>
              <button className="vm-cover-btn">Record</button>
            </div>
          </div>
        </div>
      </React.Fragment>
    );
  }

  window.VideoMeshMeta = VideoMeshMeta;
})();
