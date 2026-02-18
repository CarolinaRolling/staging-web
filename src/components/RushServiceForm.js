import React, { useState, useEffect } from 'react';
import { AlertTriangle, Clock, DollarSign } from 'lucide-react';

const EXPEDITE_OPTIONS = [
  { value: '25', label: '25%', pct: 0.25 },
  { value: '50', label: '50%', pct: 0.50 },
  { value: '100', label: '100%', pct: 1.00 },
  { value: 'custom_pct', label: 'Custom Percent', pct: null },
  { value: 'custom_amt', label: 'Custom Amount', pct: null },
];

const EMERGENCY_OPTIONS = [
  { value: 'Saturday', label: 'Saturday', fee: 600 },
  { value: 'Saturday Night', label: 'Saturday Night', fee: 800 },
  { value: 'Sunday', label: 'Sunday', fee: 600 },
  { value: 'Sunday Night', label: 'Sunday Night', fee: 800 },
];

export { EXPEDITE_OPTIONS, EMERGENCY_OPTIONS };

export default function RushServiceForm({ partData, setPartData }) {
  const [expediteEnabled, setExpediteEnabled] = useState(!!(partData._expediteEnabled));
  const [expediteType, setExpediteType] = useState(partData._expediteType || '25');
  const [expediteCustomPct, setExpediteCustomPct] = useState(partData._expediteCustomPct || '');
  const [expediteCustomAmt, setExpediteCustomAmt] = useState(partData._expediteCustomAmt || '');
  const [emergencyEnabled, setEmergencyEnabled] = useState(!!(partData._emergencyEnabled));
  const [emergencyDay, setEmergencyDay] = useState(partData._emergencyDay || 'Saturday');

  useEffect(() => {
    const updates = {
      _expediteEnabled: expediteEnabled,
      _expediteType: expediteType,
      _expediteCustomPct: expediteCustomPct,
      _expediteCustomAmt: expediteCustomAmt,
      _emergencyEnabled: emergencyEnabled,
      _emergencyDay: emergencyDay,
      quantity: 1,
      materialSource: 'customer_supplied',
    };

    // Build description for display
    const descParts = [];
    if (expediteEnabled) {
      if (expediteType === 'custom_amt') {
        descParts.push(`Expedite: $${parseFloat(expediteCustomAmt) || 0}`);
      } else if (expediteType === 'custom_pct') {
        descParts.push(`Expedite: ${expediteCustomPct || 0}%`);
      } else {
        const opt = EXPEDITE_OPTIONS.find(o => o.value === expediteType);
        descParts.push(`Expedite: ${opt?.label || expediteType}`);
      }
    }
    if (emergencyEnabled) {
      const opt = EMERGENCY_OPTIONS.find(o => o.value === emergencyDay);
      descParts.push(`Emergency Off Hour Opening: ${emergencyDay} ($${opt?.fee || 0})`);
    }
    updates.specialInstructions = descParts.join(' | ');

    setPartData(prev => ({ ...prev, ...updates }));
  }, [expediteEnabled, expediteType, expediteCustomPct, expediteCustomAmt, emergencyEnabled, emergencyDay]);

  const sectionStyle = { padding: 16, background: '#fafafa', borderRadius: 8, border: '1px solid #e0e0e0', marginBottom: 16 };

  return (
    <div style={{ gridColumn: 'span 2' }}>
      {/* Expedite Section */}
      <div style={sectionStyle}>
        <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', marginBottom: expediteEnabled ? 16 : 0 }}>
          <input 
            type="checkbox" 
            checked={expediteEnabled} 
            onChange={(e) => setExpediteEnabled(e.target.checked)}
            style={{ width: 20, height: 20, accentColor: '#e65100' }}
          />
          <Clock size={20} color={expediteEnabled ? '#e65100' : '#999'} />
          <div>
            <span style={{ fontWeight: 700, fontSize: '1.05rem', color: expediteEnabled ? '#e65100' : '#333' }}>Expedite Service</span>
            <div style={{ fontSize: '0.8rem', color: '#888' }}>Percentage surcharge on order total</div>
          </div>
        </label>

        {expediteEnabled && (
          <div style={{ marginLeft: 30 }}>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
              {EXPEDITE_OPTIONS.map(opt => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setExpediteType(opt.value)}
                  style={{
                    padding: '8px 16px', borderRadius: 8, fontWeight: 600, fontSize: '0.9rem',
                    border: `2px solid ${expediteType === opt.value ? '#e65100' : '#ccc'}`,
                    background: expediteType === opt.value ? '#fff3e0' : '#fff',
                    color: expediteType === opt.value ? '#e65100' : '#666',
                    cursor: 'pointer'
                  }}
                >
                  {opt.label}
                </button>
              ))}
            </div>

            {expediteType === 'custom_pct' && (
              <div className="form-group" style={{ maxWidth: 200 }}>
                <label className="form-label">Custom Percentage</label>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <input 
                    type="number" step="0.1" className="form-input"
                    value={expediteCustomPct} 
                    onChange={(e) => setExpediteCustomPct(e.target.value)}
                    placeholder="e.g. 35"
                  />
                  <span style={{ fontWeight: 600, fontSize: '1.1rem' }}>%</span>
                </div>
              </div>
            )}

            {expediteType === 'custom_amt' && (
              <div className="form-group" style={{ maxWidth: 200 }}>
                <label className="form-label">Custom Amount</label>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ fontWeight: 600, fontSize: '1.1rem' }}>$</span>
                  <input 
                    type="number" step="0.01" className="form-input"
                    value={expediteCustomAmt} 
                    onChange={(e) => setExpediteCustomAmt(e.target.value)}
                    placeholder="0.00"
                  />
                </div>
              </div>
            )}

            <div style={{ padding: '8px 12px', background: '#fff3e0', borderRadius: 6, border: '1px solid #ffcc80', fontSize: '0.85rem', color: '#e65100' }}>
              <AlertTriangle size={14} style={{ verticalAlign: 'middle', marginRight: 6 }} />
              Expedite charge will be calculated as a percentage of the order parts subtotal.
            </div>
          </div>
        )}
      </div>

      {/* Emergency Section */}
      <div style={sectionStyle}>
        <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', marginBottom: emergencyEnabled ? 16 : 0 }}>
          <input 
            type="checkbox" 
            checked={emergencyEnabled} 
            onChange={(e) => setEmergencyEnabled(e.target.checked)}
            style={{ width: 20, height: 20, accentColor: '#c62828' }}
          />
          <AlertTriangle size={20} color={emergencyEnabled ? '#c62828' : '#999'} />
          <div>
            <span style={{ fontWeight: 700, fontSize: '1.05rem', color: emergencyEnabled ? '#c62828' : '#333' }}>Emergency Off-Hour Service</span>
            <div style={{ fontSize: '0.8rem', color: '#888' }}>Flat fee for opening outside business hours</div>
          </div>
        </label>

        {emergencyEnabled && (
          <div style={{ marginLeft: 30 }}>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {EMERGENCY_OPTIONS.map(opt => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setEmergencyDay(opt.value)}
                  style={{
                    padding: '10px 20px', borderRadius: 8, fontWeight: 600, fontSize: '0.9rem',
                    border: `2px solid ${emergencyDay === opt.value ? '#c62828' : '#ccc'}`,
                    background: emergencyDay === opt.value ? '#ffebee' : '#fff',
                    color: emergencyDay === opt.value ? '#c62828' : '#666',
                    cursor: 'pointer', textAlign: 'center'
                  }}
                >
                  <div>{opt.value}</div>
                  <div style={{ fontSize: '0.8rem', fontWeight: 700, marginTop: 2 }}>${opt.fee}</div>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Summary */}
      {(expediteEnabled || emergencyEnabled) && (
        <div style={{ padding: 16, background: '#fff8e1', borderRadius: 8, border: '2px solid #ffcc80' }}>
          <div style={{ fontWeight: 700, fontSize: '1rem', marginBottom: 8, color: '#e65100' }}>
            <AlertTriangle size={16} style={{ verticalAlign: 'middle', marginRight: 6 }} />
            Rush Order Summary
          </div>
          {expediteEnabled && (
            <div style={{ fontSize: '0.9rem', marginBottom: 4 }}>
              <DollarSign size={14} style={{ verticalAlign: 'middle', marginRight: 4 }} />
              <strong>Expedite:</strong>{' '}
              {expediteType === 'custom_amt' 
                ? `$${parseFloat(expediteCustomAmt) || 0} flat fee`
                : `${expediteType === 'custom_pct' ? (expediteCustomPct || 0) : expediteType}% of parts subtotal`
              }
            </div>
          )}
          {emergencyEnabled && (
            <div style={{ fontSize: '0.9rem' }}>
              <Clock size={14} style={{ verticalAlign: 'middle', marginRight: 4 }} />
              <strong>Emergency Off Hour Opening:</strong> {emergencyDay} — ${EMERGENCY_OPTIONS.find(o => o.value === emergencyDay)?.fee || 0}
            </div>
          )}
          <div style={{ fontSize: '0.8rem', color: '#888', marginTop: 8, fontStyle: 'italic' }}>
            Promise date will be set to today when this part is saved.
          </div>
        </div>
      )}
    </div>
  );
}
