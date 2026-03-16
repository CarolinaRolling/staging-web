import React, { useState } from 'react';

/**
 * Heat Number Input with optional multi-heat breakdown.
 * Shows a single heat input by default. Toggle to multi-heat mode
 * to enter multiple heat#/qty pairs.
 * 
 * Props:
 *   partData - the part form data object
 *   setPartData - setter for partData
 *   gridColumn - optional CSS gridColumn (e.g. 'span 2' for full width in multi mode)
 */
export default function HeatNumberInput({ partData, setPartData, gridColumn }) {
  const breakdown = partData.heatBreakdown || [];
  const [multiMode, setMultiMode] = useState(breakdown.length > 0);

  const toggleMulti = () => {
    if (!multiMode) {
      // Switch to multi — seed from existing single heat
      const initial = partData.heatNumber
        ? [{ heat: partData.heatNumber, qty: partData.quantity || 1 }]
        : [{ heat: '', qty: '' }];
      setPartData({ ...partData, heatBreakdown: initial, heatNumber: '' });
      setMultiMode(true);
    } else {
      // Switch back to single — take first heat
      const first = breakdown[0]?.heat || '';
      setPartData({ ...partData, heatBreakdown: null, heatNumber: first });
      setMultiMode(false);
    }
  };

  const updateRow = (index, field, value) => {
    const updated = [...breakdown];
    updated[index] = { ...updated[index], [field]: field === 'qty' ? value.replace(/[^0-9]/g, '') : value };
    setPartData({ ...partData, heatBreakdown: updated });
  };

  const addRow = () => {
    setPartData({ ...partData, heatBreakdown: [...breakdown, { heat: '', qty: '' }] });
  };

  const removeRow = (index) => {
    const updated = breakdown.filter((_, i) => i !== index);
    if (updated.length === 0) {
      setPartData({ ...partData, heatBreakdown: null, heatNumber: '' });
      setMultiMode(false);
    } else {
      setPartData({ ...partData, heatBreakdown: updated });
    }
  };

  // Single heat mode
  if (!multiMode) {
    return (
      <div className="form-group" style={gridColumn ? { gridColumn } : {}}>
        <label className="form-label" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          Heat Number
          <button type="button" onClick={toggleMulti}
            style={{ background: 'none', border: 'none', color: '#795548', fontSize: '0.75rem', cursor: 'pointer', fontWeight: 600, padding: 0 }}>
            + Multiple Heats
          </button>
        </label>
        <input type="text" className="form-input" value={partData.heatNumber || ''} 
          onChange={(e) => setPartData({ ...partData, heatNumber: e.target.value })} 
          placeholder="Optional" />
      </div>
    );
  }

  // Multi-heat mode
  const totalQty = breakdown.reduce((s, r) => s + (parseInt(r.qty) || 0), 0);
  const partQty = parseInt(partData.quantity) || 1;
  const qtyMatch = totalQty === partQty;

  return (
    <div className="form-group" style={{ gridColumn: gridColumn || 'span 2' }}>
      <label className="form-label" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span>🔥 Heat Numbers ({breakdown.length})</span>
        <button type="button" onClick={toggleMulti}
          style={{ background: 'none', border: 'none', color: '#795548', fontSize: '0.75rem', cursor: 'pointer', fontWeight: 600, padding: 0 }}>
          ← Single Heat
        </button>
      </label>
      
      <div style={{ background: '#fff8f0', border: '1px solid #ffe0b2', borderRadius: 8, padding: 12 }}>
        {/* Header */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 80px 32px', gap: 8, marginBottom: 6 }}>
          <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#795548' }}>Heat #</span>
          <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#795548' }}>Qty</span>
          <span></span>
        </div>

        {breakdown.map((row, i) => (
          <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 80px 32px', gap: 8, marginBottom: 6 }}>
            <input type="text" className="form-input" value={row.heat || ''} 
              onChange={(e) => updateRow(i, 'heat', e.target.value)}
              placeholder="e.g. ER34" style={{ padding: '4px 8px', fontSize: '0.9rem' }} />
            <input type="text" inputMode="numeric" className="form-input" value={row.qty || ''} 
              onChange={(e) => updateRow(i, 'qty', e.target.value)}
              placeholder="#" style={{ padding: '4px 8px', fontSize: '0.9rem', textAlign: 'center' }} />
            <button type="button" onClick={() => removeRow(i)}
              style={{ background: 'none', border: 'none', color: '#c62828', cursor: 'pointer', fontSize: '1.1rem', padding: 0, lineHeight: 1 }}>
              ✕
            </button>
          </div>
        ))}

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 }}>
          <button type="button" onClick={addRow}
            style={{ background: 'none', border: 'none', color: '#795548', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 600, padding: 0 }}>
            + Add Heat
          </button>
          {breakdown.some(r => r.heat) && (
            <span style={{ fontSize: '0.8rem', fontWeight: 600, color: qtyMatch ? '#2e7d32' : '#e65100' }}>
              Total: {totalQty} / {partQty} pcs {!qtyMatch && '⚠️'}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
