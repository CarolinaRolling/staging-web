import React from 'react';
import { FileText, Ruler } from 'lucide-react';

/**
 * RollToOverride - Checkboxes for "Per Template/Sample" and "Per Print"
 * When active, grays out the roll-to diameter/radius inputs.
 * 
 * Props:
 *   rollToMethod: '' | 'template' | 'print'
 *   onMethodChange: (method) => void
 */
export default function RollToOverride({ rollToMethod, onMethodChange }) {
  const handleCheck = (method) => {
    if (rollToMethod === method) {
      onMethodChange(''); // uncheck = go back to normal
    } else {
      onMethodChange(method);
    }
  };

  return (
    <div style={{ 
      display: 'flex', gap: 16, marginBottom: 12, padding: '8px 12px',
      background: rollToMethod ? '#fff3e0' : '#f5f5f5', 
      borderRadius: 6,
      border: rollToMethod ? '1px solid #ffcc80' : '1px solid #e0e0e0',
      transition: 'all 0.2s'
    }}>
      <label style={{ 
        display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', 
        fontWeight: rollToMethod === 'template' ? 600 : 400, fontSize: '0.9rem',
        color: rollToMethod === 'template' ? '#e65100' : '#555'
      }}>
        <input 
          type="checkbox" 
          checked={rollToMethod === 'template'} 
          onChange={() => handleCheck('template')}
          style={{ width: 16, height: 16, accentColor: '#e65100' }}
        />
        <Ruler size={15} />
        Per Template / Sample
      </label>
      <label style={{ 
        display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer',
        fontWeight: rollToMethod === 'print' ? 600 : 400, fontSize: '0.9rem',
        color: rollToMethod === 'print' ? '#1565c0' : '#555'
      }}>
        <input 
          type="checkbox" 
          checked={rollToMethod === 'print'} 
          onChange={() => handleCheck('print')}
          style={{ width: 16, height: 16, accentColor: '#1565c0' }}
        />
        <FileText size={15} />
        Per Print
      </label>
      {rollToMethod === 'print' && (
        <span style={{ 
          fontSize: '0.8rem', color: '#1565c0', fontStyle: 'italic',
          display: 'flex', alignItems: 'center', marginLeft: 'auto'
        }}>
          ⚠ Attach roll instruction PDF to this part after saving
        </span>
      )}
    </div>
  );
}
