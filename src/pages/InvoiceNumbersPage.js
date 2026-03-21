import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getInvoiceNumbers, voidInvoiceNumber, getNextInvoiceNumber, setNextInvoiceNumber, createManualInvoiceNumber } from '../services/api';

const InvoiceNumbersPage = () => {
  const navigate = useNavigate();
  const [invoiceNumbers, setInvoiceNumbers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [search, setSearch] = useState('');
  const [showVoid, setShowVoid] = useState(false);
  const [nextNum, setNextNum] = useState('');
  const [nextNumInput, setNextNumInput] = useState('');
  const [saving, setSaving] = useState(false);
  const [voidTarget, setVoidTarget] = useState(null);
  const [voidReason, setVoidReason] = useState('');
  const [manualOpen, setManualOpen] = useState(false);
  const [manualForm, setManualForm] = useState({ invoiceNumber: '', clientName: '' });

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [invRes, nextRes] = await Promise.all([getInvoiceNumbers(), getNextInvoiceNumber()]);
      setInvoiceNumbers(invRes.data.data || []);
      const n = nextRes.data.data?.nextNumber || 1001;
      setNextNum(String(n));
      setNextNumInput(String(n));
    } catch (err) {
      setError('Failed to load data');
    } finally { setLoading(false); }
  };

  const handleSetNextNumber = async () => {
    const num = parseInt(nextNumInput);
    if (!num || num < 1) { setError('Enter a valid number'); return; }
    try {
      setSaving(true);
      await setNextInvoiceNumber(num);
      setNextNum(String(num));
      setSuccess(`Next invoice number set to ${num}`);
    } catch (err) {
      setError('Failed to update');
    } finally { setSaving(false); }
  };

  const handleVoid = async () => {
    if (!voidTarget) return;
    try {
      setSaving(true);
      await voidInvoiceNumber(voidTarget.id, voidReason);
      setSuccess(`Invoice #${voidTarget.invoiceNumber} voided`);
      setVoidTarget(null);
      setVoidReason('');
      loadData();
    } catch (err) {
      setError(err.response?.data?.error?.message || 'Failed to void');
    } finally { setSaving(false); }
  };

  const handleManualCreate = async () => {
    const num = parseInt(manualForm.invoiceNumber);
    if (!num || num < 1) { setError('Enter a valid invoice number'); return; }
    try {
      setSaving(true);
      await createManualInvoiceNumber({ invoiceNumber: num, clientName: manualForm.clientName || null });
      setSuccess(`Invoice #${num} created`);
      setManualOpen(false);
      setManualForm({ invoiceNumber: '', clientName: '' });
      loadData();
    } catch (err) {
      setError(err.response?.data?.error?.message || 'Failed to create invoice number');
    } finally { setSaving(false); }
  };

  const filtered = search
    ? invoiceNumbers.filter(inv =>
        String(inv.invoiceNumber).includes(search) ||
        (inv.clientName || '').toLowerCase().includes(search.toLowerCase()) ||
        (inv.workOrder?.drNumber && String(inv.workOrder.drNumber).includes(search))
      )
    : invoiceNumbers;

  const activeCount = invoiceNumbers.filter(i => i.status === 'active').length;
  const voidCount = invoiceNumbers.filter(i => i.status === 'void').length;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h1 className="page-title">📄 Invoice Numbers</h1>
        <input type="text" className="form-input" placeholder="Search by invoice#, client, DR#..." style={{ width: 280 }}
          value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      {error && <div className="alert alert-error" style={{ marginBottom: 12 }}>{error} <button onClick={() => setError('')} style={{ float: 'right', background: 'none', border: 'none', cursor: 'pointer' }}>×</button></div>}
      {success && <div className="alert alert-success" style={{ marginBottom: 12 }}>{success} <button onClick={() => setSuccess('')} style={{ float: 'right', background: 'none', border: 'none', cursor: 'pointer' }}>×</button></div>}

      {/* Next Number Config */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <h3 style={{ margin: 0, fontSize: '1rem' }}>Invoice Number Sequence</h3>
            <p style={{ color: '#666', fontSize: '0.85rem', margin: '4px 0 0' }}>
              {activeCount} active, {voidCount} voided — Next: <strong>#{nextNum}</strong>
            </p>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <span style={{ fontWeight: 600, color: '#555', fontSize: '0.9rem' }}>Next #:</span>
            <input type="number" className="form-input" style={{ width: 110 }}
              value={nextNumInput} onChange={e => setNextNumInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleSetNextNumber(); }} />
            <button className="btn btn-primary" disabled={saving || nextNumInput === nextNum} onClick={handleSetNextNumber}>
              {saving ? '...' : 'Set'}
            </button>
            <button className="btn btn-outline" onClick={() => setShowVoid(!showVoid)}
              style={{ color: showVoid ? '#c62828' : '#666', borderColor: showVoid ? '#c62828' : '#ccc' }}>
              {showVoid ? 'Hide Voided' : 'Show Voided'}
            </button>
            <button className="btn" onClick={() => { setManualOpen(true); setManualForm({ invoiceNumber: nextNum, clientName: '' }); }}
              style={{ background: '#1565C0', color: 'white', border: 'none', fontWeight: 600 }}>
              + Manual Entry
            </button>
          </div>
        </div>
      </div>

      {/* Invoice Number Table */}
      {loading ? (
        <div className="loading"><div className="spinner"></div></div>
      ) : filtered.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: 40, color: '#999' }}>
          <div style={{ fontSize: '3rem', marginBottom: 8 }}>📄</div>
          <div>No invoice numbers assigned yet. Export an IIF from the Invoice Center to auto-assign.</div>
        </div>
      ) : (
        <div className="card" style={{ padding: 0 }}>
          <table className="table" style={{ margin: 0 }}>
            <thead>
              <tr>
                <th>Invoice #</th>
                <th>Client</th>
                <th>Work Order</th>
                <th>Status</th>
                <th>Assigned</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filtered.filter(inv => showVoid || inv.status === 'active').map(inv => (
                <tr key={inv.id} style={inv.status === 'void' ? { opacity: 0.5, background: '#fafafa' } : {}}>
                  <td>
                    <span style={{ fontFamily: 'Courier New, monospace', fontWeight: 700, fontSize: '1.05rem', color: inv.status === 'void' ? '#999' : '#1565C0' }}>
                      #{inv.invoiceNumber}
                    </span>
                  </td>
                  <td style={{ fontWeight: 500 }}>{inv.clientName || '—'}</td>
                  <td>
                    {inv.workOrder ? (
                      <span style={{ fontFamily: 'monospace', color: '#1565C0', cursor: 'pointer', fontWeight: 600 }}
                        onClick={() => navigate(`/workorders/${inv.workOrderId}`)}>
                        {inv.workOrder.drNumber ? `DR-${inv.workOrder.drNumber}` : inv.workOrder.orderNumber}
                      </span>
                    ) : '—'}
                  </td>
                  <td>
                    <span style={{
                      padding: '3px 10px', borderRadius: 12, fontSize: '0.75rem', fontWeight: 600,
                      background: inv.status === 'active' ? '#E8F5E9' : '#FFEBEE',
                      color: inv.status === 'active' ? '#2E7D32' : '#C62828'
                    }}>
                      {inv.status === 'active' ? 'Active' : 'Voided'}
                    </span>
                    {inv.status === 'void' && inv.voidReason && (
                      <div style={{ fontSize: '0.7rem', color: '#999', marginTop: 2 }}>{inv.voidReason}</div>
                    )}
                  </td>
                  <td style={{ fontSize: '0.85rem', color: '#666' }}>
                    {new Date(inv.createdAt).toLocaleDateString()}
                  </td>
                  <td>
                    {inv.status === 'active' && (
                      <button className="btn btn-sm btn-outline" 
                        style={{ fontSize: '0.75rem', padding: '3px 8px', color: '#c62828', borderColor: '#c62828' }}
                        onClick={() => { setVoidTarget(inv); setVoidReason(''); }}>
                        Void
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Void Confirmation Modal */}
      {voidTarget && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.6)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          onClick={() => setVoidTarget(null)}>
          <div style={{ background: 'white', borderRadius: 12, padding: 24, maxWidth: 400, width: '90%', boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }}
            onClick={e => e.stopPropagation()}>
            <h3 style={{ marginBottom: 12, color: '#c62828' }}>Void Invoice #{voidTarget.invoiceNumber}?</h3>
            <p style={{ color: '#666', marginBottom: 12, fontSize: '0.9rem' }}>
              This will void invoice #{voidTarget.invoiceNumber} for {voidTarget.clientName || 'Unknown'} 
              and clear the invoice from the linked work order.
            </p>
            <div className="form-group" style={{ marginBottom: 16 }}>
              <label className="form-label">Reason (optional)</label>
              <input type="text" className="form-input" placeholder="e.g. Duplicate, wrong amount" 
                value={voidReason} onChange={e => setVoidReason(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') handleVoid(); }} />
            </div>
            <div style={{ display: 'flex', gap: 12 }}>
              <button className="btn" onClick={handleVoid} disabled={saving}
                style={{ flex: 1, background: '#c62828', color: 'white', border: 'none', fontWeight: 700, borderRadius: 8, padding: '12px' }}>
                {saving ? 'Voiding...' : 'Void Invoice'}
              </button>
              <button className="btn btn-outline" onClick={() => setVoidTarget(null)} style={{ padding: '12px 20px' }}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Manual Entry Modal */}
      {manualOpen && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.6)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          onClick={() => setManualOpen(false)}>
          <div style={{ background: 'white', borderRadius: 12, padding: 0, maxWidth: 420, width: '90%', boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }}
            onClick={e => e.stopPropagation()}>
            <div style={{ background: '#1565C0', color: 'white', padding: '16px 24px', borderRadius: '12px 12px 0 0' }}>
              <div style={{ fontSize: '1.1rem', fontWeight: 700 }}>Manual Invoice Number Entry</div>
              <div style={{ fontSize: '0.85rem', opacity: 0.9, marginTop: 4 }}>Create an invoice number record manually</div>
            </div>
            <div style={{ padding: 24 }}>
              <div className="form-group" style={{ marginBottom: 16 }}>
                <label className="form-label" style={{ fontWeight: 600 }}>Invoice Number *</label>
                <input type="number" className="form-input" placeholder="e.g. 1015" autoFocus
                  value={manualForm.invoiceNumber} onChange={e => setManualForm({ ...manualForm, invoiceNumber: e.target.value })}
                  onKeyDown={e => { if (e.key === 'Enter') handleManualCreate(); }} />
              </div>
              <div className="form-group" style={{ marginBottom: 20 }}>
                <label className="form-label" style={{ fontWeight: 600 }}>Client Name <span style={{ fontWeight: 400, color: '#888' }}>(optional)</span></label>
                <input type="text" className="form-input" placeholder="e.g. Nowell Steel and Supply"
                  value={manualForm.clientName} onChange={e => setManualForm({ ...manualForm, clientName: e.target.value })} />
              </div>
              <div style={{ display: 'flex', gap: 12 }}>
                <button className="btn" onClick={handleManualCreate} disabled={saving || !manualForm.invoiceNumber}
                  style={{ flex: 1, background: manualForm.invoiceNumber ? '#1565C0' : '#ccc', color: 'white', border: 'none', padding: '14px', fontWeight: 700, borderRadius: 8 }}>
                  {saving ? 'Creating...' : 'Create Invoice #' + (manualForm.invoiceNumber || '...')}
                </button>
                <button onClick={() => setManualOpen(false)}
                  style={{ padding: '14px 20px', background: 'none', border: '1px solid #ccc', borderRadius: 8, cursor: 'pointer', color: '#666' }}>
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default InvoiceNumbersPage;
