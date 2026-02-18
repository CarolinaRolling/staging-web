import React, { useState, useEffect, useMemo } from 'react';
import { getSettings } from '../services/api';

export default function ShopRateForm({ partData, setPartData }) {
  const [shopRate, setShopRate] = useState(0);

  // Load default labor rate from settings
  useEffect(() => {
    (async () => {
      try {
        const res = await getSettings('tax_settings');
        if (res.data?.data?.value) {
          setShopRate(parseFloat(res.data.data.value.defaultLaborRate) || 125);
        }
      } catch (e) { setShopRate(125); }
    })();
  }, []);

  // Sync rate into partData when loaded
  useEffect(() => {
    if (shopRate > 0 && !partData._shopRate) {
      setPartData(prev => ({ ...prev, _shopRate: shopRate }));
    }
  }, [shopRate]);

  const rate = parseFloat(partData._shopRate) || shopRate || 125;
  const hours = parseFloat(partData._shopHours) || 0;
  const total = rate * hours;

  // Auto-update pricing
  useEffect(() => {
    const desc = partData._shopDescription || '';
    const materialDesc = `Shop Rate: ${hours > 0 ? hours + ' hr' + (hours !== 1 ? 's' : '') : ''} @ $${rate.toFixed(2)}/hr${desc ? ' — ' + desc : ''}`;
    setPartData(prev => ({
      ...prev,
      laborTotal: total.toFixed(2),
      partTotal: total.toFixed(2),
      materialTotal: '0',
      materialDescription: materialDesc,
      _materialDescription: materialDesc,
      _rollingDescription: 'Shop Rate — pricing based on estimated hours',
      quantity: 1
    }));
  }, [rate, hours, partData._shopDescription]);

  const sectionStyle = { padding: '16px 0', borderBottom: '1px solid #eee' };
  const sectionTitle = (icon, text, color) => (
    <h4 style={{ marginBottom: 10, color, fontSize: '0.95rem' }}>{icon} {text}</h4>
  );

  return (
    <>
      {/* Description */}
      <div className="form-group">
        <label className="form-label">Job Description *</label>
        <textarea className="form-textarea" rows={3}
          value={partData._shopDescription || ''}
          onChange={(e) => setPartData({ ...partData, _shopDescription: e.target.value })}
          placeholder="e.g. Flatten warped plate, art project fabrication, custom repair work..." />
      </div>

      {/* Hours & Rate */}
      <div style={sectionStyle}>
        {sectionTitle('⏱️', 'Estimated Hours & Rate', '#e65100')}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div className="form-group">
            <label className="form-label">Estimated Hours *</label>
            <input type="number" step="0.25" min="0" className="form-input"
              value={partData._shopHours || ''}
              onFocus={(e) => e.target.select()} onChange={(e) => setPartData({ ...partData, _shopHours: e.target.value })}
              placeholder="e.g. 2.5" />
          </div>
          <div className="form-group">
            <label className="form-label">Shop Rate ($/hr)</label>
            <input type="number" step="1" className="form-input"
              value={partData._shopRate || rate}
              onFocus={(e) => e.target.select()} onChange={(e) => setPartData({ ...partData, _shopRate: e.target.value })}
              placeholder="125" />
            <div style={{ fontSize: '0.7rem', color: '#999', marginTop: 2 }}>From default labor rate in admin settings</div>
          </div>
        </div>

        {/* Pricing Summary */}
        {hours > 0 && (
          <div style={{ background: '#fff3e0', padding: 12, borderRadius: 8, marginTop: 12, border: '1px solid #ffcc80' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', fontSize: '0.9rem', color: '#555' }}>
              <span>Rate</span>
              <span>${rate.toFixed(2)}/hr</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', fontSize: '0.9rem', color: '#555' }}>
              <span>Estimated Hours</span>
              <span>{hours} hr{hours !== 1 ? 's' : ''}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderTop: '1px solid #ffcc80', marginTop: 4 }}>
              <strong>Estimated Total</strong>
              <strong style={{ fontSize: '1.15rem', color: '#e65100' }}>${total.toFixed(2)}</strong>
            </div>
          </div>
        )}
      </div>

      {/* Special Instructions */}
      <div className="form-group">
        <label className="form-label">Special Instructions</label>
        <textarea className="form-textarea" rows={2}
          value={partData.specialInstructions || ''}
          onChange={(e) => setPartData({ ...partData, specialInstructions: e.target.value })}
          placeholder="Any additional notes..." />
      </div>

      {/* File Upload */}
      <div className="form-group">
        <label className="form-label">Reference File (print/drawing)</label>
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 12px', border: '1px dashed #bbb', borderRadius: 6, cursor: 'pointer', fontSize: '0.85rem', color: '#666' }}>
          📎 Upload file...
          <input type="file" accept=".pdf,.png,.jpg,.jpeg" style={{ display: 'none' }}
            onChange={(e) => { if (e.target.files[0]) { const file = e.target.files[0]; setPartData({ ...partData, _shapeFile: file, _shapeFileName: file.name }); } }} />
        </label>
        {(partData._shapeFile || partData._shapeFileName) && <div style={{ fontSize: '0.8rem', color: '#2e7d32', marginTop: 2 }}>📎 {partData._shapeFile?.name || partData._shapeFileName} {!partData._shapeFile && partData._shapeFileName && <span style={{ color: '#999' }}>(saved)</span>}</div>}
      </div>

      {/* Tracking */}
      <div className="form-group">
        <label className="form-label">Client Part / Reference Number</label>
        <input className="form-input" value={partData.clientPartNumber || ''}
          onChange={(e) => setPartData({ ...partData, clientPartNumber: e.target.value })}
          placeholder="Optional" />
      </div>
    </>
  );
}
