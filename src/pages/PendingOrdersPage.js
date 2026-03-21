import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { FileText, Check, X, ExternalLink, RefreshCw, Clock, AlertCircle } from 'lucide-react';
import { getPendingOrders, approvePendingOrder, rejectPendingOrder, deletePendingOrder, getEmailScannerStatus, linkPendingOrderEstimate, searchEstimatesForLink } from '../services/api';

function PendingOrdersPage() {
  const navigate = useNavigate();
  const [pendingOrders, setPendingOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showProcessed, setShowProcessed] = useState(false);
  const [rejectModal, setRejectModal] = useState(null);
  const [rejectReason, setRejectReason] = useState('');
  const [scannerStatus, setScannerStatus] = useState(null);
  const [linkingId, setLinkingId] = useState(null);
  const [linkSearch, setLinkSearch] = useState('');
  const [linkResults, setLinkResults] = useState([]);

  useEffect(() => { loadData(); }, []);
  useEffect(() => { if (success) { const t = setTimeout(() => setSuccess(''), 4000); return () => clearTimeout(t); } }, [success]);

  const loadData = async () => {
    try {
      setLoading(true);
      const [ordersRes, statusRes] = await Promise.all([
        getPendingOrders('all'),
        getEmailScannerStatus().catch(() => ({ data: { data: null } }))
      ]);
      setPendingOrders(ordersRes.data.data || []);
      setScannerStatus(statusRes.data.data || null);
    } catch (err) { setError('Failed to load'); }
    finally { setLoading(false); }
  };

  const handleApprove = async (order) => {
    try {
      await approvePendingOrder(order.id, {});
      if (order.matchedEstimateId) {
        navigate(`/estimates/${order.matchedEstimateId}`, {
          state: {
            autoConvert: true,
            poNumber: order.poNumber || '',
            requestedDate: order.requestedDate || ''
          }
        });
      } else {
        setSuccess(`PO#${order.poNumber || ''} approved (no estimate linked — approve only)`);
        loadData();
      }
    } catch (err) {
      console.error('Approve error:', err);
      setError(err.response?.data?.error?.message || 'Failed to approve');
    }
  };

  const handleLinkSearch = async (q) => {
    setLinkSearch(q);
    if (q.length < 2) { setLinkResults([]); return; }
    try {
      const res = await searchEstimatesForLink(q);
      setLinkResults(res.data.data || []);
    } catch { setLinkResults([]); }
  };

  const handleLinkEstimate = async (orderId, estimateId) => {
    try {
      await linkPendingOrderEstimate(orderId, estimateId);
      setLinkingId(null);
      setLinkSearch('');
      setLinkResults([]);
      setSuccess('Estimate linked');
      loadData();
    } catch (err) { setError('Failed to link estimate'); }
  };

  const handleReject = async () => {
    try {
      await rejectPendingOrder(rejectModal.id, { reason: rejectReason });
      setSuccess(`PO#${rejectModal.poNumber} rejected`);
      setRejectModal(null); setRejectReason('');
      loadData();
    } catch (err) { setError('Failed to reject'); }
  };

  const handleDelete = async (order) => {
    if (!window.confirm(`Delete pending order${order.poNumber ? ` PO#${order.poNumber}` : ''} from ${order.clientName}? This cannot be undone.`)) return;
    try {
      await deletePendingOrder(order.id);
      setSuccess('Pending order deleted');
      loadData();
    } catch (err) { setError('Failed to delete'); }
  };

  const pending = pendingOrders.filter(o => o.status === 'pending');
  const processed = pendingOrders.filter(o => o.status !== 'pending');

  if (loading) return <div className="loading"><div className="spinner"></div></div>;

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Pending Orders</h1>
          {scannerStatus && (
            <div style={{ fontSize: '0.8rem', color: '#888', marginTop: 4 }}>
              {scannerStatus.connectedAccounts} account{scannerStatus.connectedAccounts !== 1 ? 's' : ''} connected · {scannerStatus.monitoredAddresses} email{scannerStatus.monitoredAddresses !== 1 ? 's' : ''} monitored · {scannerStatus.emailsProcessedToday} scanned today
            </div>
          )}
        </div>
        <button className="btn btn-outline" onClick={loadData}><RefreshCw size={18} /></button>
      </div>

      {error && <div className="alert alert-error" style={{ marginBottom: 12 }}>{error}</div>}
      {success && <div className="alert alert-success" style={{ marginBottom: 12 }}>{success}</div>}

      {pending.length === 0 && processed.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: 60, color: '#888' }}>
          <FileText size={56} style={{ marginBottom: 16, opacity: 0.25 }} />
          <h3 style={{ margin: '0 0 8px', fontWeight: 600, color: '#666' }}>No Pending Orders</h3>
          <p style={{ maxWidth: 440, margin: '0 auto', lineHeight: 1.6 }}>
            When the email scanner detects a purchase order from a client, it will appear here for your approval before creating a work order.
          </p>
          {(!scannerStatus || scannerStatus.connectedAccounts === 0) && (
            <div style={{ marginTop: 24 }}>
              <button className="btn btn-primary" onClick={() => navigate('/admin/shop-config')}>
                Set Up Email Scanner
              </button>
            </div>
          )}
        </div>
      ) : (
        <>
          {pending.length > 0 && (
            <div style={{ marginBottom: 24 }}>
              <div style={{ padding: '8px 0', marginBottom: 8, borderBottom: '2px solid #ff9800', display: 'flex', alignItems: 'center', gap: 8 }}>
                <Clock size={18} style={{ color: '#ff9800' }} />
                <span style={{ fontSize: '1.05rem', fontWeight: 700, color: '#E65100' }}>Awaiting Approval ({pending.length})</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {pending.map(order => (
                  <div key={order.id} className="card" style={{ padding: '16px 20px', borderLeft: '4px solid #ff9800' }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
                      <div style={{ flex: 1, minWidth: 200 }}>
                        <div style={{ fontWeight: 700, fontSize: '1.05rem' }}>{order.clientName}</div>
                        {order.poNumber && <div style={{ fontFamily: 'monospace', color: '#1565c0', fontWeight: 600, fontSize: '1rem' }}>PO# {order.poNumber}</div>}
                        {order.subject && <div style={{ fontSize: '0.85rem', color: '#666', marginTop: 2 }}>{order.subject}</div>}
                        {order.matchedEstimateNumber ? (
                          <div style={{ fontSize: '0.85rem', color: '#2e7d32', marginTop: 4, display: 'flex', alignItems: 'center', gap: 6 }}>
                            ✅ Linked to: <span style={{ fontWeight: 600, cursor: 'pointer', textDecoration: 'underline' }}
                              onClick={() => order.matchedEstimateId && navigate(`/estimates/${order.matchedEstimateId}`)}>
                              {order.matchedEstimateNumber}
                            </span>
                            <button onClick={() => { setLinkingId(order.id); setLinkSearch(''); setLinkResults([]); }}
                              style={{ background: 'none', border: 'none', color: '#888', cursor: 'pointer', fontSize: '0.75rem', padding: '0 4px' }}>change</button>
                          </div>
                        ) : (
                          <div style={{ marginTop: 4 }}>
                            {order.referenceNumber && (
                              <div style={{ fontSize: '0.85rem', color: '#888', marginBottom: 4 }}>
                                <AlertCircle size={12} style={{ color: '#ff9800' }} /> References: {order.referenceNumber} (no match found)
                              </div>
                            )}
                            {linkingId === order.id ? null : (
                              <button onClick={() => { setLinkingId(order.id); setLinkSearch(order.referenceNumber || order.clientName || ''); handleLinkSearch(order.referenceNumber || order.clientName || ''); }}
                                style={{ fontSize: '0.8rem', color: '#1565c0', background: 'none', border: '1px solid #1565c0', borderRadius: 4, padding: '3px 10px', cursor: 'pointer' }}>
                                🔗 Link Estimate
                              </button>
                            )}
                          </div>
                        )}
                        {linkingId === order.id && (
                          <div style={{ marginTop: 6, padding: 10, background: '#f5f5f5', borderRadius: 8, position: 'relative' }}>
                            <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 6 }}>
                              <input type="text" value={linkSearch} onChange={(e) => handleLinkSearch(e.target.value)}
                                placeholder="Search by estimate # or client..."
                                style={{ flex: 1, padding: '6px 10px', border: '1px solid #ccc', borderRadius: 4, fontSize: '0.85rem' }} autoFocus />
                              <button onClick={() => { setLinkingId(null); setLinkSearch(''); setLinkResults([]); }}
                                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#888' }}><X size={16} /></button>
                            </div>
                            {linkResults.length > 0 && (
                              <div style={{ display: 'flex', flexDirection: 'column', gap: 4, maxHeight: 150, overflowY: 'auto' }}>
                                {linkResults.map(est => (
                                  <div key={est.id} onClick={() => handleLinkEstimate(order.id, est.id)}
                                    style={{ padding: '6px 10px', background: 'white', borderRadius: 4, cursor: 'pointer', border: '1px solid #ddd', fontSize: '0.85rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <div>
                                      <span style={{ fontWeight: 600, color: '#1565c0' }}>{est.estimateNumber}</span>
                                      <span style={{ marginLeft: 8, color: '#666' }}>{est.clientName}</span>
                                    </div>
                                    <span style={{ fontSize: '0.75rem', color: '#888' }}>{est.status}</span>
                                  </div>
                                ))}
                              </div>
                            )}
                            {linkSearch.length >= 2 && linkResults.length === 0 && (
                              <div style={{ fontSize: '0.8rem', color: '#888', textAlign: 'center', padding: 8 }}>No estimates found</div>
                            )}
                          </div>
                        )}
                        {order.requestedDate && (
                          <div style={{ fontSize: '0.85rem', color: '#c62828', marginTop: 4, fontWeight: 600 }}>
                            📅 Requested by: {new Date(order.requestedDate + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                          </div>
                        )}
                        <div style={{ fontSize: '0.75rem', color: '#999', marginTop: 4 }}>
                          {new Date(order.createdAt).toLocaleString()}
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                        {order.emailLink && (
                          <a href={order.emailLink} target="_blank" rel="noopener noreferrer"
                            style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '8px 12px', fontSize: '0.85rem', border: '1px solid #ddd', borderRadius: 6, textDecoration: 'none', color: '#1565c0', fontWeight: 500 }}>
                            <ExternalLink size={14} /> Email
                          </a>
                        )}
                        <button className="btn" onClick={() => handleApprove(order)}
                          style={{ background: '#2e7d32', color: 'white', border: 'none', padding: '8px 16px', fontWeight: 600 }}>
                          <Check size={16} /> {order.matchedEstimateId ? 'Approve & Convert' : 'Approve'}
                        </button>
                        <button className="btn btn-outline" onClick={() => { setRejectModal(order); setRejectReason(''); }}
                          style={{ padding: '8px 12px', color: '#c62828', borderColor: '#c62828' }}>
                          <X size={16} /> Reject
                        </button>
                        <button onClick={() => handleDelete(order)}
                          style={{ padding: '8px 8px', background: 'none', border: '1px solid #ccc', borderRadius: 6, cursor: 'pointer', color: '#888', display: 'flex', alignItems: 'center' }}
                          title="Delete permanently">
                          <X size={14} />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {processed.length > 0 && (
            <div>
              <button onClick={() => setShowProcessed(!showProcessed)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8, padding: '8px 0', borderBottom: '2px solid #888', width: '100%' }}>
                <span style={{ fontSize: '1rem', fontWeight: 700, color: '#888' }}>
                  {showProcessed ? '▼' : '▶'} Processed ({processed.length})
                </span>
              </button>
              {showProcessed && (
                <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {processed.map(order => (
                    <div key={order.id} className="card" style={{ padding: '12px 20px', borderLeft: `4px solid ${order.status === 'approved' ? '#2e7d32' : '#c62828'}`, opacity: 0.75 }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                        <div>
                          <span style={{ fontWeight: 600 }}>{order.clientName}</span>
                          {order.poNumber && <span style={{ fontFamily: 'monospace', marginLeft: 8 }}>PO# {order.poNumber}</span>}
                          <span style={{
                            marginLeft: 8, fontSize: '0.75rem', padding: '2px 8px', borderRadius: 10,
                            background: order.status === 'approved' ? '#e8f5e9' : '#ffebee',
                            color: order.status === 'approved' ? '#2e7d32' : '#c62828'
                          }}>
                            {order.status === 'approved' ? '✓ Approved' : '✕ Rejected'}
                          </span>
                          {order.matchedEstimateId && (
                            <span style={{ marginLeft: 8, fontSize: '0.8rem', color: '#1565c0', cursor: 'pointer', textDecoration: 'underline' }}
                              onClick={() => navigate(`/estimates/${order.matchedEstimateId}`)}>
                              {order.matchedEstimateNumber || 'View Estimate'}
                            </span>
                          )}
                          {order.emailLink && (
                            <a href={order.emailLink} target="_blank" rel="noopener noreferrer"
                              style={{ marginLeft: 8, fontSize: '0.8rem', color: '#1565c0', textDecoration: 'none' }}>📧</a>
                          )}
                          <span style={{ marginLeft: 8, fontSize: '0.8rem', color: '#888' }}>
                            {order.approvedBy || order.rejectedBy} · {new Date(order.approvedAt || order.rejectedAt || order.updatedAt).toLocaleDateString()}
                          </span>
                        </div>
                        <button onClick={() => handleDelete(order)}
                          style={{ padding: '4px 8px', background: 'none', border: '1px solid #ccc', borderRadius: 4, cursor: 'pointer', color: '#888', fontSize: '0.75rem', flexShrink: 0 }}
                          title="Delete permanently">✕</button>
                      </div>
                      {order.rejectionReason && <div style={{ fontSize: '0.8rem', color: '#c62828', marginTop: 4 }}>Reason: {order.rejectionReason}</div>}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </>
      )}

      {rejectModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.6)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={() => setRejectModal(null)}>
          <div style={{ background: 'white', borderRadius: 12, padding: 24, maxWidth: 420, width: '90%', boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }} onClick={e => e.stopPropagation()}>
            <h3 style={{ marginBottom: 8 }}>Reject Order</h3>
            <p style={{ color: '#666', fontSize: '0.9rem', marginBottom: 16 }}>
              {rejectModal.clientName} — PO# {rejectModal.poNumber}
            </p>
            <div className="form-group" style={{ marginBottom: 16 }}>
              <label className="form-label" style={{ fontWeight: 600 }}>Reason</label>
              <input type="text" className="form-input" placeholder="e.g. Duplicate, wrong pricing, cancelled"
                value={rejectReason} onChange={e => setRejectReason(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') handleReject(); }} autoFocus />
            </div>
            <div style={{ display: 'flex', gap: 12 }}>
              <button className="btn" onClick={handleReject}
                style={{ flex: 1, background: '#c62828', color: 'white', border: 'none', padding: '12px', fontWeight: 700, borderRadius: 8 }}>
                Reject
              </button>
              <button className="btn btn-outline" onClick={() => setRejectModal(null)}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default PendingOrdersPage;
