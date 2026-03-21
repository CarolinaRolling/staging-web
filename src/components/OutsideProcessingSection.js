import React, { useState } from 'react';
import { searchVendors, createVendor } from '../services/api';

export default function OutsideProcessingSection({ partData, setPartData, showMessage, setError }) {
  const [expanded, setExpanded] = useState(
    !!(partData.outsideProcessingVendorName || partData.outsideProcessingCost > 0)
  );
  const [vendorSearch, setVendorSearch] = useState('');
  const [vendorResults, setVendorResults] = useState([]);
  const [showVendorDrop, setShowVendorDrop] = useState(false);

  const cost = parseFloat(partData.outsideProcessingCost) || 0;
  const markup = parseFloat(partData.outsideProcessingMarkupPercent) || 20;
  const costWithMarkup = Math.round(cost * (1 + markup / 100) * 100) / 100;
  const transport = parseFloat(partData.outsideProcessingTransportCost) || 0;
  const transportMarkup = parseFloat(partData.outsideProcessingTransportMarkupPercent) || 20;
  const transportWithMarkup = Math.round(transport * (1 + transportMarkup / 100) * 100) / 100;
  const total = costWithMarkup + transportWithMarkup;
  const qty = parseInt(partData.quantity) || 1;

  return (
    <div style={{ gridColumn: 'span 2', borderTop: '1px solid #e0e0e0', marginTop: 8, paddingTop: 12 }}>
      <button type="button" onClick={() => setExpanded(!expanded)}
        style={{
          display: 'flex', alignItems: 'center', gap: 8, width: '100%',
          background: expanded ? '#FFF3E0' : '#fafafa', border: expanded ? '2px solid #FF9800' : '2px solid #e0e0e0',
          borderRadius: 8, padding: '10px 14px', cursor: 'pointer', transition: 'all 0.15s'
        }}>
        <span style={{ fontSize: '1.1rem' }}>🏭</span>
        <span style={{ fontWeight: 600, color: expanded ? '#E65100' : '#555', flex: 1, textAlign: 'left' }}>
          Outside Processing
          {cost > 0 && !expanded && (
            <span style={{ fontWeight: 400, color: '#888', marginLeft: 8, fontSize: '0.85rem' }}>
              — {partData.outsideProcessingVendorName}: ${total.toFixed(2)}/ea
            </span>
          )}
        </span>
        <span style={{ color: '#888', fontSize: '0.8rem' }}>{expanded ? '▼' : '▶'}</span>
      </button>

      {expanded && (
        <div style={{ padding: '16px 0 0', display: 'flex', flexDirection: 'column', gap: 12 }}>
          {/* Vendor Picker */}
          <div style={{ position: 'relative' }}>
            <label className="form-label">Vendor *</label>
            {partData.outsideProcessingVendorName ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', background: '#E8F5E9', borderRadius: 6 }}>
                <span style={{ fontWeight: 600, flex: 1 }}>{partData.outsideProcessingVendorName}</span>
                <button type="button" onClick={() => {
                  setPartData(prev => ({ ...prev, outsideProcessingVendorId: null, outsideProcessingVendorName: '' }));
                  setVendorSearch('');
                }} style={{ background: 'none', border: 'none', color: '#1565c0', cursor: 'pointer', fontSize: '0.85rem' }}>Change</button>
              </div>
            ) : (
              <>
                <input className="form-input" value={vendorSearch} placeholder="Search vendors..."
                  onChange={async (e) => {
                    setVendorSearch(e.target.value);
                    if (e.target.value.length >= 1) {
                      try {
                        const res = await searchVendors(e.target.value);
                        setVendorResults(res.data.data || []);
                        setShowVendorDrop(true);
                      } catch { setVendorResults([]); }
                    } else { setVendorResults([]); setShowVendorDrop(false); }
                  }}
                  onFocus={async () => { try { const res = await searchVendors(''); setVendorResults(res.data.data || []); setShowVendorDrop(true); } catch {} }}
                  onBlur={() => setTimeout(() => setShowVendorDrop(false), 200)}
                  autoComplete="off" />
                {showVendorDrop && vendorResults.length > 0 && (
                  <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 100, background: 'white', border: '1px solid #ddd', borderRadius: 4, maxHeight: 200, overflowY: 'auto', boxShadow: '0 4px 12px rgba(0,0,0,0.15)' }}>
                    {vendorResults.map(v => (
                      <div key={v.id} style={{ padding: '8px 12px', cursor: 'pointer', borderBottom: '1px solid #eee' }}
                        onMouseDown={() => {
                          setPartData(prev => ({ ...prev, outsideProcessingVendorId: v.id, outsideProcessingVendorName: v.name }));
                          setShowVendorDrop(false);
                          setVendorSearch('');
                        }}>
                        <strong>{v.name}</strong>
                        {v.contactEmail && <span style={{ color: '#888', marginLeft: 8, fontSize: '0.8rem' }}>{v.contactEmail}</span>}
                      </div>
                    ))}
                    {vendorSearch.length >= 2 && !vendorResults.some(v => v.name.toLowerCase() === vendorSearch.toLowerCase()) && (
                      <div style={{ padding: '8px 12px', cursor: 'pointer', background: '#e8f5e9', color: '#2e7d32', fontWeight: 600 }}
                        onMouseDown={async () => {
                          try {
                            const resp = await createVendor({ name: vendorSearch });
                            if (resp.data.data) {
                              setPartData(prev => ({ ...prev, outsideProcessingVendorId: resp.data.data.id, outsideProcessingVendorName: resp.data.data.name }));
                              if (showMessage) showMessage(`Vendor "${resp.data.data.name}" created`);
                            }
                          } catch { if (setError) setError('Failed to create vendor'); }
                          setShowVendorDrop(false);
                          setVendorSearch('');
                        }}>+ Add "{vendorSearch}" as new vendor</div>
                    )}
                  </div>
                )}
              </>
            )}
          </div>

          {/* Description */}
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">Service Description</label>
            <input className="form-input" value={partData.outsideProcessingDescription || ''}
              onChange={(e) => setPartData(prev => ({ ...prev, outsideProcessingDescription: e.target.value }))}
              placeholder="e.g. Stress relief, heat treatment, machining, NDT" />
          </div>

          {/* Costs */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Vendor Cost (ea)</label>
              <input type="number" step="any" className="form-input" value={partData.outsideProcessingCost || ''}
                onFocus={(e) => e.target.select()}
                onChange={(e) => setPartData(prev => ({ ...prev, outsideProcessingCost: e.target.value }))} placeholder="0.00" />
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Markup %</label>
              <input type="number" step="1" className="form-input" value={partData.outsideProcessingMarkupPercent ?? 20}
                onFocus={(e) => e.target.select()}
                onChange={(e) => setPartData(prev => ({ ...prev, outsideProcessingMarkupPercent: e.target.value }))} />
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Billed to Client (ea)</label>
              <div style={{ padding: '8px 12px', background: '#f5f5f5', borderRadius: 6, fontWeight: 600, color: '#E65100' }}>
                ${costWithMarkup.toFixed(2)}
              </div>
            </div>
          </div>

          {/* Transport */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Transport Cost</label>
              <input type="number" step="any" className="form-input" value={partData.outsideProcessingTransportCost || ''}
                onFocus={(e) => e.target.select()}
                onChange={(e) => setPartData(prev => ({ ...prev, outsideProcessingTransportCost: e.target.value }))} placeholder="0.00" />
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Transport Markup %</label>
              <input type="number" step="1" className="form-input" value={partData.outsideProcessingTransportMarkupPercent ?? 20}
                onFocus={(e) => e.target.select()}
                onChange={(e) => setPartData(prev => ({ ...prev, outsideProcessingTransportMarkupPercent: e.target.value }))} />
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Transport Billed</label>
              <div style={{ padding: '8px 12px', background: '#f5f5f5', borderRadius: 6, fontWeight: 600, color: '#E65100' }}>
                ${transportWithMarkup.toFixed(2)}
              </div>
            </div>
          </div>

          {/* Summary */}
          {(cost > 0 || transport > 0) && (
            <div style={{ background: '#FFF3E0', padding: 12, borderRadius: 8, border: '1px solid #FFE0B2' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', color: '#555', padding: '2px 0' }}>
                <span>Vendor cost (ea)</span><span>${cost.toFixed(2)}</span>
              </div>
              {markup > 0 && cost > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', color: '#E65100', padding: '2px 0' }}>
                  <span>+ Markup ({markup}%)</span><span>${(costWithMarkup - cost).toFixed(2)}</span>
                </div>
              )}
              {transport > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', color: '#555', padding: '2px 0' }}>
                  <span>Transport</span><span>${transport.toFixed(2)}</span>
                </div>
              )}
              {transportMarkup > 0 && transport > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', color: '#E65100', padding: '2px 0' }}>
                  <span>+ Transport markup ({transportMarkup}%)</span><span>${(transportWithMarkup - transport).toFixed(2)}</span>
                </div>
              )}
              <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700, borderTop: '1px solid #FFE0B2', marginTop: 4, paddingTop: 6, fontSize: '0.95rem' }}>
                <span>Outside Processing Total (ea)</span><span style={{ color: '#E65100' }}>${total.toFixed(2)}</span>
              </div>
              {qty > 1 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700, fontSize: '0.95rem', color: '#2e7d32', paddingTop: 2 }}>
                  <span>× {qty} qty</span><span>${(total * qty).toFixed(2)}</span>
                </div>
              )}

              {/* PO Status */}
              {partData.outsideProcessingPONumber && (
                <div style={{ marginTop: 8, padding: '6px 10px', background: '#E8F5E9', borderRadius: 4, fontSize: '0.85rem' }}>
                  ✅ PO: <strong>{partData.outsideProcessingPONumber}</strong>
                  {partData.outsideProcessingPOSentAt && (
                    <span style={{ color: '#888', marginLeft: 8 }}>
                      Sent {new Date(partData.outsideProcessingPOSentAt).toLocaleDateString()}
                    </span>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Clear button */}
          {(partData.outsideProcessingVendorName || cost > 0) && (
            <button type="button" onClick={() => {
              setPartData(prev => ({
                ...prev,
                outsideProcessingVendorId: null, outsideProcessingVendorName: '',
                outsideProcessingDescription: '', outsideProcessingCost: 0,
                outsideProcessingMarkupPercent: 20, outsideProcessingTransportCost: 0,
                outsideProcessingTransportMarkupPercent: 20,
                outsideProcessingPONumber: null, outsideProcessingPOSentAt: null
              }));
              setExpanded(false);
            }} style={{ alignSelf: 'flex-start', background: 'none', border: '1px solid #c62828', color: '#c62828', padding: '4px 12px', borderRadius: 6, cursor: 'pointer', fontSize: '0.8rem' }}>
              ✕ Remove Outside Processing
            </button>
          )}
        </div>
      )}
    </div>
  );
}
