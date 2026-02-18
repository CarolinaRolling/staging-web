import React, { useState, useEffect, useMemo } from 'react';
import RollToOverride from './RollToOverride';
import { Upload } from 'lucide-react';
import { searchVendors, getSettings, createVendor } from '../services/api';
import PitchSection, { getPitchDescriptionLines } from './PitchSection';

const THICKNESS_OPTIONS = [
  '24 ga', '20 ga', '16 ga', '14 ga', '12 ga', '11 ga', '10 ga',
  '1/8"', '3/16"', '1/4"', '5/16"', '3/8"', '1/2"', '5/8"', '3/4"', '7/8"',
  '1"', '1-1/4"', '1-1/2"', '2"', 'Custom'
];

const DEFAULT_GRADE_OPTIONS = ['A36', '304 S/S', '316 S/S', 'AR400', 'Custom'];

// Convert thickness string to decimal inches for calculation
function thicknessToDecimal(t) {
  if (!t) return 0;
  const gaugeMap = {
    '24 ga': 0.0239, '20 ga': 0.0359, '16 ga': 0.0598, '14 ga': 0.0747,
    '12 ga': 0.1046, '11 ga': 0.1196, '10 ga': 0.1345
  };
  if (gaugeMap[t]) return gaugeMap[t];
  const clean = t.replace(/"/g, '').trim();
  if (clean.includes('-')) {
    const [whole, frac] = clean.split('-');
    const [n, d] = frac.split('/').map(Number);
    return Number(whole) + (n / d);
  }
  if (clean.includes('/')) {
    const [n, d] = clean.split('/').map(Number);
    return n / d;
  }
  return parseFloat(clean) || 0;
}

export default function PlateRollForm({ partData, setPartData, vendorSuggestions, setVendorSuggestions, showVendorSuggestions, setShowVendorSuggestions, showMessage, setError }) {
  const [customThickness, setCustomThickness] = useState('');
  const [customGrade, setCustomGrade] = useState('');
  const [rollValue, setRollValue] = useState(partData._rollValue || '');
  const [rollToMethod, setRollToMethod] = useState(partData._rollToMethod || '');
  const [rollMeasurePoint, setRollMeasurePoint] = useState(partData._rollMeasurePoint || 'inside');
  const [rollMeasureType, setRollMeasureType] = useState(partData._rollMeasureType || 'diameter');
  const [showAngle, setShowAngle] = useState(!!(partData.arcDegrees));
  const [angleValue, setAngleValue] = useState(partData.arcDegrees || '');
  const [showTangent, setShowTangent] = useState(!!(partData._tangentLength));
  const [tangentLength, setTangentLength] = useState(partData._tangentLength || '');
  const [nestingEnabled, setNestingEnabled] = useState(!!(partData._nestingEnabled));
  const [stockLength, setStockLength] = useState(partData._stockLength || '');
  const [gradeOptions, setGradeOptions] = useState(DEFAULT_GRADE_OPTIONS);

  // Load grades from admin settings
  useEffect(() => {
    const loadGrades = async () => {
      try {
        const resp = await getSettings('material_grades');
        if (resp.data.data?.value) {
          const partType = partData.partType === 'flat_stock' ? 'flat_stock' : 'plate_roll';
          const grades = resp.data.data.value.filter(g => g.partTypes?.includes(partType));
          if (grades.length > 0) setGradeOptions([...grades.map(g => g.name), 'Custom']);
        }
      } catch {}
    };
    loadGrades();
  }, [partData.partType]);
  // Sync roll fields from partData on mount (for editing)
  useEffect(() => {
    if (partData.radius && !partData.diameter) {
      setRollValue(partData.radius);
      setRollMeasureType('radius');
    } else if (partData.diameter) {
      setRollValue(partData.diameter);
      setRollMeasureType('diameter');
    }
    if (partData.arcDegrees) {
      setShowAngle(true);
      setAngleValue(partData.arcDegrees);
    }
    if (partData._rollMeasurePoint) setRollMeasurePoint(partData._rollMeasurePoint);
    if (partData._tangentLength) {
      setShowTangent(true);
      setTangentLength(partData._tangentLength);
    }
    if (partData._nestingEnabled) {
      setNestingEnabled(true);
      if (partData._stockLength) setStockLength(partData._stockLength);
    }
  }, []);

  // Update partData when roll fields change
  useEffect(() => {
    const updates = {
      _rollValue: rollValue,
      _rollToMethod: rollToMethod,
      _rollMeasurePoint: rollMeasurePoint,
      _rollMeasureType: rollMeasureType,
      _tangentLength: tangentLength,
      _nestingEnabled: nestingEnabled,
      _stockLength: stockLength,
      arcDegrees: showAngle ? angleValue : ''
    };
    if (rollMeasureType === 'radius') {
      updates.radius = rollValue;
      updates.diameter = '';
    } else {
      updates.diameter = rollValue;
      updates.radius = '';
    }
    setPartData(prev => ({ ...prev, ...updates }));
  }, [rollToMethod, rollValue, rollMeasurePoint, rollMeasureType, showAngle, angleValue, tangentLength, nestingEnabled, stockLength]);

  // Arc length calculation
  const calcResult = useMemo(() => {
    const thickDecimal = thicknessToDecimal(partData.thickness);
    const rv = parseFloat(rollValue) || 0;
    if (!rv || !thickDecimal) return null;

    let diameter = rollMeasureType === 'radius' ? rv * 2 : rv;

    let effectiveDiameter;
    if (rollMeasurePoint === 'inside') {
      effectiveDiameter = diameter + thickDecimal;
    } else if (rollMeasurePoint === 'outside') {
      effectiveDiameter = diameter - thickDecimal;
    } else {
      effectiveDiameter = diameter;
    }

    let arcLength = effectiveDiameter * Math.PI;

    const angle = parseFloat(angleValue) || 0;
    if (showAngle && angle > 0) {
      arcLength = (arcLength / 360) * angle;
    }

    const tang = parseFloat(tangentLength) || 0;
    let totalLength = arcLength;
    if (showTangent && tang > 0) {
      totalLength = arcLength + (tang * 2);
    }

    return {
      arcLength: arcLength,
      totalLength: totalLength,
      hasTangent: showTangent && tang > 0
    };
  }, [partData.thickness, rollValue, rollMeasurePoint, rollMeasureType, showAngle, angleValue, showTangent, tangentLength]);

  // Complete rings nesting calculation
  const isCompleteRing = !showAngle || !angleValue || parseFloat(angleValue) === 360;
  const nestingCalc = useMemo(() => {
    if (!nestingEnabled || !isCompleteRing || !calcResult || !stockLength) return null;
    const ringLength = calcResult.totalLength;
    const stock = parseFloat(stockLength) || 0;
    if (ringLength <= 0 || stock <= 0 || stock < ringLength) return null;
    
    const ringsPerLength = Math.floor(stock / ringLength);
    const totalRings = parseInt(partData.quantity) || 1;
    const stockLengthsNeeded = Math.ceil(totalRings / ringsPerLength);
    const totalRingsFromStock = stockLengthsNeeded * ringsPerLength;
    const waste = totalRingsFromStock - totalRings;
    const usedPerLength = (ringLength * ringsPerLength).toFixed(2);
    const wastePerLength = (stock - ringLength * ringsPerLength).toFixed(2);
    
    return { ringsPerLength, stockLengthsNeeded, totalRingsFromStock, waste, ringLength, stock, usedPerLength, wastePerLength };
  }, [nestingEnabled, isCompleteRing, calcResult, stockLength, partData.quantity]);

  // Build material description string — includes quantity
  const materialDescription = useMemo(() => {
    const descParts = [];
    
    if (nestingCalc) {
      // Nesting mode: show stock lengths needed instead of ring qty
      descParts.push(`${nestingCalc.stockLengthsNeeded}pc:`);
      if (partData.thickness) descParts.push(partData.thickness);
      if (partData.width) descParts.push(`x ${partData.width}"`);
      descParts.push(`x ${nestingCalc.stock}"`);
    } else {
      const qty = parseInt(partData.quantity) || 1;
      descParts.push(`${qty}pc:`);
      if (partData.thickness) descParts.push(partData.thickness);
      if (partData.width) descParts.push(`x ${partData.width}"`);
      if (partData.length) descParts.push(`x ${partData.length}"`);
    }
    
    const grade = partData.material || '';
    if (grade) descParts.push(grade);
    const origin = partData._materialOrigin || '';
    if (origin) descParts.push(origin);
    if (nestingCalc) {
      descParts.push(`(${nestingCalc.ringsPerLength} rings/pc × ${nestingCalc.stockLengthsNeeded}pc = ${nestingCalc.totalRingsFromStock} rings for ${parseInt(partData.quantity) || 1} needed)`);
    }
    return descParts.join(' ');
  }, [partData.thickness, partData.width, partData.length, partData.material, partData._materialOrigin, partData.quantity, nestingCalc]);

  // Auto-update material description
  useEffect(() => {
    setPartData(prev => ({ ...prev, materialDescription, _materialDescription: materialDescription }));
  }, [materialDescription]);

  // Centerline diameter for pitch calculations
  const clDiameter = useMemo(() => {
    const thickDecimal = thicknessToDecimal(partData.thickness);
    const rv = parseFloat(rollValue) || 0;
    if (!rv) return 0;
    let diameter = rollMeasureType === 'radius' ? rv * 2 : rv;
    if (rollMeasurePoint === 'inside') return diameter + thickDecimal;
    if (rollMeasurePoint === 'outside') return diameter - thickDecimal;
    return diameter;
  }, [partData.thickness, rollValue, rollMeasureType, rollMeasurePoint]);

  // Rolling description (includes pitch info)
  const rollingDescription = useMemo(() => {
    if (rollToMethod === 'template') return 'Roll Per Template / Sample';
    if (rollToMethod === 'print') return 'Roll per print';
    const rv = parseFloat(rollValue) || 0;
    if (!rv) return '';
    const lines = [];
    
    const spec = rollMeasurePoint === 'inside' ? (rollMeasureType === 'radius' ? 'ISR' : 'ID') : rollMeasurePoint === 'outside' ? (rollMeasureType === 'radius' ? 'OSR' : 'OD') : (rollMeasureType === 'radius' ? 'CLR' : 'CLD');
    lines.push(`Roll to ${rv}" ${spec} EW`);
    if (showAngle && angleValue) lines.push(`Arc: ${angleValue}°`);
    if (partData._protectivePaper && partData._protectivePaperSide) {
      const sideLabel = partData._protectivePaperSide === 'double' ? 'Double Sided' : partData._protectivePaperSide === 'inside' ? 'Inside' : 'Outside';
      lines.push(`Protective Paper: ${sideLabel}`);
    }
    if (nestingCalc) {
      lines.push(`Complete Rings: ${nestingCalc.ringsPerLength}/pc from ${nestingCalc.stock}" stock, ${nestingCalc.stockLengthsNeeded} lengths`);
    }
    lines.push(...getPitchDescriptionLines(partData, clDiameter));
    return lines.join('\n');
  }, [rollToMethod, rollValue, rollMeasureType, rollMeasurePoint, clDiameter, showAngle, angleValue, partData._pitchEnabled, partData._pitchMethod, partData._pitchRun, partData._pitchRise, partData._pitchAngle, partData._pitchSpaceType, partData._pitchSpaceValue, partData._pitchDirection, partData._pitchDevelopedDia, partData._protectivePaper, partData._protectivePaperSide, nestingCalc]);

  useEffect(() => {
    setPartData(prev => ({ ...prev, _rollingDescription: rollingDescription }));
  }, [rollingDescription]);

  // Calculate pricing: material ea + labor ea = unit price, unit price × qty = line total
  const qty = parseInt(partData.quantity) || 1;
  const materialCost = parseFloat(partData.materialTotal) || 0;
  const materialMarkup = parseFloat(partData.materialMarkupPercent) || 0;
  const materialEachRaw = Math.round(materialCost * (1 + materialMarkup / 100) * 100) / 100;
  const rounding = partData._materialRounding || 'none';
  const materialEach = rounding === 'dollar' && materialEachRaw > 0 ? Math.ceil(materialEachRaw) : rounding === 'five' && materialEachRaw > 0 ? Math.ceil(materialEachRaw / 5) * 5 : materialEachRaw;
  const laborEach = parseFloat(partData.laborTotal) || 0;
  const unitPrice = materialEach + laborEach;
  const lineTotal = Math.round(unitPrice * qty * 100) / 100;

  // Auto-update part total
  useEffect(() => {
    setPartData(prev => ({ ...prev, partTotal: lineTotal.toFixed(2) }));
  }, [lineTotal]);

  const isCustomThickness = partData.thickness === 'Custom' || (partData.thickness && !THICKNESS_OPTIONS.includes(partData.thickness) && partData.thickness !== customThickness);
  const selectedThicknessOption = THICKNESS_OPTIONS.includes(partData.thickness) ? partData.thickness : (partData.thickness ? 'Custom' : '');

  const isCustomGrade = partData.material && !gradeOptions.includes(partData.material);
  const selectedGradeOption = gradeOptions.includes(partData.material) ? partData.material : (partData.material ? 'Custom' : '');

  const sectionStyle = { gridColumn: 'span 2', borderTop: '1px solid #e0e0e0', marginTop: 8, paddingTop: 12 };
  const sectionTitle = (icon, text, color) => <h4 style={{ marginBottom: 10, color, fontSize: '0.95rem' }}>{icon} {text}</h4>;

  return (
    <>
      {/* === DIMENSIONS === */}
      <div className="form-group">
        <label className="form-label">Quantity *</label>
        <input type="number" className="form-input" value={partData.quantity} onChange={(e) => setPartData({ ...partData, quantity: e.target.value })} onFocus={(e) => e.target.select()} min="1" />
      </div>

      <div className="form-group">
        <label className="form-label">Thickness *</label>
        <select className="form-select" value={selectedThicknessOption} onChange={(e) => {
          if (e.target.value === 'Custom') {
            setPartData({ ...partData, thickness: customThickness || 'Custom' });
          } else {
            setPartData({ ...partData, thickness: e.target.value });
            setCustomThickness('');
          }
        }}>
          <option value="">Select...</option>
          {THICKNESS_OPTIONS.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
        {(selectedThicknessOption === 'Custom' || isCustomThickness) && (
          <input className="form-input" style={{ marginTop: 4 }} placeholder="Enter custom thickness" 
            value={partData.thickness === 'Custom' ? customThickness : partData.thickness}
            onChange={(e) => { setCustomThickness(e.target.value); setPartData({ ...partData, thickness: e.target.value }); }} />
        )}
      </div>

      <div className="form-group">
        <label className="form-label">Width</label>
        <input className="form-input" value={partData.width || ''} onChange={(e) => setPartData({ ...partData, width: e.target.value })} placeholder='e.g. 48"' />
      </div>

      <div className="form-group">
        <label className="form-label">Length</label>
        <input className="form-input" value={partData.length || ''} onChange={(e) => setPartData({ ...partData, length: e.target.value })} placeholder="Optional" />
      </div>

      {/* === ROLL INFO === */}
      <div style={sectionStyle}>
        {sectionTitle('🔄', 'Roll Information', '#1565c0')}
        <RollToOverride rollToMethod={rollToMethod} onMethodChange={setRollToMethod} />
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: 8, marginBottom: 8 }}>
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

        {/* Angle */}
        <div style={{ marginBottom: 8 }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontWeight: 500, fontSize: '0.9rem' }}>
            <input type="checkbox" checked={showAngle} onChange={(e) => { setShowAngle(e.target.checked); if (!e.target.checked) setAngleValue(''); }} />
            Arc Angle
          </label>
          {showAngle && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 6 }}>
              <input className="form-input" type="number" step="0.1" style={{ width: 120 }} value={angleValue} onFocus={(e) => e.target.select()} onChange={(e) => setAngleValue(e.target.value)} placeholder="Degrees" />
              <span style={{ fontSize: '0.85rem', color: '#666' }}>degrees</span>
            </div>
          )}
        </div>

        {/* Calculated Length */}
        {calcResult && (
          <div style={{ background: '#e3f2fd', padding: 12, borderRadius: 8, marginTop: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
              <span style={{ fontWeight: 600, fontSize: '0.9rem', color: '#1565c0' }}>Calculated Arc Length:</span>
              <span style={{ fontWeight: 700, fontSize: '1.05rem' }}>{calcResult.arcLength.toFixed(3)}"</span>
            </div>

            <div style={{ marginBottom: 8 }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: '0.9rem' }}>
                <input type="checkbox" checked={showTangent} onChange={(e) => { setShowTangent(e.target.checked); if (!e.target.checked) setTangentLength(''); }} />
                Add Tangents
              </label>
              {showTangent && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
                  <input className="form-input" type="number" step="0.1" style={{ width: 120 }} value={tangentLength} onFocus={(e) => e.target.select()} onChange={(e) => setTangentLength(e.target.value)} placeholder="Length each" />
                  <span style={{ fontSize: '0.85rem', color: '#666' }}>× 2 = {((parseFloat(tangentLength) || 0) * 2).toFixed(2)}"</span>
                </div>
              )}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderTop: '1px solid #bbdefb', paddingTop: 8 }}>
              <div>
                <span style={{ fontWeight: 600, fontSize: '0.9rem', color: '#1565c0' }}>Total Length:</span>
                <span style={{ fontWeight: 700, fontSize: '1.1rem', marginLeft: 8 }}>{calcResult.totalLength.toFixed(3)}"</span>
              </div>
              <button type="button" className="btn btn-sm" style={{ background: '#1565c0', color: 'white' }}
                onClick={() => {
                  const totalLen = calcResult.totalLength;
                  const widthVal = parseFloat(partData.width) || 0;
                  const autoDirection = (totalLen > 0 && widthVal > 0) 
                    ? (totalLen >= widthVal ? 'easy_way' : 'hard_way') 
                    : '';
                  setPartData(prev => ({ 
                    ...prev, 
                    length: totalLen.toFixed(2),
                    ...(autoDirection ? { rollType: autoDirection } : {})
                  }));
                  // Disable nesting if setting ring length directly
                  if (nestingEnabled) setNestingEnabled(false);
                }}>
                → Set as Ring Length
              </button>
            </div>

            {/* Complete Rings — Multiple from Stock */}
            {isCompleteRing && (
              <div style={{ borderTop: '1px solid #bbdefb', marginTop: 8, paddingTop: 8 }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontWeight: 600, fontSize: '0.9rem', color: nestingEnabled ? '#2e7d32' : '#555' }}>
                  <input type="checkbox" checked={nestingEnabled}
                    onChange={(e) => {
                      setNestingEnabled(e.target.checked);
                      if (!e.target.checked) setStockLength('');
                    }}
                    style={{ width: 16, height: 16, accentColor: '#2e7d32' }} />
                  🔗 Multiple Rings from Stock Length
                </label>
                {nestingEnabled && (
                  <div style={{ marginTop: 8 }}>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
                      {[
                        { label: "8'", val: '96' },
                        { label: "10'", val: '120' },
                        { label: "12'", val: '144' },
                        { label: "16'", val: '192' },
                        { label: "20'", val: '240' },
                        { label: "24'", val: '288' },
                      ].map(opt => (
                        <button key={opt.val} type="button"
                          onClick={() => setStockLength(opt.val)}
                          style={{
                            padding: '4px 10px', borderRadius: 4, cursor: 'pointer', fontSize: '0.8rem',
                            border: '2px solid ' + (stockLength === opt.val ? '#2e7d32' : '#ccc'),
                            background: stockLength === opt.val ? '#e8f5e9' : '#fff',
                            color: stockLength === opt.val ? '#2e7d32' : '#666',
                            fontWeight: stockLength === opt.val ? 700 : 500,
                          }}>
                          {opt.label} ({opt.val}")
                        </button>
                      ))}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: '0.8rem', color: '#666' }}>Custom:</span>
                      <input className="form-input" type="number" step="0.01" style={{ width: 100 }}
                        value={stockLength} onFocus={(e) => e.target.select()} onChange={(e) => setStockLength(e.target.value)} placeholder='e.g. 240"' />
                      <span style={{ fontSize: '0.8rem', color: '#666' }}>inches</span>
                    </div>

                    {nestingCalc && (
                      <div style={{ background: '#e8f5e9', padding: 12, borderRadius: 8, marginTop: 10, border: '1px solid #a5d6a7' }}>
                        <div style={{ fontWeight: 700, color: '#2e7d32', marginBottom: 8, fontSize: '0.9rem' }}>🔗 Ring Nesting Summary</div>
                        <div style={{ fontFamily: 'monospace', fontSize: '0.85rem', color: '#333', lineHeight: 1.8 }}>
                          <div>
                            <span style={{ color: '#888' }}>Ring circumference:</span>{' '}
                            <strong>{nestingCalc.ringLength.toFixed(2)}"</strong>
                          </div>
                          <div>
                            <span style={{ color: '#888' }}>Stock length:</span>{' '}
                            <strong>{nestingCalc.stock}"</strong>
                            <span style={{ color: '#888', marginLeft: 4 }}>({(nestingCalc.stock / 12).toFixed(1)}')</span>
                          </div>
                          <div>
                            <span style={{ color: '#888' }}>Rings per stock piece:</span>{' '}
                            <strong style={{ color: '#2e7d32', fontSize: '1rem' }}>{nestingCalc.ringsPerLength}</strong>
                            <span style={{ color: '#888', marginLeft: 8 }}>
                              (uses {nestingCalc.usedPerLength}" / waste {nestingCalc.wastePerLength}" per piece)
                            </span>
                          </div>
                          <div style={{ borderTop: '1px solid #a5d6a7', marginTop: 6, paddingTop: 6 }}>
                            <span style={{ color: '#888' }}>Rings needed:</span>{' '}
                            <strong>{parseInt(partData.quantity) || 1}</strong>
                          </div>
                          <div style={{ fontSize: '1.05rem' }}>
                            <span style={{ color: '#888' }}>Stock pieces to order:</span>{' '}
                            <strong style={{ color: '#2e7d32', fontSize: '1.15rem' }}>
                              {nestingCalc.stockLengthsNeeded} pc × {nestingCalc.stock}" ({(nestingCalc.stock / 12).toFixed(1)}')
                            </strong>
                          </div>
                          {nestingCalc.waste > 0 && (
                            <div style={{ fontSize: '0.8rem', color: '#888', marginTop: 2 }}>
                              ({nestingCalc.totalRingsFromStock} rings total, {nestingCalc.waste} extra)
                            </div>
                          )}
                        </div>
                        <button type="button" className="btn btn-sm" style={{ background: '#2e7d32', color: 'white', marginTop: 10 }}
                          onClick={() => {
                            const widthVal = parseFloat(partData.width) || 0;
                            const autoDirection = (nestingCalc.stock > 0 && widthVal > 0) 
                              ? (nestingCalc.stock >= widthVal ? 'easy_way' : 'hard_way') 
                              : '';
                            setPartData(prev => ({ 
                              ...prev, 
                              length: nestingCalc.stock.toString(),
                              ...(autoDirection ? { rollType: autoDirection } : {})
                            }));
                          }}>
                          → Set Stock Length ({nestingCalc.stock}") as Material Length
                        </button>
                      </div>
                    )}

                    {nestingEnabled && stockLength && !nestingCalc && calcResult && (
                      <div style={{ background: '#fff3e0', padding: 8, borderRadius: 6, marginTop: 8, fontSize: '0.8rem', color: '#e65100' }}>
                        ⚠️ Stock length ({stockLength}") is shorter than ring circumference ({calcResult.totalLength.toFixed(2)}") — can't nest
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* === EASY/HARD WAY & SHAPE === */}
      <div style={{ ...sectionStyle, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <div className="form-group">
          <label className="form-label">
            Roll Direction
          </label>
          <select
            className="form-select"
            value={partData.rollType || ''}
            onChange={(e) => setPartData({ ...partData, rollType: e.target.value })}
          >
            <option value="">Select...</option>
            <option value="easy_way">Easy Way</option>
            <option value="hard_way">Hard Way</option>
          </select>
          {partData.rollType && calcResult && (
            <div style={{ fontSize: '0.75rem', color: '#1565c0', marginTop: 4 }}>
              ↑ Auto-set: layout {calcResult.totalLength.toFixed(1)}" vs width {partData.width || '—'}
            </div>
          )}
        </div>
        <div className="form-group">
          <label className="form-label">Custom Shape (PDF)</label>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 12px', border: '1px dashed #bbb', borderRadius: 6, cursor: 'pointer', fontSize: '0.85rem', color: '#666' }}>
            <Upload size={16} /> Upload drawing...
            <input type="file" accept=".pdf,.png,.jpg,.jpeg" style={{ display: 'none' }} onChange={(e) => {
              if (e.target.files[0]) { const file = e.target.files[0]; setPartData({ ...partData, _shapeFile: file, _shapeFileName: file.name }); }
            }} />
          </label>
          {(partData._shapeFile || partData._shapeFileName) && <div style={{ fontSize: '0.8rem', color: '#2e7d32', marginTop: 2 }}>📎 {partData._shapeFile?.name || partData._shapeFileName} {!partData._shapeFile && partData._shapeFileName && <span style={{ color: '#999' }}>(saved)</span>}</div>}
        </div>
      </div>

      {/* === PITCH / HELIX === */}
      <div style={sectionStyle}>
        <PitchSection partData={partData} setPartData={setPartData} clDiameter={clDiameter} inputDiameter={rollMeasureType === 'radius' ? (parseFloat(rollValue) || 0) * 2 : (parseFloat(rollValue) || 0)} profileOD={thicknessToDecimal(partData.thickness)} />
      </div>

      {/* === PROTECTIVE PAPER === */}
      <div style={sectionStyle}>
        <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
          <input type="checkbox" checked={partData._protectivePaper || false}
            onChange={(e) => setPartData({ ...partData, _protectivePaper: e.target.checked, ...(!e.target.checked ? { _protectivePaperSide: '' } : {}) })}
            style={{ width: 18, height: 18, accentColor: '#1565c0' }} />
          <span style={{ fontWeight: 600, color: partData._protectivePaper ? '#1565c0' : '#555' }}>
            📄 Protective Paper
          </span>
        </label>
        {partData._protectivePaper && (
          <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
            {[
              { key: 'inside', label: 'Inside', icon: '⬇️' },
              { key: 'outside', label: 'Outside', icon: '⬆️' },
              { key: 'double', label: 'Double Sided', icon: '↕️' },
            ].map(opt => (
              <button key={opt.key} type="button"
                onClick={() => setPartData({ ...partData, _protectivePaperSide: opt.key })}
                style={{
                  flex: 1, padding: '8px 12px', borderRadius: 6, cursor: 'pointer',
                  border: '2px solid ' + (partData._protectivePaperSide === opt.key ? '#1565c0' : '#ccc'),
                  background: partData._protectivePaperSide === opt.key ? '#e3f2fd' : '#fff',
                  color: partData._protectivePaperSide === opt.key ? '#1565c0' : '#666',
                  fontWeight: partData._protectivePaperSide === opt.key ? 700 : 500,
                  fontSize: '0.85rem'
                }}>
                {opt.icon} {opt.label}
              </button>
            ))}
          </div>
        )}
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
              if (e.target.value === 'Custom') {
                setPartData({ ...partData, material: customGrade || 'Custom' });
              } else {
                setPartData({ ...partData, material: e.target.value });
                setCustomGrade('');
              }
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

        {/* Vendor Selector */}
        {partData.materialSource === 'we_order' && (
          <div className="form-group" style={{ position: 'relative', marginTop: 8 }}>
            <label className="form-label">Vendor</label>
            <input className="form-input"
              value={partData._vendorSearch !== undefined ? partData._vendorSearch : (partData.vendor?.name || partData.supplierName || '')}
              onChange={async (e) => {
                const value = e.target.value;
                setPartData({ ...partData, _vendorSearch: value });
                if (value.length >= 1) {
                  try { const res = await searchVendors(value); setVendorSuggestions(res.data.data || []); setShowVendorSuggestions(true); } catch { setVendorSuggestions([]); }
                } else {
                  setPartData({ ...partData, _vendorSearch: value, vendorId: null, supplierName: '' }); setVendorSuggestions([]); setShowVendorSuggestions(false);
                }
              }}
              onFocus={async () => { try { const res = await searchVendors(''); setVendorSuggestions(res.data.data || []); setShowVendorSuggestions(true); } catch {} }}
              onBlur={() => setTimeout(() => setShowVendorSuggestions(false), 200)}
              placeholder="Search or add vendor..." autoComplete="off"
            />
            {showVendorSuggestions && (
              <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 100, background: 'white', border: '1px solid #ddd', borderRadius: 4, maxHeight: 200, overflowY: 'auto', boxShadow: '0 4px 12px rgba(0,0,0,0.15)' }}>
                {vendorSuggestions.map(v => (
                  <div key={v.id} style={{ padding: '8px 12px', cursor: 'pointer', borderBottom: '1px solid #eee' }}
                    onMouseDown={() => { setPartData({ ...partData, vendorId: v.id, supplierName: v.name, _vendorSearch: undefined }); setShowVendorSuggestions(false); }}>
                    <strong>{v.name}</strong>
                    {v.contactPhone && <span style={{ fontSize: '0.8rem', color: '#666', marginLeft: 8 }}>{v.contactPhone}</span>}
                  </div>
                ))}
                {partData._vendorSearch && partData._vendorSearch.length >= 2 && !vendorSuggestions.some(v => v.name.toLowerCase() === (partData._vendorSearch || '').toLowerCase()) && (
                  <div style={{ padding: '8px 12px', cursor: 'pointer', background: '#e8f5e9', color: '#2e7d32', fontWeight: 600 }}
                    onMouseDown={async () => {
                      try {
                        const resp = await createVendor({ name: partData._vendorSearch });
                        if (resp.data.data) { setPartData({ ...partData, vendorId: resp.data.data.id, supplierName: resp.data.data.name, _vendorSearch: undefined }); showMessage(`Vendor "${resp.data.data.name}" created`); }
                      } catch { setError('Failed to create vendor'); }
                      setShowVendorSuggestions(false);
                    }}>
                    + Add "{partData._vendorSearch}" as new vendor
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Material Description for email */}
        <div className="form-group" style={{ marginTop: 12 }}>
          <label className="form-label">Material Description (for ordering)</label>
          <textarea className="form-textarea" value={partData.materialDescription || ''} onChange={(e) => setPartData({ ...partData, materialDescription: e.target.value })} rows={2}
            style={{ fontFamily: 'monospace', fontSize: '0.9rem' }} />
          <div style={{ fontSize: '0.75rem', color: '#999', marginTop: 2 }}>Auto-generated from dimensions — edit as needed for supplier email</div>
        </div>
      </div>

      {/* === PRICING === */}
      <div style={sectionStyle}>
        {sectionTitle('💰', 'Pricing', '#1976d2')}
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 2fr', gap: 12 }}>
          <div className="form-group">
            <label className="form-label">Material Cost (each)</label>
            <input type="number" step="any" className="form-input" value={partData.materialTotal || ''} onFocus={(e) => e.target.select()} onChange={(e) => setPartData({ ...partData, materialTotal: e.target.value })} placeholder="0.00" />
          </div>
          <div className="form-group">
            <label className="form-label">Markup %</label>
            <input type="number" step="1" className="form-input" value={partData.materialMarkupPercent ?? 20} onFocus={(e) => e.target.select()} onChange={(e) => setPartData({ ...partData, materialMarkupPercent: e.target.value })} placeholder="20" />
          </div>
          <div className="form-group">
            <label className="form-label">Labor (each)</label>
            <input type="number" step="any" className="form-input" value={partData.laborTotal || ''} onFocus={(e) => e.target.select()} onChange={(e) => setPartData({ ...partData, laborTotal: e.target.value })} placeholder="0.00" />
          </div>
        </div>

        {/* Pricing Summary */}
        <div style={{ background: '#f0f7ff', padding: 12, borderRadius: 8, marginTop: 12, border: '1px solid #bbdefb' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', fontSize: '0.9rem', color: '#555' }}>
            <span>Material Cost (ea)</span>
            <span>${materialCost.toFixed(2)}</span>
          </div>
          {materialMarkup > 0 && <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', fontSize: '0.85rem', color: '#e65100' }}>
            <span>+ Markup ({materialMarkup}%)</span>
            <span>${(materialEachRaw - materialCost).toFixed(2)}</span>
          </div>}
          {materialMarkup > 0 && <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', fontSize: '0.9rem', color: '#555', fontWeight: 600 }}>
            <span>Material w/ Markup</span>
            <span>{materialEachRaw !== materialEach && <span style={{ textDecoration: 'line-through', color: '#999', marginRight: 4, fontSize: '0.8rem' }}>${materialEachRaw.toFixed(2)}</span>}${materialEach.toFixed(2)}</span>
          </div>}
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
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', fontSize: '0.9rem', color: '#555' }}>
            <span>Labor (ea)</span>
            <span>${laborEach.toFixed(2)}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderTop: '1px solid #90caf9', marginTop: 4 }}>
            <strong>Unit Price</strong>
            <strong style={{ color: '#1976d2' }}>${unitPrice.toFixed(2)}</strong>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderTop: '1px solid #90caf9' }}>
            <strong>Line Total ({qty} × ${unitPrice.toFixed(2)})</strong>
            <strong style={{ fontSize: '1.15rem', color: '#2e7d32' }}>${lineTotal.toFixed(2)}</strong>
          </div>
        </div>
      </div>

      {/* === TRACKING (Client Part # / Heat #) — moved to bottom === */}
      <div style={sectionStyle}>
        {sectionTitle('🏷️', 'Tracking', '#616161')}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div className="form-group">
            <label className="form-label">Client Part Number</label>
            <input type="text" className="form-input" value={partData.clientPartNumber || ''} onChange={(e) => setPartData({ ...partData, clientPartNumber: e.target.value })} placeholder="Optional" />
          </div>
          <div className="form-group">
            <label className="form-label">Heat Number</label>
            <input type="text" className="form-input" value={partData.heatNumber || ''} onChange={(e) => setPartData({ ...partData, heatNumber: e.target.value })} placeholder="Optional" />
          </div>
        </div>
      </div>
    </>
  );
}
