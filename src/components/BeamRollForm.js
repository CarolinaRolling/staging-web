import React, { useState, useEffect, useMemo } from 'react';
import RollToOverride from './RollToOverride';
import { Upload } from 'lucide-react';
import { searchVendors, getSettings, createVendor } from '../services/api';
import { useSectionSizes } from '../hooks/useSectionSizes';

const DEFAULT_BEAM_SIZES = [
  // W - Wide Flange (common)
  'W4x13', 'W5x16', 'W5x19',
  'W6x9', 'W6x12', 'W6x15', 'W6x16', 'W6x20', 'W6x25',
  'W8x10', 'W8x13', 'W8x15', 'W8x18', 'W8x21', 'W8x24', 'W8x28', 'W8x31', 'W8x35', 'W8x40', 'W8x48', 'W8x58', 'W8x67',
  'W10x12', 'W10x15', 'W10x19', 'W10x22', 'W10x26', 'W10x30', 'W10x33', 'W10x39', 'W10x45', 'W10x49', 'W10x54', 'W10x60', 'W10x68', 'W10x77', 'W10x88', 'W10x100', 'W10x112',
  'W12x14', 'W12x16', 'W12x19', 'W12x22', 'W12x26', 'W12x30', 'W12x35', 'W12x40', 'W12x45', 'W12x50', 'W12x53', 'W12x58', 'W12x65', 'W12x72', 'W12x79', 'W12x87', 'W12x96', 'W12x106', 'W12x120',
  'W14x22', 'W14x26', 'W14x30', 'W14x34', 'W14x38', 'W14x43', 'W14x48', 'W14x53', 'W14x61', 'W14x68', 'W14x74', 'W14x82', 'W14x90', 'W14x99', 'W14x109', 'W14x120', 'W14x132',
  'W16x26', 'W16x31', 'W16x36', 'W16x40', 'W16x45', 'W16x50', 'W16x57', 'W16x67', 'W16x77', 'W16x89', 'W16x100',
  'W18x35', 'W18x40', 'W18x46', 'W18x50', 'W18x55', 'W18x60', 'W18x65', 'W18x71', 'W18x76', 'W18x86', 'W18x97', 'W18x106', 'W18x119',
  'W21x44', 'W21x50', 'W21x57', 'W21x62', 'W21x68', 'W21x73', 'W21x83', 'W21x93', 'W21x101', 'W21x111', 'W21x122',
  'W24x55', 'W24x62', 'W24x68', 'W24x76', 'W24x84', 'W24x94', 'W24x104', 'W24x117', 'W24x131', 'W24x146', 'W24x162',
  'W27x84', 'W27x94', 'W27x102', 'W27x114', 'W27x129', 'W27x146',
  'W30x90', 'W30x99', 'W30x108', 'W30x116', 'W30x124', 'W30x132', 'W30x148', 'W30x173', 'W30x191', 'W30x211',
  'W33x118', 'W33x130', 'W33x141', 'W33x152', 'W33x169', 'W33x201', 'W33x221', 'W33x241',
  'W36x135', 'W36x150', 'W36x160', 'W36x170', 'W36x182', 'W36x194', 'W36x210', 'W36x232', 'W36x256', 'W36x282', 'W36x302',
  // S - American Standard
  'S3x5.7', 'S3x7.5', 'S4x7.7', 'S4x9.5', 'S5x10', 'S5x14.75',
  'S6x12.5', 'S6x17.25', 'S7x15.3', 'S7x20',
  'S8x18.4', 'S8x23', 'S10x25.4', 'S10x35',
  'S12x31.8', 'S12x35', 'S12x40.8', 'S12x50',
  'S15x42.9', 'S15x50', 'S18x54.7', 'S18x70',
  'S20x66', 'S20x75', 'S20x86', 'S20x96',
  'S24x80', 'S24x90', 'S24x100', 'S24x106', 'S24x121'
];

const DEFAULT_GRADE_OPTIONS = ['A36', 'A572 Gr 50', 'A992', '304 S/S', '316 S/S', 'Custom'];

function parseBeamSize(sizeStr) {
  if (!sizeStr || sizeStr === 'Custom') return null;
  const m = sizeStr.match(/^[WS](\d+(?:\.\d+)?)/);
  if (m) return { depth: parseFloat(m[1]), label: sizeStr, type: sizeStr.startsWith('W') ? 'Wide Flange' : 'S-Beam' };
  return null;
}

function calculateRise(radiusInches, chordInches) {
  if (!radiusInches || radiusInches <= 0) return null;
  const halfChord = chordInches / 2;
  if (halfChord >= radiusInches) return null;
  return radiusInches - Math.sqrt(radiusInches * radiusInches - halfChord * halfChord);
}

export default function BeamRollForm({ partData, setPartData, vendorSuggestions, setVendorSuggestions, showVendorSuggestions, setShowVendorSuggestions, showMessage, setError }) {
  const dynamicBeamSizes = useSectionSizes('beam', DEFAULT_BEAM_SIZES);
  const BEAM_SIZES = [...dynamicBeamSizes, 'Custom'];
  const [customGrade, setCustomGrade] = useState('');
  const [rollValue, setRollValue] = useState(partData._rollValue || '');
  const [rollToMethod, setRollToMethod] = useState(partData._rollToMethod || '');
  const [rollMeasureType, setRollMeasureType] = useState(partData._rollMeasureType || 'diameter');
  const [rollMeasurePoint, setRollMeasurePoint] = useState(partData._rollMeasurePoint || 'inside');
  const [gradeOptions, setGradeOptions] = useState(DEFAULT_GRADE_OPTIONS);
  const [completeRings, setCompleteRings] = useState(!!(partData._completeRings));
  const [ringsNeeded, setRingsNeeded] = useState(partData._ringsNeeded || 1);
  const [tangentLength, setTangentLength] = useState(partData._tangentLength || '12');
  const [isCamber, setIsCamber] = useState(!!(partData._isCamber));
  const [showDiaFind, setShowDiaFind] = useState(false);
  const [diaFindChord, setDiaFindChord] = useState('');
  const [diaFindRise, setDiaFindRise] = useState('');
  const diaFindResult = (diaFindChord && diaFindRise && parseFloat(diaFindRise) > 0) ? ((parseFloat(diaFindChord) ** 2) / (4 * parseFloat(diaFindRise))) + parseFloat(diaFindRise) : null;
  const [camberDepth, setCamberDepth] = useState(partData._camberDepth || '');

  useEffect(() => {
    const loadGrades = async () => {
      try {
        const resp = await getSettings('material_grades');
        if (resp.data.data?.value) {
          const grades = resp.data.data.value.filter(g => g.partTypes?.includes('beam_roll'));
          if (grades.length > 0) setGradeOptions([...grades.map(g => g.name), 'Custom']);
        }
      } catch {}
    };
    loadGrades();
  }, []);

  useEffect(() => {
    if (partData.radius && !partData.diameter) { setRollValue(partData.radius); setRollMeasureType('radius'); }
    else if (partData.diameter) { setRollValue(partData.diameter); setRollMeasureType('diameter'); }
    if (partData._rollMeasureType) setRollMeasureType(partData._rollMeasureType);
    if (partData._rollMeasurePoint) setRollMeasurePoint(partData._rollMeasurePoint);
  }, []);

  useEffect(() => {
    const updates = { _rollValue: rollValue,
      _rollToMethod: rollToMethod, _rollMeasureType: rollMeasureType, _rollMeasurePoint: rollMeasurePoint, _isCamber: isCamber, _camberDepth: camberDepth };
    if (isCamber) { updates.diameter = ''; updates.radius = ''; }
    else if (rollMeasureType === 'radius') { updates.radius = rollValue; updates.diameter = ''; }
    else { updates.diameter = rollValue; updates.radius = ''; }
    setPartData(prev => ({ ...prev, ...updates }));
  }, [rollToMethod, rollValue, rollMeasureType, rollMeasurePoint, isCamber, camberDepth]);

  const parsedSize = useMemo(() => parseBeamSize(partData._beamSize), [partData._beamSize]);
  const profileSize = useMemo(() => parsedSize ? parsedSize.depth : 0, [parsedSize]);

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
    } else { setPartData(prev => ({ ...prev, _completeRings: false })); }
  }, [completeRings, ringCalc, ringsNeeded, tangentLength]);

  const materialDescription = useMemo(() => {
    const qty = parseInt(partData.quantity) || 1;
    const parts = [`${qty}pc:`];
    if (partData._beamSize && partData._beamSize !== 'Custom') parts.push(partData._beamSize);
    else if (partData._customBeamSize) parts.push(partData._customBeamSize);
    parts.push('Beam');
    if (partData.length) parts.push(`x ${partData.length} long`);
    if (partData.material) parts.push(partData.material);
    if (partData._materialOrigin) parts.push(partData._materialOrigin);
    return parts.join(' ');
  }, [partData._beamSize, partData._customBeamSize, partData.length, partData.material, partData._materialOrigin, partData.quantity]);

  const rollingDescription = useMemo(() => {
    if (isCamber) {
      const depth = camberDepth || '';
      const len = partData.length || '';
      if (!depth) return '';
      const dir = partData.rollType === 'easy_way' ? ' EW' : partData.rollType === 'hard_way' ? ' HW' : '';
      return `Camber ${depth}" on ${len}${dir}`;
    }
    if (rollToMethod === 'template') return 'Roll Per Template / Sample';
    if (rollToMethod === 'print') return 'Roll per print';
    const rv = parseFloat(rollValue) || 0;
    if (!rv) return '';
    const lines = [];
    
    const spec = rollMeasurePoint === 'inside' ? (rollMeasureType === 'radius' ? 'ISR' : 'ID') : rollMeasurePoint === 'outside' ? (rollMeasureType === 'radius' ? 'OSR' : 'OD') : (rollMeasureType === 'radius' ? 'CLR' : 'CLD');
    const ewHw = partData.rollType === 'easy_way' ? 'EW' : partData.rollType === 'hard_way' ? 'HW' : '';
    let rollLine = `Roll to ${rv}" ${spec}`;
    if (ewHw) rollLine += ` ${ewHw} (${partData.rollType === 'easy_way' ? 'web horizontal' : 'web vertical'})`;
    lines.push(rollLine);
    if (riseCalc) lines.push(`Chord: ${riseCalc.chord}" Rise: ${riseCalc.rise.toFixed(4)}"`);
    if (completeRings && ringCalc && !ringCalc.error) {
      if (!ringCalc.multiSegment) {
        lines.push(`Complete Ring — ${ringsNeeded} ring(s), ${ringCalc.ringsPerStick} rings/stick, ${ringCalc.sticksNeeded} stick(s) needed`);
      } else {
        lines.push(`Complete Ring — ${ringsNeeded} ring(s), ${ringCalc.segmentsPerRing} segments/ring, ${ringCalc.sticksNeeded} stick(s) needed`);
      }
      lines.push(`Tangents: ${ringCalc.tangent}" each end`);
    }
    return lines.join('\n');
  }, [isCamber, camberDepth, partData.length, rollValue, rollMeasureType, rollMeasurePoint, partData.rollType, riseCalc, clDiameter, completeRings, ringCalc, ringsNeeded]);

  useEffect(() => {
    const updates = { materialDescription, _materialDescription: materialDescription };
    if (partData._beamSize && partData._beamSize !== 'Custom') updates.sectionSize = partData._beamSize;
    else if (partData._customBeamSize) updates.sectionSize = partData._customBeamSize;
    setPartData(prev => ({ ...prev, ...updates }));
  }, [materialDescription]);

  useEffect(() => { setPartData(prev => ({ ...prev, _rollingDescription: rollingDescription })); }, [rollingDescription]);

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
  const selectedBeamSize = BEAM_SIZES.includes(partData._beamSize) ? partData._beamSize : (partData._beamSize ? 'Custom' : '');

  const sectionStyle = { gridColumn: 'span 2', borderTop: '1px solid #e0e0e0', marginTop: 8, paddingTop: 12 };
  const sectionTitle = (icon, text, color) => <h4 style={{ marginBottom: 10, color, fontSize: '0.95rem' }}>{icon} {text}</h4>;

  // Group sizes for display
  const wSizes = BEAM_SIZES.filter(s => s.startsWith('W'));
  const sSizes = BEAM_SIZES.filter(s => s.startsWith('S'));

  return (
    <>
      <div className="form-group">
        <label className="form-label">Quantity *</label>
        <input type="number" className="form-input" value={partData.quantity}
          onChange={(e) => setPartData({ ...partData, quantity: e.target.value })}
          onFocus={(e) => e.target.select()} min="1" disabled={completeRings}
          style={completeRings ? { background: '#e8f5e9', fontWeight: 600 } : {}} />
        {completeRings && ringCalc && !ringCalc.error && (
          <div style={{ fontSize: '0.75rem', color: '#2e7d32', marginTop: 2 }}>⭕ {ringsNeeded} ring(s) — {ringCalc.sticksNeeded} stick(s) needed{!ringCalc.multiSegment ? ` (${ringCalc.ringsPerStick} rings/stick)` : ` (${ringCalc.segmentsPerRing} segments/ring)`}</div>
        )}
      </div>

      <div className="form-group">
        <label className="form-label">Beam Size *</label>
        <select className="form-select" value={selectedBeamSize} onChange={(e) => {
          if (e.target.value === 'Custom') setPartData({ ...partData, _beamSize: 'Custom' });
          else setPartData({ ...partData, _beamSize: e.target.value, _customBeamSize: '' });
        }}>
          <option value="">Select...</option>
          <optgroup label="W - Wide Flange">
            {wSizes.map(s => <option key={s} value={s}>{s}</option>)}
          </optgroup>
          <optgroup label="S - American Standard">
            {sSizes.map(s => <option key={s} value={s}>{s}</option>)}
          </optgroup>
          <option value="Custom">Custom</option>
        </select>
        {selectedBeamSize === 'Custom' && (
          <input className="form-input" style={{ marginTop: 4 }} placeholder='e.g. W12x26'
            value={partData._customBeamSize || ''}
            onChange={(e) => setPartData({ ...partData, _customBeamSize: e.target.value })} />
        )}
        {parsedSize && <div style={{ fontSize: '0.75rem', color: '#999', marginTop: 2 }}>{parsedSize.type} — Depth: {parsedSize.depth}"</div>}
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
          <option value="30'">30'</option>
          <option value="40'">40'</option>
          <option value="50'">50'</option>
          <option value="60'">60'</option>
          <option value="Custom">Custom</option>
        </select>
        {partData._lengthOption === 'Custom' && (
          <input className="form-input" style={{ marginTop: 4 }} placeholder="Enter length"
            value={partData._customLength || ''} onChange={(e) => setPartData({ ...partData, _customLength: e.target.value, length: e.target.value })} />
        )}
      </div>

      {/* === ROLL INFO === */}
      <div style={sectionStyle}>
        {sectionTitle('🔄', 'Roll Information', '#1565c0')}
        <RollToOverride rollToMethod={rollToMethod} onMethodChange={setRollToMethod} />
        
        {/* Roll vs Camber toggle */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
          <button type="button" onClick={() => setIsCamber(false)}
            style={{ flex: 1, padding: '10px 16px', borderRadius: 8, fontWeight: 600, fontSize: '0.95rem', cursor: 'pointer',
              border: `2px solid ${!isCamber ? '#1565c0' : '#ccc'}`, background: !isCamber ? '#e3f2fd' : '#fff', color: !isCamber ? '#1565c0' : '#666' }}>
            🔄 Roll
          </button>
          <button type="button" onClick={() => setIsCamber(true)}
            style={{ flex: 1, padding: '10px 16px', borderRadius: 8, fontWeight: 600, fontSize: '0.95rem', cursor: 'pointer',
              border: `2px solid ${isCamber ? '#e65100' : '#ccc'}`, background: isCamber ? '#fff3e0' : '#fff', color: isCamber ? '#e65100' : '#666' }}>
            📐 Camber
          </button>
        </div>

        {isCamber ? (
          <>
            <div className="form-group">
              <label className="form-label">Camber Depth *</label>
              <input className="form-input" value={camberDepth} onFocus={(e) => e.target.select()} onChange={(e) => setCamberDepth(e.target.value)} placeholder='e.g. 2"' type="number" step="0.001" />
            </div>
            {/* Roll Direction for Camber */}
            <div style={{ marginBottom: 12, marginTop: 8 }}>
              <label className="form-label">Roll Direction *</label>
              <div style={{ display: 'flex', gap: 8 }}>
                <button type="button" style={{ flex: 1, padding: '10px 16px', borderRadius: 8, fontWeight: 600, fontSize: '0.95rem',
                    border: `2px solid ${partData.rollType === 'easy_way' ? '#2e7d32' : '#ccc'}`, background: partData.rollType === 'easy_way' ? '#e8f5e9' : '#fff', color: partData.rollType === 'easy_way' ? '#2e7d32' : '#666', cursor: 'pointer' }}
                  onClick={() => setPartData({ ...partData, rollType: 'easy_way' })}>Easy Way (EW) — Web Horizontal</button>
                <button type="button" style={{ flex: 1, padding: '10px 16px', borderRadius: 8, fontWeight: 600, fontSize: '0.95rem',
                    border: `2px solid ${partData.rollType === 'hard_way' ? '#c62828' : '#ccc'}`, background: partData.rollType === 'hard_way' ? '#ffebee' : '#fff', color: partData.rollType === 'hard_way' ? '#c62828' : '#666', cursor: 'pointer' }}
                  onClick={() => setPartData({ ...partData, rollType: 'hard_way' })}>Hard Way (HW) — Web Vertical</button>
              </div>
            </div>
            {camberDepth && partData.length && (
              <div style={{ background: '#fff3e0', padding: 12, borderRadius: 8, border: '1px solid #ffcc80', marginTop: 8 }}>
                <div style={{ fontWeight: 600, fontSize: '0.85rem', color: '#e65100', marginBottom: 6 }}>📐 Camber Instruction:</div>
                <pre style={{ margin: 0, fontSize: '0.95rem', fontFamily: 'monospace', color: '#333' }}>Camber {camberDepth}" on {partData.length}{partData.rollType === 'easy_way' ? ' EW' : partData.rollType === 'hard_way' ? ' HW' : ''}</pre>
              </div>
            )}
          </>
        ) : (
        <>
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: 8, marginBottom: 12 }}>
          <div className="form-group"><label className="form-label">Roll to: *</label><input className="form-input" value={rollToMethod ? '' : rollValue} onChange={(e) => setRollValue(e.target.value)} placeholder={rollToMethod === 'template' ? 'Per Template/Sample' : rollToMethod === 'print' ? 'Per Print' : 'Enter value'} type="number" step="0.001" disabled={!!rollToMethod} style={rollToMethod ? { background: '#f0f0f0', color: '#999' } : {}} /></div>
          <div className="form-group"><label className="form-label">Measured At</label>
            <select className="form-select" disabled={!!rollToMethod} style={rollToMethod ? { background: '#f0f0f0', color: '#999' } : {}} value={rollMeasurePoint} onChange={(e) => setRollMeasurePoint(e.target.value)}><option value="inside">Inside</option><option value="outside">Outside</option></select></div>
          <div className="form-group"><label className="form-label">Type</label>
            <select className="form-select" disabled={!!rollToMethod} style={rollToMethod ? { background: '#f0f0f0', color: '#999' } : {}} value={rollMeasureType} onChange={(e) => setRollMeasureType(e.target.value)}><option value="diameter">Diameter</option><option value="radius">Radius</option></select></div>
        </div>

        {/* DiaFind - chord & rise to diameter calculator */}
        {!rollToMethod && !isCamber && (
          <div style={{ marginBottom: 12 }}>
            <button type="button" onClick={() => setShowDiaFind(!showDiaFind)}
              style={{ background: 'none', border: 'none', color: '#1565c0', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 600, padding: 0, display: 'flex', alignItems: 'center', gap: 4 }}>
              📐 DiaFind {showDiaFind ? '▾' : '▸'} <span style={{ fontWeight: 400, color: '#888' }}>— chord & rise → diameter</span>
            </button>
            {showDiaFind && (
              <div style={{ marginTop: 8, padding: 12, background: '#f3e5f5', borderRadius: 8, border: '1px solid #ce93d8' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label" style={{ fontSize: '0.8rem' }}>Chord (inches)</label>
                    <input type="number" step="0.001" className="form-input" value={diaFindChord} onFocus={(e) => e.target.select()} onChange={(e) => setDiaFindChord(e.target.value)} placeholder="e.g. 48" />
                  </div>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label" style={{ fontSize: '0.8rem' }}>Rise (inches)</label>
                    <input type="number" step="0.001" className="form-input" value={diaFindRise} onFocus={(e) => e.target.select()} onChange={(e) => setDiaFindRise(e.target.value)} placeholder="e.g. 2.5" />
                  </div>
                </div>
                {diaFindResult && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'space-between' }}>
                    <span style={{ fontWeight: 700, color: '#6a1b9a', fontSize: '1rem' }}>⌀ {diaFindResult.toFixed(3)}"</span>
                    <button type="button" onClick={() => { setRollValue(diaFindResult.toFixed(3)); setRollMeasureType('diameter'); setShowDiaFind(false); }}
                      style={{ padding: '6px 16px', background: '#7b1fa2', color: '#fff', border: 'none', borderRadius: 6, fontWeight: 600, cursor: 'pointer', fontSize: '0.85rem' }}>
                      Apply Diameter
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Easy Way / Hard Way for beams */}
        <div style={{ marginBottom: 12 }}>
          <label className="form-label">Roll Direction *</label>
          <div style={{ display: 'flex', gap: 8 }}>
            <button type="button" style={{ flex: 1, padding: '10px 16px', borderRadius: 8, fontWeight: 600, fontSize: '0.95rem',
                border: `2px solid ${partData.rollType === 'easy_way' ? '#2e7d32' : '#ccc'}`, background: partData.rollType === 'easy_way' ? '#e8f5e9' : '#fff', color: partData.rollType === 'easy_way' ? '#2e7d32' : '#666', cursor: 'pointer' }}
              onClick={() => setPartData({ ...partData, rollType: 'easy_way' })}>Easy Way (EW) — Web Horizontal</button>
            <button type="button" style={{ flex: 1, padding: '10px 16px', borderRadius: 8, fontWeight: 600, fontSize: '0.95rem',
                border: `2px solid ${partData.rollType === 'hard_way' ? '#c62828' : '#ccc'}`, background: partData.rollType === 'hard_way' ? '#ffebee' : '#fff', color: partData.rollType === 'hard_way' ? '#c62828' : '#666', cursor: 'pointer' }}
              onClick={() => setPartData({ ...partData, rollType: 'hard_way' })}>Hard Way (HW) — Web Vertical</button>
          </div>
          {partData.rollType && (
            <div style={{ fontSize: '0.8rem', color: '#666', marginTop: 6 }}>
              {partData.rollType === 'easy_way'
                ? 'Easy Way: Beam on its side, web horizontal — flanges up/down'
                : 'Hard Way: Beam standing upright, web vertical — standard orientation'}
            </div>
          )}
        </div>

        {riseCalc && !isCamber && (
          <div style={{ background: '#e8f5e9', padding: 12, borderRadius: 8, marginBottom: 12 }}>
            <div style={{ fontWeight: 600, fontSize: '0.9rem', color: '#2e7d32', marginBottom: 4 }}>📐 Chord & Rise</div>
            <div style={{ fontSize: '0.9rem' }}><span style={{ color: '#666' }}>Over {riseCalc.chord}" chord: </span><span style={{ fontWeight: 700, fontSize: '1.05rem' }}>{riseCalc.rise.toFixed(4)}"</span><span style={{ color: '#666', marginLeft: 4 }}>({(riseCalc.rise * 25.4).toFixed(2)} mm)</span></div>
          </div>
        )}

        {!isCamber && rollingDescription && (
          <div style={{ background: '#f3e5f5', padding: 12, borderRadius: 8 }}>
            <div style={{ fontWeight: 600, fontSize: '0.85rem', color: '#6a1b9a', marginBottom: 6 }}>Rolling Description Preview:</div>
            <pre style={{ margin: 0, fontSize: '0.9rem', whiteSpace: 'pre-wrap', fontFamily: 'monospace', color: '#333' }}>{materialDescription}{'\n'}{rollingDescription}</pre>
          </div>
        )}

        {/* === COMPLETE RINGS === */}
        {!isCamber && (
        <div style={{ marginTop: 12, padding: 14, borderRadius: 8, background: completeRings ? '#e8f5e9' : '#f9f9f9', border: `2px solid ${completeRings ? '#4caf50' : '#e0e0e0'}`, transition: 'all 0.2s' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', fontWeight: 600 }}>
            <input type="checkbox" checked={completeRings} onChange={(e) => setCompleteRings(e.target.checked)} style={{ width: 18, height: 18 }} />
            <span style={{ fontSize: '1rem' }}>⭕ Complete Rings</span>
          </label>
          {completeRings && (
            <div style={{ marginTop: 12 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
                <div className="form-group" style={{ margin: 0 }}><label className="form-label">Rings Needed</label><input type="number" min="1" className="form-input" value={ringsNeeded} onChange={(e) => setRingsNeeded(parseInt(e.target.value) || 1)} /></div>
                <div className="form-group" style={{ margin: 0 }}><label className="form-label">Tangent Each End (inches)</label><input type="number" step="0.5" className="form-input" value={tangentLength} onFocus={(e) => e.target.select()} onChange={(e) => setTangentLength(e.target.value)} /><div style={{ fontSize: '0.7rem', color: '#999', marginTop: 2 }}>Flat/straight ends</div></div>
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
              {!ringCalc && clDiameter <= 0 && (<div style={{ background: '#fff3e0', padding: 8, borderRadius: 6, fontSize: '0.85rem', color: '#e65100' }}>⚠️ Enter a roll diameter/radius above</div>)}
            </div>
          )}
        </div>
        )}
        </>
        )}
      </div>

      <div style={sectionStyle}><div className="form-group"><label className="form-label">Custom Shape / Drawing (PDF)</label><label style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 12px', border: '1px dashed #bbb', borderRadius: 6, cursor: 'pointer', fontSize: '0.85rem', color: '#666' }}><Upload size={16} /> Upload drawing...<input type="file" accept=".pdf,.png,.jpg,.jpeg" style={{ display: 'none' }} onChange={(e) => { if (e.target.files[0]) { const file = e.target.files[0]; setPartData({ ...partData, _shapeFile: file, _shapeFileName: file.name }); } }} /></label>{(partData._shapeFile || partData._shapeFileName) && <div style={{ fontSize: '0.8rem', color: '#2e7d32', marginTop: 2 }}>📎 {partData._shapeFile?.name || partData._shapeFileName} {!partData._shapeFile && partData._shapeFileName && <span style={{ color: '#999' }}>(saved)</span>}</div>}</div></div>

      <div style={sectionStyle}><div className="form-group"><label className="form-label">Special Instructions</label><textarea className="form-textarea" value={partData.specialInstructions || ''} onChange={(e) => setPartData({ ...partData, specialInstructions: e.target.value })} rows={2} /></div></div>

      {/* === MATERIAL INFO === */}
      <div style={sectionStyle}>
        {sectionTitle('📦', 'Material Information', '#e65100')}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
          <div className="form-group"><label className="form-label">Grade</label>
            <select className="form-select" value={selectedGradeOption} onChange={(e) => { if (e.target.value === 'Custom') setPartData({ ...partData, material: customGrade || 'Custom' }); else { setPartData({ ...partData, material: e.target.value }); setCustomGrade(''); } }}><option value="">Select...</option>{gradeOptions.map(g => <option key={g} value={g}>{g}</option>)}</select>
            {(selectedGradeOption === 'Custom' || isCustomGrade) && (<input className="form-input" style={{ marginTop: 4 }} placeholder="Enter grade" value={isCustomGrade ? partData.material : customGrade} onChange={(e) => { setCustomGrade(e.target.value); setPartData({ ...partData, material: e.target.value }); }} />)}</div>
          <div className="form-group"><label className="form-label">Origin</label><select className="form-select" value={partData._materialOrigin || ''} onChange={(e) => setPartData({ ...partData, _materialOrigin: e.target.value })}><option value="">Select...</option><option value="Domestic">Domestic</option><option value="Import">Import</option></select></div>
          <div className="form-group"><label className="form-label">Material Source</label><select className="form-select" value={partData.materialSource || 'customer_supplied'} onChange={(e) => setPartData({ ...partData, materialSource: e.target.value })}><option value="customer_supplied">Client Supplies</option><option value="we_order">We Order</option></select></div>
        </div>
        {partData.materialSource === 'we_order' && (
          <div className="form-group" style={{ position: 'relative', marginTop: 8 }}>
            <label className="form-label">Vendor</label>
            <input className="form-input" value={partData._vendorSearch !== undefined ? partData._vendorSearch : (partData.vendor?.name || partData.supplierName || '')}
              onChange={async (e) => { const value = e.target.value; setPartData({ ...partData, _vendorSearch: value }); if (value.length >= 1) { try { const res = await searchVendors(value); setVendorSuggestions(res.data.data || []); setShowVendorSuggestions(true); } catch { setVendorSuggestions([]); } } else { setPartData({ ...partData, _vendorSearch: value, vendorId: null, supplierName: '' }); setVendorSuggestions([]); setShowVendorSuggestions(false); } }}
              onFocus={async () => { try { const res = await searchVendors(''); setVendorSuggestions(res.data.data || []); setShowVendorSuggestions(true); } catch {} }}
              onBlur={() => setTimeout(() => setShowVendorSuggestions(false), 200)} placeholder="Search or add vendor..." autoComplete="off" />
            {showVendorSuggestions && (
              <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 100, background: 'white', border: '1px solid #ddd', borderRadius: 4, maxHeight: 200, overflowY: 'auto', boxShadow: '0 4px 12px rgba(0,0,0,0.15)' }}>
                {vendorSuggestions.map(v => (<div key={v.id} style={{ padding: '8px 12px', cursor: 'pointer', borderBottom: '1px solid #eee' }} onMouseDown={() => { setPartData({ ...partData, vendorId: v.id, supplierName: v.name, _vendorSearch: undefined }); setShowVendorSuggestions(false); }}><strong>{v.name}</strong>{v.contactPhone && <span style={{ fontSize: '0.8rem', color: '#666', marginLeft: 8 }}>{v.contactPhone}</span>}</div>))}
                {partData._vendorSearch && partData._vendorSearch.length >= 2 && !vendorSuggestions.some(v => v.name.toLowerCase() === (partData._vendorSearch || '').toLowerCase()) && (
                  <div style={{ padding: '8px 12px', cursor: 'pointer', background: '#e8f5e9', color: '#2e7d32', fontWeight: 600 }}
                    onMouseDown={async () => { try { const resp = await createVendor({ name: partData._vendorSearch }); if (resp.data.data) { setPartData({ ...partData, vendorId: resp.data.data.id, supplierName: resp.data.data.name, _vendorSearch: undefined }); showMessage(`Vendor "${resp.data.data.name}" created`); } } catch { setError('Failed to create vendor'); } setShowVendorSuggestions(false); }}>+ Add "{partData._vendorSearch}" as new vendor</div>
                )}
              </div>
            )}
          </div>
        )}
        <div className="form-group" style={{ marginTop: 12 }}><label className="form-label">Material Description (for ordering)</label><textarea className="form-textarea" value={partData.materialDescription || ''} onChange={(e) => setPartData({ ...partData, materialDescription: e.target.value })} rows={2} style={{ fontFamily: 'monospace', fontSize: '0.9rem' }} /><div style={{ fontSize: '0.75rem', color: '#999', marginTop: 2 }}>Auto-generated — edit as needed</div></div>
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

      <div style={sectionStyle}>{sectionTitle('🏷️', 'Tracking', '#616161')}<div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}><div className="form-group"><label className="form-label">Client Part Number</label><input type="text" className="form-input" value={partData.clientPartNumber || ''} onChange={(e) => setPartData({ ...partData, clientPartNumber: e.target.value })} placeholder="Optional" /></div><div className="form-group"><label className="form-label">Heat Number</label><input type="text" className="form-input" value={partData.heatNumber || ''} onChange={(e) => setPartData({ ...partData, heatNumber: e.target.value })} placeholder="Optional" /></div></div></div>
    </>
  );
}
