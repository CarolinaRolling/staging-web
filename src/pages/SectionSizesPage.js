import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Save, Plus, X, GripVertical } from 'lucide-react';
import { getSettings, updateSettings } from '../services/api';
import { clearSectionSizeCache } from '../hooks/useSectionSizes';

// ─── Default sizes (fallback if nothing saved) ───
const DEFAULTS = {
  angle: [
    '0.5x0.5', '0.75x0.75', '1x1', '1.25x1.25', '1.5x1.5', '2x2', '2.5x2.5', '3x3', '4x4', '5x5', '6x6',
    '1x2', '2x3', '3x4', '4x5', '4x6'
  ],
  channel: [
    'C3x4.1', 'C3x5', 'C3x6',
    'C4x5.4', 'C4x7.25',
    'C5x6.7', 'C5x9',
    'C6x8.2', 'C6x10.5', 'C6x13',
    'C7x9.8', 'C7x12.25', 'C7x14.75',
    'C8x11.5', 'C8x13.75', 'C8x18.75',
    'C9x13.4', 'C9x15', 'C9x20',
    'C10x15.3', 'C10x20', 'C10x25', 'C10x30',
    'C12x20.7', 'C12x25', 'C12x30',
    'C15x33.9', 'C15x40', 'C15x50',
    'MC6x12', 'MC6x15.3', 'MC6x16.3',
    'MC8x8.5', 'MC8x18.7', 'MC8x20', 'MC8x21.4', 'MC8x22.8',
    'MC10x6.5', 'MC10x22', 'MC10x25', 'MC10x28.5', 'MC10x33.6',
    'MC12x10.6', 'MC12x31', 'MC12x35', 'MC12x40', 'MC12x45', 'MC12x50',
    'MC13x31.8', 'MC13x35', 'MC13x40',
    'MC18x42.7', 'MC18x45.8', 'MC18x51.9', 'MC18x58'
  ],
  beam: [
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
    'S3x5.7', 'S3x7.5', 'S4x7.7', 'S4x9.5', 'S5x10', 'S5x14.75',
    'S6x12.5', 'S6x17.25', 'S7x15.3', 'S7x20',
    'S8x18.4', 'S8x23', 'S10x25.4', 'S10x35',
    'S12x31.8', 'S12x35', 'S12x40.8', 'S12x50',
    'S15x42.9', 'S15x50', 'S18x54.7', 'S18x70',
    'S20x66', 'S20x75', 'S20x86', 'S20x96',
    'S24x80', 'S24x90', 'S24x100', 'S24x106', 'S24x121'
  ],
  pipe: [
    { label: '.625" OD Tube', od: 0.625, type: 'tube', defaultLength: "20'" },
    { label: '.75" OD Tube', od: 0.75, type: 'tube', defaultLength: "20'" },
    { label: '1" OD Tube', od: 1.0, type: 'tube', defaultLength: "20'" },
    { label: '1.25" OD Tube', od: 1.25, type: 'tube', defaultLength: "20'" },
    { label: '1.5" OD Tube', od: 1.5, type: 'tube', defaultLength: "20'" },
    { label: '2" OD Tube', od: 2.0, type: 'tube', defaultLength: "20'" },
    { label: '3" OD Tube', od: 3.0, type: 'tube', defaultLength: "20'" },
    { label: '4" OD Tube', od: 4.0, type: 'tube', defaultLength: "20'" },
    { label: '1" Pipe', od: 1.315, type: 'pipe', defaultLength: "21'", nominal: '1"' },
    { label: '1.25" Pipe', od: 1.660, type: 'pipe', defaultLength: "21'", nominal: '1-1/4"' },
    { label: '1.5" Pipe', od: 1.900, type: 'pipe', defaultLength: "21'", nominal: '1-1/2"' },
    { label: '2" Pipe', od: 2.375, type: 'pipe', defaultLength: "21'", nominal: '2"' },
    { label: '3" Pipe', od: 3.500, type: 'pipe', defaultLength: "21'", nominal: '3"' },
    { label: '4" Pipe', od: 4.500, type: 'pipe', defaultLength: "21'", nominal: '4"' },
    { label: '.500" Solid Round', od: 0.500, type: 'solid_bar', defaultLength: "20'" },
    { label: '.625" Solid Round', od: 0.625, type: 'solid_bar', defaultLength: "20'" },
    { label: '.750" Solid Round', od: 0.750, type: 'solid_bar', defaultLength: "20'" },
    { label: '.875" Solid Round', od: 0.875, type: 'solid_bar', defaultLength: "20'" },
    { label: '1" Solid Round', od: 1.0, type: 'solid_bar', defaultLength: "20'" },
    { label: '1.25" Solid Round', od: 1.25, type: 'solid_bar', defaultLength: "20'" },
    { label: '1.5" Solid Round', od: 1.5, type: 'solid_bar', defaultLength: "20'" },
    { label: '1.75" Solid Round', od: 1.75, type: 'solid_bar', defaultLength: "20'" },
    { label: '2" Solid Round', od: 2.0, type: 'solid_bar', defaultLength: "20'" },
    { label: '2.5" Solid Round', od: 2.5, type: 'solid_bar', defaultLength: "20'" },
    { label: '3" Solid Round', od: 3.0, type: 'solid_bar', defaultLength: "20'" },
    { label: '3.5" Solid Round', od: 3.5, type: 'solid_bar', defaultLength: "20'" },
    { label: '4" Solid Round', od: 4.0, type: 'solid_bar', defaultLength: "20'" }
  ],
  sq_rect_tube: {
    square: ['0.5x0.5', '0.75x0.75', '1x1', '1.25x1.25', '1.5x1.5', '2x2', '2.5x2.5', '3x3', '4x4', '5x5', '6x6'],
    rectangular: ['1x2', '1x3', '1.5x2', '1.5x3', '2x3', '2x4', '3x4', '3x5', '4x6']
  }
};

const TABS = [
  { key: 'angle', label: 'Angle', icon: '📐', hint: 'Format: LegxLeg (e.g. 2x2, 3x4)' },
  { key: 'channel', label: 'Channel', icon: '🔩', hint: 'Format: C or MC prefix (e.g. C6x8.2, MC10x22)' },
  { key: 'beam', label: 'Beam', icon: '🏗️', hint: 'Format: W or S prefix (e.g. W8x31, S6x12.5)' },
  { key: 'pipe', label: 'Pipe & Tube', icon: '🔧', hint: 'Round tube, pipe, and solid bar with OD values' },
  { key: 'sq_rect_tube', label: 'Sq/Rect Tube', icon: '⬜', hint: 'Format: Side1xSide2 (e.g. 2x2 for square, 2x4 for rect)' }
];

function SectionSizesPage() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('angle');
  const [sizes, setSizes] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(null);
  const [newItem, setNewItem] = useState('');
  // For sq/rect tube: separate inputs
  const [newSqItem, setNewSqItem] = useState('');
  const [newRectItem, setNewRectItem] = useState('');
  // For pipe: new entry fields
  const [newPipeLabel, setNewPipeLabel] = useState('');
  const [newPipeOD, setNewPipeOD] = useState('');
  const [newPipeType, setNewPipeType] = useState('tube');
  const [newPipeLength, setNewPipeLength] = useState("20'");

  useEffect(() => { loadAll(); }, []);

  const loadAll = async () => {
    setLoading(true);
    const loaded = {};
    for (const tab of TABS) {
      try {
        const resp = await getSettings(`section_sizes_${tab.key}`);
        if (resp.data.data?.value) {
          loaded[tab.key] = resp.data.data.value;
        } else {
          loaded[tab.key] = DEFAULTS[tab.key];
        }
      } catch {
        loaded[tab.key] = DEFAULTS[tab.key];
      }
    }
    setSizes(loaded);
    setLoading(false);
  };

  const showMsg = (text, type = 'success') => {
    setMessage({ text, type });
    setTimeout(() => setMessage(null), 3000);
  };

  const handleSave = async (key) => {
    try {
      setSaving(true);
      await updateSettings(`section_sizes_${key}`, sizes[key]);
      clearSectionSizeCache(key);
      showMsg(`${TABS.find(t => t.key === key)?.label} sizes saved`);
    } catch (err) {
      showMsg('Save failed', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveAll = async () => {
    setSaving(true);
    try {
      for (const tab of TABS) {
        await updateSettings(`section_sizes_${tab.key}`, sizes[tab.key]);
      }
      clearSectionSizeCache();
      showMsg('All sizes saved');
    } catch {
      showMsg('Save failed', 'error');
    } finally {
      setSaving(false);
    }
  };

  // ─── Simple list helpers (angle, channel, beam) ───
  const addSimple = (key) => {
    if (!newItem.trim()) return;
    const current = [...(sizes[key] || [])];
    if (current.includes(newItem.trim())) { showMsg('Already exists', 'error'); return; }
    current.push(newItem.trim());
    setSizes({ ...sizes, [key]: current });
    setNewItem('');
  };

  const removeSimple = (key, idx) => {
    const current = [...(sizes[key] || [])];
    current.splice(idx, 1);
    setSizes({ ...sizes, [key]: current });
  };

  // ─── Sq/Rect tube helpers ───
  const addSqRect = (subKey, value) => {
    if (!value || !value.trim()) return;
    const current = { ...(sizes.sq_rect_tube || DEFAULTS.sq_rect_tube) };
    const list = [...(current[subKey] || [])];
    if (list.includes(value.trim())) { showMsg('Already exists', 'error'); return; }
    list.push(value.trim());
    current[subKey] = list;
    setSizes({ ...sizes, sq_rect_tube: current });
    if (subKey === 'square') setNewSqItem('');
    else setNewRectItem('');
  };

  const removeSqRect = (subKey, idx) => {
    const current = { ...(sizes.sq_rect_tube || DEFAULTS.sq_rect_tube) };
    const list = [...(current[subKey] || [])];
    list.splice(idx, 1);
    current[subKey] = list;
    setSizes({ ...sizes, sq_rect_tube: current });
  };

  // ─── Pipe/Tube helpers ───
  const addPipe = () => {
    if (!newPipeLabel.trim() || !newPipeOD) return;
    const current = [...(sizes.pipe || [])];
    const entry = {
      label: newPipeLabel.trim(),
      od: parseFloat(newPipeOD),
      type: newPipeType,
      defaultLength: newPipeLength
    };
    current.push(entry);
    setSizes({ ...sizes, pipe: current });
    setNewPipeLabel('');
    setNewPipeOD('');
  };

  const removePipe = (idx) => {
    const current = [...(sizes.pipe || [])];
    current.splice(idx, 1);
    setSizes({ ...sizes, pipe: current });
  };

  const handleResetDefaults = (key) => {
    if (!window.confirm(`Reset ${TABS.find(t => t.key === key)?.label} sizes to factory defaults?`)) return;
    setSizes({ ...sizes, [key]: JSON.parse(JSON.stringify(DEFAULTS[key])) });
    showMsg('Reset to defaults — click Save to apply');
  };

  if (loading) return <div style={{ padding: 40, textAlign: 'center' }}>Loading...</div>;

  const tab = TABS.find(t => t.key === activeTab);

  // ─── Render simple list (angle, channel, beam) ───
  const renderSimpleList = (key) => {
    const items = sizes[key] || [];
    return (
      <div>
        <div style={{ marginBottom: 12, display: 'flex', gap: 8 }}>
          <input className="form-input" style={{ flex: 1 }} placeholder={tab.hint}
            value={newItem} onChange={(e) => setNewItem(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') addSimple(key); }} />
          <button className="btn btn-primary" onClick={() => addSimple(key)}>
            <Plus size={16} /> Add
          </button>
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {items.map((item, i) => (
            <div key={i} style={{
              display: 'flex', alignItems: 'center', gap: 6,
              background: '#f5f5f5', border: '1px solid #ddd', borderRadius: 6,
              padding: '6px 10px', fontSize: '0.85rem'
            }}>
              <span style={{ fontWeight: 500 }}>{item}</span>
              <button onClick={() => removeSimple(key, i)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#d32f2f', padding: 0, display: 'flex' }}>
                <X size={14} />
              </button>
            </div>
          ))}
        </div>
        <div style={{ marginTop: 8, fontSize: '0.8rem', color: '#999' }}>{items.length} sizes</div>
      </div>
    );
  };

  // ─── Render sq/rect tube list ───
  const renderSqRectTube = () => {
    const data = sizes.sq_rect_tube || DEFAULTS.sq_rect_tube;
    return (
      <div>
        {/* Square */}
        <h4 style={{ marginBottom: 8, color: '#1976d2' }}>Square Tubing</h4>
        <div style={{ marginBottom: 12, display: 'flex', gap: 8 }}>
          <input className="form-input" style={{ flex: 1 }} placeholder="e.g. 2x2 or 7x7"
            value={newSqItem}
            onChange={(e) => setNewSqItem(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') addSqRect('square', newSqItem); }} />
          <button className="btn btn-primary" onClick={() => addSqRect('square', newSqItem)}>
            <Plus size={16} /> Add
          </button>
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 16 }}>
          {(data.square || []).map((item, i) => (
            <div key={i} style={{
              display: 'flex', alignItems: 'center', gap: 6,
              background: '#e3f2fd', border: '1px solid #90caf9', borderRadius: 6,
              padding: '6px 10px', fontSize: '0.85rem'
            }}>
              <span style={{ fontWeight: 500 }}>{item}</span>
              <button onClick={() => removeSqRect('square', i)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#d32f2f', padding: 0, display: 'flex' }}>
                <X size={14} />
              </button>
            </div>
          ))}
        </div>

        {/* Rectangular */}
        <h4 style={{ marginBottom: 8, color: '#e65100' }}>Rectangular Tubing</h4>
        <div style={{ marginBottom: 12, display: 'flex', gap: 8 }}>
          <input className="form-input" style={{ flex: 1 }} placeholder="e.g. 2x4 or 3x5"
            value={newRectItem}
            onChange={(e) => setNewRectItem(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') addSqRect('rectangular', newRectItem); }} />
          <button className="btn btn-outline" onClick={() => addSqRect('rectangular', newRectItem)}>
            <Plus size={16} /> Add
          </button>
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {(data.rectangular || []).map((item, i) => (
            <div key={i} style={{
              display: 'flex', alignItems: 'center', gap: 6,
              background: '#fff3e0', border: '1px solid #ffcc80', borderRadius: 6,
              padding: '6px 10px', fontSize: '0.85rem'
            }}>
              <span style={{ fontWeight: 500 }}>{item}</span>
              <button onClick={() => removeSqRect('rectangular', i)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#d32f2f', padding: 0, display: 'flex' }}>
                <X size={14} />
              </button>
            </div>
          ))}
        </div>
        <div style={{ marginTop: 8, fontSize: '0.8rem', color: '#999' }}>
          {(data.square || []).length} square, {(data.rectangular || []).length} rectangular
        </div>
      </div>
    );
  };

  // ─── Render pipe/tube list ───
  const renderPipeList = () => {
    const items = sizes.pipe || [];
    const tubes = items.filter(i => i.type === 'tube');
    const pipes = items.filter(i => i.type === 'pipe');
    const solids = items.filter(i => i.type === 'solid_bar');

    const renderGroup = (title, groupItems, color) => (
      <div style={{ marginBottom: 16 }}>
        <h4 style={{ marginBottom: 8, color }}>{title}</h4>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {groupItems.map((item) => {
            const globalIdx = items.indexOf(item);
            return (
              <div key={globalIdx} style={{
                display: 'flex', alignItems: 'center', gap: 6,
                background: '#f5f5f5', border: '1px solid #ddd', borderRadius: 6,
                padding: '6px 10px', fontSize: '0.85rem'
              }}>
                <span style={{ fontWeight: 500 }}>{item.label}</span>
                <span style={{ color: '#999', fontSize: '0.75rem' }}>OD: {item.od}"</span>
                <button onClick={() => removePipe(globalIdx)}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#d32f2f', padding: 0, display: 'flex' }}>
                  <X size={14} />
                </button>
              </div>
            );
          })}
        </div>
      </div>
    );

    return (
      <div>
        <div style={{ marginBottom: 16, padding: 12, background: '#f9f9f9', borderRadius: 8, border: '1px solid #eee' }}>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'end' }}>
            <div className="form-group" style={{ flex: 2, margin: 0 }}>
              <label className="form-label" style={{ fontSize: '0.75rem' }}>Label</label>
              <input className="form-input" placeholder='e.g. 5" OD Tube' value={newPipeLabel}
                onChange={(e) => setNewPipeLabel(e.target.value)} />
            </div>
            <div className="form-group" style={{ flex: 1, margin: 0 }}>
              <label className="form-label" style={{ fontSize: '0.75rem' }}>OD (inches)</label>
              <input className="form-input" type="number" step="0.001" placeholder="e.g. 5.0" value={newPipeOD}
                onChange={(e) => setNewPipeOD(e.target.value)} />
            </div>
            <div className="form-group" style={{ flex: 1, margin: 0 }}>
              <label className="form-label" style={{ fontSize: '0.75rem' }}>Type</label>
              <select className="form-select" value={newPipeType} onChange={(e) => setNewPipeType(e.target.value)}>
                <option value="tube">Tube</option>
                <option value="pipe">Pipe</option>
                <option value="solid_bar">Solid Bar</option>
              </select>
            </div>
            <div className="form-group" style={{ flex: 1, margin: 0 }}>
              <label className="form-label" style={{ fontSize: '0.75rem' }}>Default Length</label>
              <input className="form-input" placeholder="20'" value={newPipeLength}
                onChange={(e) => setNewPipeLength(e.target.value)} />
            </div>
            <button className="btn btn-primary" onClick={addPipe} style={{ marginBottom: 0 }}>
              <Plus size={16} /> Add
            </button>
          </div>
        </div>

        {tubes.length > 0 && renderGroup('Round Tube', tubes, '#1976d2')}
        {pipes.length > 0 && renderGroup('Pipe', pipes, '#388e3c')}
        {solids.length > 0 && renderGroup('Solid Bar', solids, '#e65100')}

        <div style={{ fontSize: '0.8rem', color: '#999' }}>{items.length} total sizes</div>
      </div>
    );
  };

  return (
    <div style={{ maxWidth: 1000, margin: '0 auto', padding: 20 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button className="btn btn-outline" onClick={() => navigate('/settings')} style={{ padding: '6px 10px' }}>
            <ArrowLeft size={18} />
          </button>
          <h1 style={{ margin: 0 }}>Section Sizes</h1>
        </div>
        <button className="btn btn-primary" onClick={handleSaveAll} disabled={saving}>
          <Save size={18} /> {saving ? 'Saving...' : 'Save All'}
        </button>
      </div>

      {message && (
        <div style={{
          padding: '10px 16px', borderRadius: 8, marginBottom: 16,
          background: message.type === 'error' ? '#ffebee' : '#e8f5e9',
          color: message.type === 'error' ? '#c62828' : '#2e7d32',
          fontWeight: 500
        }}>
          {message.text}
        </div>
      )}

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 20, flexWrap: 'wrap' }}>
        {TABS.map(t => (
          <button key={t.key}
            onClick={() => { setActiveTab(t.key); setNewItem(''); }}
            style={{
              padding: '10px 16px', borderRadius: 8, border: '2px solid',
              borderColor: activeTab === t.key ? '#1976d2' : '#ddd',
              background: activeTab === t.key ? '#e3f2fd' : '#fff',
              color: activeTab === t.key ? '#1976d2' : '#666',
              fontWeight: activeTab === t.key ? 700 : 500,
              cursor: 'pointer', fontSize: '0.9rem'
            }}>
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="card" style={{ padding: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <div>
            <h3 style={{ margin: 0 }}>{tab.icon} {tab.label} Sizes</h3>
            <div style={{ fontSize: '0.8rem', color: '#999', marginTop: 4 }}>{tab.hint}</div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn-sm btn-outline" onClick={() => handleResetDefaults(activeTab)}>
              Reset Defaults
            </button>
            <button className="btn btn-sm btn-primary" onClick={() => handleSave(activeTab)} disabled={saving}>
              <Save size={14} /> Save {tab.label}
            </button>
          </div>
        </div>

        {activeTab === 'pipe' ? renderPipeList() :
         activeTab === 'sq_rect_tube' ? renderSqRectTube() :
         renderSimpleList(activeTab)}
      </div>
    </div>
  );
}

export default SectionSizesPage;
