import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Plus, Search, Calendar, Package, MapPin } from 'lucide-react';
import { getWorkOrders, createWorkOrder, searchClients, getNextDRNumber, getShipmentById } from '../services/api';

function WorkOrdersPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showNewModal, setShowNewModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [searchQuery, setSearchQuery] = useState(() => {
    return sessionStorage.getItem('wo_search') || '';
  });
  const updateSearch = (val) => {
    setSearchQuery(val);
    if (val) sessionStorage.setItem('wo_search', val);
    else sessionStorage.removeItem('wo_search');
  };
  const [statusFilter, setStatusFilter] = useState(() => {
    return localStorage.getItem('workorders_statusFilter') || 'all';
  });
  const [sortBy, setSortBy] = useState(() => {
    return localStorage.getItem('workorders_sortBy') || 'dr_desc';
  });
  const [newOrder, setNewOrder] = useState({
    clientName: '',
    clientId: null,
    clientPurchaseOrderNumber: '',
    contactName: '',
    contactPhone: '',
    contactEmail: '',
    notes: '',
    receivedBy: '',
    requestedDueDate: '',
    promisedDate: '',
  });
  const [clientSuggestions, setClientSuggestions] = useState([]);
  const [showClientSuggestions, setShowClientSuggestions] = useState(false);
  const [nextDR, setNextDR] = useState(null);
  const [useCustomDR, setUseCustomDR] = useState(false);
  const [customDR, setCustomDR] = useState('');
  const [linkShipmentId, setLinkShipmentId] = useState(null);

  // Auto-open modal when navigated from inventory with shipment
  useEffect(() => {
    const shipmentId = searchParams.get('newFromShipment');
    if (shipmentId) {
      setLinkShipmentId(shipmentId);
      // Fetch next DR number
      getNextDRNumber().then(res => setNextDR(res.data.data.nextNumber)).catch(() => setNextDR(null));
      setUseCustomDR(false);
      setCustomDR('');
      // Fetch shipment data to pre-fill form
      getShipmentById(shipmentId).then(res => {
        const s = res.data.data;
        setNewOrder(prev => ({
          ...prev,
          clientName: s.clientName || '',
          clientPurchaseOrderNumber: s.clientPurchaseOrderNumber || '',
          notes: s.description ? `Received: ${s.description}` : '',
          receivedBy: s.receivedBy || '',
        }));
        setShowNewModal(true);
      }).catch(() => {
        setShowNewModal(true);
      });
      // Clean the URL param
      setSearchParams({}, { replace: true });
    }
  }, []);

  useEffect(() => {
    localStorage.setItem('workorders_statusFilter', statusFilter);
  }, [statusFilter]);

  useEffect(() => {
    localStorage.setItem('workorders_sortBy', sortBy);
  }, [sortBy]);

  useEffect(() => {
    loadOrders();
    // Auto-refresh every 30 seconds for live progress updates
    const interval = setInterval(() => {
      if (!searchQuery) loadOrders(true);
    }, 30000);
    return () => clearInterval(interval);
  }, []);

  // Server-side search for finding orders across all statuses (including shipped/archived)
  useEffect(() => {
    if (!searchQuery || searchQuery.length < 2) {
      // Reset to normal active orders when search is cleared
      if (searchQuery === '' && !loading) loadOrders();
      return;
    }
    const timer = setTimeout(async () => {
      try {
        setLoading(true);
        const response = await getWorkOrders({ search: searchQuery, limit: 100 });
        setOrders(response.data.data || []);
      } catch (err) {
        console.error('Search failed:', err);
      } finally {
        setLoading(false);
      }
    }, 400); // debounce
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Restore scroll position when returning from a WO detail page
  useEffect(() => {
    if (!loading && orders.length > 0) {
      const savedScroll = sessionStorage.getItem('wo_scroll');
      if (savedScroll) {
        requestAnimationFrame(() => window.scrollTo(0, parseInt(savedScroll)));
        sessionStorage.removeItem('wo_scroll');
      }
    }
  }, [loading, orders.length]);

  const loadOrders = async (silent = false) => {
    try {
      if (!silent) setLoading(true);
      const response = await getWorkOrders();
      setOrders(response.data.data || []);
    } catch (err) {
      if (!silent) setError('Failed to load work orders');
      console.error(err);
    } finally {
      if (!silent) setLoading(false);
    }
  };

  const getFilteredOrders = () => {
    let filtered = [...orders];

    // Filter by status (skip when searching — show all matching statuses)
    if (statusFilter !== 'all' && !searchQuery) {
      filtered = filtered.filter(o => o.status === statusFilter);
    }

    // Filter by search query (only for local filtering when search < 2 chars)
    // Server-side search handles 2+ char queries — don't double-filter
    if (searchQuery && searchQuery.length < 2) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(o =>
        o.clientName?.toLowerCase().includes(query) ||
        o.orderNumber?.toLowerCase().includes(query) ||
        o.clientPurchaseOrderNumber?.toLowerCase().includes(query) ||
        o.drNumber?.toString().includes(query) ||
        o.contactName?.toLowerCase().includes(query)
      );
    }

    // Sort
    filtered.sort((a, b) => {
      // Rush orders always go to top
      const aRush = a.parts?.some(p => p.partType === 'rush_service') && !['stored', 'completed', 'shipped', 'archived'].includes(a.status);
      const bRush = b.parts?.some(p => p.partType === 'rush_service') && !['stored', 'completed', 'shipped', 'archived'].includes(b.status);
      if (aRush && !bRush) return -1;
      if (!aRush && bRush) return 1;

      switch (sortBy) {
        case 'dr_desc':
          return (b.drNumber || 0) - (a.drNumber || 0);
        case 'dr_asc':
          return (a.drNumber || 0) - (b.drNumber || 0);
        case 'client':
          return (a.clientName || '').localeCompare(b.clientName || '');
        case 'date_desc':
          return new Date(b.createdAt) - new Date(a.createdAt);
        case 'date_asc':
          return new Date(a.createdAt) - new Date(b.createdAt);
        case 'due_date':
          if (!a.promisedDate && !b.promisedDate) return 0;
          if (!a.promisedDate) return 1;
          if (!b.promisedDate) return -1;
          return new Date(a.promisedDate) - new Date(b.promisedDate);
        default:
          return (b.drNumber || 0) - (a.drNumber || 0);
      }
    });

    return filtered;
  };

  const handleCreateOrder = async (e) => {
    e.preventDefault();
    if (!newOrder.clientName.trim()) {
      setError('Client name is required');
      return;
    }
    try {
      setSaving(true);
      const payload = {
        ...newOrder,
        assignDRNumber: !useCustomDR,
        customDRNumber: useCustomDR && customDR ? parseInt(customDR) : null,
        shipmentIds: linkShipmentId ? [linkShipmentId] : []
      };
      const response = await createWorkOrder(payload);
      setShowNewModal(false);
      setLinkShipmentId(null);
      setNewOrder({
        clientName: '', clientId: null, clientPurchaseOrderNumber: '', contactName: '',
        contactPhone: '', contactEmail: '', notes: '', receivedBy: '',
        requestedDueDate: '', promisedDate: ''
      });
      navigate(`/workorders/${response.data.data.id}`);
    } catch (err) {
      setError(err.response?.data?.error?.message || 'Failed to create work order');
    } finally {
      setSaving(false);
    }
  };

  const getStatusBadge = (status) => {
    const colors = {
      quoted: { bg: '#f5f5f5', text: '#666', label: 'Quoted' },
      work_order_generated: { bg: '#f3e5f5', text: '#7b1fa2', label: 'WO Generated' },
      waiting_for_materials: { bg: '#fff3e0', text: '#f57c00', label: 'Waiting Materials' },
      received: { bg: '#e3f2fd', text: '#1565c0', label: 'Received' },
      processing: { bg: '#e1f5fe', text: '#0288d1', label: 'Processing' },
      stored: { bg: '#e8f5e9', text: '#2e7d32', label: 'Stored' },
      shipped: { bg: '#f3e5f5', text: '#7b1fa2', label: 'Shipped' },
      archived: { bg: '#eceff1', text: '#546e7a', label: 'Archived' },
      void: { bg: '#ffcdd2', text: '#b71c1c', label: '⛔ VOID' },
      // Legacy mappings
      draft: { bg: '#e3f2fd', text: '#1565c0', label: 'Received' },
      in_progress: { bg: '#e1f5fe', text: '#0288d1', label: 'Processing' },
      completed: { bg: '#e8f5e9', text: '#2e7d32', label: 'Stored' },
    };
    const style = colors[status] || colors.received;
    return (
      <span style={{
        background: style.bg,
        color: style.text,
        padding: '4px 10px',
        borderRadius: 12,
        fontSize: '0.75rem',
        fontWeight: 600
      }}>
        {style.label}
      </span>
    );
  };

  const getStatusColor = (order) => {
    if (!order.parts || order.parts.length === 0) return '#9c27b0'; // Purple - no parts
    switch (order.status) {
      case 'stored':
      case 'completed': return '#388e3c';
      case 'shipped':
      case 'processing':
      case 'in_progress': return '#0288d1';
      case 'waiting_for_materials': return '#f57c00';
      default: return '#1976d2';
    }
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return null;
    const d = typeof dateStr === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dateStr) ? dateStr + 'T12:00:00' : dateStr;
    return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const filteredOrders = getFilteredOrders();

  if (loading) {
    return (
      <div className="loading">
        <div className="spinner"></div>
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Work Orders</h1>
          <p style={{ color: '#666' }}>{orders.length} total orders</p>
        </div>
        <button className="btn btn-primary" onClick={async () => {
          setShowNewModal(true);
          try { const res = await getNextDRNumber(); setNextDR(res.data.data.nextNumber); } catch { setNextDR(null); }
          setUseCustomDR(false);
          setCustomDR('');
        }}>
          <Plus size={20} /> New Work Order
        </button>
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      {/* Filters */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: 200 }}>
            <div style={{ position: 'relative' }}>
              <Search size={18} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#666' }} />
              <input
                type="text"
                className="form-input"
                placeholder="Search by client, DR#, PO#..."
                value={searchQuery}
                onChange={(e) => updateSearch(e.target.value)}
                style={{ paddingLeft: 40 }}
              />
            </div>
          </div>
          <select 
            className="form-select" 
            value={sortBy} 
            onChange={(e) => setSortBy(e.target.value)}
            style={{ width: 180 }}
          >
            <option value="dr_desc">DR# (Newest)</option>
            <option value="dr_asc">DR# (Oldest)</option>
            <option value="client">Client Name</option>
            <option value="date_desc">Created (Newest)</option>
            <option value="date_asc">Created (Oldest)</option>
            <option value="due_date">Due Date</option>
          </select>
        </div>

        {/* Status Tabs */}
        <div style={{ marginTop: 16, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {[
            { value: 'all', label: 'All' },
            { value: 'waiting_for_materials', label: 'Waiting Materials' },
            { value: 'received', label: 'Received' },
            { value: 'processing', label: 'Processing' },
            { value: 'stored', label: 'Stored' },
            { value: 'shipped', label: 'Shipped' }
          ].map(status => (
            <button
              key={status.value}
              className={`tab ${statusFilter === status.value ? 'active' : ''}`}
              onClick={() => setStatusFilter(status.value)}
            >
              {status.label}
            </button>
          ))}
        </div>
      </div>

      {/* Work Orders Grid */}
      {filteredOrders.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">📋</div>
          <div className="empty-state-title">No work orders found</div>
          <p>{searchQuery || statusFilter !== 'all' ? 'Try adjusting your filters' : 'Create a work order to get started'}</p>
        </div>
      ) : (
        <div className="grid grid-3">
          {filteredOrders.map((order) => {
            const isRush = order.parts?.some(p => p.partType === 'rush_service') && !['stored', 'completed', 'shipped', 'archived'].includes(order.status);
            return (
            <div
              key={order.id}
              className="card"
              onClick={() => { sessionStorage.setItem('wo_scroll', window.scrollY); navigate(`/workorders/${order.id}`); }}
              style={{
                cursor: 'pointer',
                transition: 'transform 0.15s, box-shadow 0.15s',
                background: order.isVoided ? '#fafafa' : isRush ? '#ffebee' : undefined,
                border: order.isVoided ? '2px dashed #e0e0e0' : isRush ? '2px solid #ef5350' : undefined,
                borderLeft: order.isVoided ? '4px solid #c62828' : isRush ? '4px solid #c62828' : `4px solid ${getStatusColor(order)}`,
                opacity: order.isVoided ? 0.7 : 1,
              }}
              onMouseOver={(e) => {
                e.currentTarget.style.transform = 'translateY(-2px)';
                e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.15)';
              }}
              onMouseOut={(e) => {
                e.currentTarget.style.transform = 'none';
                e.currentTarget.style.boxShadow = '';
              }}
            >
              {/* Header */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                <div>
                  {order.drNumber ? (
                    <div style={{
                      fontFamily: 'Courier New, monospace',
                      fontWeight: 700,
                      fontSize: '1.2rem',
                      color: isRush ? '#c62828' : '#1976d2',
                      background: isRush ? '#ffcdd2' : '#e3f2fd',
                      padding: '4px 10px',
                      borderRadius: 6,
                      display: 'inline-block'
                    }}>
                      DR-{order.drNumber}
                    </div>
                  ) : (
                    <div style={{ fontWeight: 600, color: '#666', fontSize: '0.85rem' }}>
                      {order.orderNumber}
                    </div>
                  )}
                  <div style={{ fontWeight: 600, fontSize: '1rem', marginTop: 6 }}>
                    {order.clientName}
                  </div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
                  {isRush && (
                    <span style={{
                      background: '#c62828', color: 'white', padding: '3px 10px',
                      borderRadius: 4, fontSize: '0.75rem', fontWeight: 700,
                      letterSpacing: '0.5px'
                    }}>
                      🚨 RUSH
                    </span>
                  )}
                  {getStatusBadge(order.isVoided ? 'void' : order.status)}
                </div>
              </div>

              {/* Void Banner */}
              {order.isVoided && (
                <div style={{ background: '#ffcdd2', padding: '4px 10px', borderRadius: 4, marginBottom: 8, fontSize: '0.8rem', color: '#b71c1c', fontWeight: 600 }}>
                  ⛔ {order.voidReason || 'Voided'}
                </div>
              )}

              {/* Client PO */}
              {order.clientPurchaseOrderNumber && (
                <div style={{
                  fontSize: '0.85rem',
                  color: '#555',
                  marginBottom: 8,
                  background: '#f5f5f5',
                  padding: '4px 8px',
                  borderRadius: 4,
                  display: 'inline-block'
                }}>
                  PO# {order.clientPurchaseOrderNumber}
                </div>
              )}

              {/* Parts Progress */}
              {(() => {
                const totalParts = order.parts?.length || 0;
                const completedParts = (order.parts || []).filter(p => p.status === 'completed').length;
                const inProgressParts = (order.parts || []).filter(p => p.status === 'in_progress').length;
                const pct = totalParts > 0 ? Math.round((completedParts / totalParts) * 100) : 0;
                const isShippedOrArchived = ['shipped', 'archived'].includes(order.status);
                const displayPct = isShippedOrArchived ? 100 : pct;
                const displayCompleted = isShippedOrArchived ? totalParts : completedParts;
                return (
                  <div style={{ marginBottom: 8 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 3 }}>
                      <span style={{ fontSize: '0.8rem', color: '#666', display: 'flex', alignItems: 'center', gap: 4 }}>
                        <Package size={13} />
                        {displayCompleted}/{totalParts} part{totalParts !== 1 ? 's' : ''} complete
                      </span>
                      <span style={{ fontSize: '0.75rem', fontWeight: 700, color: displayPct === 100 ? '#2e7d32' : displayPct > 0 ? '#1565c0' : '#999' }}>
                        {displayPct}%
                      </span>
                    </div>
                    <div style={{ height: 6, background: '#e0e0e0', borderRadius: 3, overflow: 'hidden' }}>
                      <div style={{
                        height: '100%',
                        width: `${displayPct}%`,
                        background: displayPct === 100 ? '#4caf50' : '#1976d2',
                        borderRadius: 3,
                        transition: 'width 0.5s ease'
                      }} />
                    </div>
                    {inProgressParts > 0 && !isShippedOrArchived && (
                      <div style={{ fontSize: '0.7rem', color: '#0288d1', marginTop: 2 }}>
                        {inProgressParts} in progress
                      </div>
                    )}
                  </div>
                );
              })()}

              {/* Storage Location */}
              {order.storageLocation && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#666', fontSize: '0.85rem', marginBottom: 8 }}>
                  <MapPin size={14} />
                  <span>{order.storageLocation}</span>
                </div>
              )}

              {/* Dates */}
              <div style={{ display: 'flex', gap: 12, fontSize: '0.8rem', color: '#888', marginTop: 8 }}>
                {order.promisedDate && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <Calendar size={12} />
                    <span>Due: {formatDate(order.promisedDate)}</span>
                  </div>
                )}
                {order.createdAt && (
                  <div>
                    Created: {formatDate(order.createdAt)}
                  </div>
                )}
              </div>
            </div>
          )})}
        </div>
      )}

      {/* New Work Order Modal */}
      {showNewModal && (
        <div className="modal-overlay" onClick={() => { setShowNewModal(false); setLinkShipmentId(null); }}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 560 }}>
            <div className="modal-header">
              <h3 className="modal-title">New Work Order</h3>
              <button className="modal-close" onClick={() => { setShowNewModal(false); setLinkShipmentId(null); }}>&times;</button>
            </div>
            <form onSubmit={handleCreateOrder}>
              <div className="modal-body">

                {/* Shipment linking banner */}
                {linkShipmentId && (
                  <div style={{ background: '#e8f5e9', padding: 10, borderRadius: 8, marginBottom: 12, fontSize: '0.85rem', color: '#2e7d32', display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Package size={16} />
                    <span>This work order will be linked to the receiving record</span>
                  </div>
                )}

                {/* DR Number Preview */}
                <div style={{ background: '#e3f2fd', padding: 14, borderRadius: 8, marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontSize: '0.8rem', color: '#666' }}>DR Number</div>
                    <div style={{ fontWeight: 700, fontSize: '1.3rem', color: '#1565c0' }}>
                      DR-{useCustomDR ? (customDR || '?') : (nextDR || '...')}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: '0.85rem' }}>
                      <input type="checkbox" checked={useCustomDR} onChange={(e) => { setUseCustomDR(e.target.checked); if (!e.target.checked) setCustomDR(''); }} />
                      <span>Use different DR#</span>
                    </label>
                    {useCustomDR && (
                      <input type="number" className="form-input" value={customDR}
                        onChange={(e) => setCustomDR(e.target.value)}
                        placeholder="Enter DR#" autoFocus
                        style={{ width: 120, marginTop: 4, textAlign: 'right', fontWeight: 700, fontSize: '1rem' }}
                      />
                    )}
                  </div>
                </div>

                {/* Client Name with Autofill */}
                <div className="form-group" style={{ position: 'relative' }}>
                  <label className="form-label">Client Name *</label>
                  <input
                    type="text"
                    className="form-input"
                    value={newOrder.clientName}
                    onChange={async (e) => {
                      const val = e.target.value;
                      setNewOrder({ ...newOrder, clientName: val, clientId: null });
                      if (val.length >= 1) {
                        try {
                          const res = await searchClients(val);
                          setClientSuggestions(res.data.data || []);
                          setShowClientSuggestions(true);
                        } catch { setClientSuggestions([]); }
                      } else {
                        setClientSuggestions([]);
                        setShowClientSuggestions(false);
                      }
                    }}
                    onFocus={async () => {
                      try { const res = await searchClients(''); setClientSuggestions(res.data.data || []); setShowClientSuggestions(true); } catch {}
                    }}
                    onBlur={() => setTimeout(() => setShowClientSuggestions(false), 200)}
                    required
                    autoComplete="off"
                    placeholder="Start typing to search clients..."
                  />
                  {showClientSuggestions && clientSuggestions.length > 0 && (
                    <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 100, background: 'white', border: '1px solid #ddd', borderRadius: 4, maxHeight: 200, overflowY: 'auto', boxShadow: '0 4px 12px rgba(0,0,0,0.15)' }}>
                      {clientSuggestions.map(c => (
                        <div key={c.id} style={{ padding: '8px 12px', cursor: 'pointer', borderBottom: '1px solid #eee' }}
                          onMouseDown={() => {
                            setNewOrder(prev => ({
                              ...prev,
                              clientName: c.name,
                              clientId: c.id,
                              contactName: c.contactName || prev.contactName,
                              contactPhone: c.contactPhone || prev.contactPhone,
                              contactEmail: c.contactEmail || prev.contactEmail,
                            }));
                            setShowClientSuggestions(false);
                          }}>
                          <strong>{c.name}</strong>
                          {c.contactName && <span style={{ fontSize: '0.8rem', color: '#666', marginLeft: 8 }}>{c.contactName}</span>}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="form-group">
                  <label className="form-label">Client PO Number</label>
                  <input
                    type="text"
                    className="form-input"
                    value={newOrder.clientPurchaseOrderNumber}
                    onChange={(e) => setNewOrder({ ...newOrder, clientPurchaseOrderNumber: e.target.value })}
                    placeholder="Enter client's PO number..."
                  />
                </div>
                <div className="grid grid-2">
                  <div className="form-group">
                    <label className="form-label">Contact Name</label>
                    <input
                      type="text"
                      className="form-input"
                      value={newOrder.contactName}
                      onChange={(e) => setNewOrder({ ...newOrder, contactName: e.target.value })}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Contact Phone</label>
                    <input
                      type="tel"
                      className="form-input"
                      value={newOrder.contactPhone}
                      onChange={(e) => setNewOrder({ ...newOrder, contactPhone: e.target.value })}
                    />
                  </div>
                </div>
                <div className="form-group">
                  <label className="form-label">Contact Email</label>
                  <input
                    type="email"
                    className="form-input"
                    value={newOrder.contactEmail}
                    onChange={(e) => setNewOrder({ ...newOrder, contactEmail: e.target.value })}
                  />
                </div>
                <div className="grid grid-2">
                  <div className="form-group">
                    <label className="form-label">Requested Due Date</label>
                    <input
                      type="date"
                      className="form-input"
                      value={newOrder.requestedDueDate}
                      onChange={(e) => setNewOrder({ ...newOrder, requestedDueDate: e.target.value })}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Promised Date</label>
                    <input
                      type="date"
                      className="form-input"
                      value={newOrder.promisedDate}
                      onChange={(e) => setNewOrder({ ...newOrder, promisedDate: e.target.value })}
                    />
                  </div>
                </div>
                <div className="form-group">
                  <label className="form-label">Notes</label>
                  <textarea
                    className="form-textarea"
                    value={newOrder.notes}
                    onChange={(e) => setNewOrder({ ...newOrder, notes: e.target.value })}
                    rows={3}
                  />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => { setShowNewModal(false); setLinkShipmentId(null); }}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving ? 'Creating...' : `Create Work Order (DR-${useCustomDR ? (customDR || '?') : (nextDR || '...')})`}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default WorkOrdersPage;
