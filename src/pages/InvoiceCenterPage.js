import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getInvoiceQueue, getInvoiceHistory, getInvoiceSkipped, uploadInvoicePdf, clearInvoice, exportWorkOrderIIF, assignInvoiceNumber, exportBatchIIF, getNextInvoiceNumber, skipInvoice, restoreInvoice, markInvoiceSent } from '../services/api';

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];

const InvoiceCenterPage = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('queue');
  const [queue, setQueue] = useState([]);
  const [history, setHistory] = useState([]);
  const [skipped, setSkipped] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [search, setSearch] = useState('');
  const [saving, setSaving] = useState(false);
  const [pdfUploadWO, setPdfUploadWO] = useState(null);
  const [pdfFile, setPdfFile] = useState(null);
  const [selected, setSelected] = useState(new Set());
  const [batchConfirmOpen, setBatchConfirmOpen] = useState(false);
  const [batchPreview, setBatchPreview] = useState([]);
  const [nextInvNum, setNextInvNum] = useState(null);
  const [skipModal, setSkipModal] = useState(null);
  const [skipReason, setSkipReason] = useState('');
  const [sentModal, setSentModal] = useState(null);
  const [sentFile, setSentFile] = useState(null);
  const [sentDate, setSentDate] = useState('');
  const [showSkipped, setShowSkipped] = useState(false);
  const [manualModal, setManualModal] = useState(null);
  const [manualInvNum, setManualInvNum] = useState('');

  useEffect(() => { loadData(); }, [activeTab]);

  const loadData = async () => {
    try {
      setLoading(true); setError('');
      if (activeTab === 'queue') {
        const [qRes, numRes] = await Promise.all([getInvoiceQueue(), getNextInvoiceNumber()]);
        setQueue(qRes.data.data || []);
        setNextInvNum(numRes.data.data?.nextNumber || 1001);
      } else {
        const [hRes, sRes] = await Promise.all([getInvoiceHistory(), getInvoiceSkipped()]);
        setHistory(hRes.data.data || []);
        setSkipped(sRes.data.data || []);
      }
    } catch (err) { setError('Failed to load data'); }
    finally { setLoading(false); }
  };

  const toggleSelect = (id) => { setSelected(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; }); };
  const toggleSelectAll = () => { setSelected(selected.size === filteredQueue.length ? new Set() : new Set(filteredQueue.map(wo => wo.id))); };

  const handleExportIIF = async (wo) => {
    try {
      if (!wo.invoiceNumber) {
        const r = await assignInvoiceNumber(wo.id);
        wo.invoiceNumber = r.data.data.invoiceNumber;
      }
      const response = await exportWorkOrderIIF(wo.id);
      const iifContent = typeof response.data === 'string' ? response.data : JSON.stringify(response.data);
      const blob = new Blob([iifContent], { type: 'text/plain' });
      const url = window.URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url;
      a.download = `invoice-${wo.invoiceNumber}-${(wo.clientName || '').replace(/[^a-zA-Z0-9]/g, '_')}.iif`;
      document.body.appendChild(a); a.click(); window.URL.revokeObjectURL(url); a.remove();
      setSuccess(`IIF exported — Invoice #${wo.invoiceNumber}`); loadData();
    } catch (err) { setError(err.response?.data?.error?.message || 'Failed to export IIF'); }
  };

  const handleManualAssign = async () => {
    const num = manualInvNum.trim();
    if (!num) { setError('Enter an invoice number'); return; }
    try {
      setSaving(true);
      // Use the record-invoice endpoint with just the number
      const fd = new FormData();
      fd.append('invoiceNumber', num);
      fd.append('invoiceDate', new Date().toISOString().split('T')[0]);
      const { recordInvoice } = await import('../services/api');
      await recordInvoice(manualModal.id, fd);
      setSuccess(`Invoice #${num} assigned to ${manualModal.drNumber ? 'DR-' + manualModal.drNumber : manualModal.orderNumber}`);
      setManualModal(null); setManualInvNum(''); loadData();
    } catch (err) { setError(err.response?.data?.error?.message || 'Failed to assign'); }
    finally { setSaving(false); }
  };

  const handleBatchConfirm = () => {
    const sel = filteredQueue.filter(wo => selected.has(wo.id));
    if (!sel.length) return;
    let num = nextInvNum;
    setBatchPreview(sel.map(wo => ({ id: wo.id, drNumber: wo.drNumber ? 'DR-' + wo.drNumber : wo.orderNumber, clientName: wo.clientName, total: getWOTotal(wo), invoiceNumber: wo.invoiceNumber || num++ })));
    setBatchConfirmOpen(true);
  };

  const handleBatchExport = async () => {
    try {
      setSaving(true);
      for (const item of batchPreview) { const o = queue.find(q => q.id === item.id); if (!o?.invoiceNumber) await assignInvoiceNumber(item.id); }
      const response = await exportBatchIIF(batchPreview.map(p => p.id));
      const iifContent = typeof response.data === 'string' ? response.data : JSON.stringify(response.data);
      const blob = new Blob([iifContent], { type: 'text/plain' });
      const url = window.URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url;
      a.download = `quickbooks-batch-${new Date().toISOString().split('T')[0]}.iif`;
      document.body.appendChild(a); a.click(); window.URL.revokeObjectURL(url); a.remove();
      setSuccess(`Batch exported — ${batchPreview.length} invoices`);
      setBatchConfirmOpen(false); setSelected(new Set()); loadData();
    } catch (err) { setError(err.response?.data?.error?.message || 'Failed to export batch'); }
    finally { setSaving(false); }
  };

  const handleMarkSent = async () => {
    try {
      setSaving(true);
      const fd = new FormData();
      if (sentFile) fd.append('invoicePdf', sentFile);
      if (sentDate) fd.append('invoiceDate', sentDate);
      await markInvoiceSent(sentModal.id, fd);
      setSuccess(`Invoice #${sentModal.invoiceNumber} marked as sent`);
      setSentModal(null); setSentFile(null); setSentDate(''); loadData();
    } catch (err) { setError(err.response?.data?.error?.message || 'Failed'); }
    finally { setSaving(false); }
  };

  const handleSkip = async () => {
    try {
      setSaving(true);
      await skipInvoice(skipModal.id, skipReason);
      setSuccess(`${skipModal.drNumber ? 'DR-' + skipModal.drNumber : skipModal.orderNumber} moved to Not Invoiced`);
      setSkipModal(null); setSkipReason(''); loadData();
    } catch (err) { setError('Failed to skip'); }
    finally { setSaving(false); }
  };

  const handleRestore = async (wo) => {
    try { await restoreInvoice(wo.id); setSuccess('Restored to queue'); loadData(); }
    catch (err) { setError('Failed to restore'); }
  };

  const handleUploadPdf = async () => {
    if (!pdfFile) return;
    try {
      setSaving(true); const fd = new FormData(); fd.append('invoicePdf', pdfFile);
      await uploadInvoicePdf(pdfUploadWO.id, fd);
      setSuccess('PDF uploaded'); setPdfUploadWO(null); setPdfFile(null); loadData();
    } catch (err) { setError('Failed to upload PDF'); }
    finally { setSaving(false); }
  };

  const handleClearInvoice = async (wo) => {
    if (!window.confirm(`Remove invoice ${wo.invoiceNumber} from ${wo.drNumber ? 'DR-' + wo.drNumber : wo.orderNumber}? This moves it back to the queue.`)) return;
    try { await clearInvoice(wo.id); setSuccess('Invoice cleared'); loadData(); } catch (err) { setError('Failed'); }
  };

  const formatCurrency = (v) => '$' + (parseFloat(v) || 0).toFixed(2);
  const getWOTotal = (wo) => (wo.parts || []).reduce((s, p) => s + (parseFloat(p.partTotal) || 0), 0) + (parseFloat(wo.truckingCost) || 0);

  const filteredQueue = search ? queue.filter(wo => (wo.clientName || '').toLowerCase().includes(search.toLowerCase()) || (wo.drNumber && String(wo.drNumber).includes(search))) : queue;
  const filteredHistory = search ? history.filter(wo => (wo.clientName || '').toLowerCase().includes(search.toLowerCase()) || (wo.drNumber && String(wo.drNumber).includes(search)) || (wo.invoiceNumber || '').includes(search)) : history;

  // Group history by month/year
  const groupedHistory = {};
  filteredHistory.forEach(wo => {
    const d = wo.invoiceDate ? new Date(wo.invoiceDate) : wo.createdAt ? new Date(wo.createdAt) : new Date();
    const key = `${d.getFullYear()}-${String(d.getMonth()).padStart(2, '0')}`;
    const label = `${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
    if (!groupedHistory[key]) groupedHistory[key] = { label, items: [] };
    groupedHistory[key].items.push(wo);
  });
  const sortedMonths = Object.keys(groupedHistory).sort().reverse();

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h1 className="page-title">Invoice Center</h1>
        <input type="text" className="form-input" placeholder="Search..." style={{ width: 260 }} value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      {error && <div className="alert alert-error" style={{ marginBottom: 12 }}>{error} <button onClick={() => setError('')} style={{ float: 'right', background: 'none', border: 'none', cursor: 'pointer' }}>x</button></div>}
      {success && <div className="alert alert-success" style={{ marginBottom: 12 }}>{success} <button onClick={() => setSuccess('')} style={{ float: 'right', background: 'none', border: 'none', cursor: 'pointer' }}>x</button></div>}

      <div className="tabs" style={{ marginBottom: 16 }}>
        <button className={`tab ${activeTab === 'queue' ? 'active' : ''}`} onClick={() => { setActiveTab('queue'); setSelected(new Set()); }}>
          Awaiting Invoice {queue.length > 0 && <span style={{ marginLeft: 6, background: '#E65100', color: 'white', borderRadius: 10, padding: '2px 8px', fontSize: '0.75rem' }}>{queue.length}</span>}
        </button>
        <button className={`tab ${activeTab === 'history' ? 'active' : ''}`} onClick={() => setActiveTab('history')}>Invoiced</button>
      </div>

      {loading ? <div className="loading"><div className="spinner"></div></div> :

      /* ========== QUEUE TAB ========== */
      activeTab === 'queue' ? (
        <div>
          {selected.size > 0 && (
            <div style={{ background: '#E3F2FD', border: '2px solid #1565C0', borderRadius: 8, padding: '12px 20px', marginBottom: 12, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontWeight: 600, color: '#1565C0' }}>{selected.size} selected</span>
              <div style={{ display: 'flex', gap: 8 }}>
                <button className="btn" onClick={handleBatchConfirm} style={{ background: '#2E7D32', color: 'white', border: 'none', fontWeight: 700, padding: '10px 20px' }}>Batch IIF Export ({selected.size})</button>
                <button className="btn btn-outline" onClick={() => setSelected(new Set())}>Clear</button>
              </div>
            </div>
          )}
          {filteredQueue.length === 0 ? (
            <div className="card" style={{ textAlign: 'center', padding: 40, color: '#999' }}>All caught up! No work orders waiting to be invoiced.</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '4px 8px' }}>
                <input type="checkbox" checked={selected.size === filteredQueue.length && filteredQueue.length > 0} onChange={toggleSelectAll} style={{ width: 18, height: 18, cursor: 'pointer' }} />
                <span style={{ fontSize: '0.85rem', color: '#666', fontWeight: 600 }}>Select All ({filteredQueue.length})</span>
              </div>
              {filteredQueue.map(wo => {
                const drLabel = wo.drNumber ? 'DR-' + wo.drNumber : wo.orderNumber;
                const total = getWOTotal(wo);
                return (
                  <div key={wo.id} className="card" style={{ padding: '14px 20px', borderLeft: selected.has(wo.id) ? '4px solid #1565C0' : '4px solid transparent' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <input type="checkbox" checked={selected.has(wo.id)} onChange={() => toggleSelect(wo.id)} style={{ width: 18, height: 18, cursor: 'pointer', flexShrink: 0 }} />
                      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
                        <div style={{ flex: 1, minWidth: 200 }}>
                          <span style={{ fontFamily: 'Courier New, monospace', fontWeight: 700, fontSize: '1.1rem', color: '#1565C0', cursor: 'pointer' }} onClick={() => navigate('/workorders/' + wo.id)}>{drLabel}</span>
                          {wo.invoiceNumber && <span style={{ marginLeft: 8, fontFamily: 'monospace', fontWeight: 600, color: '#2E7D32' }}>#{wo.invoiceNumber}</span>}
                          <div style={{ fontSize: '0.85rem', color: '#555' }}>{wo.clientName}</div>
                        </div>
                        <div style={{ textAlign: 'right', minWidth: 90 }}>
                          <div style={{ fontWeight: 700, fontSize: '1.05rem' }}>{formatCurrency(total)}</div>
                          <div style={{ fontSize: '0.75rem', color: '#888' }}>{(wo.parts || []).length} part{(wo.parts || []).length !== 1 ? 's' : ''}</div>
                        </div>
                        <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                          <button className="btn btn-outline" style={{ padding: '8px 12px', fontSize: '0.85rem', borderColor: '#2E7D32', color: '#2E7D32' }} onClick={() => handleExportIIF(wo)}>IIF</button>
                          <button className="btn" style={{ padding: '8px 14px', fontSize: '0.85rem', background: '#7B1FA2', color: 'white', border: 'none', fontWeight: 600 }} onClick={() => { setManualModal(wo); setManualInvNum(wo.invoiceNumber || ''); }}>Assign #</button>
                          {wo.invoiceNumber && !wo.invoiceDate && (
                            <button className="btn" style={{ padding: '8px 14px', fontSize: '0.85rem', background: '#1565C0', color: 'white', border: 'none', fontWeight: 600 }} onClick={() => { setSentModal(wo); setSentFile(null); setSentDate(new Date().toISOString().split('T')[0]); }}>Invoice Sent</button>
                          )}
                          <button className="btn btn-outline" style={{ padding: '8px 10px', fontSize: '0.8rem', color: '#888', borderColor: '#ccc' }} onClick={() => { setSkipModal(wo); setSkipReason(''); }}>Skip</button>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ) :

      /* ========== INVOICED TAB ========== */
      (
        <div>
          {filteredHistory.length === 0 && skipped.length === 0 ? (
            <div className="card" style={{ textAlign: 'center', padding: 40, color: '#999' }}>No invoices yet.</div>
          ) : (
            <>
              {sortedMonths.map(key => {
                const group = groupedHistory[key];
                return (
                  <div key={key} style={{ marginBottom: 24 }}>
                    <div style={{ padding: '8px 0', marginBottom: 8, borderBottom: '2px solid #1565C0', display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: '1.05rem', fontWeight: 700, color: '#1565C0' }}>{group.label}</span>
                      <span style={{ fontSize: '0.8rem', color: '#888' }}>({group.items.length} invoice{group.items.length !== 1 ? 's' : ''})</span>
                      <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#333', marginLeft: 'auto' }}>{formatCurrency(group.items.reduce((s, wo) => s + getWOTotal(wo), 0))}</span>
                    </div>
                    <table className="table" style={{ marginBottom: 0 }}>
                      <thead><tr><th>Invoice #</th><th>DR#</th><th>Client</th><th>Amount</th><th>Sent</th><th>PDF</th><th></th></tr></thead>
                      <tbody>
                        {group.items.map(wo => (
                          <tr key={wo.id}>
                            <td style={{ fontFamily: 'monospace', fontWeight: 700, color: '#2E7D32' }}>#{wo.invoiceNumber}</td>
                            <td><span style={{ fontFamily: 'monospace', fontWeight: 600, color: '#1565C0', cursor: 'pointer' }} onClick={() => navigate('/workorders/' + wo.id)}>{wo.drNumber ? 'DR-' + wo.drNumber : wo.orderNumber}</span></td>
                            <td>{wo.clientName}</td>
                            <td style={{ fontWeight: 600 }}>{formatCurrency(getWOTotal(wo))}</td>
                            <td style={{ fontSize: '0.85rem' }}>
                              {wo.invoiceDate ? (
                                <span style={{ color: '#2E7D32', fontWeight: 500, cursor: 'pointer' }} onClick={() => { setSentModal(wo); setSentFile(null); setSentDate(new Date(wo.invoiceDate).toISOString().split('T')[0]); }} title="Click to edit date">
                                  {new Date(wo.invoiceDate).toLocaleDateString()}
                                </span>
                              ) : (
                                <button className="btn btn-sm" style={{ fontSize: '0.75rem', padding: '4px 10px', background: '#E65100', color: 'white', border: 'none', fontWeight: 600, borderRadius: 4 }}
                                  onClick={() => { setSentModal(wo); setSentFile(null); setSentDate(new Date().toISOString().split('T')[0]); }}>
                                  Confirm Sent
                                </button>
                              )}
                            </td>
                            <td>{wo.invoicePdfUrl ? <a href={wo.invoicePdfUrl} target="_blank" rel="noopener noreferrer" style={{ color: '#1565C0', fontWeight: 600, fontSize: '0.85rem' }}>View</a> : <button className="btn btn-sm btn-outline" style={{ fontSize: '0.75rem', padding: '3px 8px' }} onClick={() => { setPdfUploadWO(wo); setPdfFile(null); }}>Upload</button>}</td>
                            <td><button className="btn btn-sm btn-outline" style={{ fontSize: '0.75rem', padding: '3px 8px', color: '#c62828', borderColor: '#c62828' }} onClick={() => handleClearInvoice(wo)}>Clear</button></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                );
              })}

              {/* Not Invoiced — collapsible at bottom */}
              {skipped.length > 0 && (
                <div style={{ marginTop: 32 }}>
                  <button onClick={() => setShowSkipped(!showSkipped)}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8, padding: '8px 0', width: '100%', borderBottom: '2px solid #888' }}>
                    <span style={{ fontSize: '1.05rem', fontWeight: 700, color: '#888' }}>{showSkipped ? '▼' : '▶'} Not Invoiced ({skipped.length})</span>
                  </button>
                  {showSkipped && (
                    <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {skipped.map(wo => {
                        const drLabel = wo.drNumber ? 'DR-' + wo.drNumber : wo.orderNumber;
                        return (
                          <div key={wo.id} className="card" style={{ padding: '12px 20px', borderLeft: '4px solid #888', opacity: 0.85 }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
                              <div style={{ flex: 1, minWidth: 200 }}>
                                <span style={{ fontFamily: 'Courier New, monospace', fontWeight: 700, color: '#1565C0', cursor: 'pointer' }} onClick={() => navigate('/workorders/' + wo.id)}>{drLabel}</span>
                                <div style={{ fontSize: '0.85rem', color: '#555' }}>{wo.clientName}</div>
                                {wo.invoiceSkipReason && <div style={{ fontSize: '0.8rem', color: '#888', marginTop: 2 }}>Reason: <strong>{wo.invoiceSkipReason}</strong></div>}
                              </div>
                              <div style={{ fontSize: '0.8rem', color: '#888' }}>
                                {wo.invoiceSkippedBy && <span>by {wo.invoiceSkippedBy}</span>}
                                {wo.invoiceSkippedAt && <span> on {new Date(wo.invoiceSkippedAt).toLocaleDateString()}</span>}
                              </div>
                              <button className="btn btn-outline" style={{ padding: '6px 14px', fontSize: '0.85rem' }} onClick={() => handleRestore(wo)}>Restore to Queue</button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* Batch Confirm Modal */}
      {batchConfirmOpen && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.6)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={() => setBatchConfirmOpen(false)}>
          <div style={{ background: 'white', borderRadius: 12, maxWidth: 560, width: '95%', maxHeight: '80vh', display: 'flex', flexDirection: 'column', boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }} onClick={e => e.stopPropagation()}>
            <div style={{ background: '#2E7D32', color: 'white', padding: '16px 24px', borderRadius: '12px 12px 0 0' }}>
              <div style={{ fontSize: '1.1rem', fontWeight: 700 }}>Batch IIF Export - Confirm</div>
              <div style={{ fontSize: '0.85rem', opacity: 0.9, marginTop: 4 }}>{batchPreview.length} invoices</div>
            </div>
            <div style={{ overflow: 'auto', flex: 1 }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead><tr style={{ background: '#f5f5f5', fontSize: '0.8rem', color: '#666' }}><th style={{ padding: '10px 16px', textAlign: 'left' }}>Invoice #</th><th style={{ padding: '10px 16px', textAlign: 'left' }}>Work Order</th><th style={{ padding: '10px 16px', textAlign: 'left' }}>Client</th><th style={{ padding: '10px 16px', textAlign: 'right' }}>Amount</th></tr></thead>
                <tbody>{batchPreview.map(item => (
                  <tr key={item.id} style={{ borderBottom: '1px solid #eee' }}>
                    <td style={{ padding: '10px 16px', fontFamily: 'monospace', fontWeight: 700, color: '#2E7D32' }}>#{item.invoiceNumber}</td>
                    <td style={{ padding: '10px 16px', fontFamily: 'monospace', fontWeight: 600, color: '#1565C0' }}>{item.drNumber}</td>
                    <td style={{ padding: '10px 16px' }}>{item.clientName}</td>
                    <td style={{ padding: '10px 16px', textAlign: 'right', fontWeight: 600 }}>{formatCurrency(item.total)}</td>
                  </tr>
                ))}</tbody>
                <tfoot><tr style={{ background: '#f5f5f5', fontWeight: 700 }}><td colSpan={3} style={{ padding: '10px 16px' }}>Total</td><td style={{ padding: '10px 16px', textAlign: 'right' }}>{formatCurrency(batchPreview.reduce((s, i) => s + i.total, 0))}</td></tr></tfoot>
              </table>
            </div>
            <div style={{ padding: '16px 24px', borderTop: '1px solid #eee', display: 'flex', gap: 12 }}>
              <button className="btn" onClick={handleBatchExport} disabled={saving} style={{ flex: 1, background: '#2E7D32', color: 'white', border: 'none', padding: '14px', fontWeight: 700, borderRadius: 8, fontSize: '1rem' }}>{saving ? 'Exporting...' : `Export ${batchPreview.length} Invoices to IIF`}</button>
              <button onClick={() => setBatchConfirmOpen(false)} style={{ padding: '14px 20px', background: 'none', border: '1px solid #ccc', borderRadius: 8, cursor: 'pointer', color: '#666' }}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Manual Invoice # Assignment Modal */}
      {manualModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.6)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={() => setManualModal(null)}>
          <div style={{ background: 'white', borderRadius: 12, padding: 0, maxWidth: 420, width: '90%', boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }} onClick={e => e.stopPropagation()}>
            <div style={{ background: '#7B1FA2', color: 'white', padding: '16px 24px', borderRadius: '12px 12px 0 0' }}>
              <div style={{ fontSize: '1.1rem', fontWeight: 700 }}>Assign Invoice Number</div>
              <div style={{ fontSize: '0.85rem', opacity: 0.9, marginTop: 4 }}>{manualModal.drNumber ? 'DR-' + manualModal.drNumber : manualModal.orderNumber} — {manualModal.clientName}</div>
            </div>
            <div style={{ padding: 24 }}>
              <p style={{ color: '#666', fontSize: '0.9rem', marginBottom: 16 }}>Enter the invoice number for this work order. Use this for previously invoiced orders or manual entries.</p>
              <div className="form-group" style={{ marginBottom: 20 }}>
                <label className="form-label" style={{ fontWeight: 600 }}>Invoice Number</label>
                <input type="text" className="form-input" placeholder="e.g. 208394" autoFocus
                  value={manualInvNum} onChange={e => setManualInvNum(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') handleManualAssign(); }}
                  style={{ fontFamily: 'monospace', fontSize: '1.1rem' }} />
              </div>
              <div style={{ display: 'flex', gap: 12 }}>
                <button className="btn" onClick={handleManualAssign} disabled={saving || !manualInvNum.trim()}
                  style={{ flex: 1, background: manualInvNum.trim() ? '#7B1FA2' : '#ccc', color: 'white', border: 'none', padding: '14px', fontWeight: 700, borderRadius: 8 }}>
                  {saving ? 'Saving...' : 'Assign #' + (manualInvNum || '...')}
                </button>
                <button onClick={() => setManualModal(null)} style={{ padding: '14px 20px', background: 'none', border: '1px solid #ccc', borderRadius: 8, cursor: 'pointer', color: '#666' }}>Cancel</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Skip Modal */}
      {skipModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.6)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={() => setSkipModal(null)}>
          <div style={{ background: 'white', borderRadius: 12, padding: 24, maxWidth: 420, width: '90%', boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }} onClick={e => e.stopPropagation()}>
            <h3 style={{ marginBottom: 8 }}>Move to Not Invoiced</h3>
            <p style={{ color: '#666', fontSize: '0.9rem', marginBottom: 16 }}>{skipModal.drNumber ? 'DR-' + skipModal.drNumber : skipModal.orderNumber} — {skipModal.clientName}</p>
            <div className="form-group" style={{ marginBottom: 16 }}>
              <label className="form-label" style={{ fontWeight: 600 }}>Reason</label>
              <input type="text" className="form-input" placeholder="e.g. Job rejected, No charge, Warranty" value={skipReason} onChange={e => setSkipReason(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') handleSkip(); }} autoFocus />
            </div>
            <div style={{ display: 'flex', gap: 12 }}>
              <button className="btn" onClick={handleSkip} disabled={saving} style={{ flex: 1, background: '#555', color: 'white', border: 'none', padding: '12px', fontWeight: 700, borderRadius: 8 }}>{saving ? '...' : 'Move to Not Invoiced'}</button>
              <button className="btn btn-outline" onClick={() => setSkipModal(null)}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Invoice Sent Modal */}
      {sentModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.6)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={() => setSentModal(null)}>
          <div style={{ background: 'white', borderRadius: 12, padding: 0, maxWidth: 440, width: '90%', boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }} onClick={e => e.stopPropagation()}>
            <div style={{ background: '#1565C0', color: 'white', padding: '16px 24px', borderRadius: '12px 12px 0 0' }}>
              <div style={{ fontSize: '1.1rem', fontWeight: 700 }}>Invoice Sent</div>
              <div style={{ fontSize: '0.85rem', opacity: 0.9, marginTop: 4 }}>Invoice #{sentModal.invoiceNumber} — {sentModal.clientName}</div>
            </div>
            <div style={{ padding: 24 }}>
              <div className="form-group" style={{ marginBottom: 16 }}>
                <label className="form-label" style={{ fontWeight: 600 }}>Date Sent</label>
                <input type="date" className="form-input" value={sentDate} onChange={e => setSentDate(e.target.value)} />
              </div>
              <div className="form-group" style={{ marginBottom: 20 }}>
                <label className="form-label" style={{ fontWeight: 600 }}>Invoice PDF <span style={{ fontWeight: 400, color: '#888' }}>(optional)</span></label>
                <input type="file" accept=".pdf" className="form-input" style={{ padding: 8 }} onChange={e => setSentFile(e.target.files[0] || null)} />
              </div>
              <div style={{ display: 'flex', gap: 12 }}>
                <button className="btn" onClick={handleMarkSent} disabled={saving} style={{ flex: 1, background: '#1565C0', color: 'white', border: 'none', padding: '14px', fontWeight: 700, borderRadius: 8 }}>{saving ? 'Saving...' : 'Confirm Sent'}</button>
                <button onClick={() => setSentModal(null)} style={{ padding: '14px 20px', background: 'none', border: '1px solid #ccc', borderRadius: 8, cursor: 'pointer', color: '#666' }}>Cancel</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* PDF Upload Modal */}
      {pdfUploadWO && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.6)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={() => setPdfUploadWO(null)}>
          <div style={{ background: 'white', borderRadius: 12, padding: 24, maxWidth: 400, width: '90%', boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }} onClick={e => e.stopPropagation()}>
            <h3 style={{ marginBottom: 16 }}>Upload Invoice PDF</h3>
            <p style={{ color: '#666', marginBottom: 12, fontSize: '0.9rem' }}>Invoice #{pdfUploadWO.invoiceNumber}</p>
            <input type="file" accept=".pdf" className="form-input" style={{ padding: 8, marginBottom: 16 }} onChange={e => setPdfFile(e.target.files[0] || null)} />
            <div style={{ display: 'flex', gap: 12 }}>
              <button className="btn btn-primary" onClick={handleUploadPdf} disabled={saving || !pdfFile} style={{ flex: 1 }}>{saving ? 'Uploading...' : 'Upload'}</button>
              <button className="btn btn-outline" onClick={() => setPdfUploadWO(null)}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default InvoiceCenterPage;
