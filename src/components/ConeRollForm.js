import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { Upload, ChevronDown, ChevronUp, Copy, Check } from 'lucide-react';
import { searchVendors, getSettings, createVendor } from '../services/api';

const THICKNESS_OPTIONS = [
  '24 ga', '20 ga', '16 ga', '14 ga', '12 ga', '11 ga', '10 ga',
  '1/8"', '3/16"', '1/4"', '5/16"', '3/8"', '1/2"', '5/8"', '3/4"', '7/8"',
  '1"', '1-1/4"', '1-1/2"', '2"', 'Custom'
];
const DEFAULT_GRADE_OPTIONS = ['A36', '304 S/S', '316 S/S', 'AR400', 'Custom'];

function thicknessToDecimal(t) {
  if (!t) return 0;
  var gm = { '24 ga': 0.0239, '20 ga': 0.0359, '16 ga': 0.0598, '14 ga': 0.0747, '12 ga': 0.1046, '11 ga': 0.1196, '10 ga': 0.1345 };
  if (gm[t]) return gm[t];
  var c = t.replace(/"/g, '').trim();
  if (c.includes('-')) { var p = c.split('-'); var f = p[1].split('/').map(Number); return Number(p[0]) + f[0] / f[1]; }
  if (c.includes('/')) { var f = c.split('/').map(Number); return f[0] / f[1]; }
  return parseFloat(c) || 0;
}

// ========== CONE CALCULATOR ==========
class ConeCalculator {
  constructor(thickness, largeDia, largeDiaType, smallDia, smallDiaType, height) {
    this.thickness = thickness; this.height = height;
    this.largeDia = largeDiaType === 'inside' ? largeDia + thickness : largeDiaType === 'centerline' ? largeDia : largeDia - thickness;
    this.smallDia = smallDiaType === 'inside' ? smallDia + thickness : smallDiaType === 'centerline' ? smallDia : smallDia - thickness;
    this.largeRadius = this.largeDia / 2;
    this.smallRadius = this.smallDia / 2;
    this.slantHeight = Math.sqrt(this.height * this.height + Math.pow(this.largeRadius - this.smallRadius, 2));
    this.semiAngle = Math.atan((this.largeRadius - this.smallRadius) / this.height) * (180 / Math.PI);
  }
  getDiameterAtHeight(h) { return this.smallDia + (this.largeDia - this.smallDia) * (h / this.height); }
  getRadiusAtHeight(h) { return this.getDiameterAtHeight(h) / 2; }
  calculateBlankDimensions(topRadius, bottomRadius, segmentHeight) {
    var R1 = bottomRadius * this.slantHeight / (this.largeRadius - this.smallRadius);
    var R2 = topRadius * this.slantHeight / (this.largeRadius - this.smallRadius);
    return {
      outerRadius: R1, innerRadius: R2,
      arcLength: 2 * Math.PI * bottomRadius,
      developedAngle: (bottomRadius * 360) / R1,
      slantHeight: Math.sqrt(segmentHeight * segmentHeight + Math.pow(bottomRadius - topRadius, 2))
    };
  }
}

// ========== GENERATE COMMAND CALLS ==========
function generateCommands(cone, segments, radialSegs) {
  var cmds = [];
  var offsetX = 0;
  var spacing = 2;
  var rSegs = parseInt(radialSegs) || 1;

  for (var h = 0; h < segments.length; h++) {
    var seg = segments[h];
    var segH = seg.topHeight - seg.bottomHeight;
    var botR = cone.getRadiusAtHeight(seg.bottomHeight);
    var topR = cone.getRadiusAtHeight(seg.topHeight);
    var blank = cone.calculateBlankDimensions(topR, botR, segH);
    var segAngle = blank.developedAngle / rSegs;
    var lyrName = 'CONE-L' + (h + 1);

    // Output ONE segment only — vendors use their own nesting software
    cmds.push('(CONELAYOUT ' +
      blank.outerRadius.toFixed(4) + ' ' +
      blank.innerRadius.toFixed(4) + ' ' +
      segAngle.toFixed(4) + ' ' +
      '1 ' +
      '"' + lyrName + '" ' +
      offsetX.toFixed(4) + ')');

    // Offset for next layer — only one segment width
    offsetX += (blank.outerRadius * 2 + spacing);
  }

  return cmds;
}


// ========== DRAWING ==========
function drawCone3D(canvas, cone, segments) {
  if (!canvas) return;
  var ctx = canvas.getContext('2d');
  canvas.width = canvas.offsetWidth || 400;
  canvas.height = canvas.offsetHeight || 280;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  var pad = 40;
  var scale = Math.min((canvas.width - 2 * pad) / cone.largeDia, (canvas.height - 2 * pad) / cone.height);
  var cx = canvas.width / 2, by = canvas.height - pad;
  ctx.fillStyle = '#f8f9fa'; ctx.fillRect(0, 0, canvas.width, canvas.height);
  var colors = ['#667eea', '#764ba2', '#48bb78', '#ed8936', '#e53e3e', '#38b2ac'];
  for (var i = 0; i < segments.length; i++) {
    var s = segments[i];
    var bd = cone.getDiameterAtHeight(s.bottomHeight), td = cone.getDiameterAtHeight(s.topHeight);
    var bY = by - s.bottomHeight * scale, tY = by - s.topHeight * scale;
    var bH = (bd / 2) * scale, tH = (td / 2) * scale;
    ctx.fillStyle = colors[i % colors.length] + '22'; ctx.strokeStyle = colors[i % colors.length]; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(cx - bH, bY); ctx.lineTo(cx + bH, bY); ctx.lineTo(cx + tH, tY); ctx.lineTo(cx - tH, tY); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#333'; ctx.font = '10px Arial'; ctx.textAlign = 'left';
    if (i === 0) ctx.fillText('\u2300' + bd.toFixed(1) + '"', cx + bH + 4, bY);
    if (i === segments.length - 1) ctx.fillText('\u2300' + td.toFixed(1) + '"', cx + tH + 4, tY);
    ctx.textAlign = 'right'; ctx.fillStyle = colors[i % colors.length];
    ctx.fillText('L' + (i + 1), cx - Math.max(bH, tH) - 6, (bY + tY) / 2 + 4);
  }
  ctx.setLineDash([4, 4]); ctx.strokeStyle = '#999'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(cx, by + 10); ctx.lineTo(cx, by - cone.height * scale - 10); ctx.stroke(); ctx.setLineDash([]);
  ctx.fillStyle = '#666'; ctx.font = '11px Arial'; ctx.textAlign = 'center';
  ctx.fillText('H: ' + cone.height.toFixed(2) + '"', cx, by + 25);
}

function drawBlank(canvas, blank, segAngle, layerNum) {
  if (!canvas) return;
  var ctx = canvas.getContext('2d');
  canvas.width = canvas.offsetWidth || 240; canvas.height = canvas.offsetHeight || 180;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = '#f8f9fa'; ctx.fillRect(0, 0, canvas.width, canvas.height);
  var pad = 20, aR = segAngle * Math.PI / 180;
  var aw = segAngle <= 180 ? 2 * blank.outerRadius * Math.sin(aR / 2) : 2 * blank.outerRadius;
  var sc = Math.min((canvas.width - 2 * pad) / aw, (canvas.height - 2 * pad) / blank.outerRadius) * 0.8;
  var cx = canvas.width / 2, cy = canvas.height - pad, oR = blank.outerRadius * sc, iR = blank.innerRadius * sc;
  ctx.fillStyle = 'rgba(102,126,234,0.1)'; ctx.beginPath();
  ctx.arc(cx, cy, oR, -Math.PI / 2 - aR / 2, -Math.PI / 2 + aR / 2);
  ctx.lineTo(cx + iR * Math.cos(-Math.PI / 2 + aR / 2), cy + iR * Math.sin(-Math.PI / 2 + aR / 2));
  ctx.arc(cx, cy, iR, -Math.PI / 2 + aR / 2, -Math.PI / 2 - aR / 2, true); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = '#667eea'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.arc(cx, cy, oR, -Math.PI / 2 - aR / 2, -Math.PI / 2 + aR / 2); ctx.stroke();
  ctx.beginPath(); ctx.arc(cx, cy, iR, -Math.PI / 2 - aR / 2, -Math.PI / 2 + aR / 2); ctx.stroke();
  [-Math.PI / 2 - aR / 2, -Math.PI / 2 + aR / 2].forEach(function(a) {
    ctx.beginPath(); ctx.moveTo(cx + iR * Math.cos(a), cy + iR * Math.sin(a)); ctx.lineTo(cx + oR * Math.cos(a), cy + oR * Math.sin(a)); ctx.stroke();
  });
  ctx.fillStyle = '#667eea'; ctx.font = 'bold 12px Arial'; ctx.textAlign = 'center';
  ctx.fillText('Layer ' + layerNum, cx, 14);
}


// ========== COMPONENT ==========
export default function ConeRollForm({ partData, setPartData, vendorSuggestions, setVendorSuggestions, showVendorSuggestions, setShowVendorSuggestions, showMessage, setError }) {
  var [customThickness, setCustomThickness] = useState('');
  var [customGrade, setCustomGrade] = useState('');
  var [gradeOptions, setGradeOptions] = useState(DEFAULT_GRADE_OPTIONS);
  var [largeDia, setLargeDia] = useState(partData._coneLargeDia || '');
  var [largeDiaType, setLargeDiaType] = useState(partData._coneLargeDiaType || 'inside');
  var [largeDiaMeasure, setLargeDiaMeasure] = useState(partData._coneLargeDiaMeasure || 'diameter');
  var [smallDia, setSmallDia] = useState(partData._coneSmallDia || '');
  var [smallDiaType, setSmallDiaType] = useState(partData._coneSmallDiaType || 'inside');
  var [smallDiaMeasure, setSmallDiaMeasure] = useState(partData._coneSmallDiaMeasure || 'diameter');
  var [coneHeight, setConeHeight] = useState(partData._coneHeight || '');
  var [showAdvanced, setShowAdvanced] = useState(!!(partData._coneShowAdvanced));
  var [radialSegments, setRadialSegments] = useState(partData._coneRadialSegments || 1);
  var [heightCutMethod, setHeightCutMethod] = useState(partData._coneHeightCutMethod || 'equal');
  var [heightSegments, setHeightSegments] = useState(partData._coneHeightSegments || 1);
  var [customCuts, setCustomCuts] = useState(partData._coneCustomCuts || '');
  var [coneType, setConeType] = useState(partData._coneType || 'concentric');
  var [eccentricAngle, setEccentricAngle] = useState(partData._coneEccentricAngle || '');
  var [copiedCmd, setCopiedCmd] = useState(false);
  var coneCanvasRef = useRef(null);
  var blankRefs = useRef({});
  var cmdRef = useRef(null);

  useEffect(function() {
    (async function() { try { var r = await getSettings('material_grades'); if (r.data.data && r.data.data.value) { var g = r.data.data.value.filter(function(x) { return x.partTypes && x.partTypes.includes('cone_roll'); }); if (g.length > 0) setGradeOptions(g.map(function(x) { return x.name; }).concat(['Custom'])); } } catch(e) {} })();
  }, []);

  var coneData = useMemo(function() {
    var t = thicknessToDecimal(partData.thickness);
    var ldRaw = parseFloat(largeDia) || 0, sdRaw = parseFloat(smallDia) || 0, h = parseFloat(coneHeight) || 0;
    var ld = largeDiaMeasure === 'radius' ? ldRaw * 2 : ldRaw;
    var sd = smallDiaMeasure === 'radius' ? sdRaw * 2 : sdRaw;
    if (ld <= 0 || sd <= 0 || h <= 0) return null;
    try { var c = new ConeCalculator(t, ld, largeDiaType, sd, smallDiaType, h); return c.largeDia > c.smallDia ? c : null; } catch(e) { return null; }
  }, [partData.thickness, largeDia, largeDiaType, largeDiaMeasure, smallDia, smallDiaType, smallDiaMeasure, coneHeight]);

  var heightSegs = useMemo(function() {
    var h = parseFloat(coneHeight) || 0;
    if (h <= 0) return [{ bottomHeight: 0, topHeight: h }];
    if (heightCutMethod === 'equal') {
      var n = parseInt(heightSegments) || 1, segs = [];
      for (var i = 0; i < n; i++) segs.push({ bottomHeight: (i * h) / n, topHeight: ((i + 1) * h) / n });
      return segs;
    }
    if (!customCuts.trim()) return [{ bottomHeight: 0, topHeight: h }];
    var cuts = customCuts.split(',').map(function(c) { return parseFloat(c.trim()); }).filter(function(c) { return !isNaN(c) && c > 0 && c < h; }).sort(function(a, b) { return a - b; });
    var segs = [], prev = 0;
    cuts.forEach(function(cut) { segs.push({ bottomHeight: prev, topHeight: cut }); prev = cut; });
    segs.push({ bottomHeight: prev, topHeight: h });
    return segs;
  }, [coneHeight, heightCutMethod, heightSegments, customCuts]);

  var segmentSpecs = useMemo(function() {
    if (!coneData) return [];
    var rS = parseInt(radialSegments) || 1;
    return heightSegs.map(function(seg, i) {
      var segH = seg.topHeight - seg.bottomHeight;
      var bR = coneData.getRadiusAtHeight(seg.bottomHeight), tR = coneData.getRadiusAtHeight(seg.topHeight);
      var bl = coneData.calculateBlankDimensions(tR, bR, segH);
      var sA = bl.developedAngle / rS, arc = bl.arcLength / rS;
      var slope = Math.atan((bR - tR) / segH) * (180 / Math.PI);
      var aR = sA * Math.PI / 180;
      var cW = sA <= 180 ? 2 * bl.outerRadius * Math.sin(aR / 2) : 2 * bl.outerRadius;
      var rH = Math.abs(bl.outerRadius - bl.innerRadius);
      return { layer: i + 1, bottomHeight: seg.bottomHeight, topHeight: seg.topHeight, segmentHeight: segH, bottomDia: coneData.getDiameterAtHeight(seg.bottomHeight), topDia: coneData.getDiameterAtHeight(seg.topHeight), slantHeight: bl.slantHeight, slopeAngle: slope, outerRadius: bl.outerRadius, innerRadius: bl.innerRadius, segmentAngle: sA, arcLength: arc, developedAngle: bl.developedAngle, sheetWidth: Math.ceil(cW + 1), sheetHeight: Math.ceil(rH + 1), blank: bl };
    });
  }, [coneData, heightSegs, radialSegments]);

  // Generated AutoCAD commands
  var generatedCmds = useMemo(function() {
    if (!coneData) return [];
    return generateCommands(coneData, heightSegs, radialSegments);
  }, [coneData, heightSegs, radialSegments]);

  useEffect(function() { if (coneData && coneCanvasRef.current) drawCone3D(coneCanvasRef.current, coneData, heightSegs); }, [coneData, heightSegs]);
  useEffect(function() { segmentSpecs.forEach(function(sp) { var cv = blankRefs.current[sp.layer]; if (cv && sp.blank) drawBlank(cv, sp.blank, sp.segmentAngle, sp.layer); }); }, [segmentSpecs]);

  useEffect(function() {
    setPartData(function(p) { return Object.assign({}, p, { _coneLargeDia: largeDia, _coneLargeDiaType: largeDiaType, _coneLargeDiaMeasure: largeDiaMeasure, _coneSmallDia: smallDia, _coneSmallDiaType: smallDiaType, _coneSmallDiaMeasure: smallDiaMeasure, _coneHeight: coneHeight, _coneRadialSegments: radialSegments, _coneShowAdvanced: showAdvanced, _coneHeightCutMethod: heightCutMethod, _coneHeightSegments: heightSegments, _coneCustomCuts: customCuts, _coneType: coneType, _coneEccentricAngle: eccentricAngle,
      _coneSegmentDetails: segmentSpecs.map(function(s) { return { layer: s.layer, segmentAngle: s.segmentAngle, sheetWidth: s.sheetWidth, sheetHeight: s.sheetHeight, outerRadius: s.outerRadius, innerRadius: s.innerRadius, bottomDia: s.bottomDia, topDia: s.topDia }; })
    }); });
  }, [largeDia, largeDiaType, largeDiaMeasure, smallDia, smallDiaType, smallDiaMeasure, coneHeight, radialSegments, showAdvanced, heightCutMethod, heightSegments, customCuts, segmentSpecs, coneType, eccentricAngle]);

  useEffect(function() { var total = heightSegs.length * (parseInt(radialSegments) || 1); setPartData(function(p) { return Object.assign({}, p, { quantity: String(total) }); }); }, [radialSegments, heightSegs]);

  var materialDescription = useMemo(function() {
    var parts = [];
    if (partData.thickness) parts.push(partData.thickness);
    parts.push('Cone -');
    if (coneData) {
      var ldLabel = largeDiaType === 'inside' ? 'ID' : largeDiaType === 'outside' ? 'OD' : 'CLD';
      var sdLabel = smallDiaType === 'inside' ? 'ID' : smallDiaType === 'outside' ? 'OD' : 'CLD';
      parts.push(parseFloat(largeDia).toFixed(1) + '" ' + ldLabel + ' x ' + parseFloat(smallDia).toFixed(1) + '" ' + sdLabel + ' x ' + parseFloat(coneHeight).toFixed(1) + '" VH');
    }
    if (partData.material) parts.push(partData.material);
    if (partData._materialOrigin) parts.push(partData._materialOrigin);
    return parts.join(' ');
  }, [partData.thickness, partData.material, partData._materialOrigin, largeDia, smallDia, largeDiaType, smallDiaType, coneHeight, coneData]);

  var rollingDescription = useMemo(function() {
    if (!coneData) return '';
    var rS = parseInt(radialSegments) || 1, l = [];
    // Line 1: Cone type
    if (coneType === 'eccentric') {
      l.push('Eccentric' + (eccentricAngle ? ' = ' + eccentricAngle + ' deg' : ''));
    } else {
      l.push('Concentric');
    }
    // Line 2: Segment info (only if segmented)
    if (rS > 1) {
      l.push(rS + ' @ ' + (360 / rS).toFixed(0) + ' deg');
    }
    // Line 3: Multi-layer info (only if multiple layers)
    if (heightSegs.length > 1) {
      l.push(heightSegs.length + ' layers');
      segmentSpecs.forEach(function(s) { l.push('  L' + s.layer + ': ' + s.segmentAngle.toFixed(1) + ' deg - Sheet ' + s.sheetWidth + '"x' + s.sheetHeight + '" | OR:' + s.outerRadius.toFixed(1) + '" IR:' + s.innerRadius.toFixed(1) + '"'); });
    }
    return l.join('\n');
  }, [coneData, coneType, eccentricAngle, radialSegments, heightSegs, segmentSpecs]);

  useEffect(function() {
    var u = { materialDescription: materialDescription };
    if (coneData) u.sectionSize = 'Dia ' + parseFloat(largeDia).toFixed(1) + '" to Dia ' + parseFloat(smallDia).toFixed(1) + '"';
    setPartData(function(p) { return Object.assign({}, p, u); });
  }, [materialDescription]);
  useEffect(function() { if (rollingDescription) setPartData(function(p) { return Object.assign({}, p, { _rollingDescription: rollingDescription }); }); }, [rollingDescription]);

  var handleCopyCmd = useCallback(function() {
    var text = generatedCmds.join('\n');
    navigator.clipboard.writeText(text).then(function() { setCopiedCmd(true); if (showMessage) showMessage('Command(s) copied \u2014 paste into AutoCAD command line'); setTimeout(function() { setCopiedCmd(false); }, 3000); }).catch(function() { if (cmdRef.current) { cmdRef.current.select(); document.execCommand('copy'); setCopiedCmd(true); } });
  }, [generatedCmds, showMessage]);

  // Pricing
  var qty = parseInt(partData.quantity) || 1;
  var matEa = parseFloat(partData.materialTotal) || 0, labEa = parseFloat(partData.laborTotal) || 0;
  var unitPrice = matEa + labEa, lineTotal = unitPrice * qty;
  useEffect(function() { setPartData(function(p) { return Object.assign({}, p, { partTotal: lineTotal.toFixed(2) }); }); }, [lineTotal]);

  var isCustomThk = partData.thickness && !THICKNESS_OPTIONS.includes(partData.thickness) && partData.thickness !== 'Custom';
  var selThk = THICKNESS_OPTIONS.includes(partData.thickness) ? partData.thickness : (partData.thickness ? 'Custom' : '');
  var isCustomGrd = partData.material && !gradeOptions.includes(partData.material);
  var selGrd = gradeOptions.includes(partData.material) ? partData.material : (partData.material ? 'Custom' : '');

  var secStyle = { gridColumn: 'span 2', borderTop: '1px solid #e0e0e0', marginTop: 8, paddingTop: 12 };
  var secHead = function(icon, text, color) { return React.createElement('h4', { style: { marginBottom: 10, color: color, fontSize: '0.95rem' } }, icon + ' ' + text); };

  return (
    <>
      {/* QUANTITY */}
      <div className="form-group">
        <label className="form-label">Total Pieces</label>
        <input type="number" className="form-input" value={partData.quantity} style={{ background: '#e8f5e9', fontWeight: 600 }} disabled />
        <div style={{ fontSize: '0.75rem', color: '#2e7d32', marginTop: 2 }}>🔺 Auto: {heightSegs.length} layer(s) × {radialSegments} seg(s) = {heightSegs.length * (parseInt(radialSegments) || 1)}</div>
      </div>

      {/* THICKNESS */}
      <div className="form-group">
        <label className="form-label">Material Thickness *</label>
        <select className="form-select" value={selThk} onChange={function(e) { if (e.target.value === 'Custom') setPartData(Object.assign({}, partData, { thickness: customThickness || '' })); else { setPartData(Object.assign({}, partData, { thickness: e.target.value })); setCustomThickness(''); } }}>
          <option value="">Select...</option>{THICKNESS_OPTIONS.map(function(t) { return <option key={t} value={t}>{t}</option>; })}
        </select>
        {(selThk === 'Custom' || isCustomThk) && <input className="form-input" style={{ marginTop: 4 }} placeholder="Enter thickness" value={isCustomThk ? partData.thickness : customThickness} onChange={function(e) { setCustomThickness(e.target.value); setPartData(Object.assign({}, partData, { thickness: e.target.value })); }} />}
      </div>

      {/* CONE DIMENSIONS */}
      <div style={secStyle}>
        {secHead('🔺', 'Cone Dimensions', '#764ba2')}
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: 8, marginBottom: 10 }}>
          <div className="form-group" style={{ margin: 0 }}><label className="form-label">Large {largeDiaMeasure === 'radius' ? 'Radius' : 'Diameter'} *</label><input type="number" step="0.001" className="form-input" value={largeDia} onFocus={(e) => e.target.select()} onChange={function(e) { setLargeDia(e.target.value); }} placeholder="e.g. 24" /></div>
          <div className="form-group" style={{ margin: 0 }}><label className="form-label">Measured At</label><select className="form-select" value={largeDiaType} onChange={function(e) { setLargeDiaType(e.target.value); }}><option value="inside">Inside</option><option value="centerline">Centerline</option><option value="outside">Outside</option></select></div>
          <div className="form-group" style={{ margin: 0 }}><label className="form-label">Type</label><select className="form-select" value={largeDiaMeasure} onChange={function(e) { setLargeDiaMeasure(e.target.value); }}><option value="diameter">Diameter</option><option value="radius">Radius</option></select></div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: 8, marginBottom: 10 }}>
          <div className="form-group" style={{ margin: 0 }}><label className="form-label">Small {smallDiaMeasure === 'radius' ? 'Radius' : 'Diameter'} *</label><input type="number" step="0.001" className="form-input" value={smallDia} onFocus={(e) => e.target.select()} onChange={function(e) { setSmallDia(e.target.value); }} placeholder="e.g. 12" /></div>
          <div className="form-group" style={{ margin: 0 }}><label className="form-label">Measured At</label><select className="form-select" value={smallDiaType} onChange={function(e) { setSmallDiaType(e.target.value); }}><option value="inside">Inside</option><option value="centerline">Centerline</option><option value="outside">Outside</option></select></div>
          <div className="form-group" style={{ margin: 0 }}><label className="form-label">Type</label><select className="form-select" value={smallDiaMeasure} onChange={function(e) { setSmallDiaMeasure(e.target.value); }}><option value="diameter">Diameter</option><option value="radius">Radius</option></select></div>
        </div>
        <div className="form-group" style={{ marginBottom: 0 }}><label className="form-label">Cone Height *</label><input type="number" step="0.001" className="form-input" value={coneHeight} onFocus={(e) => e.target.select()} onChange={function(e) { setConeHeight(e.target.value); }} placeholder="e.g. 18" /></div>

        {/* COMPUTED PROPERTIES */}
        {coneData && (
          <div style={{ background: '#f3e8ff', padding: 12, borderRadius: 8, marginTop: 12, border: '1px solid #d6bcfa' }}>
            <div style={{ fontWeight: 600, fontSize: '0.85rem', color: '#764ba2', marginBottom: 8 }}>🔺 Computed Cone Properties</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, fontSize: '0.85rem' }}>
              <div><span style={{ color: '#666' }}>CL Large ⌀:</span> <strong>{coneData.largeDia.toFixed(3)}"</strong></div>
              <div><span style={{ color: '#666' }}>CL Small ⌀:</span> <strong>{coneData.smallDia.toFixed(3)}"</strong></div>
              <div><span style={{ color: '#666' }}>Slant Height:</span> <strong>{coneData.slantHeight.toFixed(3)}"</strong></div>
              <div><span style={{ color: '#666' }}>Semi-angle:</span> <strong>{coneData.semiAngle.toFixed(2)}°</strong></div>
            </div>
          </div>
        )}

        {/* ADVANCED BUTTON — directly below cone properties */}
        <button type="button" onClick={function() { setShowAdvanced(!showAdvanced); }}
          style={{ width: '100%', marginTop: 12, padding: '12px 16px', borderRadius: 8, fontWeight: 700, fontSize: '0.95rem', border: '2px solid ' + (showAdvanced ? '#764ba2' : '#ccc'), background: showAdvanced ? 'linear-gradient(135deg, #f3e8ff, #ede9fe)' : '#fff', color: showAdvanced ? '#764ba2' : '#666', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
          {showAdvanced ? React.createElement(ChevronUp, { size: 18 }) : React.createElement(ChevronDown, { size: 18 })}
          🔧 Advanced Cone Designer
          {showAdvanced ? React.createElement(ChevronUp, { size: 18 }) : React.createElement(ChevronDown, { size: 18 })}
        </button>

        {showAdvanced && (
          <div style={{ marginTop: 12, padding: 16, borderRadius: 8, background: '#faf5ff', border: '1px solid #e9d5ff' }}>
            {/* Cone Type */}
            <div style={{ marginBottom: 16 }}>
              <label className="form-label" style={{ fontWeight: 700, color: '#764ba2' }}>Cone Type</label>
              <div style={{ display: 'flex', gap: 8 }}>
                <button type="button" onClick={function() { setConeType('concentric'); }}
                  style={{ flex: 1, padding: '10px', borderRadius: 6, fontWeight: 600, border: '2px solid ' + (coneType === 'concentric' ? '#764ba2' : '#ccc'), background: coneType === 'concentric' ? '#ede9fe' : '#fff', color: coneType === 'concentric' ? '#764ba2' : '#666', cursor: 'pointer' }}>
                  Concentric
                </button>
                <button type="button" onClick={function() { setConeType('eccentric'); }}
                  style={{ flex: 1, padding: '10px', borderRadius: 6, fontWeight: 600, border: '2px solid ' + (coneType === 'eccentric' ? '#e65100' : '#ccc'), background: coneType === 'eccentric' ? '#fff3e0' : '#fff', color: coneType === 'eccentric' ? '#e65100' : '#666', cursor: 'pointer' }}>
                  Eccentric
                </button>
              </div>
              {coneType === 'eccentric' && (
                <div style={{ marginTop: 8 }}>
                  <label className="form-label">Eccentric Angle (degrees)</label>
                  <input type="number" className="form-input" value={eccentricAngle} onFocus={(e) => e.target.select()} onChange={function(e) { setEccentricAngle(e.target.value); }} placeholder="e.g., 15" step="0.1" />
                </div>
              )}
            </div>
            {/* Radial */}
            <div style={{ marginBottom: 16 }}>
              <label className="form-label" style={{ fontWeight: 700, color: '#764ba2' }}>Segments Around Cone: <strong>{radialSegments}</strong></label>
              <input type="range" min="1" max="16" value={radialSegments} onChange={function(e) { setRadialSegments(parseInt(e.target.value)); }} style={{ width: '100%', accentColor: '#764ba2' }} />
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem', color: '#999' }}><span>1 (full wrap)</span><span>16 pieces</span></div>
            </div>
            {/* Height */}
            <div style={{ borderTop: '1px solid #e9d5ff', paddingTop: 14 }}>
              <label className="form-label" style={{ fontWeight: 700, color: '#764ba2' }}>Height Segmentation</label>
              <select className="form-select" value={heightCutMethod} onChange={function(e) { setHeightCutMethod(e.target.value); }} style={{ marginBottom: 8 }}><option value="equal">Equal Height Segments</option><option value="custom">Custom Cut Positions</option></select>
              {heightCutMethod === 'equal' ? (
                <div>
                  <label className="form-label">Number of Height Layers: <strong style={{ color: '#764ba2' }}>{heightSegments}</strong></label>
                  <input type="range" min="1" max="10" value={heightSegments} onChange={function(e) { setHeightSegments(parseInt(e.target.value)); }} style={{ width: '100%', accentColor: '#764ba2' }} />
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem', color: '#999' }}><span>1 (no cuts)</span><span>10</span></div>
                </div>
              ) : (
                <div>
                  <label className="form-label">Cut Heights (inches from bottom)</label>
                  <input className="form-input" value={customCuts} onChange={function(e) { setCustomCuts(e.target.value); }} placeholder="e.g., 6, 12" />
                  <div style={{ fontSize: '0.7rem', color: '#999', marginTop: 2 }}>Comma-separated. "6, 12" = layers at 0→6", 6→12", 12→top</div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* CONE PREVIEW — concentric only */}
      {coneData && coneType === 'concentric' && (
        <div style={secStyle}>
          {secHead('\uD83D\uDC41\uFE0F', 'Cone Preview', '#667eea')}
          <canvas ref={coneCanvasRef} style={{ width: '100%', height: 220, borderRadius: 8, border: '1px solid #e0e0e0' }} />
        </div>
      )}

      {/* SEGMENT DETAILS — concentric only */}
      {segmentSpecs.length > 0 && coneType === 'concentric' && (
        <div style={secStyle}>
          {secHead('📋', 'Segment Details (' + segmentSpecs.length + ' layer' + (segmentSpecs.length > 1 ? 's' : '') + ' \u00d7 ' + radialSegments + ' seg' + (radialSegments > 1 ? 's' : '') + ')', '#2e7d32')}
          {segmentSpecs.map(function(sp) { return (
            <div key={sp.layer} style={{ background: '#f0fdf4', padding: 12, borderRadius: 8, marginBottom: 8, border: '1px solid #bbf7d0' }}>
              <div style={{ fontWeight: 700, color: '#166534', marginBottom: 6, fontSize: '0.9rem' }}>Layer {sp.layer}: {sp.bottomHeight.toFixed(2)}" → {sp.topHeight.toFixed(2)}"</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4, fontSize: '0.8rem' }}>
                <div>Bottom ⌀: <strong>{sp.bottomDia.toFixed(3)}"</strong></div>
                <div>Top ⌀: <strong>{sp.topDia.toFixed(3)}"</strong></div>
                <div>Slant: <strong>{sp.slantHeight.toFixed(3)}"</strong></div>
                <div>Slope: <strong>{sp.slopeAngle.toFixed(2)}°</strong></div>
                <div>Outer R: <strong>{sp.outerRadius.toFixed(3)}"</strong></div>
                <div>Inner R: <strong>{sp.innerRadius.toFixed(3)}"</strong></div>
                <div>Seg Angle: <strong>{sp.segmentAngle.toFixed(2)}°</strong></div>
                <div>Arc Length: <strong>{sp.arcLength.toFixed(3)}"</strong></div>
                <div style={{ gridColumn: 'span 2', marginTop: 4, padding: '4px 8px', background: '#dcfce7', borderRadius: 4, fontWeight: 600 }}>📐 Sheet Size: {sp.sheetWidth}" × {sp.sheetHeight}" (with 1" trim)</div>
              </div>
              <canvas ref={function(el) { blankRefs.current[sp.layer] = el; }} style={{ width: '100%', height: 140, marginTop: 8, borderRadius: 6, border: '1px solid #d1fae5' }} />
            </div>
          ); })}
        </div>
      )}

      {/* AUTOCAD INTEGRATION — concentric only */}
      {coneData && coneType === 'concentric' && (
        <div style={secStyle}>
          {secHead('📐', 'AutoCAD Command', '#b45309')}

          <div style={{ background: '#f0f4ff', padding: 14, borderRadius: 8, border: '1px solid #bfdbfe' }}>
            <div style={{ fontSize: '0.8rem', color: '#1e3a5f', marginBottom: 10 }}>
              {generatedCmds.length === 1 ? 'Copy and paste into AutoCAD command line (draws one segment):' : 'Copy these ' + generatedCmds.length + ' lines and paste into AutoCAD command line (one segment per layer):'}
            </div>

            <textarea ref={cmdRef} readOnly value={generatedCmds.join('\n')}
              style={{ width: '100%', height: Math.max(44, generatedCmds.length * 28), fontFamily: '"Courier New", monospace', fontSize: '0.85rem', background: '#1e1e2e', color: '#89b4fa', border: '1px solid #45475a', borderRadius: 8, padding: 12, resize: 'none', lineHeight: 1.6 }}
              onClick={function(e) { e.target.select(); }} />

            <button type="button" onClick={handleCopyCmd}
              style={{ width: '100%', marginTop: 8, padding: '12px 16px', borderRadius: 8, fontWeight: 700, fontSize: '0.95rem', border: 'none', cursor: 'pointer', background: copiedCmd ? '#16a34a' : 'linear-gradient(135deg, #3b82f6, #1d4ed8)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, transition: 'background 0.3s' }}>
              {copiedCmd ? React.createElement(Check, { size: 18 }) : React.createElement(Copy, { size: 18 })}
              {copiedCmd ? 'Copied! Paste into AutoCAD command line' : 'Copy Command' + (generatedCmds.length > 1 ? 's' : '')}
            </button>

            <div style={{ fontSize: '0.75rem', color: '#6b7280', marginTop: 8, textAlign: 'center' }}>
              Requires CONELAYOUT.lsp — download from <a href="/admin/autocad-tools" style={{ color: '#3b82f6' }}>Admin → AutoCAD Tools</a>
            </div>
          </div>
        </div>
      )}

      {/* DESCRIPTION PREVIEW */}
      {rollingDescription && (
        <div style={secStyle}>
          <div style={{ background: '#f3e5f5', padding: 12, borderRadius: 8 }}>
            <div style={{ fontWeight: 600, fontSize: '0.85rem', color: '#6a1b9a', marginBottom: 6 }}>Cone Layout Description:</div>
            <pre style={{ margin: 0, fontSize: '0.85rem', whiteSpace: 'pre-wrap', fontFamily: 'monospace', color: '#333' }}>{materialDescription}{'\n'}{rollingDescription}</pre>
          </div>
        </div>
      )}

      {/* FILE UPLOAD */}
      <div style={secStyle}>
        <div className="form-group"><label className="form-label">Drawing / Reference (PDF)</label>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 12px', border: '1px dashed #bbb', borderRadius: 6, cursor: 'pointer', fontSize: '0.85rem', color: '#666' }}>
            <Upload size={16} /> Upload drawing...<input type="file" accept=".pdf,.png,.jpg,.jpeg" style={{ display: 'none' }} onChange={function(e) { if (e.target.files[0]) { var file = e.target.files[0]; setPartData(Object.assign({}, partData, { _shapeFile: file, _shapeFileName: file.name })); } }} /></label>
          {(partData._shapeFile || partData._shapeFileName) && <div style={{ fontSize: '0.8rem', color: '#2e7d32', marginTop: 2 }}>📎 {partData._shapeFile?.name || partData._shapeFileName} {!partData._shapeFile && partData._shapeFileName && <span style={{ color: '#999' }}>(saved)</span>}</div>}
        </div>
      </div>

      {/* SPECIAL INSTRUCTIONS */}
      <div style={secStyle}>
        <div className="form-group"><label className="form-label">Special Instructions</label><textarea className="form-textarea" value={partData.specialInstructions || ''} onChange={function(e) { setPartData(Object.assign({}, partData, { specialInstructions: e.target.value })); }} rows={2} /></div>
      </div>

      {/* MATERIAL */}
      <div style={secStyle}>
        {secHead('📦', 'Material Information', '#e65100')}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
          <div className="form-group"><label className="form-label">Grade</label>
            <select className="form-select" value={selGrd} onChange={function(e) { if (e.target.value === 'Custom') setPartData(Object.assign({}, partData, { material: customGrade || 'Custom' })); else { setPartData(Object.assign({}, partData, { material: e.target.value })); setCustomGrade(''); } }}><option value="">Select...</option>{gradeOptions.map(function(g) { return <option key={g} value={g}>{g}</option>; })}</select>
            {(selGrd === 'Custom' || isCustomGrd) && <input className="form-input" style={{ marginTop: 4 }} placeholder="Enter grade" value={isCustomGrd ? partData.material : customGrade} onChange={function(e) { setCustomGrade(e.target.value); setPartData(Object.assign({}, partData, { material: e.target.value })); }} />}
          </div>
          <div className="form-group"><label className="form-label">Origin</label><select className="form-select" value={partData._materialOrigin || ''} onChange={function(e) { setPartData(Object.assign({}, partData, { _materialOrigin: e.target.value })); }}><option value="">Select...</option><option value="Domestic">Domestic</option><option value="Import">Import</option></select></div>
          <div className="form-group"><label className="form-label">Material Source</label><select className="form-select" value={partData.materialSource || 'customer_supplied'} onChange={function(e) { setPartData(Object.assign({}, partData, { materialSource: e.target.value })); }}><option value="customer_supplied">Client Supplies</option><option value="we_order">We Order</option></select></div>
        </div>
        {partData.materialSource === 'we_order' && (
          <div className="form-group" style={{ position: 'relative', marginTop: 8 }}>
            <label className="form-label">Vendor</label>
            <input className="form-input" value={partData._vendorSearch !== undefined ? partData._vendorSearch : (partData.vendor ? partData.vendor.name : partData.supplierName || '')}
              onChange={async function(e) { var v = e.target.value; setPartData(Object.assign({}, partData, { _vendorSearch: v })); if (v.length >= 1) { try { var r = await searchVendors(v); setVendorSuggestions(r.data.data || []); setShowVendorSuggestions(true); } catch(x) { setVendorSuggestions([]); } } else { setPartData(Object.assign({}, partData, { _vendorSearch: v, vendorId: null, supplierName: '' })); setVendorSuggestions([]); setShowVendorSuggestions(false); } }}
              onFocus={async function() { try { var r = await searchVendors(''); setVendorSuggestions(r.data.data || []); setShowVendorSuggestions(true); } catch(x) {} }}
              onBlur={function() { setTimeout(function() { setShowVendorSuggestions(false); }, 200); }} placeholder="Search or add vendor..." autoComplete="off" />
            {showVendorSuggestions && (
              <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 100, background: 'white', border: '1px solid #ddd', borderRadius: 4, maxHeight: 200, overflowY: 'auto', boxShadow: '0 4px 12px rgba(0,0,0,0.15)' }}>
                {vendorSuggestions.map(function(v) { return <div key={v.id} style={{ padding: '8px 12px', cursor: 'pointer', borderBottom: '1px solid #eee' }} onMouseDown={function() { setPartData(Object.assign({}, partData, { vendorId: v.id, supplierName: v.name, _vendorSearch: undefined })); setShowVendorSuggestions(false); }}><strong>{v.name}</strong>{v.contactPhone && <span style={{ fontSize: '0.8rem', color: '#666', marginLeft: 8 }}>{v.contactPhone}</span>}</div>; })}
                {partData._vendorSearch && partData._vendorSearch.length >= 2 && !vendorSuggestions.some(function(v) { return v.name.toLowerCase() === (partData._vendorSearch || '').toLowerCase(); }) && (
                  <div style={{ padding: '8px 12px', cursor: 'pointer', background: '#e8f5e9', color: '#2e7d32', fontWeight: 600 }} onMouseDown={async function() { try { var resp = await createVendor({ name: partData._vendorSearch }); if (resp.data.data) { setPartData(Object.assign({}, partData, { vendorId: resp.data.data.id, supplierName: resp.data.data.name, _vendorSearch: undefined })); showMessage('Vendor "' + resp.data.data.name + '" created'); } } catch(x) { setError('Failed to create vendor'); } setShowVendorSuggestions(false); }}>+ Add "{partData._vendorSearch}" as new vendor</div>
                )}
              </div>
            )}
          </div>
        )}
        <div className="form-group" style={{ marginTop: 12 }}><label className="form-label">Material Description (for ordering)</label><textarea className="form-textarea" value={partData.materialDescription || ''} onChange={function(e) { setPartData(Object.assign({}, partData, { materialDescription: e.target.value })); }} rows={2} style={{ fontFamily: 'monospace', fontSize: '0.9rem' }} /><div style={{ fontSize: '0.75rem', color: '#999', marginTop: 2 }}>Auto-generated — edit as needed</div></div>
      </div>

      {/* PRICING */}
      <div style={secStyle}>
        {secHead('💰', 'Pricing', '#1976d2')}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div className="form-group"><label className="form-label">Material (each)</label><input type="number" step="any" className="form-input" value={partData.materialTotal || ''} onFocus={(e) => e.target.select()} onChange={function(e) { setPartData(Object.assign({}, partData, { materialTotal: e.target.value })); }} placeholder="0.00" /></div>
          <div className="form-group"><label className="form-label">Labor (each)</label><input type="number" step="any" className="form-input" value={partData.laborTotal || ''} onFocus={(e) => e.target.select()} onChange={function(e) { setPartData(Object.assign({}, partData, { laborTotal: e.target.value })); }} placeholder="0.00" /></div>
        </div>
        <div style={{ background: '#f0f7ff', padding: 12, borderRadius: 8, marginTop: 12, border: '1px solid #bbdefb' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', fontSize: '0.9rem', color: '#555' }}><span>Material (ea)</span><span>${matEa.toFixed(2)}</span></div>
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', fontSize: '0.9rem', color: '#555' }}><span>Labor (ea)</span><span>${labEa.toFixed(2)}</span></div>
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderTop: '1px solid #90caf9', marginTop: 4 }}><strong>Unit Price</strong><strong style={{ color: '#1976d2' }}>${unitPrice.toFixed(2)}</strong></div>
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderTop: '1px solid #90caf9' }}><strong>Line Total ({qty} × ${unitPrice.toFixed(2)})</strong><strong style={{ fontSize: '1.15rem', color: '#2e7d32' }}>${lineTotal.toFixed(2)}</strong></div>
        </div>
      </div>

      {/* TRACKING */}
      <div style={secStyle}>
        {secHead('🏷️', 'Tracking', '#616161')}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div className="form-group"><label className="form-label">Client Part Number</label><input type="text" className="form-input" value={partData.clientPartNumber || ''} onChange={function(e) { setPartData(Object.assign({}, partData, { clientPartNumber: e.target.value })); }} placeholder="Optional" /></div>
          <div className="form-group"><label className="form-label">Heat Number</label><input type="text" className="form-input" value={partData.heatNumber || ''} onChange={function(e) { setPartData(Object.assign({}, partData, { heatNumber: e.target.value })); }} placeholder="Optional" /></div>
        </div>
      </div>
    </>
  );
}
