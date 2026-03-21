import React, { useState, useEffect, useMemo } from 'react';
import { searchVendors, getSettings, createVendor } from '../services/api';
import HeatNumberInput from './HeatNumberInput';

const THICKNESS_OPTIONS = [
  '16 ga', '14 ga', '12 ga', '11 ga', '10 ga', '7 ga',
  '1/8"', '3/16"', '1/4"', '5/16"', '3/8"', '1/2"', '5/8"', '3/4"', '1"',
  '1-1/4"', '1-1/2"', '2"', '2-1/2"', '3"', 'Custom'
];

const SHAPE_OPTIONS = [
  { value: 'round', label: '⭕ Round Plate', desc: 'Solid circular plate' },
  { value: 'donut', label: '🍩 Donut', desc: 'Ring — outer and inner diameter' },
  { value: 'custom', label: '📐 Custom Shape', desc: 'Per DXF or drawing' }
];

const DEFAULT_GRADE_OPTIONS = ['A36', 'A572 Gr 50', '304 S/S', '316 S/S', 'AR400', 'Custom'];

export default function ShapedPlateForm({ partData, setPartData, vendorSuggestions, setVendorSuggestions, showVendorSuggestions, setShowVendorSuggestions, showMessage, setError }) {
  const [customThickness, setCustomThickness] = useState('');
  const [customGrade, setCustomGrade] = useState('');
  const [gradeOptions, setGradeOptions] = useState(DEFAULT_GRADE_OPTIONS);

  useEffect(() => {
    const loadGrades = async () => {
      try {
        const resp = await getSettings('material_grades');
        if (resp.data.data?.value) {
          const grades = resp.data.data.value.filter(g => g.partTypes?.includes('shaped_plate') || g.partTypes?.includes('plate_roll'));
          if (grades.length > 0) setGradeOptions([...grades.map(g => g.name), 'Custom']);
        }
      } catch {}
    };
    loadGrades();
  }, []);

  // Default shape to round if not set
  useEffect(() => {
    if (!partData._shapeType) {
      setPartData(prev => ({ ...prev, _shapeType: 'round' }));
    }
  }, []);

  const shape = partData._shapeType || 'round';

  // Build material description
  const materialDescription = useMemo(() => {
    const qty = parseInt(partData.quantity) || 1;
    const parts = [`${qty}pc:`];
    if (partData.thickness) parts.push(partData.thickness);
    if (partData.material) parts.push(partData.material);
    if (partData._materialOrigin) parts.push(partData._materialOrigin);

    if (shape === 'round') {
      if (partData.outerDiameter) parts.push(`${partData.outerDiameter}" OD Round Plate`);
      else parts.push('Round Plate');
    } else if (shape === 'donut') {
      const od = partData.outerDiameter ? `${partData.outerDiameter}" OD` : '';
      const id = partData._innerDiameter ? `${partData._innerDiameter}" ID` : '';
      parts.push(`${od} x ${id} Donut`);
      if (partData._donutPurpose === 'cylinder') parts.push('(For Cylinder)');
      if (partData._donutPurpose === 'head') parts.push('(For Elliptical Head)');
    } else {
      parts.push('Custom Shape');
      if (partData._customDescription) parts.push(`— ${partData._customDescription}`);
    }

    return parts.join(' ');
  }, [partData.thickness, partData.material, partData._materialOrigin, partData.outerDiameter, partData._innerDiameter, partData._shapeType, partData._donutPurpose, partData._customDescription, partData.quantity, shape]);

  useEffect(() => {
    setPartData(prev => ({ ...prev, materialDescription, _materialDescription: materialDescription }));
  }, [materialDescription]);

  // Pricing calculations
  const qty = parseInt(partData.quantity) || 1;
  const materialCost = parseFloat(partData.materialTotal) || 0;
  const materialMarkup = parseFloat(partData.materialMarkupPercent) || 0;
  const materialEachRaw = Math.round(materialCost * (1 + materialMarkup / 100) * 100) / 100;
  const rounding = partData._materialRounding || 'none';
  const materialEach = rounding === 'dollar' && materialEachRaw > 0 ? Math.ceil(materialEachRaw) : rounding === 'five' && materialEachRaw > 0 ? Math.ceil(materialEachRaw / 5) * 5 : materialEachRaw;
  const laborEach = parseFloat(partData.laborTotal) || 0;
  const unitPrice = materialEach + laborEach;
  const lineTotal = Math.round(unitPrice * qty * 100) / 100;

  useEffect(() => {
    setPartData(prev => ({ ...prev, partTotal: lineTotal.toFixed(2) }));
  }, [lineTotal]);

  const isCustomThickness = partData.thickness && !THICKNESS_OPTIONS.includes(partData.thickness) && partData.thickness !== 'Custom';
  const selectedThicknessOption = THICKNESS_OPTIONS.includes(partData.thickness) ? partData.thickness : (partData.thickness ? 'Custom' : '');
  const isCustomGrade = partData.material && !gradeOptions.includes(partData.material);
  const selectedGradeOption = gradeOptions.includes(partData.material) ? partData.material : (partData.material ? 'Custom' : '');

  const sectionStyle = { gridColumn: 'span 2', borderTop: '1px solid #e0e0e0', marginTop: 8, paddingTop: 12 };
  const sectionTitle = (icon, text, color) => <h4 style={{ marginBottom: 10, color, fontSize: '0.95rem' }}>{icon} {text}</h4>;

  return (
    <>
      {/* === SHAPE PICKER === */}
      <div style={{ gridColumn: 'span 2', marginBottom: 8 }}>
        <label className="form-label" style={{ marginBottom: 8 }}>Shape *</label>
        <div style={{ display: 'flex', gap: 8 }}>
          {SHAPE_OPTIONS.map(opt => (
            <button key={opt.value} type="button" onClick={() => setPartData(prev => ({ ...prev, _shapeType: opt.value }))}
              style={{
                flex: 1, padding: '12px 8px', borderRadius: 8, cursor: 'pointer', textAlign: 'center',
                border: shape === opt.value ? '2px solid #1976d2' : '2px solid #e0e0e0',
                background: shape === opt.value ? '#e3f2fd' : '#fafafa',
                transition: 'all 0.15s'
              }}>
              <div style={{ fontSize: '1.3rem', marginBottom: 4 }}>{opt.label.split(' ')[0]}</div>
              <div style={{ fontSize: '0.85rem', fontWeight: shape === opt.value ? 700 : 500, color: shape === opt.value ? '#1976d2' : '#333' }}>
                {opt.label.split(' ').slice(1).join(' ')}
              </div>
              <div style={{ fontSize: '0.7rem', color: '#888', marginTop: 2 }}>{opt.desc}</div>
            </button>
          ))}
        </div>
      </div>

      {/* === DIMENSIONS === */}
      <div className="form-group">
        <label className="form-label">Quantity *</label>
        <input type="number" className="form-input" value={partData.quantity}
          onChange={(e) => setPartData({ ...partData, quantity: e.target.value })} onFocus={(e) => e.target.select()} min="1" />
      </div>

      <div className="form-group">
        <label className="form-label">Thickness *</label>
        <select className="form-select" value={selectedThicknessOption}
          onChange={(e) => {
            if (e.target.value === 'Custom') setPartData({ ...partData, thickness: customThickness || '' });
            else { setPartData({ ...partData, thickness: e.target.value }); setCustomThickness(''); }
          }}>
          <option value="">Select...</option>
          {THICKNESS_OPTIONS.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
        {(selectedThicknessOption === 'Custom' || isCustomThickness) && (
          <input className="form-input" style={{ marginTop: 4 }} placeholder='e.g. 7/8"'
            value={isCustomThickness ? partData.thickness : customThickness}
            onChange={(e) => { setCustomThickness(e.target.value); setPartData({ ...partData, thickness: e.target.value }); }} />
        )}
      </div>

      {/* Shape-specific fields */}
      {(shape === 'round' || shape === 'donut') && (
        <div className="form-group">
          <label className="form-label">Outer Diameter (OD) *</label>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <input type="number" step="any" className="form-input" value={partData.outerDiameter || ''}
              onChange={(e) => setPartData({ ...partData, outerDiameter: e.target.value })} placeholder="e.g. 24" />
            <span style={{ color: '#888', fontSize: '0.9rem', whiteSpace: 'nowrap' }}>inches</span>
          </div>
        </div>
      )}

      {shape === 'donut' && (
        <>
          <div className="form-group">
            <label className="form-label">Inner Diameter (ID) *</label>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <input type="number" step="any" className="form-input" value={partData._innerDiameter || ''}
                onChange={(e) => setPartData({ ...partData, _innerDiameter: e.target.value })} placeholder="e.g. 12" />
              <span style={{ color: '#888', fontSize: '0.9rem', whiteSpace: 'nowrap' }}>inches</span>
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">Formed To Fit</label>
            <select className="form-select" value={partData._donutPurpose || ''}
              onChange={(e) => setPartData({ ...partData, _donutPurpose: e.target.value })}>
              <option value="">Flat (no forming)</option>
              <option value="cylinder">For Cylinder</option>
              <option value="head">For Elliptical Head</option>
            </select>
            {partData._donutPurpose === 'cylinder' && (
              <div style={{ marginTop: 6, padding: 8, background: '#e3f2fd', borderRadius: 6, fontSize: '0.8rem', color: '#1565c0' }}>
                Donut will be formed to match the curvature of a cylinder
              </div>
            )}
            {partData._donutPurpose === 'head' && (
              <div style={{ marginTop: 6, padding: 8, background: '#fce4ec', borderRadius: 6, fontSize: '0.8rem', color: '#c62828' }}>
                Donut will be formed to match an elliptical head profile
              </div>
            )}
          </div>
        </>
      )}

      {shape === 'custom' && (
        <div className="form-group" style={{ gridColumn: 'span 2' }}>
          <label className="form-label">Shape Description *</label>
          <textarea className="form-textarea" value={partData._customDescription || ''}
            onChange={(e) => setPartData({ ...partData, _customDescription: e.target.value })}
            rows={2} placeholder="Describe the shape — e.g. oval, kidney shape, cut-to-profile per DXF" />
          <div style={{ fontSize: '0.75rem', color: '#888', marginTop: 4 }}>
            📐 Upload a DXF/STEP file in the Material section below for custom shapes
          </div>
        </div>
      )}

      {shape === 'custom' && (
        <>
          <div className="form-group">
            <label className="form-label">Width / X Dimension</label>
            <input className="form-input" value={partData.width || ''}
              onChange={(e) => setPartData({ ...partData, width: e.target.value })} placeholder='e.g. 24"' />
          </div>
          <div className="form-group">
            <label className="form-label">Length / Y Dimension</label>
            <input className="form-input" value={partData.length || ''}
              onChange={(e) => setPartData({ ...partData, length: e.target.value })} placeholder='e.g. 36"' />
          </div>
        </>
      )}

      {/* === MATERIAL === */}
      <div style={sectionStyle}>
        {sectionTitle('📦', 'Material', '#e65100')}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
          <div className="form-group">
            <label className="form-label">Grade *</label>
            <select className="form-select" value={selectedGradeOption}
              onChange={(e) => {
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
            <select className="form-select" value={partData._materialOrigin || ''}
              onChange={(e) => setPartData({ ...partData, _materialOrigin: e.target.value })}>
              <option value="">Select...</option>
              <option value="Domestic">Domestic</option>
              <option value="Import">Import</option>
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Material Source</label>
            <select className="form-select" value={partData.materialSource || 'customer_supplied'}
              onChange={(e) => setPartData({ ...partData, materialSource: e.target.value })}>
              <option value="customer_supplied">Client Supplies</option>
              <option value="we_order">We Order</option>
              <option value="in_stock">In Stock (We Supply)</option>
            </select>
          </div>
        </div>
        {partData.materialSource === 'we_order' && (
          <>
          <div className="form-group" style={{ position: 'relative', marginTop: 8 }}>
            <label className="form-label">Vendor</label>
            <input className="form-input" value={partData._vendorSearch !== undefined ? partData._vendorSearch : (partData.supplierName || '')}
              onChange={async (e) => { const value = e.target.value; setPartData({ ...partData, _vendorSearch: value }); if (value.length >= 1) { try { const res = await searchVendors(value); setVendorSuggestions(res.data.data || []); setShowVendorSuggestions(true); } catch { setVendorSuggestions([]); } } else { setPartData({ ...partData, _vendorSearch: value, vendorId: null, supplierName: '' }); setVendorSuggestions([]); setShowVendorSuggestions(false); } }}
              onFocus={async () => { try { const res = await searchVendors(''); setVendorSuggestions(res.data.data || []); setShowVendorSuggestions(true); } catch {} }}
              onBlur={() => setTimeout(() => setShowVendorSuggestions(false), 200)} placeholder="Search or add vendor..." autoComplete="off" />
            {showVendorSuggestions && (
              <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 100, background: 'white', border: '1px solid #ddd', borderRadius: 4, maxHeight: 200, overflowY: 'auto', boxShadow: '0 4px 12px rgba(0,0,0,0.15)' }}>
                {vendorSuggestions.map(v => (<div key={v.id} style={{ padding: '8px 12px', cursor: 'pointer', borderBottom: '1px solid #eee' }} onMouseDown={() => { setPartData({ ...partData, vendorId: v.id, supplierName: v.name, _vendorSearch: undefined }); setShowVendorSuggestions(false); }}><strong>{v.name}</strong></div>))}
                {partData._vendorSearch && partData._vendorSearch.length >= 2 && !vendorSuggestions.some(v => v.name.toLowerCase() === (partData._vendorSearch || '').toLowerCase()) && (
                  <div style={{ padding: '8px 12px', cursor: 'pointer', background: '#e8f5e9', color: '#2e7d32', fontWeight: 600 }}
                    onMouseDown={async () => { try { const resp = await createVendor({ name: partData._vendorSearch }); if (resp.data.data) { setPartData({ ...partData, vendorId: resp.data.data.id, supplierName: resp.data.data.name, _vendorSearch: undefined }); showMessage(`Vendor "${resp.data.data.name}" created`); } } catch { setError('Failed to create vendor'); } setShowVendorSuggestions(false); }}>+ Add "{partData._vendorSearch}" as new vendor</div>
                )}
              </div>
            )}
          </div>
          <div className="form-group" style={{ marginTop: 8 }}>
            <label className="form-label">Vendor Estimate #</label>
            <input className="form-input" value={partData.vendorEstimateNumber || ''}
              onChange={(e) => setPartData({ ...partData, vendorEstimateNumber: e.target.value })}
              placeholder="Optional" />
          </div>
          </>
        )}
        <div className="form-group" style={{ marginTop: 12 }}>
          <label className="form-label">Material Description (for ordering)</label>
          <textarea className="form-textarea" value={partData.materialDescription || ''}
            onChange={(e) => setPartData({ ...partData, materialDescription: e.target.value })} rows={2}
            style={{ fontFamily: 'monospace', fontSize: '0.9rem' }} />
          <div style={{ fontSize: '0.75rem', color: '#999', marginTop: 2 }}>Auto-generated — edit as needed</div>
        </div>
      </div>

      {/* === PRICING === */}
      <div style={sectionStyle}>
        {sectionTitle('💰', 'Pricing', '#1976d2')}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
          <div className="form-group"><label className="form-label">Material Cost (each)</label>
            <input type="number" step="any" className="form-input" value={partData.materialTotal || ''}
              onFocus={(e) => e.target.select()} onChange={(e) => setPartData({ ...partData, materialTotal: e.target.value })} placeholder="0.00" /></div>
          <div className="form-group"><label className="form-label">Markup %</label>
            <input type="number" step="1" className="form-input" value={partData.materialMarkupPercent ?? 20}
              onFocus={(e) => e.target.select()} onChange={(e) => setPartData({ ...partData, materialMarkupPercent: e.target.value })} placeholder="20" /></div>
          <div className="form-group"><label className="form-label">Labor (each)</label>
            <input type="number" step="any" className="form-input" value={partData.laborTotal || ''}
              onFocus={(e) => e.target.select()} onChange={(e) => setPartData({ ...partData, laborTotal: e.target.value })} placeholder="0.00" /></div>
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
          <div className="form-group"><label className="form-label">Client Part Number</label>
            <input type="text" className="form-input" value={partData.clientPartNumber || ''}
              onChange={(e) => setPartData({ ...partData, clientPartNumber: e.target.value })} placeholder="Optional" /></div>
          <HeatNumberInput partData={partData} setPartData={setPartData} />
        </div>
      </div>

      {/* === SPECIAL INSTRUCTIONS === */}
      <div style={sectionStyle}>
        <div className="form-group">
          <label className="form-label">Special Instructions</label>
          <textarea className="form-textarea" value={partData.specialInstructions || ''}
            onChange={(e) => setPartData({ ...partData, specialInstructions: e.target.value })}
            rows={2} placeholder="Tolerances, finish requirements, etc." />
        </div>
      </div>
    </>
  );
}
