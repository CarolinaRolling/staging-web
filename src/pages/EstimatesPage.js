import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Search, DollarSign, Send, Check, X, Archive, Trash2 } from 'lucide-react';
import { getEstimates, deleteEstimate, restoreEstimate, permanentDeleteEstimate, getEstimateTrash, convertEstimateToWorkOrder, createEstimate, searchClients } from '../services/api';

function EstimatesPage() {
  const navigate = useNavigate();
  const [estimates, setEstimates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [message, setMessage] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState(null);
  const [searching, setSearching] = useState(false);
  const [statusFilter, setStatusFilter] = useState('all');
  const [showArchived, setShowArchived] = useState(false);
  const [showTrash, setShowTrash] = useState(false);
  const [trashEstimates, setTrashEstimates] = useState([]);
  const [showConvertModal, setShowConvertModal] = useState(null);
  const [convertData, setConvertData] = useState({ clientPurchaseOrderNumber: '', promisedDate: '' });
  const [converting, setConverting] = useState(false);

  // New estimate modal state
  const [showNewModal, setShowNewModal] = useState(false);
  const [newEstData, setNewEstData] = useState({
    clientName: '', contactName: '', contactEmail: '', contactPhone: '', projectDescription: ''
  });
  const [creating, setCreating] = useState(false);
  const [clientSuggestions, setClientSuggestions] = useState([]);
  const [showClientSuggestions, setShowClientSuggestions] = useState(false);
  const clientInputRef = useRef(null);

  useEffect(() => {
    loadEstimates();
  }, [showArchived]);

  useEffect(() => {
    if (message) { const t = setTimeout(() => setMessage(null), 3000); return () => clearTimeout(t); }
  }, [message]);

  // Debounced server-side search across ALL statuses
  const searchTimer = useRef(null);
  useEffect(() => {
    if (!searchQuery || searchQuery.length < 2) {
      setSearchResults(null);
      setSearching(false);
      return;
    }
    setSearching(true);
    clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(async () => {
      try {
        const response = await getEstimates({ search: searchQuery });
        setSearchResults(response.data.data || []);
      } catch (err) {
        console.error('Search error:', err);
        setSearchResults(null);
      } finally {
        setSearching(false);
      }
    }, 300);
    return () => clearTimeout(searchTimer.current);
  }, [searchQuery]);

  const loadEstimates = async () => {
    try {
      setLoading(true);
      const response = await getEstimates({ archived: showArchived ? 'true' : 'false' });
      setEstimates(response.data.data || []);
    } catch (err) {
      setError('Failed to load estimates');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const getFilteredEstimates = () => {
    // When searching, use server-side results (includes archived/accepted)
    if (searchQuery && searchQuery.length >= 2 && searchResults !== null) {
      let filtered = [...searchResults];
      if (statusFilter !== 'all') {
        filtered = filtered.filter(e => e.status === statusFilter);
      }
      return filtered;
    }

    let filtered = [...estimates];
    
    if (statusFilter !== 'all') {
      filtered = filtered.filter(e => e.status === statusFilter);
    }
    
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(e =>
        e.clientName?.toLowerCase().includes(query) ||
        e.estimateNumber?.toLowerCase().includes(query) ||
        e.projectDescription?.toLowerCase().includes(query)
      );
    }
    
    return filtered;
  };

  const handleDelete = async (id, e) => {
    e.stopPropagation();
    if (!window.confirm('Delete this estimate?')) return;
    try {
      await deleteEstimate(id);
      await loadEstimates();
    } catch (err) {
      setError('Failed to delete estimate');
    }
  };

  const handleConvert = async () => {
    if (!showConvertModal) return;
    try {
      setConverting(true);
      const response = await convertEstimateToWorkOrder(showConvertModal.id, convertData);
      const workOrder = response.data.data.workOrder;
      setShowConvertModal(null);
      navigate(`/workorders/${workOrder.id}`);
    } catch (err) {
      setError('Failed to convert estimate');
    } finally {
      setConverting(false);
    }
  };

  const handleCreateEstimate = async () => {
    if (!newEstData.clientName.trim()) { setError('Client name is required'); return; }
    try {
      setCreating(true);
      setError(null);
      const response = await createEstimate({ ...newEstData, status: 'draft' });
      const newId = response.data.data.id;
      setShowNewModal(false);
      navigate(`/estimates/${newId}`);
    } catch (err) {
      setError('Failed to create estimate');
    } finally {
      setCreating(false);
    }
  };

  const openNewEstimateModal = () => {
    setNewEstData({ clientName: '', contactName: '', contactEmail: '', contactPhone: '', projectDescription: '' });
    setClientSuggestions([]);
    setShowNewModal(true);
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount || 0);
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const getStatusBadge = (status) => {
    const styles = {
      draft: { background: '#e0e0e0', color: '#555' },
      sent: { background: '#e3f2fd', color: '#1565c0' },
      accepted: { background: '#e8f5e9', color: '#2e7d32' },
      declined: { background: '#ffebee', color: '#c62828' },
      archived: { background: '#f5f5f5', color: '#999' },
    };
    return <span className="status-badge" style={styles[status] || styles.draft}>{status}</span>;
  };

  const filteredEstimates = getFilteredEstimates();
  const activeCount = estimates.filter(e => e.status !== 'archived' && e.status !== 'accepted').length;

  if (loading) {
    return <div className="loading"><div className="spinner"></div></div>;
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Estimates</h1>
          <p style={{ color: '#666', fontSize: '0.875rem', marginTop: 4 }}>
            {activeCount} active estimates
          </p>
        </div>
        <button className="btn btn-primary" onClick={openNewEstimateModal}>
          <Plus size={18} />
          New Estimate
        </button>
      </div>

      {error && <div className="alert alert-error">{error}</div>}
      {message && <div style={{ background: '#e8f5e9', color: '#2e7d32', padding: '10px 16px', borderRadius: 8, marginBottom: 16, fontWeight: 500 }}>{message}</div>}

      {/* Tabs */}
      <div className="tabs">
        <button className={`tab ${!showArchived && !showTrash ? 'active' : ''}`} onClick={() => { setShowArchived(false); setShowTrash(false); setStatusFilter('all'); }}>
          Active
        </button>
        <button className={`tab ${showArchived ? 'active' : ''}`} onClick={() => { setShowArchived(true); setShowTrash(false); setStatusFilter('all'); }}>
          <Archive size={14} style={{ marginRight: 4 }} />
          Archived
        </button>
        <button className={`tab ${showTrash ? 'active' : ''}`} onClick={async () => {
          setShowTrash(true); setShowArchived(false);
          try {
            const res = await getEstimateTrash();
            setTrashEstimates(res.data.data || []);
          } catch { setTrashEstimates([]); }
        }}>
          <Trash2 size={14} style={{ marginRight: 4 }} />
          Trash
        </button>
      </div>

      {/* Trash Tab Content */}
      {showTrash ? (
        <div>
          <div style={{ padding: 12, background: '#ffebee', borderRadius: 8, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Trash2 size={18} color="#c62828" />
            <span style={{ fontWeight: 600, color: '#c62828' }}>Trash</span>
            <span style={{ color: '#888', fontSize: '0.85rem' }}>— estimates are permanently deleted after 30 days</span>
          </div>
          {trashEstimates.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 40, color: '#888' }}>
              <Trash2 size={40} style={{ opacity: 0.3, marginBottom: 12 }} />
              <div>Trash is empty</div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {trashEstimates.map(est => {
                const daysLeft = Math.max(0, 30 - Math.floor((Date.now() - new Date(est.trashedAt).getTime()) / (1000 * 60 * 60 * 24)));
                return (
                  <div key={est.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', background: '#fafafa', borderRadius: 8, border: '1px dashed #e0e0e0' }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 600, fontSize: '0.95rem' }}>
                        {est.estimateNumber} — {est.clientName}
                      </div>
                      <div style={{ fontSize: '0.8rem', color: '#888' }}>
                        Trashed {new Date(est.trashedAt).toLocaleDateString()} by {est.trashedBy || 'admin'}
                        <span style={{ marginLeft: 8, color: daysLeft <= 7 ? '#c62828' : '#888' }}>
                          ({daysLeft} days until permanent deletion)
                        </span>
                      </div>
                      <div style={{ fontSize: '0.8rem', color: '#555', marginTop: 2 }}>
                        {est.parts?.length || 0} parts • {est.projectDescription ? est.projectDescription.substring(0, 80) : ''}
                      </div>
                    </div>
                    <button onClick={async () => {
                      try {
                        await restoreEstimate(est.id);
                        setTrashEstimates(prev => prev.filter(e => e.id !== est.id));
                        setMessage(`${est.estimateNumber} restored`);
                        setTimeout(() => setMessage(null), 3000);
                      } catch { setError('Failed to restore'); }
                    }} style={{ background: '#e8f5e9', border: '1px solid #66bb6a', color: '#2e7d32', padding: '6px 14px', borderRadius: 6, cursor: 'pointer', fontWeight: 600, fontSize: '0.85rem' }}>
                      ↩️ Restore
                    </button>
                    <button onClick={async () => {
                      if (!window.confirm(`Permanently delete ${est.estimateNumber}? This cannot be undone.`)) return;
                      try {
                        await permanentDeleteEstimate(est.id);
                        setTrashEstimates(prev => prev.filter(e => e.id !== est.id));
                        setMessage(`${est.estimateNumber} permanently deleted`);
                        setTimeout(() => setMessage(null), 3000);
                      } catch { setError('Failed to delete'); }
                    }} style={{ background: 'none', border: '1px solid #c62828', color: '#c62828', padding: '6px 14px', borderRadius: 6, cursor: 'pointer', fontWeight: 600, fontSize: '0.85rem' }}>
                      🗑️ Delete Forever
                    </button>
                  </div>
                );
              })}
              {trashEstimates.length > 0 && (
                <button onClick={async () => {
                  if (!window.confirm(`Permanently delete ALL ${trashEstimates.length} trashed estimates? This cannot be undone.`)) return;
                  try {
                    for (const est of trashEstimates) { await permanentDeleteEstimate(est.id); }
                    setTrashEstimates([]);
                    setMessage('Trash emptied');
                    setTimeout(() => setMessage(null), 3000);
                  } catch { setError('Failed to empty trash'); }
                }} style={{ alignSelf: 'flex-end', background: '#c62828', color: 'white', border: 'none', padding: '8px 16px', borderRadius: 6, cursor: 'pointer', fontWeight: 600, fontSize: '0.85rem' }}>
                  🗑️ Empty Trash ({trashEstimates.length})
                </button>
              )}
            </div>
          )}
        </div>
      ) : (
      <>
      {/* Filters */}
      <div className="card" style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap' }}>
          <div className="search-box" style={{ flex: 1, minWidth: 200, marginBottom: 0, position: 'relative' }}>
            <Search size={18} className="search-box-icon" />
            <input
              type="text"
              placeholder="Search by client, estimate#, project..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            {searchQuery && (
              <button onClick={() => setSearchQuery('')} style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#999', fontSize: '1.1rem', padding: 4 }}>✕</button>
            )}
          </div>
          {searchQuery && searchQuery.length >= 2 && (
            <span style={{ fontSize: '0.8rem', color: '#1565c0', fontWeight: 600, whiteSpace: 'nowrap' }}>
              {searching ? '⏳ Searching...' : `🔍 All statuses (${getFilteredEstimates().length} found)`}
            </span>
          )}
          {!showArchived && (
            <div className="tabs" style={{ marginBottom: 0, borderBottom: 'none', paddingBottom: 0 }}>
              {['all', 'draft', 'sent', 'declined'].map(status => {
                const count = status === 'all' ? estimates.length : estimates.filter(e => e.status === status).length;
                return (
                <button
                  key={status}
                  className={`tab ${statusFilter === status ? 'active' : ''}`}
                  onClick={() => setStatusFilter(status)}
                >
                  {status.charAt(0).toUpperCase() + status.slice(1)}
                  {status !== 'all' && count > 0 && <span style={{ marginLeft: 4, fontSize: '0.75rem', opacity: 0.7 }}>({count})</span>}
                </button>
                );
              })}
            </div>
          )}
          {showArchived && (
            <div className="tabs" style={{ marginBottom: 0, borderBottom: 'none', paddingBottom: 0 }}>
              {['all', 'accepted', 'archived'].map(status => (
                <button
                  key={status}
                  className={`tab ${statusFilter === status ? 'active' : ''}`}
                  onClick={() => setStatusFilter(status)}
                >
                  {status === 'accepted' ? 'Converted to WO' : status.charAt(0).toUpperCase() + status.slice(1)}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {showArchived && (
        <div className="alert alert-warning" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <Archive size={20} />
          <div>
            <strong>Archived Estimates</strong>
            <div style={{ fontSize: '0.8rem' }}>Converted estimates and estimates older than 1 month appear here. Archived estimates are kept for 2 years.</div>
          </div>
        </div>
      )}

      {/* Estimates Table */}
      <div className="card">
        {filteredEstimates.length === 0 ? (
          <div className="empty-state">
            <DollarSign size={48} color="#ccc" />
            <div className="empty-state-title">No estimates</div>
            <p>{searchQuery || statusFilter !== 'all' ? 'No estimates match your filters' : 'Create your first estimate'}</p>
          </div>
        ) : (
          <table className="table table-clickable">
            <thead>
              <tr>
                <th>Estimate #</th>
                <th>Client</th>
                <th>Description</th>
                <th>Total</th>
                <th>Status</th>
                <th>Created</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredEstimates.map(estimate => (
                <tr key={estimate.id} onClick={() => navigate(`/estimates/${estimate.id}`)} style={{ cursor: 'pointer' }}>
                  <td style={{ fontWeight: 600, color: '#1976d2' }}>{estimate.estimateNumber}</td>
                  <td>{estimate.clientName}</td>
                  <td style={{ maxWidth: 250, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {estimate.projectDescription || `${estimate.parts?.length || 0} parts`}
                  </td>
                  <td style={{ fontWeight: 600 }}>{formatCurrency(estimate.grandTotal)}</td>
                  <td>{getStatusBadge(estimate.status)}</td>
                  <td>{formatDate(estimate.createdAt)}</td>
                  <td onClick={(e) => e.stopPropagation()}>
                    <div className="actions-row">
                      {(estimate.status === 'sent' || estimate.status === 'accepted') && (
                        <button
                          className="btn btn-sm btn-success"
                          title="Convert to Work Order"
                          onClick={(e) => { e.stopPropagation(); setShowConvertModal(estimate); }}
                        >
                          📋→
                        </button>
                      )}
                      {estimate.status === 'draft' && (
                        <button className="btn btn-sm btn-outline" title="Send to Client">
                          <Send size={14} />
                        </button>
                      )}
                      <button className="btn btn-sm btn-danger" onClick={(e) => handleDelete(estimate.id, e)}>
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Convert Modal */}
      {showConvertModal && (
        <div className="modal-overlay" onClick={() => setShowConvertModal(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 500 }}>
            <div className="modal-header">
              <h3 className="modal-title">Convert to Work Order</h3>
              <button className="modal-close" onClick={() => setShowConvertModal(null)}>&times;</button>
            </div>
            
            <p style={{ marginBottom: 16 }}>Create a Work Order from this estimate.</p>
            
            <div style={{ background: '#e8f5e9', borderRadius: 8, padding: 16, marginBottom: 16 }}>
              <strong>Estimate:</strong> {showConvertModal.estimateNumber}<br />
              <strong>Client:</strong> {showConvertModal.clientName}<br />
              <strong>Total:</strong> {formatCurrency(showConvertModal.grandTotal)}
            </div>

            <div className="form-group">
              <label className="form-label">Client PO Number (if received)</label>
              <input
                type="text"
                className="form-input"
                value={convertData.clientPurchaseOrderNumber}
                onChange={(e) => setConvertData({ ...convertData, clientPurchaseOrderNumber: e.target.value })}
                placeholder="e.g., PO-2025-001"
              />
            </div>

            <div className="form-group">
              <label className="form-label">Promised Date</label>
              <input
                type="date"
                className="form-input"
                value={convertData.promisedDate}
                onChange={(e) => setConvertData({ ...convertData, promisedDate: e.target.value })}
              />
            </div>

            <div className="alert" style={{ background: '#e3f2fd', border: '1px solid #90caf9', display: 'flex', alignItems: 'center', gap: 12 }}>
              <span>ℹ️</span>
              <div style={{ fontSize: '0.875rem' }}>
                The estimate will be marked as "Accepted" and linked to the new work order.
              </div>
            </div>

            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowConvertModal(null)}>Cancel</button>
              <button className="btn btn-success" onClick={handleConvert} disabled={converting}>
                {converting ? 'Converting...' : 'Create Work Order'}
              </button>
            </div>
          </div>
        </div>
      )}
      </>
      )}

      {/* New Estimate Modal */}
      {showNewModal && (
        <div className="modal-overlay" onClick={() => setShowNewModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 550 }}>
            <div className="modal-header">
              <h3 className="modal-title">New Estimate</h3>
              <button className="modal-close" onClick={() => setShowNewModal(false)}>&times;</button>
            </div>

            <div style={{ padding: 20 }}>
              <div className="form-group" style={{ position: 'relative' }}>
                <label className="form-label">Client Name *</label>
                <input
                  type="text"
                  className="form-input"
                  ref={clientInputRef}
                  value={newEstData.clientName}
                  onChange={async (e) => {
                    const value = e.target.value;
                    setNewEstData({ ...newEstData, clientName: value });
                    if (value.length >= 1) {
                      try {
                        const res = await searchClients(value);
                        setClientSuggestions(res.data.data || []);
                        setShowClientSuggestions(true);
                      } catch { setClientSuggestions([]); }
                    } else {
                      setClientSuggestions([]);
                      setShowClientSuggestions(false);
                    }
                  }}
                  onFocus={async () => {
                    if (newEstData.clientName.length >= 1) {
                      try { const res = await searchClients(newEstData.clientName); setClientSuggestions(res.data.data || []); setShowClientSuggestions(true); } catch {}
                    } else {
                      try { const res = await searchClients(''); setClientSuggestions(res.data.data || []); setShowClientSuggestions(true); } catch {}
                    }
                  }}
                  onBlur={() => setTimeout(() => setShowClientSuggestions(false), 200)}
                  autoComplete="off"
                  placeholder="Search or add client..."
                  autoFocus
                />
                {showClientSuggestions && clientSuggestions.length > 0 && (
                  <div style={{
                    position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 100,
                    background: 'white', border: '1px solid #ddd', borderRadius: 4,
                    maxHeight: 200, overflowY: 'auto', boxShadow: '0 4px 12px rgba(0,0,0,0.15)'
                  }}>
                    {clientSuggestions.map(client => (
                      <div
                        key={client.id}
                        style={{
                          padding: '10px 12px', cursor: 'pointer', borderBottom: '1px solid #eee',
                          display: 'flex', justifyContent: 'space-between', alignItems: 'center'
                        }}
                        onMouseDown={() => {
                          setNewEstData({
                            ...newEstData,
                            clientName: client.name,
                            contactName: client.contactName || '',
                            contactEmail: client.contactEmail || '',
                            contactPhone: client.contactPhone || ''
                          });
                          setShowClientSuggestions(false);
                        }}
                      >
                        <div>
                          <strong>{client.name}</strong>
                          {client.contactName && <div style={{ fontSize: '0.8rem', color: '#666' }}>{client.contactName}</div>}
                        </div>
                        <span style={{
                          fontSize: '0.7rem', padding: '2px 6px', borderRadius: 4,
                          background: client.taxStatus === 'resale' ? '#fff3e0' : client.taxStatus === 'exempt' ? '#e8f5e9' : '#e3f2fd',
                          color: client.taxStatus === 'resale' ? '#e65100' : client.taxStatus === 'exempt' ? '#2e7d32' : '#1565c0'
                        }}>
                          {client.taxStatus === 'resale' ? 'Resale' : client.taxStatus === 'exempt' ? 'Exempt' : 'Taxable'}
                        </span>
                      </div>
                    ))}
                    {newEstData.clientName && newEstData.clientName.length >= 2 && !clientSuggestions.some(c => c.name.toLowerCase() === newEstData.clientName.toLowerCase()) && (
                      <div style={{ padding: '10px 12px', cursor: 'pointer', background: '#e8f5e9', color: '#2e7d32', fontWeight: 600, borderTop: '1px solid #c8e6c9' }}
                        onMouseDown={() => {
                          setShowClientSuggestions(false);
                          navigate(`/clients-vendors?addClient=${encodeURIComponent(newEstData.clientName)}`);
                        }}>
                        + Add "{newEstData.clientName}" as new client
                      </div>
                    )}
                  </div>
                )}
                {/* Show add button when no suggestions at all */}
                {showClientSuggestions && clientSuggestions.length === 0 && newEstData.clientName && newEstData.clientName.length >= 2 && (
                  <div style={{
                    position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 100,
                    background: 'white', border: '1px solid #ddd', borderRadius: 4,
                    boxShadow: '0 4px 12px rgba(0,0,0,0.15)'
                  }}>
                    <div style={{ padding: '10px 12px', cursor: 'pointer', background: '#e8f5e9', color: '#2e7d32', fontWeight: 600 }}
                      onMouseDown={() => {
                        setShowClientSuggestions(false);
                        navigate(`/clients-vendors?addClient=${encodeURIComponent(newEstData.clientName)}`);
                      }}>
                      + Add "{newEstData.clientName}" as new client
                    </div>
                  </div>
                )}
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div className="form-group">
                  <label className="form-label">Contact Name</label>
                  <input type="text" className="form-input" value={newEstData.contactName}
                    onChange={(e) => setNewEstData({ ...newEstData, contactName: e.target.value })} />
                </div>
                <div className="form-group">
                  <label className="form-label">Phone</label>
                  <input type="tel" className="form-input" value={newEstData.contactPhone}
                    onChange={(e) => setNewEstData({ ...newEstData, contactPhone: e.target.value })} />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Email</label>
                <input type="email" className="form-input" value={newEstData.contactEmail}
                  onChange={(e) => setNewEstData({ ...newEstData, contactEmail: e.target.value })} />
              </div>

              <div className="form-group">
                <label className="form-label">Project Description</label>
                <textarea className="form-textarea" value={newEstData.projectDescription}
                  onChange={(e) => setNewEstData({ ...newEstData, projectDescription: e.target.value })}
                  placeholder="Brief description of the job..."
                  rows={2} />
              </div>
            </div>

            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowNewModal(false)}>Cancel</button>
              <button
                className="btn btn-primary"
                onClick={handleCreateEstimate}
                disabled={creating || !newEstData.clientName.trim()}
              >
                <Plus size={16} />
                {creating ? 'Creating...' : 'Generate Estimate'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default EstimatesPage;
