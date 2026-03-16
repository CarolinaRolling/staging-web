import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ShoppingCart, AlertTriangle, Trash2, RefreshCw, Save, Unlock, Search, Edit2 } from 'lucide-react';
import { getPONumbers, getPONumberStats, setNextPONumber, voidPONumber, releasePONumber, reassignPONumber, getVoidedPONumbers } from '../services/api';

function PONumbersPage() {
  const navigate = useNavigate();
  const [stats, setStats] = useState({ lastUsed: 0, nextNumber: 1, voidedCount: 0, activeCount: 0 });
  const [activePOs, setActivePOs] = useState([]);
  const [voidedNumbers, setVoidedNumbers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  
  const [newNextNumber, setNewNextNumber] = useState('');
  const [voidNumber, setVoidNumber] = useState('');
  const [voidReason, setVoidReason] = useState('');
  const [saving, setSaving] = useState(false);
  const [showVoidConfirm, setShowVoidConfirm] = useState(false);
  const [releaseConfirm, setReleaseConfirm] = useState(null);
  const [searchFilter, setSearchFilter] = useState('');
  const [tab, setTab] = useState('active');
  const [editingPO, setEditingPO] = useState(null);
  const [editValue, setEditValue] = useState('');

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [statsRes, activeRes, voidedRes] = await Promise.all([
        getPONumberStats(),
        getPONumbers({ status: 'active', limit: 500 }),
        getVoidedPONumbers()
      ]);
      setStats(statsRes.data.data);
      setNewNextNumber(statsRes.data.data.nextNumber.toString());
      setActivePOs(activeRes.data.data || []);
      setVoidedNumbers(voidedRes.data.data || []);
    } catch (err) {
      setError('Failed to load PO number data');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateNextNumber = async () => {
    const num = parseInt(newNextNumber);
    if (!num || num < 1) { setError('Please enter a valid number'); return; }
    try {
      setSaving(true); setError(null);
      await setNextPONumber(num);
      setSuccess(`Next PO number set to ${num}`);
      loadData();
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError(err.response?.data?.error?.message || 'Failed to update');
    } finally { setSaving(false); }
  };

  const handleVoidNumber = async () => {
    const num = parseInt(voidNumber);
    if (!num || num < 1) { setError('Please enter a valid PO number'); return; }
    if (!voidReason.trim()) { setError('Please enter a reason for voiding'); return; }
    try {
      setSaving(true); setError(null);
      await voidPONumber(num, voidReason, 'admin');
      setSuccess(`PO${num} has been voided`);
      setVoidNumber(''); setVoidReason(''); setShowVoidConfirm(false);
      loadData();
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError(err.response?.data?.error?.message || 'Failed to void PO number');
    } finally { setSaving(false); }
  };

  const handleRelease = async (poNumber) => {
    try {
      setSaving(true); setError(null);
      await releasePONumber(poNumber);
      setSuccess(`PO${poNumber} released — number is now available for reuse`);
      setReleaseConfirm(null);
      loadData();
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError(err.response?.data?.error?.message || 'Failed to release PO number');
    } finally { setSaving(false); }
  };

  const handleReassign = async (oldPO) => {
    const newPO = parseInt(editValue);
    if (!newPO || newPO < 1) { setError('Please enter a valid number'); return; }
    if (newPO === oldPO) { setEditingPO(null); return; }
    try {
      setSaving(true); setError(null);
      await reassignPONumber(oldPO, newPO);
      setSuccess(`PO number changed from PO${oldPO} → PO${newPO}`);
      setEditingPO(null); setEditValue('');
      loadData();
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError(err.response?.data?.error?.message || 'Failed to change PO number');
    } finally { setSaving(false); }
  };

  const formatDate = (d) => {
    if (!d) return '—';
    return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' });
  };

  const filteredActive = activePOs.filter(po => {
    if (!searchFilter) return true;
    const s = searchFilter.toLowerCase();
    return String(po.poNumber).includes(s) || (po.supplier || '').toLowerCase().includes(s) || (po.clientName || '').toLowerCase().includes(s);
  });

  const orphanedPOs = activePOs.filter(po => !po.inboundOrderId && !po.workOrderId);

  if (loading) return <div className="loading"><div className="spinner"></div></div>;

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title"><ShoppingCart size={28} style={{ marginRight: 8 }} /> PO Number Management</h1>
        <button className="btn btn-outline" onClick={loadData}><RefreshCw size={18} /> Refresh</button>
      </div>

      {error && <div className="alert alert-error" style={{ marginBottom: 16 }}>{error}<button style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer' }} onClick={() => setError(null)}>×</button></div>}
      {success && <div className="alert alert-success" style={{ marginBottom: 16 }}>{success}</div>}

      {/* Stats */}
      <div className="grid grid-4" style={{ marginBottom: 24 }}>
        <div className="card" style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '2rem', fontWeight: 700, color: '#1976d2' }}>{stats.lastUsed || '—'}</div>
          <div style={{ fontSize: '0.85rem', color: '#666' }}>Last Used PO#</div>
        </div>
        <div className="card" style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '2rem', fontWeight: 700, color: '#388e3c' }}>{stats.nextNumber}</div>
          <div style={{ fontSize: '0.85rem', color: '#666' }}>Next Available PO#</div>
        </div>
        <div className="card" style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '2rem', fontWeight: 700, color: '#1976d2' }}>{stats.activeCount}</div>
          <div style={{ fontSize: '0.85rem', color: '#666' }}>Active PO Numbers</div>
        </div>
        <div className="card" style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '2rem', fontWeight: 700, color: orphanedPOs.length > 0 ? '#e65100' : '#999' }}>{orphanedPOs.length}</div>
          <div style={{ fontSize: '0.85rem', color: '#666' }}>Orphaned (no order)</div>
        </div>
      </div>

      {/* Orphaned Alert */}
      {orphanedPOs.length > 0 && (
        <div style={{ background: '#fff3e0', border: '1px solid #ffcc80', borderRadius: 8, padding: 16, marginBottom: 20 }}>
          <h4 style={{ color: '#e65100', margin: '0 0 8px', display: 'flex', alignItems: 'center', gap: 8 }}>
            <AlertTriangle size={18} /> {orphanedPOs.length} Orphaned PO Number{orphanedPOs.length > 1 ? 's' : ''} Found
          </h4>
          <p style={{ fontSize: '0.85rem', color: '#666', margin: '0 0 12px' }}>
            These PO numbers are active but have no linked inbound order or work order. Release them to free up the number for reuse.
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {orphanedPOs.map(po => (
              <div key={po.id} style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'white', border: '1px solid #ffcc80', borderRadius: 6, padding: '6px 12px' }}>
                <strong style={{ color: '#e65100' }}>PO{po.poNumber}</strong>
                <span style={{ fontSize: '0.8rem', color: '#666' }}>{po.supplier || po.clientName || ''}</span>
                {releaseConfirm === po.poNumber ? (
                  <div style={{ display: 'flex', gap: 4 }}>
                    <button onClick={() => handleRelease(po.poNumber)} disabled={saving}
                      style={{ background: '#e65100', color: 'white', padding: '2px 8px', fontSize: '0.75rem', border: 'none', borderRadius: 4, cursor: 'pointer' }}>
                      {saving ? '...' : 'Confirm'}
                    </button>
                    <button onClick={() => setReleaseConfirm(null)}
                      style={{ padding: '2px 8px', fontSize: '0.75rem', border: '1px solid #ccc', borderRadius: 4, cursor: 'pointer', background: 'white' }}>Cancel</button>
                  </div>
                ) : (
                  <button onClick={() => setReleaseConfirm(po.poNumber)}
                    style={{ background: '#fff3e0', color: '#e65100', border: '1px solid #e65100', padding: '2px 8px', fontSize: '0.75rem', borderRadius: 4, cursor: 'pointer',
                      display: 'flex', alignItems: 'center', gap: 4 }}>
                    <Unlock size={10} /> Release
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Controls */}
      <div className="grid grid-2" style={{ gap: 20, marginBottom: 24 }}>
        <div className="card">
          <h3 style={{ marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}><ShoppingCart size={20} /> Set Next PO Number</h3>
          <p style={{ fontSize: '0.85rem', color: '#666', marginBottom: 16 }}>Enter the number you want to use for the next material order.</p>
          <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end' }}>
            <div style={{ flex: 1 }}>
              <label className="form-label">Next PO Number</label>
              <input type="text" inputMode="numeric" className="form-input" value={newNextNumber}
                onChange={(e) => setNewNextNumber(e.target.value.replace(/[^0-9]/g, ''))} style={{ maxWidth: 200 }} />
            </div>
            <button className="btn btn-primary" onClick={handleUpdateNextNumber} disabled={saving}>
              <Save size={16} /> {saving ? 'Saving...' : 'Update'}
            </button>
          </div>
        </div>

        <div className="card">
          <h3 style={{ marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8, color: '#c62828' }}><AlertTriangle size={20} /> Void a PO Number</h3>
          <p style={{ fontSize: '0.85rem', color: '#666', marginBottom: 16 }}>Voiding marks the number as permanently used. Removes link from inbound orders.</p>
          <div className="form-group">
            <label className="form-label">PO Number to Void</label>
            <input type="text" inputMode="numeric" className="form-input" value={voidNumber}
              onChange={(e) => setVoidNumber(e.target.value.replace(/[^0-9]/g, ''))} placeholder="e.g., 7764" style={{ maxWidth: 200 }} />
          </div>
          <div className="form-group">
            <label className="form-label">Reason (required)</label>
            <input type="text" className="form-input" value={voidReason} onChange={(e) => setVoidReason(e.target.value)}
              placeholder="e.g., Order canceled, duplicate entry" />
          </div>
          {!showVoidConfirm ? (
            <button className="btn btn-danger" onClick={() => setShowVoidConfirm(true)} disabled={!voidNumber || !voidReason.trim()}>
              <Trash2 size={16} /> Void PO{voidNumber || '____'}
            </button>
          ) : (
            <div style={{ background: '#ffebee', border: '1px solid #ef5350', borderRadius: 8, padding: 16 }}>
              <p style={{ fontWeight: 600, color: '#c62828', marginBottom: 12 }}>⚠️ Are you sure you want to void PO{voidNumber}?</p>
              <p style={{ fontSize: '0.85rem', marginBottom: 12 }}>This will mark the PO number as voided and cannot be undone.</p>
              <div style={{ display: 'flex', gap: 8 }}>
                <button className="btn btn-danger" onClick={handleVoidNumber} disabled={saving}>{saving ? 'Voiding...' : 'Yes, Void It'}</button>
                <button className="btn btn-secondary" onClick={() => setShowVoidConfirm(false)}>Cancel</button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 0, marginBottom: 0 }}>
        {['active', 'voided'].map(t => (
          <button key={t} onClick={() => setTab(t)} style={{
            padding: '10px 24px', border: '1px solid #ddd', borderBottom: tab === t ? '2px solid #1976d2' : '1px solid #ddd',
            background: tab === t ? 'white' : '#f5f5f5', fontWeight: tab === t ? 700 : 400, color: tab === t ? '#1976d2' : '#666',
            cursor: 'pointer', borderRadius: '8px 8px 0 0', fontSize: '0.9rem'
          }}>
            {t === 'active' ? `Active PO Numbers (${activePOs.length})` : `Voided (${voidedNumbers.length})`}
          </button>
        ))}
      </div>

      {/* Active */}
      {tab === 'active' && (
        <div className="card" style={{ borderTopLeftRadius: 0 }}>
          <div style={{ display: 'flex', gap: 12, marginBottom: 16, alignItems: 'center' }}>
            <div style={{ position: 'relative', flex: 1, maxWidth: 300 }}>
              <Search size={16} style={{ position: 'absolute', left: 10, top: 10, color: '#999' }} />
              <input type="text" className="form-input" placeholder="Search PO#, supplier, or client..." value={searchFilter}
                onChange={(e) => setSearchFilter(e.target.value)} style={{ paddingLeft: 34 }} />
            </div>
            <span style={{ fontSize: '0.85rem', color: '#666' }}>{filteredActive.length} of {activePOs.length}</span>
          </div>

          {filteredActive.length === 0 ? (
            <p style={{ color: '#666', fontStyle: 'italic' }}>No active PO numbers{searchFilter ? ' matching search' : ''}</p>
          ) : (
            <table className="table">
              <thead>
                <tr><th>PO #</th><th>Supplier</th><th>Client</th><th>Linked Order</th><th>Created</th><th style={{ width: 180 }}>Actions</th></tr>
              </thead>
              <tbody>
                {filteredActive.map(po => (
                  <tr key={po.id} style={{ background: (!po.inboundOrderId && !po.workOrderId) ? '#fff3e0' : 'transparent' }}>
                    <td>
                      {editingPO === po.poNumber ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                          <span style={{ fontWeight: 700, color: '#1976d2' }}>PO</span>
                          <input type="text" inputMode="numeric" value={editValue}
                            onChange={(e) => setEditValue(e.target.value.replace(/[^0-9]/g, ''))}
                            onKeyDown={(e) => { if (e.key === 'Enter') handleReassign(po.poNumber); if (e.key === 'Escape') setEditingPO(null); }}
                            autoFocus onFocus={(e) => e.target.select()}
                            style={{ width: 80, padding: '2px 6px', fontSize: '0.9rem', fontWeight: 700, border: '2px solid #1976d2', borderRadius: 4 }} />
                          <button onClick={() => handleReassign(po.poNumber)} disabled={saving}
                            style={{ background: '#1976d2', color: 'white', border: 'none', borderRadius: 4, padding: '3px 8px', fontSize: '0.75rem', cursor: 'pointer' }}>
                            {saving ? '...' : 'Save'}
                          </button>
                          <button onClick={() => setEditingPO(null)}
                            style={{ background: '#eee', border: '1px solid #ccc', borderRadius: 4, padding: '3px 8px', fontSize: '0.75rem', cursor: 'pointer' }}>Cancel</button>
                        </div>
                      ) : (
                        <strong style={{ color: '#1976d2' }}>PO{po.poNumber}</strong>
                      )}
                    </td>
                    <td>{po.supplier || '—'}</td>
                    <td>{po.clientName || '—'}</td>
                    <td>
                      {po.workOrder
                        ? <span style={{ color: '#1565c0', fontSize: '0.85rem', cursor: 'pointer', fontWeight: 600 }}
                            onClick={() => navigate(`/workorders/${po.workOrder.id}`)}>
                            {po.workOrder.drNumber ? `DR-${po.workOrder.drNumber}` : po.workOrder.orderNumber} ↗
                          </span>
                        : po.workOrderId
                        ? <span style={{ color: '#388e3c', fontSize: '0.85rem' }}>✓ Work Order</span>
                        : po.inboundOrderId
                        ? <span style={{ color: '#388e3c', fontSize: '0.85rem' }}>✓ Inbound</span>
                        : <span style={{ color: '#e65100', fontSize: '0.85rem', fontWeight: 600 }}>⚠ No Order</span>
                      }
                    </td>
                    <td style={{ fontSize: '0.85rem', color: '#666' }}>{formatDate(po.createdAt)}</td>
                    <td>
                      <div style={{ display: 'flex', gap: 4 }}>
                        {editingPO !== po.poNumber && (
                          <button onClick={() => { setEditingPO(po.poNumber); setEditValue(String(po.poNumber)); }}
                            style={{ background: '#e3f2fd', color: '#1565c0', border: '1px solid #90caf9', padding: '3px 10px', fontSize: '0.75rem', borderRadius: 4, cursor: 'pointer',
                              display: 'flex', alignItems: 'center', gap: 4 }}>
                            <Edit2 size={12} /> Edit
                          </button>
                        )}
                        {releaseConfirm === po.poNumber ? (
                          <div style={{ display: 'flex', gap: 4 }}>
                            <button onClick={() => handleRelease(po.poNumber)} disabled={saving}
                              style={{ background: '#e65100', color: 'white', padding: '3px 8px', fontSize: '0.75rem', border: 'none', borderRadius: 4, cursor: 'pointer' }}>
                              {saving ? '...' : 'Yes'}
                            </button>
                            <button onClick={() => setReleaseConfirm(null)}
                              style={{ padding: '3px 8px', fontSize: '0.75rem', border: '1px solid #ccc', borderRadius: 4, cursor: 'pointer', background: 'white' }}>No</button>
                          </div>
                        ) : (
                          <button onClick={() => setReleaseConfirm(po.poNumber)}
                            style={{ background: (!po.inboundOrderId && !po.workOrderId) ? '#fff3e0' : '#f5f5f5', color: (!po.inboundOrderId && !po.workOrderId) ? '#e65100' : '#666',
                              border: `1px solid ${(!po.inboundOrderId && !po.workOrderId) ? '#e65100' : '#ccc'}`, padding: '3px 10px', fontSize: '0.75rem', borderRadius: 4, cursor: 'pointer',
                              display: 'flex', alignItems: 'center', gap: 4 }}>
                            <Unlock size={12} /> Release
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* Voided */}
      {tab === 'voided' && (
        <div className="card" style={{ borderTopLeftRadius: 0 }}>
          {voidedNumbers.length === 0 ? (
            <p style={{ color: '#666', fontStyle: 'italic' }}>No voided numbers</p>
          ) : (
            <table className="table">
              <thead><tr><th>PO #</th><th>Supplier</th><th>Client</th><th>Voided By</th><th>Voided Date</th><th>Reason</th></tr></thead>
              <tbody>
                {voidedNumbers.map(po => (
                  <tr key={po.id} style={{ opacity: 0.7 }}>
                    <td><span style={{ textDecoration: 'line-through', color: '#c62828' }}>PO{po.poNumber}</span></td>
                    <td>{po.supplier || '—'}</td>
                    <td>{po.clientName || '—'}</td>
                    <td>{po.voidedBy || 'admin'}</td>
                    <td>{formatDate(po.voidedAt)}</td>
                    <td>{po.voidReason}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}

export default PONumbersPage;
