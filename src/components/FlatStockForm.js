import React, { useState, useEffect, useMemo } from 'react';
import { Upload } from 'lucide-react';
import { searchVendors, getSettings, createVendor } from '../services/api';

// ── SIZE DATA ──────────────────────────────────────────────────────────────────

const PLATE_THICKNESSES = [
  '24 ga', '20 ga', '16 ga', '14 ga', '12 ga', '11 ga', '10 ga',
  '1/8"', '3/16"', '1/4"', '5/16"', '3/8"', '1/2"', '5/8"', '3/4"', '7/8"',
  '1"', '1-1/4"', '1-1/2"', '2"', 'Custom'
];

const ANGLE_SIZES = [
  '1x1', '1-1/4x1-1/4', '1-1/2x1-1/2', '2x2', '2-1/2x2-1/2', '3x3', '3-1/2x3-1/2', '4x4', '5x5', '6x6',
  '1x2', '2x3', '3x4', '4x5', '4x6', 'Custom'
];

const ANGLE_THICKNESSES = [
  '1/8"', '3/16"', '1/4"', '5/16"', '3/8"', '1/2"', '5/8"', '3/4"', '1"', 'Custom'
];

const CHANNEL_SIZES = [
  'C3x4.1', 'C3x5', 'C3x6', 'C4x5.4', 'C4x7.25',
  'C5x6.7', 'C5x9', 'C6x8.2', 'C6x10.5', 'C6x13',
  'C7x9.8', 'C7x12.25', 'C8x11.5', 'C8x13.75', 'C8x18.75',
  'C9x13.4', 'C9x15', 'C10x15.3', 'C10x20', 'C10x25',
  'C12x20.7', 'C12x25', 'C12x30', 'C15x33.9', 'C15x40',
  'MC6x12', 'MC6x15.3', 'MC8x8.5', 'MC8x20', 'MC10x22',
  'MC12x10.6', 'MC12x31', 'MC13x31.8', 'MC18x42.7',
  'Custom'
];

const BEAM_SIZES = [
  'W4x13', 'W5x16', 'W5x19',
  'W6x9', 'W6x12', 'W6x15', 'W6x16', 'W6x20', 'W6x25',
  'W8x10', 'W8x13', 'W8x15', 'W8x18', 'W8x21', 'W8x24', 'W8x28', 'W8x31', 'W8x35',
  'W10x12', 'W10x15', 'W10x19', 'W10x22', 'W10x26', 'W10x30', 'W10x33', 'W10x39', 'W10x45',
  'W12x14', 'W12x16', 'W12x19', 'W12x22', 'W12x26', 'W12x30', 'W12x35', 'W12x40', 'W12x45', 'W12x50',
  'W14x22', 'W14x26', 'W14x30', 'W14x34', 'W14x38', 'W14x43', 'W14x48',
  'W16x26', 'W16x31', 'W16x36', 'W16x40', 'W16x50',
  'S3x5.7', 'S3x7.5', 'S4x7.7', 'S4x9.5', 'S5x10', 'S6x12.5', 'S6x17.25',
  'S8x18.4', 'S8x23', 'S10x25.4', 'S10x35', 'S12x31.8', 'S12x35',
  'Custom'
];

const SQUARE_TUBE_SIZES = [
  '1x1', '1.25x1.25', '1.5x1.5', '2x2', '2.5x2.5', '3x3', '4x4', '5x5', '6x6',
  '1x2', '1x3', '1.5x2', '1.5x3', '2x3', '2x4', '3x4', '3x5', '4x6',
  'Custom'
];

const SQ_TUBE_THICKNESSES = [
  '16 ga', '14 ga', '12 ga', '11 ga', '10 ga',
  '1/8"', '3/16"', '1/4"', '5/16"', '3/8"', '1/2"', '5/8"', '3/4"', '1"', 'Custom'
];

const ROUND_TUBE_OPTIONS = [
  { label: '.625" OD Tube', od: '0.625' },
  { label: '.75" OD Tube', od: '0.750' },
  { label: '1" OD Tube', od: '1.000' },
  { label: '1.25" OD Tube', od: '1.250' },
  { label: '1.5" OD Tube', od: '1.500' },
  { label: '2" OD Tube', od: '2.000' },
  { label: '3" OD Tube', od: '3.000' },
  { label: '4" OD Tube', od: '4.000' },
  { label: '1" Pipe (1.315 OD)', od: '1.315' },
  { label: '1-1/4" Pipe (1.660 OD)', od: '1.660' },
  { label: '1-1/2" Pipe (1.900 OD)', od: '1.900' },
  { label: '2" Pipe (2.375 OD)', od: '2.375' },
  { label: '3" Pipe (3.500 OD)', od: '3.500' },
  { label: '4" Pipe (4.500 OD)', od: '4.500' },
];

const DEFAULT_GRADE_OPTIONS = ['A36', 'A500 Gr B', 'A513', '304 S/S', '316 S/S', 'AR400', '6061-T6 Alum', 'Custom'];

const STOCK_TYPES = [
  { key: 'plate', label: 'Plate', icon: '🔲' },
  { key: 'angle', label: 'Angle', icon: '📐' },
  { key: 'round_tube', label: 'Pipe / Tube / Round Bar', icon: '⭕' },
  { key: 'square_tube', label: 'Square / Rect Tube', icon: '⬜' },
  { key: 'channel', label: 'Channel', icon: '🔩' },
  { key: 'beam', label: 'I-Beam', icon: '🏗️' },
];

export default function FlatStockForm({ partData, setPartData, vendorSuggestions, setVendorSuggestions, showVendorSuggestions, setShowVendorSuggestions, showMessage, setError }) {
  const [customGrade, setCustomGrade] = useState('');
  const [gradeOptions, setGradeOptions] = useState(DEFAULT_GRADE_OPTIONS);

  useEffect(() => {
    const loadGrades = async () => {
      try {
        const resp = await getSettings('material_grades');
        if (resp.data.data?.value) {
          const grades = resp.data.data.value.filter(g => g.partTypes?.includes('flat_stock'));
          if (grades.length > 0) setGradeOptions([...grades.map(g => g.name), 'Custom']);
        }
      } catch {}
    };
    loadGrades();
  }, []);

  const stockType = partData._stockType || '';
  const plateShape = partData._plateShape || 'rectangular';

  // Material description auto-generation
  const materialDescription = useMemo(() => {
    const qty = parseInt(partData.quantity) || 1;
    const parts = [`${qty}pc:`];

    if (stockType === 'plate') {
      if (partData.thickness) parts.push(partData.thickness);
      if (plateShape === 'rectangular') {
        if (partData.width) parts.push(`x ${partData.width}"`);
        if (partData.length) parts.push(`x ${partData.length}"`);
        parts.push('Plate');
      } else if (plateShape === 'round') {
        if (partData._plateDiameter) parts.push(`x ${partData._plateDiameter}" Dia`);
        parts.push('Round Plate');
      } else if (plateShape === 'donut') {
        if (partData._plateOD) parts.push(`${partData._plateOD}" OD`);
        if (partData._plateID) parts.push(`x ${partData._plateID}" ID`);
        parts.push('Donut Plate');
      }
    } else if (stockType === 'angle') {
      const size = partData._angleSize === 'Custom' ? partData._customAngleSize : partData._angleSize;
      if (size) parts.push(`${size}`);
      if (partData.thickness) parts.push(`x ${partData.thickness}`);
      parts.push('Angle');
      if (partData.length) parts.push(`x ${partData.length} long`);
    } else if (stockType === 'round_tube') {
      if (partData.outerDiameter) parts.push(`${partData.outerDiameter}" OD`);
      if (partData.wallThickness) parts.push(`x .${partData.wallThickness}" Wall`);
      parts.push('Round Tube');
      if (partData.length) parts.push(`x ${partData.length} long`);
    } else if (stockType === 'square_tube') {
      const size = partData._tubeSize === 'Custom' ? partData._customTubeSize : partData._tubeSize;
      if (size) parts.push(size);
      if (partData.thickness) parts.push(`x ${partData.thickness}`);
      parts.push('Rect Tube');
      if (partData.length) parts.push(`x ${partData.length} long`);
    } else if (stockType === 'channel') {
      const size = partData._channelSize === 'Custom' ? partData._customChannelSize : partData._channelSize;
      if (size) parts.push(size);
      parts.push('Channel');
      if (partData.length) parts.push(`x ${partData.length} long`);
    } else if (stockType === 'beam') {
      const size = partData._beamSize === 'Custom' ? partData._customBeamSize : partData._beamSize;
      if (size) parts.push(size);
      parts.push('Beam');
      if (partData.length) parts.push(`x ${partData.length} long`);
    }

    if (partData.material) parts.push(partData.material);
    if (partData._materialOrigin) parts.push(partData._materialOrigin);
    return parts.join(' ');
  }, [stockType, plateShape, partData.quantity, partData.thickness, partData.width, partData.length,
    partData._plateDiameter, partData._plateOD, partData._plateID, partData._angleSize, partData._customAngleSize,
    partData.outerDiameter, partData.wallThickness, partData._tubeSize, partData._customTubeSize,
    partData._channelSize, partData._customChannelSize, partData._beamSize, partData._customBeamSize,
    partData.material, partData._materialOrigin]);

  // Sync material description and section size
  useEffect(() => {
    const updates = { materialDescription, _materialDescription: materialDescription, _rollingDescription: 'Ship Flat (No Rolling)' };
    // Set sectionSize for display
    if (stockType === 'plate') {
      if (plateShape === 'rectangular') updates.sectionSize = `${partData.thickness || ''} Plate`;
      else if (plateShape === 'round') updates.sectionSize = `${partData.thickness || ''} Round Plate`;
      else if (plateShape === 'donut') updates.sectionSize = `${partData.thickness || ''} Donut`;
    } else if (stockType === 'angle') {
      updates.sectionSize = partData._angleSize === 'Custom' ? partData._customAngleSize : partData._angleSize;
    } else if (stockType === 'round_tube') {
      updates.sectionSize = partData.outerDiameter ? `${partData.outerDiameter}" OD` : '';
    } else if (stockType === 'square_tube') {
      updates.sectionSize = partData._tubeSize === 'Custom' ? partData._customTubeSize : partData._tubeSize;
    } else if (stockType === 'channel') {
      updates.sectionSize = partData._channelSize === 'Custom' ? partData._customChannelSize : partData._channelSize;
    } else if (stockType === 'beam') {
      updates.sectionSize = partData._beamSize === 'Custom' ? partData._customBeamSize : partData._beamSize;
    }
    setPartData(prev => ({ ...prev, ...updates }));
  }, [materialDescription]);

  // Pricing
  const qty = parseInt(partData.quantity) || 1;
  const materialCost = parseFloat(partData.materialTotal) || 0;
  const materialMarkup = parseFloat(partData.materialMarkupPercent) || 0;
  const materialEachRaw = Math.round(materialCost * (1 + materialMarkup / 100) * 100) / 100;
  const rounding = partData._materialRounding || 'none';
  const materialEach = rounding === 'dollar' && materialEachRaw > 0 ? Math.ceil(materialEachRaw) : rounding === 'five' && materialEachRaw > 0 ? Math.ceil(materialEachRaw / 5) * 5 : materialEachRaw;
  const laborEach = parseFloat(partData.laborTotal) || 0;
  const unitPrice = materialEach + laborEach;
  const lineTotal = Math.round(unitPrice * qty * 100) / 100;

  useEffect(() => { setPartData(prev => ({ ...prev, partTotal: lineTotal.toFixed(2) })); }, [lineTotal]);

  const isCustomGrade = partData.material && !gradeOptions.includes(partData.material);
  const selectedGradeOption = gradeOptions.includes(partData.material) ? partData.material : (partData.material ? 'Custom' : '');

  const sectionStyle = { gridColumn: 'span 2', borderTop: '1px solid #e0e0e0', marginTop: 8, paddingTop: 12 };
  const sectionTitle = (icon, text, color) => <h4 style={{ marginBottom: 10, color, fontSize: '0.95rem' }}>{icon} {text}</h4>;

  return (
    <>
      {/* Quantity */}
      <div className="form-group">
        <label className="form-label">Quantity *</label>
        <input type="number" className="form-input" value={partData.quantity}
          onChange={(e) => setPartData({ ...partData, quantity: e.target.value })} onFocus={(e) => e.target.select()} min="1" />
      </div>

      {/* Stock Type Selector */}
      <div className="form-group" style={{ gridColumn: 'span 2' }}>
        <label className="form-label">Stock Type *</label>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
          {STOCK_TYPES.map(st => (
            <button key={st.key} type="button" onClick={() => setPartData({ ...partData, _stockType: st.key })}
              style={{
                padding: '12px 8px', borderRadius: 8, cursor: 'pointer', textAlign: 'center',
                border: `2px solid ${stockType === st.key ? '#1976d2' : '#ccc'}`,
                background: stockType === st.key ? '#e3f2fd' : '#fff',
                color: stockType === st.key ? '#1976d2' : '#666',
                fontWeight: stockType === st.key ? 700 : 500,
                fontSize: '0.9rem', transition: 'all 0.2s'
              }}>
              <div style={{ fontSize: '1.3rem', marginBottom: 4 }}>{st.icon}</div>
              {st.label}
            </button>
          ))}
        </div>
      </div>

      {/* ═══════ PLATE FIELDS ═══════ */}
      {stockType === 'plate' && (
        <>
          <div className="form-group">
            <label className="form-label">Thickness *</label>
            <select className="form-select" value={PLATE_THICKNESSES.includes(partData.thickness) ? partData.thickness : (partData.thickness ? 'Custom' : '')}
              onChange={(e) => {
                if (e.target.value === 'Custom') setPartData({ ...partData, thickness: '' });
                else setPartData({ ...partData, thickness: e.target.value });
              }}>
              <option value="">Select...</option>
              {PLATE_THICKNESSES.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
            {(partData.thickness && !PLATE_THICKNESSES.includes(partData.thickness)) && (
              <input className="form-input" style={{ marginTop: 4 }} placeholder="Enter thickness"
                value={partData.thickness || ''}
                onChange={(e) => setPartData({ ...partData, thickness: e.target.value })} />
            )}
          </div>

          <div className="form-group">
            <label className="form-label">Shape *</label>
            <div style={{ display: 'flex', gap: 8 }}>
              {[
                { key: 'rectangular', label: '▬ Rectangular', color: '#1976d2' },
                { key: 'round', label: '● Round', color: '#2e7d32' },
                { key: 'donut', label: '◎ Donut', color: '#e65100' }
              ].map(s => (
                <button key={s.key} type="button" onClick={() => setPartData({ ...partData, _plateShape: s.key })}
                  style={{
                    flex: 1, padding: '10px 8px', borderRadius: 8, cursor: 'pointer', fontWeight: 600, fontSize: '0.85rem',
                    border: `2px solid ${plateShape === s.key ? s.color : '#ccc'}`,
                    background: plateShape === s.key ? `${s.color}11` : '#fff',
                    color: plateShape === s.key ? s.color : '#666'
                  }}>
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          {plateShape === 'rectangular' && (
            <>
              <div className="form-group">
                <label className="form-label">Width (inches)</label>
                <input type="text" className="form-input" value={partData.width || ''} placeholder='e.g. 12'
                  onChange={(e) => setPartData({ ...partData, width: e.target.value })} />
              </div>
              <div className="form-group">
                <label className="form-label">Length (inches)</label>
                <input type="text" className="form-input" value={partData.length || ''} placeholder='e.g. 48'
                  onChange={(e) => setPartData({ ...partData, length: e.target.value })} />
              </div>
            </>
          )}

          {plateShape === 'round' && (
            <div className="form-group">
              <label className="form-label">Diameter (inches)</label>
              <input type="text" className="form-input" value={partData._plateDiameter || ''} placeholder='e.g. 24'
                onChange={(e) => setPartData({ ...partData, _plateDiameter: e.target.value })} />
            </div>
          )}

          {plateShape === 'donut' && (
            <>
              <div className="form-group">
                <label className="form-label">Outside Diameter (OD)</label>
                <input type="text" className="form-input" value={partData._plateOD || ''} placeholder='e.g. 36'
                  onChange={(e) => setPartData({ ...partData, _plateOD: e.target.value })} />
              </div>
              <div className="form-group">
                <label className="form-label">Inside Diameter (ID)</label>
                <input type="text" className="form-input" value={partData._plateID || ''} placeholder='e.g. 12'
                  onChange={(e) => setPartData({ ...partData, _plateID: e.target.value })} />
              </div>
            </>
          )}
        </>
      )}

      {/* ═══════ ANGLE FIELDS ═══════ */}
      {stockType === 'angle' && (
        <>
          <div className="form-group">
            <label className="form-label">Angle Size *</label>
            <select className="form-select" value={ANGLE_SIZES.includes(partData._angleSize) ? partData._angleSize : (partData._angleSize ? 'Custom' : '')}
              onChange={(e) => {
                if (e.target.value === 'Custom') setPartData({ ...partData, _angleSize: 'Custom' });
                else setPartData({ ...partData, _angleSize: e.target.value, _customAngleSize: '' });
              }}>
              <option value="">Select...</option>
              {ANGLE_SIZES.map(s => <option key={s} value={s}>{s === 'Custom' ? 'Custom' : `${s}"`}</option>)}
            </select>
            {partData._angleSize === 'Custom' && (
              <input className="form-input" style={{ marginTop: 4 }} placeholder='e.g. 3x3'
                value={partData._customAngleSize || ''}
                onChange={(e) => setPartData({ ...partData, _customAngleSize: e.target.value })} />
            )}
          </div>
          <div className="form-group">
            <label className="form-label">Thickness *</label>
            <select className="form-select" value={ANGLE_THICKNESSES.includes(partData.thickness) ? partData.thickness : (partData.thickness ? 'Custom' : '')}
              onChange={(e) => {
                if (e.target.value === 'Custom') setPartData({ ...partData, thickness: '' });
                else setPartData({ ...partData, thickness: e.target.value });
              }}>
              <option value="">Select...</option>
              {ANGLE_THICKNESSES.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
            {(partData.thickness && !ANGLE_THICKNESSES.includes(partData.thickness)) && (
              <input className="form-input" style={{ marginTop: 4 }} placeholder="Enter thickness"
                value={partData.thickness || ''}
                onChange={(e) => setPartData({ ...partData, thickness: e.target.value })} />
            )}
          </div>
          <div className="form-group">
            <label className="form-label">Length</label>
            <input type="text" className="form-input" value={partData.length || ''} placeholder="e.g. 20'"
              onChange={(e) => setPartData({ ...partData, length: e.target.value })} />
          </div>
        </>
      )}

      {/* ═══════ ROUND TUBE / PIPE FIELDS ═══════ */}
      {stockType === 'round_tube' && (
        <>
          <div className="form-group">
            <label className="form-label">Size</label>
            <select className="form-select" value={partData._roundTubeSelection || ''}
              onChange={(e) => {
                const sel = e.target.value;
                if (sel === 'Custom') {
                  setPartData({ ...partData, _roundTubeSelection: 'Custom', outerDiameter: '' });
                } else {
                  const found = ROUND_TUBE_OPTIONS.find(r => r.od === sel);
                  setPartData({ ...partData, _roundTubeSelection: sel, outerDiameter: sel, _roundTubeLabel: found?.label || sel });
                }
              }}>
              <option value="">Select...</option>
              {ROUND_TUBE_OPTIONS.map(r => <option key={r.od} value={r.od}>{r.label}</option>)}
              <option value="Custom">Custom</option>
            </select>
            {partData._roundTubeSelection === 'Custom' && (
              <input className="form-input" style={{ marginTop: 4 }} placeholder="Enter OD"
                value={partData.outerDiameter || ''}
                onChange={(e) => setPartData({ ...partData, outerDiameter: e.target.value })} />
            )}
          </div>
          <div className="form-group">
            <label className="form-label">Wall Thickness</label>
            <input type="text" className="form-input" value={partData.wallThickness || ''} placeholder="e.g. .120"
              onChange={(e) => setPartData({ ...partData, wallThickness: e.target.value })} />
          </div>
          <div className="form-group">
            <label className="form-label">Length</label>
            <input type="text" className="form-input" value={partData.length || ''} placeholder="e.g. 20'"
              onChange={(e) => setPartData({ ...partData, length: e.target.value })} />
          </div>
        </>
      )}

      {/* ═══════ SQUARE / RECT TUBE FIELDS ═══════ */}
      {stockType === 'square_tube' && (
        <>
          <div className="form-group">
            <label className="form-label">Tube Size *</label>
            <select className="form-select" value={SQUARE_TUBE_SIZES.includes(partData._tubeSize) ? partData._tubeSize : (partData._tubeSize ? 'Custom' : '')}
              onChange={(e) => {
                if (e.target.value === 'Custom') setPartData({ ...partData, _tubeSize: 'Custom' });
                else setPartData({ ...partData, _tubeSize: e.target.value, _customTubeSize: '' });
              }}>
              <option value="">Select...</option>
              <optgroup label="Square">
                {SQUARE_TUBE_SIZES.filter(s => { const p = s.split('x').map(Number); return p.length === 2 && p[0] === p[1]; }).map(s => <option key={s} value={s}>{s}"</option>)}
              </optgroup>
              <optgroup label="Rectangular">
                {SQUARE_TUBE_SIZES.filter(s => { const p = s.split('x').map(Number); return p.length === 2 && p[0] !== p[1]; }).map(s => <option key={s} value={s}>{s}"</option>)}
              </optgroup>
              <option value="Custom">Custom</option>
            </select>
            {partData._tubeSize === 'Custom' && (
              <input className="form-input" style={{ marginTop: 4 }} placeholder='e.g. 3x4'
                value={partData._customTubeSize || ''}
                onChange={(e) => setPartData({ ...partData, _customTubeSize: e.target.value })} />
            )}
          </div>
          <div className="form-group">
            <label className="form-label">Wall Thickness *</label>
            <select className="form-select" value={SQ_TUBE_THICKNESSES.includes(partData.thickness) ? partData.thickness : (partData.thickness ? 'Custom' : '')}
              onChange={(e) => {
                if (e.target.value === 'Custom') setPartData({ ...partData, thickness: '' });
                else setPartData({ ...partData, thickness: e.target.value });
              }}>
              <option value="">Select...</option>
              {SQ_TUBE_THICKNESSES.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
            {(partData.thickness && !SQ_TUBE_THICKNESSES.includes(partData.thickness)) && (
              <input className="form-input" style={{ marginTop: 4 }} placeholder="Enter wall"
                value={partData.thickness || ''}
                onChange={(e) => setPartData({ ...partData, thickness: e.target.value })} />
            )}
          </div>
          <div className="form-group">
            <label className="form-label">Length</label>
            <input type="text" className="form-input" value={partData.length || ''} placeholder="e.g. 24'"
              onChange={(e) => setPartData({ ...partData, length: e.target.value })} />
          </div>
        </>
      )}

      {/* ═══════ CHANNEL FIELDS ═══════ */}
      {stockType === 'channel' && (
        <>
          <div className="form-group">
            <label className="form-label">Channel Size *</label>
            <select className="form-select" value={CHANNEL_SIZES.includes(partData._channelSize) ? partData._channelSize : (partData._channelSize ? 'Custom' : '')}
              onChange={(e) => {
                if (e.target.value === 'Custom') setPartData({ ...partData, _channelSize: 'Custom' });
                else setPartData({ ...partData, _channelSize: e.target.value, _customChannelSize: '' });
              }}>
              <option value="">Select...</option>
              <optgroup label="C - American Standard">
                {CHANNEL_SIZES.filter(s => s.startsWith('C') && !s.startsWith('Cu')).map(s => <option key={s} value={s}>{s}</option>)}
              </optgroup>
              <optgroup label="MC - Miscellaneous">
                {CHANNEL_SIZES.filter(s => s.startsWith('MC')).map(s => <option key={s} value={s}>{s}</option>)}
              </optgroup>
              <option value="Custom">Custom</option>
            </select>
            {partData._channelSize === 'Custom' && (
              <input className="form-input" style={{ marginTop: 4 }} placeholder='e.g. C8x11.5'
                value={partData._customChannelSize || ''}
                onChange={(e) => setPartData({ ...partData, _customChannelSize: e.target.value })} />
            )}
          </div>
          <div className="form-group">
            <label className="form-label">Length</label>
            <input type="text" className="form-input" value={partData.length || ''} placeholder="e.g. 20'"
              onChange={(e) => setPartData({ ...partData, length: e.target.value })} />
          </div>
        </>
      )}

      {/* ═══════ BEAM FIELDS ═══════ */}
      {stockType === 'beam' && (
        <>
          <div className="form-group">
            <label className="form-label">Beam Size *</label>
            <select className="form-select" value={BEAM_SIZES.includes(partData._beamSize) ? partData._beamSize : (partData._beamSize ? 'Custom' : '')}
              onChange={(e) => {
                if (e.target.value === 'Custom') setPartData({ ...partData, _beamSize: 'Custom' });
                else setPartData({ ...partData, _beamSize: e.target.value, _customBeamSize: '' });
              }}>
              <option value="">Select...</option>
              <optgroup label="W - Wide Flange">
                {BEAM_SIZES.filter(s => s.startsWith('W')).map(s => <option key={s} value={s}>{s}</option>)}
              </optgroup>
              <optgroup label="S - Standard">
                {BEAM_SIZES.filter(s => s.startsWith('S')).map(s => <option key={s} value={s}>{s}</option>)}
              </optgroup>
              <option value="Custom">Custom</option>
            </select>
            {partData._beamSize === 'Custom' && (
              <input className="form-input" style={{ marginTop: 4 }} placeholder='e.g. W10x22'
                value={partData._customBeamSize || ''}
                onChange={(e) => setPartData({ ...partData, _customBeamSize: e.target.value })} />
            )}
          </div>
          <div className="form-group">
            <label className="form-label">Length</label>
            <input type="text" className="form-input" value={partData.length || ''} placeholder="e.g. 40'"
              onChange={(e) => setPartData({ ...partData, length: e.target.value })} />
          </div>
        </>
      )}

      {/* ═══════ DESCRIPTION PREVIEW ═══════ */}
      {stockType && (
        <div style={{ ...sectionStyle }}>
          <div style={{ background: '#f3e5f5', padding: 12, borderRadius: 8 }}>
            <div style={{ fontWeight: 600, fontSize: '0.85rem', color: '#6a1b9a', marginBottom: 6 }}>Description Preview:</div>
            <pre style={{ margin: 0, fontSize: '0.9rem', whiteSpace: 'pre-wrap', fontFamily: 'monospace', color: '#333' }}>
              {materialDescription}{'\n'}Ship Flat (No Rolling)
            </pre>
          </div>
        </div>
      )}

      {/* ═══════ FILE UPLOAD ═══════ */}
      <div style={sectionStyle}>
        <div className="form-group">
          <label className="form-label">Print / Drawing (PDF)</label>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 12px', border: '1px dashed #bbb', borderRadius: 6, cursor: 'pointer', fontSize: '0.85rem', color: '#666' }}>
            <Upload size={16} /> Upload drawing...
            <input type="file" accept=".pdf,.png,.jpg,.jpeg" style={{ display: 'none' }} onChange={(e) => { if (e.target.files[0]) { const file = e.target.files[0]; setPartData({ ...partData, _shapeFile: file, _shapeFileName: file.name }); } }} />
          </label>
          {(partData._shapeFile || partData._shapeFileName) && <div style={{ fontSize: '0.8rem', color: '#2e7d32', marginTop: 2 }}>📎 {partData._shapeFile?.name || partData._shapeFileName} {!partData._shapeFile && partData._shapeFileName && <span style={{ color: '#999' }}>(saved)</span>}</div>}
        </div>
      </div>

      {/* ═══════ SPECIAL INSTRUCTIONS ═══════ */}
      <div style={sectionStyle}>
        <div className="form-group">
          <label className="form-label">Special Instructions</label>
          <textarea className="form-textarea" value={partData.specialInstructions || ''} onChange={(e) => setPartData({ ...partData, specialInstructions: e.target.value })} rows={2} />
        </div>
      </div>

      {/* ═══════ MATERIAL INFO ═══════ */}
      <div style={sectionStyle}>
        {sectionTitle('📦', 'Material Information', '#e65100')}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
          <div className="form-group">
            <label className="form-label">Grade</label>
            <select className="form-select" value={selectedGradeOption} onChange={(e) => {
              if (e.target.value === 'Custom') setPartData({ ...partData, material: customGrade || 'Custom' });
              else { setPartData({ ...partData, material: e.target.value }); setCustomGrade(''); }
            }}>
              <option value="">Select...</option>
              {gradeOptions.map(g => <option key={g} value={g}>{g}</option>)}
            </select>
            {(selectedGradeOption === 'Custom' || isCustomGrade) && (
              <input className="form-input" style={{ marginTop: 4 }} placeholder="Enter grade"
                value={isCustomGrade ? partData.material : customGrade}
                onChange={(e) => { setCustomGrade(e.target.value); setPartData({ ...partData, material: e.target.value }); }} />
            )}
          </div>
          <div className="form-group">
            <label className="form-label">Origin</label>
            <select className="form-select" value={partData._materialOrigin || ''} onChange={(e) => setPartData({ ...partData, _materialOrigin: e.target.value })}>
              <option value="">Select...</option>
              <option value="Domestic">Domestic</option>
              <option value="Import">Import</option>
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Material Source</label>
            <select className="form-select" value={partData.materialSource || 'customer_supplied'} onChange={(e) => setPartData({ ...partData, materialSource: e.target.value })}>
              <option value="customer_supplied">Client Supplies</option>
              <option value="we_order">We Order</option>
            </select>
          </div>
        </div>
        {partData.materialSource === 'we_order' && (
          <div className="form-group" style={{ position: 'relative', marginTop: 8 }}>
            <label className="form-label">Vendor</label>
            <input className="form-input"
              value={partData._vendorSearch !== undefined ? partData._vendorSearch : (partData.vendor?.name || partData.supplierName || '')}
              onChange={async (e) => {
                const value = e.target.value;
                setPartData({ ...partData, _vendorSearch: value });
                if (value.length >= 1) { try { const res = await searchVendors(value); setVendorSuggestions(res.data.data || []); setShowVendorSuggestions(true); } catch { setVendorSuggestions([]); } }
                else { setPartData({ ...partData, _vendorSearch: value, vendorId: null, supplierName: '' }); setVendorSuggestions([]); setShowVendorSuggestions(false); }
              }}
              onFocus={async () => { try { const res = await searchVendors(''); setVendorSuggestions(res.data.data || []); setShowVendorSuggestions(true); } catch {} }}
              onBlur={() => setTimeout(() => setShowVendorSuggestions(false), 200)}
              placeholder="Search or add vendor..." autoComplete="off" />
            {showVendorSuggestions && (
              <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 100, background: 'white', border: '1px solid #ddd', borderRadius: 4, maxHeight: 200, overflowY: 'auto', boxShadow: '0 4px 12px rgba(0,0,0,0.15)' }}>
                {vendorSuggestions.map(v => (
                  <div key={v.id} style={{ padding: '8px 12px', cursor: 'pointer', borderBottom: '1px solid #eee' }}
                    onMouseDown={() => { setPartData({ ...partData, vendorId: v.id, supplierName: v.name, _vendorSearch: undefined }); setShowVendorSuggestions(false); }}>
                    <strong>{v.name}</strong>{v.contactPhone && <span style={{ fontSize: '0.8rem', color: '#666', marginLeft: 8 }}>{v.contactPhone}</span>}
                  </div>
                ))}
                {partData._vendorSearch && partData._vendorSearch.length >= 2 && !vendorSuggestions.some(v => v.name.toLowerCase() === (partData._vendorSearch || '').toLowerCase()) && (
                  <div style={{ padding: '8px 12px', cursor: 'pointer', background: '#e8f5e9', color: '#2e7d32', fontWeight: 600 }}
                    onMouseDown={async () => {
                      try { const resp = await createVendor({ name: partData._vendorSearch });
                        if (resp.data.data) { setPartData({ ...partData, vendorId: resp.data.data.id, supplierName: resp.data.data.name, _vendorSearch: undefined }); showMessage(`Vendor "${resp.data.data.name}" created`); }
                      } catch { setError('Failed to create vendor'); } setShowVendorSuggestions(false);
                    }}>+ Add "{partData._vendorSearch}" as new vendor</div>
                )}
              </div>
            )}
          </div>
        )}
        <div className="form-group" style={{ marginTop: 12 }}>
          <label className="form-label">Material Description (for ordering)</label>
          <textarea className="form-textarea" value={partData.materialDescription || ''} onChange={(e) => setPartData({ ...partData, materialDescription: e.target.value })} rows={2} style={{ fontFamily: 'monospace', fontSize: '0.9rem' }} />
          <div style={{ fontSize: '0.75rem', color: '#999', marginTop: 2 }}>Auto-generated — edit as needed</div>
        </div>
      </div>

      {/* ═══════ PRICING ═══════ */}
      <div style={sectionStyle}>
        {sectionTitle('💰', 'Pricing', '#1976d2')}
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 2fr', gap: 12 }}>
          <div className="form-group"><label className="form-label">Material Cost (each)</label><input type="number" step="any" className="form-input" value={partData.materialTotal || ''} onFocus={(e) => e.target.select()} onChange={(e) => setPartData({ ...partData, materialTotal: e.target.value })} placeholder="0.00" /></div>
          <div className="form-group"><label className="form-label">Markup %</label><input type="number" step="1" className="form-input" value={partData.materialMarkupPercent ?? 20} onFocus={(e) => e.target.select()} onChange={(e) => setPartData({ ...partData, materialMarkupPercent: e.target.value })} placeholder="20" /></div>
          <div className="form-group"><label className="form-label">Labor (each)</label><input type="number" step="any" className="form-input" value={partData.laborTotal || ''} onFocus={(e) => e.target.select()} onChange={(e) => setPartData({ ...partData, laborTotal: e.target.value })} placeholder="0.00" /></div>
        </div>
        <div style={{ background: '#f0f7ff', padding: 12, borderRadius: 8, marginTop: 12, border: '1px solid #bbdefb' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', fontSize: '0.9rem', color: '#555' }}><span>Material Cost (ea)</span><span>${materialCost.toFixed(2)}</span></div>
          {materialMarkup > 0 && <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', fontSize: '0.85rem', color: '#e65100' }}><span>+ Markup ({materialMarkup}%)</span><span>${(materialEachRaw - materialCost).toFixed(2)}</span></div>}
          {materialMarkup > 0 && <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', fontSize: '0.9rem', color: '#555', fontWeight: 600 }}><span>Material w/ Markup</span><span>{materialEachRaw !== materialEach && <span style={{ textDecoration: 'line-through', color: '#999', marginRight: 4, fontSize: '0.8rem' }}>${materialEachRaw.toFixed(2)}</span>}${materialEach.toFixed(2)}</span></div>}
          {materialMarkup > 0 && <div style={{ display: 'flex', gap: 4, padding: '4px 0 2px' }}>
            <span style={{ fontSize: '0.75rem', color: '#888', alignSelf: 'center' }}>Round up:</span>
            {[{k:'none',l:'None'},{k:'dollar',l:'↑ $1'},{k:'five',l:'↑ $5'}].map(o => (
              <button key={o.k} type="button" onClick={() => setPartData(prev => ({ ...prev, _materialRounding: o.k }))}
                style={{ padding: '2px 8px', fontSize: '0.7rem', borderRadius: 4, cursor: 'pointer',
                  border: (partData._materialRounding || 'none') === o.k ? '2px solid #1976d2' : '1px solid #ccc',
                  background: (partData._materialRounding || 'none') === o.k ? '#e3f2fd' : '#fff',
                  color: (partData._materialRounding || 'none') === o.k ? '#1976d2' : '#666',
                  fontWeight: (partData._materialRounding || 'none') === o.k ? 700 : 400 }}>{o.l}</button>
            ))}
          </div>}
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', fontSize: '0.9rem', color: '#555' }}><span>Labor (ea)</span><span>${laborEach.toFixed(2)}</span></div>
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderTop: '1px solid #90caf9', marginTop: 4 }}><strong>Unit Price</strong><strong style={{ color: '#1976d2' }}>${unitPrice.toFixed(2)}</strong></div>
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderTop: '1px solid #90caf9' }}><strong>Line Total ({qty} × ${unitPrice.toFixed(2)})</strong><strong style={{ fontSize: '1.15rem', color: '#2e7d32' }}>${lineTotal.toFixed(2)}</strong></div>
        </div>
      </div>

      {/* ═══════ TRACKING ═══════ */}
      <div style={sectionStyle}>
        {sectionTitle('🏷️', 'Tracking', '#616161')}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div className="form-group"><label className="form-label">Client Part Number</label><input type="text" className="form-input" value={partData.clientPartNumber || ''} onChange={(e) => setPartData({ ...partData, clientPartNumber: e.target.value })} placeholder="Optional" /></div>
          <div className="form-group"><label className="form-label">Heat Number</label><input type="text" className="form-input" value={partData.heatNumber || ''} onChange={(e) => setPartData({ ...partData, heatNumber: e.target.value })} placeholder="Optional" /></div>
        </div>
      </div>
    </>
  );
}
