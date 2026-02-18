import React, { useState, useEffect, useMemo } from 'react';
import RollToOverride from './RollToOverride';
import { Upload } from 'lucide-react';
import { searchVendors, getSettings, createVendor } from '../services/api';
import PitchSection, { getPitchDescriptionLines } from './PitchSection';

const FLAT_BAR_SIZES = [
  '1/2x1/4', '3/4x1/4', '3/4x3/8',
  '1x1/4', '1x3/8', '1x1/2',
  '1-1/2x1/4', '1-1/2x3/8', '1-1/2x1/2',
  '2x1/4', '2x3/8', '2x1/2', '2x3/4',
  '2-1/2x1/4', '2-1/2x3/8', '2-1/2x1/2',
  '3x1/4', '3x3/8', '3x1/2', '3x3/4', '3x1',
  '4x3/8', '4x1/2', '4x3/4', '4x1',
  '5x3/8', '5x1/2', '5x3/4', '5x1',
  '6x3/8', '6x1/2', '6x3/4', '6x1',
  '8x1/2', '8x3/4', '8x1',
  '10x1/2', '10x3/4', '10x1',
  '12x1/2', '12x3/4', '12x1',
  'Custom'
];

const DEFAULT_GRADE_OPTIONS = ['A36', '304 S/S', '316 S/S', 'AR400', 'Custom'];

function parseFlatBarSize(sizeStr) {
  if (!sizeStr || sizeStr === 'Custom') return null;
  const parts = sizeStr.split('x');
  if (parts.length !== 2) return null;
  const toDecimal = (s) => {
    s = s.trim();
    // Handle mixed numbers like "1-1/2"
    const mixedMatch = s.match(/^(\d+)-(\d+)\/(\d+)$/);
    if (mixedMatch) return parseInt(mixedMatch[1]) + parseInt(mixedMatch[2]) / parseInt(mixedMatch[3]);
    // Handle fractions like "1/4"
    const fracMatch = s.match(/^(\d+)\/(\d+)$/);
    if (fracMatch) return parseInt(fracMatch[1]) / parseInt(fracMatch[2]);
    return parseFloat(s) || 0;
  };
  const width = toDecimal(parts[0]);
  const thickness = toDecimal(parts[1]);
  if (width > 0 && thickness > 0) return { width, thickness };
  return null;
}

function formatFraction(val) {
  const fracs = [[0.125,'1/8'],[0.25,'1/4'],[0.375,'3/8'],[0.5,'1/2'],[0.625,'5/8'],[0.75,'3/4'],[0.875,'7/8']];
  const whole = Math.floor(val);
  const frac = val - whole;
  const match = fracs.find(f => Math.abs(f[0] - frac) < 0.01);
  if (match) return whole > 0 ? `${whole}-${match[1]}"` : `${match[1]}"`;
  if (frac === 0) return `${whole}"`;
  return `${val}"`;
}

function calculateRise(radiusInches, chordInches) {
  if (!radiusInches || radiusInches <= 0) return null;
  const halfChord = chordInches / 2;
  if (halfChord >= radiusInches) return null;
  return radiusInches - Math.sqrt(radiusInches * radiusInches - halfChord * halfChord);
}

export default function FlatBarRollForm({ partData, setPartData, vendorSuggestions, setVendorSuggestions, showVendorSuggestions, setShowVendorSuggestions, showMessage, setError }) {
  const [customGrade, setCustomGrade] = useState('');
  const [rollValue, setRollValue] = useState(partData._rollValue || '');
  const [rollToMethod, setRollToMethod] = useState(partData._rollToMethod || '');
  const [rollMeasureType, setRollMeasureType] = useState(partData._rollMeasureType || 'diameter');
  const [rollMeasurePoint, setRollMeasurePoint] = useState(partData._rollMeasurePoint || 'inside');
  const [gradeOptions, setGradeOptions] = useState(DEFAULT_GRADE_OPTIONS);
  const [completeRings, setCompleteRings] = useState(!!(partData._completeRings));
  const [ringsNeeded, setRingsNeeded] = useState(partData._ringsNeeded || 1);
  const [tangentLength, setTangentLength] = useState(partData._tangentLength || '12');

  useEffect(() => {
    const loadGrades = async () => {
      try {
        const resp = await getSettings('material_grades');
        if (resp.data.data?.value) {
          const grades = resp.data.data.value.filter(g => g.partTypes?.includes('flat_bar'));
          if (grades.length > 0) setGradeOptions([...grades.map(g => g.name), 'Custom']);
        }
      } catch {}
    };
    loadGrades();
  }, []);

  useEffect(() => {
    if (partData.radius && !partData.diameter) {
      setRollValue(partData.radius);
      setRollMeasureType('radius');
    } else if (partData.diameter) {
      setRollValue(partData.diameter);
      setRollMeasureType('diameter');
    }
    if (partData._rollMeasureType) setRollMeasureType(partData._rollMeasureType);
    if (partData._rollMeasurePoint) setRollMeasurePoint(partData._rollMeasurePoint);
  }, []);

  useEffect(() => {
    const updates = { _rollValue: rollValue,
      _rollToMethod: rollToMethod, _rollMeasureType: rollMeasureType, _rollMeasurePoint: rollMeasurePoint };
    if (rollMeasureType === 'radius') { updates.radius = rollValue; updates.diameter = ''; }
    else { updates.diameter = rollValue; updates.radius = ''; }
    setPartData(prev => ({ ...prev, ...updates }));
  }, [rollToMethod, rollValue, rollMeasureType, rollMeasurePoint]);

  const parsedSize = useMemo(() => parseFlatBarSize(partData._barSize), [partData._barSize]);

  // Profile size for CL offset: EW rolls on the width, HW rolls on thickness
  const profileSize = useMemo(() => {
    if (!parsedSize) return 0;
    if (partData.rollType === 'hard_way') return parsedSize.width;
    return parsedSize.thickness; // easy way or no selection
  }, [parsedSize, partData.rollType]);

  const clDiameter = useMemo(() => {
    const rv = parseFloat(rollValue) || 0;
    if (!rv) return 0;
    const dia = rollMeasureType === 'radius' ? rv * 2 : rv;
    if (rollMeasurePoint === 'inside') return dia + profileSize;
    if (rollMeasurePoint === 'outside') return dia - profileSize;
    return dia;
  }, [rollToMethod, rollValue, rollMeasureType, rollMeasurePoint, profileSize]);

  const riseCalc = useMemo(() => {
    const r = clDiameter > 0 ? clDiameter / 2 : 0;
    if (r <= 0 || clDiameter <= 100) return null;
    const chord = r >= 60 ? 60 : r >= 24 ? 24 : r >= 12 ? 12 : r >= 6 ? 6 : 3;
    const rise = calculateRise(r, chord);
    if (rise !== null && rise > 0) return { rise, chord };
    return null;
  }, [clDiameter]);

  const lengthInches = useMemo(() => {
    const raw = partData.length || '';
    const m = raw.match(/([\d.]+)/);
    if (!m) return 0;
    const val = parseFloat(m[1]);
    if (raw.includes("'") || raw.includes('ft')) return val * 12;
    return val;
  }, [partData.length]);

  const ringCalc = useMemo(() => {
    if (!completeRings || clDiameter <= 0) return null;
    const circumference = Math.PI * clDiameter;
    const tang = parseFloat(tangentLength) || 0;
    const usable = lengthInches - (2 * tang);
    if (usable <= 0) return { error: 'Length too short after tangents' };
    const numRings = parseInt(ringsNeeded) || 1;
    if (circumference <= usable) {
      const ringsPerStick = Math.floor(usable / circumference);
      const sticksNeeded = Math.ceil(numRings / ringsPerStick);
      return { circumference, usable, ringsPerStick, sticksNeeded, tangent: tang, multiSegment: false };
    } else {
      const segmentsPerRing = Math.ceil(circumference / usable);
      const sticksNeeded = segmentsPerRing * numRings;
      return { circumference, usable, segmentsPerRing, sticksNeeded, tangent: tang, multiSegment: true };
    }
  }, [completeRings, clDiameter, lengthInches, tangentLength, ringsNeeded]);

  useEffect(() => {
    if (completeRings && ringCalc && !ringCalc.error) {
      setPartData(prev => ({ ...prev, quantity: String(parseInt(ringsNeeded) || 1), _completeRings: true, _ringsNeeded: ringsNeeded, _tangentLength: tangentLength, _ringSticksNeeded: ringCalc.sticksNeeded, _ringRingsPerStick: ringCalc.ringsPerStick || 0, _ringMultiSegment: ringCalc.multiSegment || false }));
    } else {
      setPartData(prev => ({ ...prev, _completeRings: false }));
    }
  }, [completeRings, ringCalc, ringsNeeded, tangentLength]);

  const materialDescription = useMemo(() => {
    const qty = parseInt(partData.quantity) || 1;
    const parts = [`${qty}pc:`];
    if (parsedSize) {
      parts.push(`${formatFraction(parsedSize.width)} x ${formatFraction(parsedSize.thickness)}`);
    } else if (partData._customBarSize) {
      parts.push(partData._customBarSize);
    }
    parts.push('Flat Bar');
    if (partData.length) parts.push(`x ${partData.length} long`);
    if (partData.material) parts.push(partData.material);
    if (partData._materialOrigin) parts.push(partData._materialOrigin);
    return parts.join(' ');
  }, [partData._barSize, partData._customBarSize, partData.length, partData.material, partData._materialOrigin, partData.quantity, parsedSize]);

  // Input diameter (raw user value, not CL-adjusted) — for developed diameter in pitch calc
  const inputDiameter = useMemo(() => {
    const rv = parseFloat(rollValue) || 0;
    if (!rv) return 0;
    return rollMeasureType === 'radius' ? rv * 2 : rv;
  }, [rollValue, rollMeasureType]);

  const rollingDescription = useMemo(() => {
    if (rollToMethod === 'template') return 'Roll Per Template / Sample';
    if (rollToMethod === 'print') return 'Roll per print';
    const rv = parseFloat(rollValue) || 0;
    if (!rv) return '';
    const lines = [];
    
    const spec = rollMeasurePoint === 'inside' ? (rollMeasureType === 'radius' ? 'ISR' : 'ID') : rollMeasurePoint === 'outside' ? (rollMeasureType === 'radius' ? 'OSR' : 'OD') : (rollMeasureType === 'radius' ? 'CLR' : 'CLD');
    const ewHw = partData.rollType === 'easy_way' ? 'EW' : partData.rollType === 'hard_way' ? 'HW' : '';
    let rollLine = `Roll to ${rv}" ${spec}`;
    if (ewHw) rollLine += ` ${ewHw}`;
    lines.push(rollLine);
    if (riseCalc) lines.push(`Chord: ${riseCalc.chord}" Rise: ${riseCalc.rise.toFixed(4)}"`);
    lines.push(...getPitchDescriptionLines(partData, clDiameter));
    if (completeRings && ringCalc && !ringCalc.error) {
      if (!ringCalc.multiSegment) {
        lines.push(`Complete Ring — ${ringsNeeded} ring(s), ${ringCalc.ringsPerStick} rings/stick, ${ringCalc.sticksNeeded} stick(s) needed`);
      } else {
        lines.push(`Complete Ring — ${ringsNeeded} ring(s), ${ringCalc.segmentsPerRing} segments/ring, ${ringCalc.sticksNeeded} stick(s) needed`);
      }
      lines.push(`Tangents: ${ringCalc.tangent}" each end`);
    }
    return lines.join('\n');
  }, [rollValue, rollMeasureType, rollMeasurePoint, partData.rollType, riseCalc, clDiameter, completeRings, ringCalc, ringsNeeded, partData._pitchEnabled, partData._pitchMethod, partData._pitchRun, partData._pitchRise, partData._pitchAngle, partData._pitchSpaceType, partData._pitchSpaceValue, partData._pitchDirection, partData._pitchDevelopedDia]);

  useEffect(() => {
    const updates = { materialDescription, _materialDescription: materialDescription };
    if (partData._barSize && partData._barSize !== 'Custom') {
      updates.sectionSize = partData._barSize;
      if (parsedSize) { updates.width = String(parsedSize.width); updates.thickness = String(parsedSize.thickness); }
    } else if (partData._customBarSize) {
      updates.sectionSize = partData._customBarSize;
    }
    setPartData(prev => ({ ...prev, ...updates }));
  }, [materialDescription]);

  useEffect(() => {
    setPartData(prev => ({ ...prev, _rollingDescription: rollingDescription }));
  }, [rollingDescription]);

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
  const selectedBarSize = FLAT_BAR_SIZES.includes(partData._barSize) ? partData._barSize : (partData._barSize ? 'Custom' : '');

  const sectionStyle = { gridColumn: 'span 2', borderTop: '1px solid #e0e0e0', marginTop: 8, paddingTop: 12 };
  const sectionTitle = (icon, text, color) => <h4 style={{ marginBottom: 10, color, fontSize: '0.95rem' }}>{icon} {text}</h4>;

  return (
    <>
      <div className="form-group">
        <label className="form-label">Quantity *</label>
        <input type="number" className="form-input" value={partData.quantity}
          onChange={(e) => setPartData({ ...partData, quantity: e.target.value })}
          onFocus={(e) => e.target.select()} min="1" disabled={completeRings}
          style={completeRings ? { background: '#e8f5e9', fontWeight: 600 } : {}} />
        {completeRings && ringCalc && !ringCalc.error && (
          <div style={{ fontSize: '0.75rem', color: '#2e7d32', marginTop: 2 }}>
            ⭕ {ringsNeeded} ring(s) — {ringCalc.sticksNeeded} stick(s) needed{!ringCalc.multiSegment ? ` (${ringCalc.ringsPerStick} rings/stick)` : ` (${ringCalc.segmentsPerRing} segments/ring)`}
          </div>
        )}
      </div>

      <div className="form-group">
        <label className="form-label">Flat Bar Size *</label>
        <select className="form-select" value={selectedBarSize} onChange={(e) => {
          if (e.target.value === 'Custom') {
            setPartData({ ...partData, _barSize: 'Custom' });
          } else {
            setPartData({ ...partData, _barSize: e.target.value, _customBarSize: '' });
          }
        }}>
          <option value="">Select...</option>
          {FLAT_BAR_SIZES.map(s => {
            if (s === 'Custom') return <option key={s} value={s}>{s}</option>;
            const p = parseFlatBarSize(s);
            return <option key={s} value={s}>{formatFraction(p.width)} × {formatFraction(p.thickness)}</option>;
          })}
        </select>
        {selectedBarSize === 'Custom' && (
          <input className="form-input" style={{ marginTop: 4 }} placeholder='e.g. 4x3/4 or 4" x 3/4"'
            value={partData._customBarSize || ''}
            onChange={(e) => setPartData({ ...partData, _customBarSize: e.target.value })} />
        )}
      </div>

      <div className="form-group">
        <label className="form-label">Length</label>
        <select className="form-select" value={partData._lengthOption || ''} onChange={(e) => {
          const val = e.target.value;
          if (val === 'Custom') setPartData({ ...partData, _lengthOption: 'Custom', length: partData._customLength || '' });
          else setPartData({ ...partData, _lengthOption: val, length: val, _customLength: '' });
        }}>
          <option value="">Select...</option>
          <option value="20'">20'</option>
          <option value="24'">24'</option>
          <option value="40'">40'</option>
          <option value="Custom">Custom</option>
        </select>
        {partData._lengthOption === 'Custom' && (
          <input className="form-input" style={{ marginTop: 4 }} placeholder="Enter length"
            value={partData._customLength || ''}
            onChange={(e) => setPartData({ ...partData, _customLength: e.target.value, length: e.target.value })} />
        )}
      </div>

      {/* === ROLL INFO === */}
      <div style={sectionStyle}>
        {sectionTitle('🔄', 'Roll Information', '#1565c0')}
        <RollToOverride rollToMethod={rollToMethod} onMethodChange={setRollToMethod} />
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: 8, marginBottom: 12 }}>
          <div className="form-group">
            <label className="form-label">Roll to: *</label>
            <input className="form-input" value={rollToMethod ? '' : rollValue} onChange={(e) => setRollValue(e.target.value)} placeholder={rollToMethod === 'template' ? 'Per Template/Sample' : rollToMethod === 'print' ? 'Per Print' : 'Enter value'} type="number" step="0.001" disabled={!!rollToMethod} style={rollToMethod ? { background: '#f0f0f0', color: '#999' } : {}} />
          </div>
          <div className="form-group">
            <label className="form-label">Measured At</label>
            <select className="form-select" disabled={!!rollToMethod} style={rollToMethod ? { background: '#f0f0f0', color: '#999' } : {}} value={rollMeasurePoint} onChange={(e) => setRollMeasurePoint(e.target.value)}>
              <option value="inside">Inside</option>
              <option value="outside">Outside</option>
              <option value="centerline">Centerline</option>
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Type</label>
            <select className="form-select" disabled={!!rollToMethod} style={rollToMethod ? { background: '#f0f0f0', color: '#999' } : {}} value={rollMeasureType} onChange={(e) => setRollMeasureType(e.target.value)}>
              <option value="diameter">Diameter</option>
              <option value="radius">Radius</option>
            </select>
          </div>
        </div>

        {/* Easy Way / Hard Way */}
        <div style={{ marginBottom: 12 }}>
          <label className="form-label">Roll Direction *</label>
          <div style={{ display: 'flex', gap: 8 }}>
            <button type="button" style={{ flex: 1, padding: '10px 16px', borderRadius: 8, fontWeight: 600, fontSize: '0.95rem',
                border: `2px solid ${partData.rollType === 'easy_way' ? '#2e7d32' : '#ccc'}`, background: partData.rollType === 'easy_way' ? '#e8f5e9' : '#fff', color: partData.rollType === 'easy_way' ? '#2e7d32' : '#666', cursor: 'pointer' }}
              onClick={() => setPartData({ ...partData, rollType: 'easy_way' })}>Easy Way (EW) — On Edge</button>
            <button type="button" style={{ flex: 1, padding: '10px 16px', borderRadius: 8, fontWeight: 600, fontSize: '0.95rem',
                border: `2px solid ${partData.rollType === 'hard_way' ? '#c62828' : '#ccc'}`, background: partData.rollType === 'hard_way' ? '#ffebee' : '#fff', color: partData.rollType === 'hard_way' ? '#c62828' : '#666', cursor: 'pointer' }}
              onClick={() => setPartData({ ...partData, rollType: 'hard_way' })}>Hard Way (HW) — Flat Way</button>
          </div>
          {parsedSize && partData.rollType && (
            <div style={{ fontSize: '0.8rem', color: '#666', marginTop: 6 }}>
              {partData.rollType === 'easy_way'
                ? `Rolling on edge: ${formatFraction(parsedSize.thickness)} side against rollers, ${formatFraction(parsedSize.width)} standing up`
                : `Rolling flat way: ${formatFraction(parsedSize.width)} side against rollers`}
            </div>
          )}
        </div>

        {/* Rise */}
        {riseCalc && (
          <div style={{ background: '#e8f5e9', padding: 12, borderRadius: 8, marginBottom: 12 }}>
            <div style={{ fontWeight: 600, fontSize: '0.9rem', color: '#2e7d32', marginBottom: 4 }}>📐 Chord & Rise</div>
            <div style={{ fontSize: '0.9rem' }}>
              <span style={{ color: '#666' }}>Over {riseCalc.chord}" chord: </span>
              <span style={{ fontWeight: 700, fontSize: '1.05rem' }}>{riseCalc.rise.toFixed(4)}"</span>
              <span style={{ color: '#666', marginLeft: 4 }}>({(riseCalc.rise * 25.4).toFixed(2)} mm)</span>
            </div>
          </div>
        )}

        {/* Rolling Description Preview */}
        {rollingDescription && (
          <div style={{ background: '#f3e5f5', padding: 12, borderRadius: 8 }}>
            <div style={{ fontWeight: 600, fontSize: '0.85rem', color: '#6a1b9a', marginBottom: 6 }}>Rolling Description Preview:</div>
            <pre style={{ margin: 0, fontSize: '0.9rem', whiteSpace: 'pre-wrap', fontFamily: 'monospace', color: '#333' }}>
              {materialDescription}{'\n'}{rollingDescription}
            </pre>
          </div>
        )}

        {/* Pitch / Helix */}
        <PitchSection 
          partData={partData} 
          setPartData={setPartData} 
          clDiameter={clDiameter} 
          inputDiameter={inputDiameter} 
          profileOD={profileSize} 
        />

        {/* === COMPLETE RINGS === */}
        <div style={{ marginTop: 12, padding: 14, borderRadius: 8, background: completeRings ? '#e8f5e9' : '#f9f9f9', border: `2px solid ${completeRings ? '#4caf50' : '#e0e0e0'}`, transition: 'all 0.2s' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', fontWeight: 600 }}>
            <input type="checkbox" checked={completeRings} onChange={(e) => setCompleteRings(e.target.checked)} style={{ width: 18, height: 18 }} />
            <span style={{ fontSize: '1rem' }}>⭕ Complete Rings</span>
          </label>
          {completeRings && (
            <div style={{ marginTop: 12 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">Rings Needed</label>
                  <input type="number" min="1" className="form-input" value={ringsNeeded} onFocus={(e) => e.target.select()} onChange={(e) => setRingsNeeded(parseInt(e.target.value) || 1)} />
                </div>
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">Tangent Each End (inches)</label>
                  <input type="number" step="0.5" className="form-input" value={tangentLength} onFocus={(e) => e.target.select()} onChange={(e) => setTangentLength(e.target.value)} />
                  <div style={{ fontSize: '0.7rem', color: '#999', marginTop: 2 }}>Flat/straight ends that won't bend</div>
                </div>
              </div>
              {ringCalc && !ringCalc.error && (
                <div style={{ background: '#c8e6c9', borderRadius: 8, padding: 12, fontSize: '0.85rem' }}>
                  <div style={{ fontWeight: 600, color: '#2e7d32', marginBottom: 8 }}>⭕ Ring Calculation</div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
                    <div><div style={{ color: '#666', fontSize: '0.7rem' }}>CL Circumference</div><div style={{ fontWeight: 600 }}>{ringCalc.circumference.toFixed(2)}"</div></div>
                    <div><div style={{ color: '#666', fontSize: '0.7rem' }}>Usable Length</div><div style={{ fontWeight: 600 }}>{ringCalc.usable.toFixed(2)}"</div></div>
                    <div><div style={{ color: '#666', fontSize: '0.7rem' }}>{ringCalc.multiSegment ? 'Segments/Ring' : 'Rings/Stick'}</div><div style={{ fontWeight: 600, fontSize: '1.1rem', color: '#1565c0' }}>{ringCalc.multiSegment ? ringCalc.segmentsPerRing : ringCalc.ringsPerStick}</div></div>
                  </div>
                  <div style={{ marginTop: 10, padding: '8px 0', borderTop: '1px solid #a5d6a7', display: 'flex', justifyContent: 'space-between', fontSize: '1rem' }}>
                    <span><strong>{ringsNeeded}</strong> ring(s) needed</span>
                    <strong style={{ color: '#2e7d32', fontSize: '1.1rem' }}>= {ringCalc.sticksNeeded} stick(s) to order</strong>
                  </div>
                  {!ringCalc.multiSegment && ringCalc.ringsPerStick > 1 && (
                    <div style={{ marginTop: 6, fontSize: '0.8rem', color: '#1565c0', fontStyle: 'italic' }}>
                      💡 Material cost per ring = stick price ÷ {ringCalc.ringsPerStick}
                    </div>
                  )}
                </div>
              )}
              {ringCalc && ringCalc.error && (<div style={{ background: '#ffebee', padding: 8, borderRadius: 6, fontSize: '0.85rem', color: '#c62828' }}>⚠️ {ringCalc.error}</div>)}
              {!ringCalc && clDiameter <= 0 && (<div style={{ background: '#fff3e0', padding: 8, borderRadius: 6, fontSize: '0.85rem', color: '#e65100' }}>⚠️ Enter a roll diameter/radius above to calculate</div>)}
            </div>
          )}
        </div>
      </div>

      {/* === FILE UPLOAD === */}
      <div style={sectionStyle}>
        <div className="form-group">
          <label className="form-label">Custom Shape / Drawing (PDF)</label>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 12px', border: '1px dashed #bbb', borderRadius: 6, cursor: 'pointer', fontSize: '0.85rem', color: '#666' }}>
            <Upload size={16} /> Upload drawing...
            <input type="file" accept=".pdf,.png,.jpg,.jpeg" style={{ display: 'none' }} onChange={(e) => { if (e.target.files[0]) { const file = e.target.files[0]; setPartData({ ...partData, _shapeFile: file, _shapeFileName: file.name }); } }} />
          </label>
          {(partData._shapeFile || partData._shapeFileName) && <div style={{ fontSize: '0.8rem', color: '#2e7d32', marginTop: 2 }}>📎 {partData._shapeFile?.name || partData._shapeFileName} {!partData._shapeFile && partData._shapeFileName && <span style={{ color: '#999' }}>(saved)</span>}</div>}
        </div>
      </div>

      {/* === SPECIAL INSTRUCTIONS === */}
      <div style={sectionStyle}>
        <div className="form-group">
          <label className="form-label">Special Instructions</label>
          <textarea className="form-textarea" value={partData.specialInstructions || ''} onChange={(e) => setPartData({ ...partData, specialInstructions: e.target.value })} rows={2} />
        </div>
      </div>

      {/* === MATERIAL INFO === */}
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

      {/* === PRICING === */}
      <div style={sectionStyle}>
        {sectionTitle('💰', 'Pricing', '#1976d2')}
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 2fr', gap: 12 }}>
          <div className="form-group"><label className="form-label">Material Cost (each)</label><input type="number" step="any" className="form-input" value={partData.materialTotal || ''} onChange={(e) => setPartData({ ...partData, materialTotal: e.target.value })} placeholder="0.00" /></div>
          <div className="form-group"><label className="form-label">Markup %</label><input type="number" step="1" className="form-input" value={partData.materialMarkupPercent ?? 20} onChange={(e) => setPartData({ ...partData, materialMarkupPercent: e.target.value })} placeholder="20" /></div>
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

      {/* === TRACKING === */}
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
