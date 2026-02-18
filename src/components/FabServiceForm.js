import React, { useState, useEffect, useMemo, useRef } from 'react';
import { getSettings } from '../services/api';

const SERVICE_TYPES = [
  { key: 'weld_100', label: '100% Weld', icon: '🔥', color: '#c62828', hasWeldCalc: true },
  { key: 'tack_weld', label: 'Tack Weld', icon: '⚡', color: '#e65100', hasWeldCalc: false },
  { key: 'fit', label: 'Fit Only', icon: '🔧', color: '#1565c0', hasWeldCalc: false },
  { key: 'cut_to_fit', label: 'Cut to Fit', icon: '✂️', color: '#2e7d32', hasWeldCalc: false },
  { key: 'finishing', label: 'Finishing', icon: '✨', color: '#6a1b9a', hasWeldCalc: false },
  { key: 'other', label: 'Other Service', icon: '🛠️', color: '#616161', hasWeldCalc: false },
];

const FINISH_TYPES = [
  '#1 Finish (Hot Rolled)',
  '#2B Finish (Cold Rolled)',
  '#3 Finish (Intermediate Polish)',
  '#4 Finish (Brushed/Satin)',
  '#6 Finish (Fine Satin)',
  '#7 Finish (Reflective)',
  '#8 Finish (Mirror)',
  'Bead Blast',
  'Grain Finish',
  'Custom',
];

/**
 * Extract dimensions from a part's fields (formData is already merged by API).
 */
function extractPartInfo(part) {
  const info = {
    thickness: 0,
    thicknessLabel: '',
    grade: '',
    seamOptions: [],
    partLabel: '',
  };

  // Thickness
  const thkStr = part.thickness || '';
  info.thicknessLabel = thkStr;
  info.thickness = parseThickness(thkStr);

  // Grade
  info.grade = part.material || '';

  // Part label
  const matDesc = part._materialDescription || part.materialDescription || '';
  info.partLabel = matDesc || ('Part #' + (part.partNumber || '?'));

  const ptype = part.partType;

  if (ptype === 'plate_roll') {
    const w = parseFloat(part.width) || 0;
    if (w > 0) info.seamOptions.push({ label: 'Longitudinal Seam (' + w + '")', lengthInches: w });
    const rollVal = parseFloat(part._rollValue || part.diameter || part.radius) || 0;
    const measureType = part._rollMeasureType || 'diameter';
    const measurePoint = part._rollMeasurePoint || 'outside';
    let dia = rollVal;
    if (measureType === 'radius') dia = rollVal * 2;
    if (dia > 0) {
      const circ = Math.PI * dia;
      info.seamOptions.push({ label: 'Circumferential Seam (' + measurePoint + ' \u00d8' + dia + '" = ' + circ.toFixed(2) + '")', lengthInches: circ });
    }
  } else if (ptype === 'flat_stock') {
    const shape = part._plateShape || '';
    const stockType = part._stockType || '';
    if (stockType === 'plate' && shape === 'round') {
      const plateDia = parseFloat(part._plateDiameter) || 0;
      if (plateDia > 0) {
        const circ = Math.PI * plateDia;
        info.seamOptions.push({ label: 'Circumference (\u00d8' + plateDia + '" = ' + circ.toFixed(2) + '")', lengthInches: circ });
      }
    } else if (stockType === 'plate' && shape === 'donut') {
      const od = parseFloat(part._plateOD) || 0;
      const id = parseFloat(part._plateID) || 0;
      if (od > 0) info.seamOptions.push({ label: 'OD Circumference (\u00d8' + od + '" = ' + (Math.PI * od).toFixed(2) + '")', lengthInches: Math.PI * od });
      if (id > 0) info.seamOptions.push({ label: 'ID Circumference (\u00d8' + id + '" = ' + (Math.PI * id).toFixed(2) + '")', lengthInches: Math.PI * id });
    } else if (stockType === 'plate') {
      const w = parseFloat(part.width) || 0;
      const l = parseFloat(part.length) || 0;
      if (w > 0 && l > 0) {
        info.seamOptions.push({ label: 'Width seam (' + w + '")', lengthInches: w });
        info.seamOptions.push({ label: 'Length seam (' + l + '")', lengthInches: l });
        info.seamOptions.push({ label: 'Perimeter (' + (2 * (w + l)).toFixed(2) + '")', lengthInches: 2 * (w + l) });
      }
    }
  } else if (ptype === 'pipe_roll' || ptype === 'tube_roll') {
    const od = parseFloat(part.outerDiameter) || 0;
    if (od > 0) {
      const circ = Math.PI * od;
      info.seamOptions.push({ label: 'Circumference (OD ' + od + '" = ' + circ.toFixed(2) + '")', lengthInches: circ });
    }
  } else if (['angle_roll', 'channel_roll', 'beam_roll', 'flat_bar', 'tee_bar'].includes(ptype)) {
    const rollVal = parseFloat(part._rollValue || part.diameter || part.radius) || 0;
    const measureType = part._rollMeasureType || 'diameter';
    let dia = rollVal;
    if (measureType === 'radius') dia = rollVal * 2;
    if (dia > 0) {
      const circ = Math.PI * dia;
      info.seamOptions.push({ label: 'Circumference (\u00d8' + dia + '" = ' + circ.toFixed(2) + '")', lengthInches: circ });
    }
  }

  // Always add manual/custom option
  info.seamOptions.push({ label: 'Custom Length', lengthInches: 0 });

  return info;
}

function parseThickness(t) {
  if (!t) return 0;
  const gaugeMap = {
    '24 ga': 0.0239, '20 ga': 0.0359, '16 ga': 0.0598, '14 ga': 0.0747,
    '12 ga': 0.1046, '11 ga': 0.1196, '10 ga': 0.1345
  };
  if (gaugeMap[t]) return gaugeMap[t];
  const clean = t.replace(/"/g, '').trim();
  if (clean.includes('-')) {
    const parts = clean.split('-');
    const frac = parts[1].split('/').map(Number);
    return Number(parts[0]) + (frac[0] / frac[1]);
  }
  if (clean.includes('/')) {
    const parts = clean.split('/').map(Number);
    return parts[0] / parts[1];
  }
  return parseFloat(clean) || 0;
}

export default function FabServiceForm({ partData, setPartData, estimateParts = [], showMessage, setError }) {
  const [weldRates, setWeldRates] = useState({});
  const prevSyncRef = useRef('');

  useEffect(() => {
    const loadRates = async () => {
      try {
        const resp = await getSettings('weld_rates');
        if (resp.data.data?.value) setWeldRates(resp.data.data.value);
      } catch (e) { /* no rates configured yet */ }
    };
    loadRates();
  }, []);

  const serviceType = partData._serviceType || '';
  const serviceConfig = SERVICE_TYPES.find(s => s.key === serviceType);
  
  // Keep linkedPartId as string to match select values
  const linkedPartIdStr = partData._linkedPartId ? String(partData._linkedPartId) : '';

  // Available parts (exclude fab services)
  const availableParts = useMemo(() => {
    return estimateParts.filter(p => p.partType !== 'fab_service' && p.partType !== 'shop_rate');
  }, [estimateParts]);

  // Find linked part using string comparison
  const linkedPart = useMemo(() => {
    if (!linkedPartIdStr) return null;
    return availableParts.find(p => String(p.id) === linkedPartIdStr) || null;
  }, [linkedPartIdStr, availableParts]);

  const partInfo = useMemo(() => {
    if (!linkedPart) return null;
    try {
      return extractPartInfo(linkedPart);
    } catch (e) {
      console.error('extractPartInfo error:', e);
      return null;
    }
  }, [linkedPart]);

  // Selected seam
  const selectedSeamIdx = parseInt(partData._seamOptionIdx) || 0;
  const selectedSeam = partInfo && partInfo.seamOptions ? partInfo.seamOptions[selectedSeamIdx] : null;
  const isCustomSeam = selectedSeam ? selectedSeam.label === 'Custom Length' : false;
  const seamLength = isCustomSeam ? (parseFloat(partData._customSeamLength) || 0) : (selectedSeam ? selectedSeam.lengthInches : 0);

  // Auto weld rate lookup
  const autoRate = useMemo(() => {
    if (!partInfo || !partInfo.grade || !weldRates || Object.keys(weldRates).length === 0) return null;
    const grade = partInfo.grade;
    if (weldRates[grade] !== undefined) return Number(weldRates[grade]);
    const key = Object.keys(weldRates).find(k => k !== 'default' && grade.toLowerCase().includes(k.toLowerCase()));
    if (key) return Number(weldRates[key]);
    if (weldRates['default'] !== undefined) return Number(weldRates['default']);
    return null;
  }, [partInfo, weldRates]);

  const weldPricePerFoot = parseFloat(partData._weldPricePerFoot) || 0;

  // Weld calc
  const weldCalc = useMemo(() => {
    if (!serviceConfig || !serviceConfig.hasWeldCalc || !partInfo) return null;
    const thickness = partInfo.thickness;
    if (thickness <= 0 || seamLength <= 0 || weldPricePerFoot <= 0) return null;
    const passesRaw = thickness / 0.125;
    const passes = Math.ceil(passesRaw);
    const seamFeetRaw = seamLength / 12;
    const seamFeet = Math.ceil(seamFeetRaw);
    const total = passes * seamFeet * weldPricePerFoot;
    return { passesRaw: passesRaw, passes: passes, seamFeetRaw: seamFeetRaw, seamFeet: seamFeet, total: total, thickness: thickness, seamLength: seamLength, pricePerFoot: weldPricePerFoot };
  }, [serviceConfig, partInfo, seamLength, weldPricePerFoot]);

  // Description
  const serviceDescription = useMemo(() => {
    const d = [];
    if (serviceConfig) d.push(serviceConfig.label);
    if (linkedPart) d.push('Part #' + (linkedPart.partNumber || '?'));
    if (serviceType === 'finishing') {
      if (partData._finishType) d.push(partData._finishType === 'Custom' ? (partData._finishTypeCustom || 'Custom Finish') : partData._finishType);
      if (partData._finishSide) {
        const sideLabel = partData._finishSide === 'one' ? 'One Side' : 'Both Sides';
        d.push(sideLabel);
      }
    } else {
      if (selectedSeam && !isCustomSeam) d.push(selectedSeam.label);
      if (isCustomSeam && partData._customSeamLength) d.push('Custom Seam: ' + partData._customSeamLength + '"');
      if (partData._bevelNotes) d.push('Bevel: ' + partData._bevelNotes);
    }
    if (partData._serviceNotes) d.push(partData._serviceNotes);
    return d.join(' \u2014 ');
  }, [serviceConfig, serviceType, linkedPart, selectedSeam, isCustomSeam, partData._customSeamLength, partData._bevelNotes, partData._serviceNotes, partData._finishType, partData._finishTypeCustom, partData._finishSide]);

  // Pricing
  const qty = parseInt(partData.quantity) || 1;
  const laborEach = weldCalc ? weldCalc.total : (parseFloat(partData.laborTotal) || 0);
  const lineTotal = laborEach * qty;

  // Auto-set weld rate on part link
  useEffect(() => {
    if (autoRate !== null && linkedPartIdStr && !partData._weldPriceManualOverride && !partData._weldPricePerFoot) {
      setPartData(prev => ({ ...prev, _weldPricePerFoot: autoRate.toString() }));
    }
  }, [autoRate, linkedPartIdStr]);

  // Sync computed values — use ref to prevent infinite loops
  useEffect(() => {
    const syncKey = lineTotal.toFixed(2) + '|' + serviceDescription + '|' + (serviceConfig ? serviceConfig.label : '');
    if (syncKey !== prevSyncRef.current) {
      prevSyncRef.current = syncKey;
      setPartData(prev => ({
        ...prev,
        partTotal: lineTotal.toFixed(2),
        laborTotal: laborEach.toFixed(2),
        materialDescription: serviceDescription,
        _materialDescription: serviceDescription,
        _rollingDescription: serviceConfig ? serviceConfig.label : '',
      }));
    }
  }, [lineTotal, laborEach, serviceDescription, serviceConfig]);

  const update = (fields) => {
    setPartData(prev => ({ ...prev, ...fields }));
  };

  const sectionStyle = { gridColumn: 'span 2', borderTop: '1px solid #e0e0e0', marginTop: 8, paddingTop: 12 };
  const sTitle = (icon, text, color) => <h4 style={{ marginBottom: 10, color: color, fontSize: '0.95rem' }}>{icon} {text}</h4>;

  return (
    <>
      {/* Quantity */}
      <div className="form-group">
        <label className="form-label">Quantity *</label>
        <input type="number" className="form-input" value={partData.quantity || '1'}
          onChange={(e) => update({ quantity: e.target.value })} onFocus={(e) => e.target.select()} min="1" />
      </div>

      {/* Service Type */}
      <div className="form-group" style={{ gridColumn: 'span 2' }}>
        <label className="form-label">Service Type *</label>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 8 }}>
          {SERVICE_TYPES.map(st => (
            <button key={st.key} type="button"
              onClick={() => update({ _serviceType: st.key })}
              style={{
                padding: '10px 6px', borderRadius: 8, cursor: 'pointer', textAlign: 'center',
                border: '2px solid ' + (serviceType === st.key ? st.color : '#ccc'),
                background: serviceType === st.key ? st.color + '15' : '#fff',
                color: serviceType === st.key ? st.color : '#666',
                fontWeight: serviceType === st.key ? 700 : 500, fontSize: '0.85rem',
                transition: 'all 0.2s'
              }}>
              <div style={{ fontSize: '1.2rem', marginBottom: 2 }}>{st.icon}</div>
              {st.label}
            </button>
          ))}
        </div>
      </div>

      {/* Part Selector */}
      {serviceType && (
        <div className="form-group" style={{ gridColumn: 'span 2' }}>
          <label className="form-label">Link to Part *</label>
          {availableParts.length === 0 ? (
            <div style={{ padding: 12, background: '#fff3e0', borderRadius: 8, fontSize: '0.9rem', color: '#e65100' }}>
              ⚠️ Add parts to the estimate first, then link a service to them.
            </div>
          ) : (
            <select className="form-select" value={linkedPartIdStr}
              onChange={(e) => update({ _linkedPartId: e.target.value, _seamOptionIdx: '0', _weldPriceManualOverride: false, _weldPricePerFoot: '' })}>
              <option value="">Select a part...</option>
              {availableParts.map(p => {
                const desc = p._materialDescription || p.materialDescription || (p.partType || '').replace(/_/g, ' ');
                return <option key={p.id} value={String(p.id)}>Part #{p.partNumber} — {desc}</option>;
              })}
            </select>
          )}
        </div>
      )}

      {/* Debug — remove after confirming */}
      {serviceType && linkedPartIdStr && !linkedPart && (
        <div style={{ gridColumn: 'span 2', padding: 12, background: '#ffebee', borderRadius: 8, fontSize: '0.8rem', color: '#c62828' }}>
          ⚠️ Part ID "{linkedPartIdStr}" not found in {availableParts.length} available parts.
          IDs available: [{availableParts.map(p => String(p.id)).join(', ')}]
        </div>
      )}

      {/* Linked Part Info Card */}
      {linkedPart && partInfo && (
        <div style={{ ...sectionStyle }}>
          <div style={{ background: '#e8eaf6', padding: 14, borderRadius: 8 }}>
            <div style={{ fontWeight: 700, color: '#283593', fontSize: '0.95rem', marginBottom: 8 }}>
              📋 Part #{linkedPart.partNumber} Details
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, fontSize: '0.85rem' }}>
              <div><span style={{ color: '#666' }}>Thickness:</span> <strong>{partInfo.thicknessLabel || '—'}</strong>{partInfo.thickness > 0 ? ' (' + partInfo.thickness.toFixed(4) + '")' : ''}</div>
              <div><span style={{ color: '#666' }}>Grade:</span> <strong>{partInfo.grade || '—'}</strong></div>
              <div><span style={{ color: '#666' }}>Type:</span> <strong>{(linkedPart.partType || '').replace(/_/g, ' ')}</strong></div>
            </div>
            {partInfo.seamOptions.length > 1 && (
              <div style={{ marginTop: 8, fontSize: '0.8rem', color: '#666' }}>
                {partInfo.seamOptions.filter(s => s.label !== 'Custom Length').map((s, i) => (
                  <span key={i} style={{ marginRight: 12 }}>📏 {s.label}: <strong>{s.lengthInches.toFixed(2)}"</strong></span>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Seam Selection (for weld services) */}
      {linkedPart && partInfo && (serviceType === 'weld_100' || serviceType === 'tack_weld') && (
        <div style={{ ...sectionStyle }}>
          {sTitle('📏', 'Seam / Weld Length', '#283593')}
          <div className="form-group">
            <label className="form-label">Seam Type</label>
            <select className="form-select" value={selectedSeamIdx}
              onChange={(e) => update({ _seamOptionIdx: e.target.value })}>
              {partInfo.seamOptions.map((opt, idx) => (
                <option key={idx} value={idx}>{opt.label}{opt.lengthInches > 0 ? ' — ' + opt.lengthInches.toFixed(2) + '"' : ''}</option>
              ))}
            </select>
          </div>
          {isCustomSeam && (
            <div className="form-group">
              <label className="form-label">Custom Seam Length (inches)</label>
              <input type="number" step="0.01" className="form-input" value={partData._customSeamLength || ''}
                onChange={(e) => update({ _customSeamLength: e.target.value })} placeholder="Enter length in inches" />
            </div>
          )}
          {seamLength > 0 && (
            <div style={{ background: '#e8f5e9', padding: 10, borderRadius: 8, fontSize: '0.85rem', marginTop: 8 }}>
              <strong style={{ color: '#2e7d32' }}>Seam Length: {seamLength.toFixed(2)}"</strong>
              <span style={{ color: '#666', marginLeft: 12 }}>({(seamLength / 12).toFixed(4)} ft)</span>
            </div>
          )}
        </div>
      )}

      {/* Finishing Options */}
      {linkedPart && serviceType === 'finishing' && (
        <div style={{ ...sectionStyle }}>
          {sTitle('✨', 'Finish Details', '#6a1b9a')}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div className="form-group">
              <label className="form-label">Finish Type *</label>
              <select className="form-select" value={partData._finishType || ''}
                onChange={(e) => update({ _finishType: e.target.value })}>
                <option value="">Select finish...</option>
                {FINISH_TYPES.map(ft => <option key={ft} value={ft}>{ft}</option>)}
              </select>
              {partData._finishType === 'Custom' && (
                <input className="form-input" style={{ marginTop: 6 }}
                  value={partData._finishTypeCustom || ''}
                  onChange={(e) => update({ _finishTypeCustom: e.target.value })}
                  placeholder="Describe custom finish..." />
              )}
            </div>
            <div className="form-group">
              <label className="form-label">Apply To *</label>
              <div style={{ display: 'flex', gap: 8, marginTop: 2 }}>
                {[
                  { key: 'one', label: 'One Side', icon: '▬' },
                  { key: 'both', label: 'Both Sides', icon: '▣' },
                ].map(opt => (
                  <button key={opt.key} type="button"
                    onClick={() => update({ _finishSide: opt.key })}
                    style={{
                      flex: 1, padding: '10px 12px', borderRadius: 6, cursor: 'pointer',
                      border: '2px solid ' + (partData._finishSide === opt.key ? '#6a1b9a' : '#ccc'),
                      background: partData._finishSide === opt.key ? '#f3e5f5' : '#fff',
                      color: partData._finishSide === opt.key ? '#6a1b9a' : '#666',
                      fontWeight: partData._finishSide === opt.key ? 700 : 500,
                      fontSize: '0.85rem'
                    }}>
                    {opt.icon} {opt.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
          {partData._finishType && partData._finishSide && (
            <div style={{ background: '#f3e5f5', padding: 10, borderRadius: 8, fontSize: '0.85rem', marginTop: 8, border: '1px solid #ce93d8' }}>
              <strong style={{ color: '#6a1b9a' }}>
                ✨ {partData._finishType === 'Custom' ? (partData._finishTypeCustom || 'Custom Finish') : partData._finishType} — {partData._finishSide === 'one' ? 'One Side' : 'Both Sides'}
              </strong>
              <span style={{ color: '#888', marginLeft: 8 }}>(Part #{linkedPart.partNumber})</span>
            </div>
          )}
        </div>
      )}

      {/* Weld Pricing (100% Weld) */}
      {serviceType === 'weld_100' && linkedPart && partInfo && (
        <div style={{ ...sectionStyle }}>
          {sTitle('💰', 'Weld Pricing', '#c62828')}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div className="form-group">
              <label className="form-label">Weld Price Per Foot</label>
              <div style={{ position: 'relative' }}>
                <input type="number" step="0.01" className="form-input" value={partData._weldPricePerFoot || ''}
                  onChange={(e) => update({ _weldPricePerFoot: e.target.value, _weldPriceManualOverride: true })}
                  placeholder="0.00" style={{ paddingLeft: 20 }} />
                <span style={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)', color: '#666', fontWeight: 600 }}>$</span>
              </div>
              {autoRate !== null && (
                <div style={{ fontSize: '0.75rem', color: '#666', marginTop: 2 }}>
                  Default for {partInfo.grade}: ${autoRate.toFixed(2)}/ft
                  {partData._weldPriceManualOverride && (
                    <button type="button" onClick={() => update({ _weldPricePerFoot: autoRate.toString(), _weldPriceManualOverride: false })}
                      style={{ marginLeft: 8, fontSize: '0.7rem', color: '#1976d2', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}>
                      Reset to default
                    </button>
                  )}
                </div>
              )}
            </div>
            <div className="form-group">
              <label className="form-label">Bevel / Weld Notes</label>
              <input type="text" className="form-input" value={partData._bevelNotes || ''}
                onChange={(e) => update({ _bevelNotes: e.target.value })} placeholder="e.g. 37.5° bevel, V-groove, etc." />
            </div>
          </div>

          {weldCalc && (
            <div style={{ background: '#fce4ec', padding: 14, borderRadius: 8, marginTop: 12, border: '1px solid #ef9a9a' }}>
              <div style={{ fontWeight: 700, color: '#c62828', marginBottom: 10, fontSize: '0.9rem' }}>🔥 Weld Cost Calculation</div>
              <div style={{ fontFamily: 'monospace', fontSize: '0.9rem', color: '#333', lineHeight: 1.8 }}>
                <div>
                  <span style={{ color: '#888' }}>Passes:</span>{' '}
                  {weldCalc.thickness.toFixed(4)}" ÷ 0.125" = {weldCalc.passesRaw % 1 !== 0 ? <>{weldCalc.passesRaw.toFixed(2)} → <strong>↑ {weldCalc.passes} passes</strong></> : <strong>{weldCalc.passes} passes</strong>}
                </div>
                <div>
                  <span style={{ color: '#888' }}>Seam (ft):</span>{' '}
                  {weldCalc.seamLength.toFixed(2)}" ÷ 12 = {weldCalc.seamFeetRaw.toFixed(2)} ft → <strong>↑ {weldCalc.seamFeet} ft</strong>
                </div>
                <div>
                  <span style={{ color: '#888' }}>Rate:</span>{' '}
                  <strong>${weldCalc.pricePerFoot.toFixed(2)}/ft</strong>
                </div>
                <div style={{ borderTop: '1px solid #ef9a9a', marginTop: 8, paddingTop: 8, fontSize: '1rem' }}>
                  <span style={{ color: '#888' }}>Formula:</span>{' '}
                  {weldCalc.passes} × {weldCalc.seamFeet} × ${weldCalc.pricePerFoot.toFixed(2)} ={' '}
                  <strong style={{ color: '#c62828', fontSize: '1.15rem' }}>${weldCalc.total.toFixed(2)}</strong>
                  <span style={{ color: '#888', fontSize: '0.8rem', marginLeft: 8 }}>(per piece)</span>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Manual Pricing (Tack Weld, Fit, Cut, Other) */}
      {serviceType && serviceConfig && !serviceConfig.hasWeldCalc && linkedPart && (
        <div style={{ ...sectionStyle }}>
          {sTitle('💰', 'Pricing', serviceConfig.color || '#1976d2')}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div className="form-group">
              <label className="form-label">Labor Cost (per piece)</label>
              <div style={{ position: 'relative' }}>
                <input type="number" step="0.01" className="form-input" value={partData.laborTotal || ''}
                  onChange={(e) => update({ laborTotal: e.target.value })} placeholder="0.00" style={{ paddingLeft: 20 }} />
                <span style={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)', color: '#666', fontWeight: 600 }}>$</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Special Notes */}
      {serviceType && (
        <div style={{ ...sectionStyle }}>
          <div className="form-group">
            <label className="form-label">Service Notes / Special Instructions</label>
            <textarea className="form-textarea" value={partData._serviceNotes || ''}
              onChange={(e) => update({ _serviceNotes: e.target.value, specialInstructions: e.target.value })}
              rows={3} placeholder="Bevel details, weld symbols, fit-up requirements, etc." />
          </div>
        </div>
      )}

      {/* Pricing Summary */}
      {serviceType && linkedPart && (
        <div style={{ ...sectionStyle }}>
          <div style={{ background: '#f0f7ff', padding: 14, borderRadius: 8, border: '1px solid #bbdefb' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', fontSize: '0.9rem', color: '#555' }}>
              <span>{serviceConfig ? serviceConfig.label : 'Service'} (per piece)</span>
              <span>${laborEach.toFixed(2)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderTop: '1px solid #90caf9', marginTop: 4 }}>
              <strong>Line Total ({qty} × ${laborEach.toFixed(2)})</strong>
              <strong style={{ fontSize: '1.15rem', color: '#2e7d32' }}>${lineTotal.toFixed(2)}</strong>
            </div>
          </div>
        </div>
      )}

      {/* Tracking */}
      {serviceType && (
        <div style={{ ...sectionStyle }}>
          {sTitle('🏷️', 'Tracking', '#616161')}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div className="form-group">
              <label className="form-label">Client Part Number</label>
              <input type="text" className="form-input" value={partData.clientPartNumber || ''}
                onChange={(e) => update({ clientPartNumber: e.target.value })} placeholder="Optional" />
            </div>
          </div>
        </div>
      )}
    </>
  );
}
