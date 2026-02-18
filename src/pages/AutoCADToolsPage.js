import React, { useState } from 'react';
import { Download, Copy, Check, FileCode, Terminal } from 'lucide-react';

const CONELAYOUT_LISP = `;;; ============================================================
;;; CONELAYOUT.LSP - Cone Flat Pattern Generator
;;; Load once: APPLOAD > select this file > Load
;;; Add to Startup Suite for permanent loading.
;;; The CR Admin estimating software generates the command to paste.
;;; ============================================================
;;;
;;; Usage (paste from CR Admin web app):
;;;   (CONELAYOUT outerR innerR devAngle numSegs "layerName" startX)
;;;
;;; Parameters:
;;;   outerR    - Outer radius of flat blank (inches)
;;;   innerR    - Inner radius of flat blank (inches)
;;;   devAngle  - Developed angle per segment piece (degrees)
;;;   numSegs   - Number of radial segments (pieces around cone)
;;;   layerName - Layer name string (e.g. "CONE-L1")
;;;   startX    - X origin offset for this layer group
;;;
;;; Example (single layer, 1 segment, full wrap):
;;;   (CONELAYOUT 19.1713 38.1450 113.8420 1 "CONE-L1" 0.0000)
;;;
;;; Example (2 layers, 4 segments each):
;;;   (CONELAYOUT 19.1713 28.6581 28.4605 4 "CONE-L1" 0.0000)
;;;   (CONELAYOUT 28.6581 38.1450 28.4605 4 "CONE-L2" 161.3705)
;;; ============================================================

(defun CONELAYOUT (outerR innerR devAngle numSegs lyrName startX
                   / old-os old-ly old-ce segIdx sa ea saRad eaRad
                     cx cy ox1 oy1 ox2 oy2 ix1 iy1 ix2 iy2 spacing)

  ;; Save current settings
  (setq old-os (getvar "OSMODE"))
  (setq old-ly (getvar "CLAYER"))
  (setq old-ce (getvar "CMDECHO"))
  (setvar "OSMODE" 0)
  (setvar "CMDECHO" 0)

  ;; Create / set layer
  (command "_.LAYER" "_M" lyrName "_C" "7" "" "")
  (setq spacing 2.0)
  (setq cx startX)
  (setq cy 0.0)

  ;; Draw each radial segment piece
  (setq segIdx 0)
  (while (< segIdx numSegs)
    (setq sa (* segIdx devAngle))
    (setq ea (* (1+ segIdx) devAngle))
    (setq saRad (* sa (/ pi 180.0)))
    (setq eaRad (* ea (/ pi 180.0)))

    ;; Outer arc endpoints
    (setq ox1 (+ cx (* outerR (cos saRad))))
    (setq oy1 (+ cy (* outerR (sin saRad))))
    (setq ox2 (+ cx (* outerR (cos eaRad))))
    (setq oy2 (+ cy (* outerR (sin eaRad))))

    ;; Inner arc endpoints
    (setq ix1 (+ cx (* innerR (cos saRad))))
    (setq iy1 (+ cy (* innerR (sin saRad))))
    (setq ix2 (+ cx (* innerR (cos eaRad))))
    (setq iy2 (+ cy (* innerR (sin eaRad))))

    ;; Draw outer arc: center, start point, included angle
    (command "_.ARC" "_C" (list cx cy) (list ox1 oy1) "_A" devAngle)

    ;; Draw inner arc
    (command "_.ARC" "_C" (list cx cy) (list ix1 iy1) "_A" devAngle)

    ;; Radial line - start side
    (command "_.LINE" (list ix1 iy1) (list ox1 oy1) "")

    ;; Radial line - end side
    (command "_.LINE" (list ix2 iy2) (list ox2 oy2) "")

    ;; Advance origin for next piece
    (setq cx (+ cx (* outerR 2.0) spacing))
    (setq segIdx (1+ segIdx))
  )

  ;; Restore settings
  (setvar "OSMODE" old-os)
  (setvar "CLAYER" old-ly)
  (setvar "CMDECHO" old-ce)
  (command "_.ZOOM" "_E")
  (princ (strcat "\\nCONELAYOUT: " (itoa numSegs) " piece(s) drawn on layer " lyrName))
  (princ)
)

(princ "\\n=== CONELAYOUT.LSP loaded ===========================")
(princ "\\nPaste command from CR Admin estimating software.")
(princ "\\nFormat: (CONELAYOUT outerR innerR angle segs \\"layer\\" offsetX)")
(princ)`;

function AutoCADToolsPage() {
  const [copiedLisp, setCopiedLisp] = useState(false);

  const handleDownload = (content, filename) => {
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename;
    document.body.appendChild(a); a.click();
    document.body.removeChild(a); URL.revokeObjectURL(url);
  };

  const handleCopy = (content, setter) => {
    navigator.clipboard.writeText(content).then(() => {
      setter(true);
      setTimeout(() => setter(false), 3000);
    });
  };

  return (
    <div className="page-container">
      <div className="page-header">
        <h2 style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <FileCode size={28} /> AutoCAD Tools
        </h2>
        <p style={{ color: '#666', marginTop: 4, fontSize: '0.9rem' }}>
          Download AutoLISP programs that work with CR Admin's estimating features.
        </p>
      </div>

      {/* CONELAYOUT.lsp */}
      <div className="card" style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16, marginBottom: 16 }}>
          <div style={{ width: 56, height: 56, borderRadius: 12, background: 'linear-gradient(135deg, #f59e0b, #d97706)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <Terminal size={28} color="white" />
          </div>
          <div style={{ flex: 1 }}>
            <h3 style={{ margin: 0, fontSize: '1.15rem' }}>CONELAYOUT.lsp</h3>
            <div style={{ color: '#666', fontSize: '0.85rem', marginTop: 2 }}>Cone Flat Pattern Generator</div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn-primary"
              onClick={() => handleDownload(CONELAYOUT_LISP, 'CONELAYOUT.lsp')}
              style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'linear-gradient(135deg, #f59e0b, #d97706)', border: 'none' }}>
              <Download size={16} /> Download .lsp
            </button>
            <button className="btn"
              onClick={() => handleCopy(CONELAYOUT_LISP, setCopiedLisp)}
              style={{ display: 'flex', alignItems: 'center', gap: 6, border: '2px solid ' + (copiedLisp ? '#16a34a' : '#d97706'), color: copiedLisp ? '#16a34a' : '#92400e', background: copiedLisp ? '#f0fdf4' : '#fffbeb' }}>
              {copiedLisp ? <><Check size={14} /> Copied</> : <><Copy size={14} /> Copy</>}
            </button>
          </div>
        </div>

        {/* What it does */}
        <div style={{ background: '#fffbeb', padding: 16, borderRadius: 8, border: '1px solid #fde68a', marginBottom: 16 }}>
          <div style={{ fontWeight: 700, color: '#92400e', marginBottom: 8, fontSize: '0.9rem' }}>What it does</div>
          <div style={{ color: '#78350f', fontSize: '0.85rem', lineHeight: 1.7 }}>
            Draws cone flat patterns in AutoCAD from computed parameters. When you create a Cone Layout part in the
            estimating system, it generates a command like:<br />
            <code style={{ display: 'inline-block', marginTop: 6, background: '#1e1e2e', color: '#89b4fa', padding: '6px 10px', borderRadius: 4, fontSize: '0.85rem' }}>
              (CONELAYOUT 19.1713 38.1450 113.8420 1 "CONE-L1" 0.0000)
            </code>
            <br />
            You copy that command from the estimate form and paste it into AutoCAD's command line. It draws the outer arc,
            inner arc, and radial lines for each segment piece — all on a named layer.
          </div>
        </div>

        {/* Setup instructions */}
        <div style={{ background: '#f0f4ff', padding: 16, borderRadius: 8, border: '1px solid #bfdbfe', marginBottom: 16 }}>
          <div style={{ fontWeight: 700, color: '#1e40af', marginBottom: 10, fontSize: '0.9rem' }}>Setup (one time)</div>
          <div style={{ display: 'grid', gap: 10 }}>
            {[
              { step: '1', text: 'Download CONELAYOUT.lsp and save it somewhere permanent', sub: 'e.g. C:\\AutoCAD Support\\CONELAYOUT.lsp' },
              { step: '2', text: 'In AutoCAD, type APPLOAD and press Enter' },
              { step: '3', text: 'Browse to the file and click Load' },
              { step: '4', text: 'Click "Contents" under Startup Suite → Add → pick the same file', sub: 'This loads it automatically every time AutoCAD starts' },
            ].map(item => (
              <div key={item.step} style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                <div style={{ width: 28, height: 28, borderRadius: '50%', background: '#3b82f6', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '0.85rem', flexShrink: 0 }}>{item.step}</div>
                <div>
                  <div style={{ fontSize: '0.9rem', color: '#1e3a5f' }}>{item.text}</div>
                  {item.sub && <div style={{ fontSize: '0.8rem', color: '#6b7280', marginTop: 2 }}>{item.sub}</div>}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Daily workflow */}
        <div style={{ background: '#f0fdf4', padding: 16, borderRadius: 8, border: '1px solid #bbf7d0', marginBottom: 16 }}>
          <div style={{ fontWeight: 700, color: '#166534', marginBottom: 10, fontSize: '0.9rem' }}>Daily Workflow</div>
          <div style={{ display: 'grid', gap: 10 }}>
            {[
              { step: '1', text: 'In CR Admin, fill in the cone part dimensions' },
              { step: '2', text: 'Copy the generated command from the AutoCAD Command section' },
              { step: '3', text: 'Switch to AutoCAD and paste at the command line', sub: 'The flat pattern draws instantly with layers and zoom-to-fit' },
            ].map(item => (
              <div key={item.step} style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                <div style={{ width: 28, height: 28, borderRadius: '50%', background: '#16a34a', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '0.85rem', flexShrink: 0 }}>{item.step}</div>
                <div>
                  <div style={{ fontSize: '0.9rem', color: '#14532d' }}>{item.text}</div>
                  {item.sub && <div style={{ fontSize: '0.8rem', color: '#6b7280', marginTop: 2 }}>{item.sub}</div>}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Parameters reference */}
        <div style={{ background: '#faf5ff', padding: 16, borderRadius: 8, border: '1px solid #e9d5ff' }}>
          <div style={{ fontWeight: 700, color: '#6b21a8', marginBottom: 10, fontSize: '0.9rem' }}>Parameter Reference</div>
          <div style={{ fontFamily: 'monospace', fontSize: '0.85rem', color: '#581c87', marginBottom: 12 }}>
            (CONELAYOUT outerR innerR devAngle numSegs "layerName" startX)
          </div>
          <table style={{ width: '100%', fontSize: '0.85rem', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid #e9d5ff' }}>
                <th style={{ textAlign: 'left', padding: '6px 8px', color: '#6b21a8' }}>Parameter</th>
                <th style={{ textAlign: 'left', padding: '6px 8px', color: '#6b21a8' }}>Description</th>
                <th style={{ textAlign: 'left', padding: '6px 8px', color: '#6b21a8' }}>Example</th>
              </tr>
            </thead>
            <tbody>
              {[
                ['outerR', 'Outer radius of flat blank (inches)', '19.1713'],
                ['innerR', 'Inner radius of flat blank (inches)', '38.1450'],
                ['devAngle', 'Developed angle per piece (degrees)', '113.842'],
                ['numSegs', 'Number of radial segments', '4'],
                ['layerName', 'AutoCAD layer name (string)', '"CONE-L1"'],
                ['startX', 'X origin offset for the group', '0.0'],
              ].map(([param, desc, ex]) => (
                <tr key={param} style={{ borderBottom: '1px solid #f3e8ff' }}>
                  <td style={{ padding: '6px 8px', fontFamily: 'monospace', fontWeight: 600 }}>{param}</td>
                  <td style={{ padding: '6px 8px', color: '#374151' }}>{desc}</td>
                  <td style={{ padding: '6px 8px', fontFamily: 'monospace', color: '#7c3aed' }}>{ex}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export default AutoCADToolsPage;
