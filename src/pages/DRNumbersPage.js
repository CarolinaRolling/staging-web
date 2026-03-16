import React, { useState, useEffect } from 'react';
import { Hash, AlertTriangle, Trash2, RefreshCw, Save, Unlock, Search } from 'lucide-react';
import { getDRNumbers, getDRNumberStats, setNextDRNumber, voidDRNumber, releaseDRNumber, getVoidedDRNumbers } from '../services/api';

function DRNumbersPage() {
  const [stats, setStats] = useState({ lastUsed: 0, nextNumber: 1, voidedCount: 0, activeCount: 0 });
  const [activeDRs, setActiveDRs] = useState([]);
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

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [statsRes, activeRes, voidedRes] = await Promise.all([
        getDRNumberStats(),
        getDRNumbers({ status: 'active', limit: 500 }),
        getVoidedDRNumbers()
      ]);
      setStats(statsRes.data.data);
      setNewNextNumber(statsRes.data.data.nextNumber.toString());
      setActiveDRs(activeRes.data.data || []);
      setVoidedNumbers(voidedRes.data.data || []);
    } catch (err) {
      setError('Failed to load DR number data');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateNextNumber = async () => {
    const num = parseInt(newNextNumber);
    if (!num || num < 1) { setError('Please enter a valid number'); return; }
    try {
      setSaving(true); setError(null);
      await setNextDRNumber(num);
      setSuccess(`Next DR number set to ${num}`);
      loadData();
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError(err.response?.data?.error?.message || 'Failed to update');
    } finally { setSaving(false); }
  };

  const handleVoidNumber = async () => {
    const num = parseInt(voidNumber);
    if (!num || num < 1) { setError('Please enter a valid DR number'); return; }
    if (!voidReason.trim()) { setError('Please enter a reason for voiding'); return; }
    try {
      setSaving(true); setError(null);
      await voidDRNumber(num, voidReason, 'admin');
      setSuccess(`DR-${num} has been voided`);
      setVoidNumber(''); setVoidReason(''); setShowVoidConfirm(false);
      loadData();
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError(err.response?.data?.error?.message || 'Failed to void DR number');
    } finally { setSaving(false); }
  };

  const handleRelease = async (drNumber) => {
    try {
      setSaving(true); setError(null);
      await releaseDRNumber(drNumber);
      setSuccess(`DR-${drNumber} released — number is now available for reuse`);
      setReleaseConfirm(null);
      loadData();
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError(err.response?.data?.error?.message || 'Failed to release DR number');
    } finally { setSaving(false); }
  };

  const formatDate = (d) => {
    if (!d) return '—';
    return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' });
  };

  const filteredActive = activeDRs.filter(dr => {
    if (!searchFilter) return true;
    const s = searchFilter.toLowerCase();
    return String(dr.drNumber).includes(s) || (dr.clientName || '').toLowerCase().includes(s);
  });

  const orphanedDRs = activeDRs.filter(dr => !dr.workOrderId);

  if (loading) return <div className="loading"><div className="spinner"></div></div>;

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title"><Hash size={28} style={{ marginRight: 8 }} /> DR Number Management</h1>
        <button className="btn btn-outline" onClick={loadData}><RefreshCw size={18} /> Refresh</button>
      </div>

      {error && <div className="alert alert-error" style={{ marginBottom: 16 }}>{error}<button style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer' }} onClick={() => setError(null)}>×</button></div>}
      {success && <div className="alert alert-success" style={{ marginBottom: 16 }}>{success}</div>}

      {/* Stats */}
      <div className="grid grid-4" style={{ marginBottom: 24 }}>
        <div className="card" style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '2rem', fontWeight: 700, color: '#1976d2' }}>{stats.lastUsed || '—'}</div>
          <div style={{ fontSize: '0.85rem', color: '#666' }}>Last Used DR#</div>
        </div>
        <div className="card" style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '2rem', fontWeight: 700, color: '#388e3c' }}>{stats.nextNumber}</div>
          <div style={{ fontSize: '0.85rem', color: '#666' }}>Next Available DR#</div>
        </div>
        <div className="card" style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '2rem', fontWeight: 700, color: '#1976d2' }}>{stats.activeCount}</div>
          <div style={{ fontSize: '0.85rem', color: '#666' }}>Active DR Numbers</div>
        </div>
        <div className="card" style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '2rem', fontWeight: 700, color: orphanedDRs.length > 0 ? '#e65100' : '#999' }}>{orphanedDRs.length}</div>
          <div style={{ fontSize: '0.85rem', color: '#666' }}>Orphaned (no WO)</div>
        </div>
      </div>

      {/* Orphaned Alert */}
      {orphanedDRs.length > 0 && (
        <div style={{ background: '#fff3e0', border: '1px solid #ffcc80', borderRadius: 8, padding: 16, marginBottom: 20 }}>
          <h4 style={{ color: '#e65100', margin: '0 0 8px', display: 'flex', alignItems: 'center', gap: 8 }}>
            <AlertTriangle size={18} /> {orphanedDRs.length} Orphaned DR Number{orphanedDRs.length > 1 ? 's' : ''} Found
          </h4>
          <p style={{ fontSize: '0.85rem', color: '#666', margin: '0 0 12px' }}>
            These DR numbers are active but have no linked work order. Release them to free up the number for reuse.
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {orphanedDRs.map(dr => (
              <div key={dr.id} style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'white', border: '1px solid #ffcc80', borderRadius: 6, padding: '6px 12px' }}>
                <strong style={{ color: '#e65100' }}>DR-{dr.drNumber}</strong>
                <span style={{ fontSize: '0.8rem', color: '#666' }}>{dr.clientName || ''}</span>
                {releaseConfirm === dr.drNumber ? (
                  <div style={{ display: 'flex', gap: 4 }}>
                    <button onClick={() => handleRelease(dr.drNumber)} disabled={saving}
                      style={{ background: '#e65100', color: 'white', padding: '2px 8px', fontSize: '0.75rem', border: 'none', borderRadius: 4, cursor: 'pointer' }}>
                      {saving ? '...' : 'Confirm'}
                    </button>
                    <button onClick={() => setReleaseConfirm(null)}
                      style={{ padding: '2px 8px', fontSize: '0.75rem', border: '1px solid #ccc', borderRadius: 4, cursor: 'pointer', background: 'white' }}>Cancel</button>
                  </div>
                ) : (
                  <button onClick={() => setReleaseConfirm(dr.drNumber)}
                    style={{ background: '#fff3e0', color: '#e65100', border: '1px solid #e65100', padding: '2px 8px', fontSize: '0.75rem', borderRadius: 4, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}>
                    <Unlock size={12} /> Release
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
          <h3 style={{ marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}><Hash size={20} /> Set Next DR Number</h3>
          <p style={{ fontSize: '0.85rem', color: '#666', marginBottom: 16 }}>Enter the number you want to use for the next work order.</p>
          <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end' }}>
            <div style={{ flex: 1 }}>
              <label className="form-label">Next DR Number</label>
              <input type="text" inputMode="numeric" className="form-input" value={newNextNumber}
                onChange={(e) => setNewNextNumber(e.target.value.replace(/[^0-9]/g, ''))} style={{ maxWidth: 200 }} />
            </div>
            <button className="btn btn-primary" onClick={handleUpdateNextNumber} disabled={saving}>
              <Save size={16} /> {saving ? 'Saving...' : 'Update'}
            </button>
          </div>
        </div>

        <div className="card">
          <h3 style={{ marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8, color: '#c62828' }}><AlertTriangle size={20} /> Void a DR Number</h3>
          <p style={{ fontSize: '0.85rem', color: '#666', marginBottom: 16 }}>Voiding marks the number as permanently used. Deletes the linked work order.</p>
          <div className="form-group">
            <label className="form-label">DR Number to Void</label>
            <input type="text" inputMode="numeric" className="form-input" value={voidNumber}
              onChange={(e) => setVoidNumber(e.target.value.replace(/[^0-9]/g, ''))} placeholder="e.g., 1234" style={{ maxWidth: 200 }} />
          </div>
          <div className="form-group">
            <label className="form-label">Reason (required)</label>
            <input type="text" className="form-input" value={voidReason} onChange={(e) => setVoidReason(e.target.value)}
              placeholder="e.g., Order canceled by customer" />
          </div>
          {!showVoidConfirm ? (
            <button className="btn btn-danger" onClick={() => setShowVoidConfirm(true)} disabled={!voidNumber || !voidReason.trim()}>
              <Trash2 size={16} /> Void DR-{voidNumber || '____'}
            </button>
          ) : (
            <div style={{ background: '#ffebee', border: '1px solid #ef5350', borderRadius: 8, padding: 16 }}>
              <p style={{ fontWeight: 600, color: '#c62828', marginBottom: 12 }}>⚠️ Are you sure you want to void DR-{voidNumber}?</p>
              <p style={{ fontSize: '0.85rem', marginBottom: 12 }}>This will permanently delete the work order and cannot be undone.</p>
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
            {t === 'active' ? `Active DR Numbers (${activeDRs.length})` : `Voided (${voidedNumbers.length})`}
          </button>
        ))}
      </div>

      {/* Active */}
      {tab === 'active' && (
        <div className="card" style={{ borderTopLeftRadius: 0 }}>
          <div style={{ display: 'flex', gap: 12, marginBottom: 16, alignItems: 'center' }}>
            <div style={{ position: 'relative', flex: 1, maxWidth: 300 }}>
              <Search size={16} style={{ position: 'absolute', left: 10, top: 10, color: '#999' }} />
              <input type="text" className="form-input" placeholder="Search DR# or client..." value={searchFilter}
                onChange={(e) => setSearchFilter(e.target.value)} style={{ paddingLeft: 34 }} />
            </div>
            <span style={{ fontSize: '0.85rem', color: '#666' }}>{filteredActive.length} of {activeDRs.length}</span>
          </div>

          {filteredActive.length === 0 ? (
            <p style={{ color: '#666', fontStyle: 'italic' }}>No active DR numbers{searchFilter ? ' matching search' : ''}</p>
          ) : (
            <table className="table">
              <thead>
                <tr><th>DR #</th><th>Client</th><th>Work Order</th><th>Created</th><th style={{ width: 120 }}>Actions</th></tr>
              </thead>
              <tbody>
                {filteredActive.map(dr => (
                  <tr key={dr.id} style={{ background: !dr.workOrderId ? '#fff3e0' : 'transparent' }}>
                    <td><strong style={{ color: '#1976d2' }}>DR-{dr.drNumber}</strong></td>
                    <td>{dr.clientName || '—'}</td>
                    <td>
                      {dr.workOrderId
                        ? <span style={{ color: '#388e3c', fontSize: '0.85rem' }}>✓ Linked</span>
                        : <span style={{ color: '#e65100', fontSize: '0.85rem', fontWeight: 600 }}>⚠ No WO</span>
                      }
                    </td>
                    <td style={{ fontSize: '0.85rem', color: '#666' }}>{formatDate(dr.createdAt)}</td>
                    <td>
                      {releaseConfirm === dr.drNumber ? (
                        <div style={{ display: 'flex', gap: 4 }}>
                          <button onClick={() => handleRelease(dr.drNumber)} disabled={saving}
                            style={{ background: '#e65100', color: 'white', padding: '3px 8px', fontSize: '0.75rem', border: 'none', borderRadius: 4, cursor: 'pointer' }}>
                            {saving ? '...' : 'Yes'}
                          </button>
                          <button onClick={() => setReleaseConfirm(null)}
                            style={{ padding: '3px 8px', fontSize: '0.75rem', border: '1px solid #ccc', borderRadius: 4, cursor: 'pointer', background: 'white' }}>No</button>
                        </div>
                      ) : (
                        <button onClick={() => setReleaseConfirm(dr.drNumber)}
                          style={{ background: !dr.workOrderId ? '#fff3e0' : '#f5f5f5', color: !dr.workOrderId ? '#e65100' : '#666',
                            border: `1px solid ${!dr.workOrderId ? '#e65100' : '#ccc'}`, padding: '3px 10px', fontSize: '0.75rem', borderRadius: 4, cursor: 'pointer',
                            display: 'flex', alignItems: 'center', gap: 4 }}>
                          <Unlock size={12} /> Release
                        </button>
                      )}
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
              <thead><tr><th>DR #</th><th>Original Client</th><th>Voided By</th><th>Voided Date</th><th>Reason</th></tr></thead>
              <tbody>
                {voidedNumbers.map(dr => (
                  <tr key={dr.id} style={{ opacity: 0.7 }}>
                    <td><span style={{ textDecoration: 'line-through', color: '#c62828' }}>DR-{dr.drNumber}</span></td>
                    <td>{dr.clientName || '—'}</td>
                    <td>{dr.voidedBy || 'admin'}</td>
                    <td>{formatDate(dr.voidedAt)}</td>
                    <td>{dr.voidReason}</td>
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

export default DRNumbersPage;
