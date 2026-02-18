import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, MapPin, Calendar, Package, Truck, CheckCircle, Clock, FileText, Inbox, Image, AlertCircle } from 'lucide-react';
import { getWorkOrders, getArchivedWorkOrders, getUnlinkedShipments, linkShipmentToWorkOrder, getRecentlyCompletedOrders } from '../services/api';

// Status configuration
const STATUSES = {
  quoted: { label: 'Quoted', color: '#9e9e9e', bg: '#f5f5f5' },
  work_order_generated: { label: 'Work Order Generated', color: '#7b1fa2', bg: '#f3e5f5' },
  waiting_for_materials: { label: 'Waiting for Materials', color: '#f57c00', bg: '#fff3e0' },
  received: { label: 'Received', color: '#1976d2', bg: '#e3f2fd' },
  processing: { label: 'Processing', color: '#0288d1', bg: '#e1f5fe' },
  stored: { label: 'Stored', color: '#388e3c', bg: '#e8f5e9' },
  shipped: { label: 'Shipped', color: '#7b1fa2', bg: '#f3e5f5' },
  picked_up: { label: 'Picked Up', color: '#7b1fa2', bg: '#f3e5f5' },
  archived: { label: 'Archived', color: '#616161', bg: '#eeeeee' },
  // Legacy status mappings
  draft: { label: 'Received', color: '#1976d2', bg: '#e3f2fd' },
  in_progress: { label: 'Processing', color: '#0288d1', bg: '#e1f5fe' },
  completed: { label: 'Stored', color: '#388e3c', bg: '#e8f5e9' }
};

function InventoryPage() {
  const navigate = useNavigate();
  const [workOrders, setWorkOrders] = useState([]);
  const [unlinkedShipments, setUnlinkedShipments] = useState([]);
  const [recentlyCompleted, setRecentlyCompleted] = useState([]);
  const [dismissedCompletions, setDismissedCompletions] = useState(() => {
    try { return JSON.parse(localStorage.getItem('dismissed_completions') || '[]'); } catch { return []; }
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  
  const [statusFilter, setStatusFilter] = useState(() => {
    return localStorage.getItem('inventory_statusFilter') || 'active';
  });
  const [sortBy, setSortBy] = useState(() => {
    return localStorage.getItem('inventory_sortBy') || 'dr_desc';
  });

  useEffect(() => {
    localStorage.setItem('inventory_statusFilter', statusFilter);
  }, [statusFilter]);

  useEffect(() => {
    localStorage.setItem('inventory_sortBy', sortBy);
  }, [sortBy]);

  useEffect(() => {
    loadWorkOrders();
  }, [statusFilter]);

  const loadWorkOrders = async () => {
    try {
      setLoading(true);
      setError(null);
      let response;
      if (statusFilter === 'archived') {
        try {
          response = await getArchivedWorkOrders();
        } catch (archiveErr) {
          console.error('Archived endpoint failed, trying fallback:', archiveErr);
          // Fallback: get all work orders and filter client-side
          response = await getWorkOrders({ archived: 'true' });
        }
      } else {
        response = await getWorkOrders({ archived: 'false' });
      }
      setWorkOrders(response.data.data || []);
      
      // Also load unlinked shipments
      try {
        const unlinkedRes = await getUnlinkedShipments();
        setUnlinkedShipments(unlinkedRes.data.data || []);
      } catch (e) {
        console.error('Failed to load unlinked shipments:', e);
      }
      
      // Load recently completed orders (shop floor notifications)
      try {
        const completedRes = await getRecentlyCompletedOrders();
        setRecentlyCompleted(completedRes.data.data || []);
      } catch (e) {
        console.error('Failed to load recently completed:', e);
      }
    } catch (err) {
      setError('Failed to load inventory');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateWorkOrder = async (shipmentId) => {
    try {
      const res = await linkShipmentToWorkOrder(shipmentId);
      const workOrder = res.data.data.workOrder;
      navigate(`/workorder/${workOrder.id}`);
    } catch (err) {
      console.error('Failed to create work order:', err);
    }
  };

  const dismissCompletion = (orderId) => {
    const updated = [...dismissedCompletions, orderId];
    setDismissedCompletions(updated);
    localStorage.setItem('dismissed_completions', JSON.stringify(updated));
  };

  const visibleCompletions = recentlyCompleted.filter(o => !dismissedCompletions.includes(o.id));

  const getFilteredOrders = () => {
    let filtered = [...workOrders];

    // Filter by status
    if (statusFilter === 'waiting_for_materials') {
      filtered = filtered.filter(o => o.status === 'waiting_for_materials');
    } else if (statusFilter === 'received') {
      filtered = filtered.filter(o => o.status === 'received' || o.status === 'draft');
    } else if (statusFilter === 'processing') {
      filtered = filtered.filter(o => o.status === 'processing' || o.status === 'in_progress');
    } else if (statusFilter === 'stored') {
      filtered = filtered.filter(o => o.status === 'stored' || o.status === 'completed');
    } else if (statusFilter === 'active') {
      // All non-archived, non-shipped, non-picked-up
      filtered = filtered.filter(o => o.status !== 'archived' && o.status !== 'shipped' && o.status !== 'picked_up');
    }

    // Filter by search query
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(o =>
        o.clientName?.toLowerCase().includes(query) ||
        o.orderNumber?.toLowerCase().includes(query) ||
        o.clientPurchaseOrderNumber?.toLowerCase().includes(query) ||
        (o.drNumber && `DR-${o.drNumber}`.toLowerCase().includes(query)) ||
        (o.drNumber && o.drNumber.toString().includes(query)) ||
        o.storageLocation?.toLowerCase().includes(query)
      );
    }

    // Sort
    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'dr_desc':
          return (b.drNumber || 0) - (a.drNumber || 0);
        case 'dr_asc':
          return (a.drNumber || 0) - (b.drNumber || 0);
        case 'client':
          return (a.clientName || '').localeCompare(b.clientName || '');
        case 'date':
          return new Date(b.createdAt) - new Date(a.createdAt);
        case 'location':
          return (a.storageLocation || '').localeCompare(b.storageLocation || '');
        default:
          return (b.drNumber || 0) - (a.drNumber || 0);
      }
    });

    return filtered;
  };

  const filteredOrders = getFilteredOrders();

  // Count for badges
  const waitingCount = workOrders.filter(o => o.status === 'waiting_for_materials').length;
  const receivedCount = workOrders.filter(o => o.status === 'received' || o.status === 'draft').length;
  const processingCount = workOrders.filter(o => o.status === 'processing' || o.status === 'in_progress').length;
  const storedCount = workOrders.filter(o => o.status === 'stored' || o.status === 'completed').length;

  const getStatusBadge = (status) => {
    const config = STATUSES[status] || STATUSES.received;
    return (
      <span style={{
        background: config.bg,
        color: config.color,
        padding: '4px 10px',
        borderRadius: 12,
        fontSize: '0.75rem',
        fontWeight: 600,
        whiteSpace: 'nowrap'
      }}>
        {config.label}
      </span>
    );
  };

  const getStatusColor = (status) => {
    const config = STATUSES[status] || STATUSES.received;
    return config.color;
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  // Get thumbnail image for order (uses server-generated signed URL)
  const getOrderImage = (order) => {
    // Use the pre-signed thumbnail URL from the backend
    if (order.thumbnailUrl) return order.thumbnailUrl;
    return null;
  };

  if (loading) {
    return (
      <div className="loading">
        <div className="spinner"></div>
      </div>
    );
  }

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">
          {statusFilter === 'archived' ? '📁 Archived (Shipped)' : 
           statusFilter === 'waiting_for_materials' ? '⏳ Waiting for Materials' : 
           statusFilter === 'stored' ? '✅ Stored (Ready to Ship)' :
           statusFilter === 'processing' ? '🔧 Processing' :
           statusFilter === 'received' ? '📥 Received' :
           '📦 Inventory'}
        </h1>
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      {/* Tabs */}
      <div className="tabs" style={{ flexWrap: 'wrap' }}>
        <button 
          className={`tab ${statusFilter === 'active' ? 'active' : ''}`}
          onClick={() => setStatusFilter('active')}
        >
          All Active
        </button>
        <button 
          className={`tab ${statusFilter === 'waiting_for_materials' ? 'active' : ''}`}
          onClick={() => setStatusFilter('waiting_for_materials')}
          style={{ display: 'flex', alignItems: 'center', gap: 6 }}
        >
          <Clock size={14} />
          Waiting for Materials
          {waitingCount > 0 && (
            <span style={{ background: '#f57c00', color: 'white', borderRadius: 10, padding: '2px 8px', fontSize: '0.7rem' }}>
              {waitingCount}
            </span>
          )}
        </button>
        <button 
          className={`tab ${statusFilter === 'received' ? 'active' : ''}`}
          onClick={() => setStatusFilter('received')}
          style={{ display: 'flex', alignItems: 'center', gap: 6 }}
        >
          <Inbox size={14} />
          Received
          {receivedCount > 0 && (
            <span style={{ background: '#1976d2', color: 'white', borderRadius: 10, padding: '2px 8px', fontSize: '0.7rem' }}>
              {receivedCount}
            </span>
          )}
        </button>
        <button 
          className={`tab ${statusFilter === 'processing' ? 'active' : ''}`}
          onClick={() => setStatusFilter('processing')}
          style={{ display: 'flex', alignItems: 'center', gap: 6 }}
        >
          <Clock size={14} />
          Processing
          {processingCount > 0 && (
            <span style={{ background: '#0288d1', color: 'white', borderRadius: 10, padding: '2px 8px', fontSize: '0.7rem' }}>
              {processingCount}
            </span>
          )}
        </button>
        <button 
          className={`tab ${statusFilter === 'stored' ? 'active' : ''}`}
          onClick={() => setStatusFilter('stored')}
          style={{ display: 'flex', alignItems: 'center', gap: 6 }}
        >
          <CheckCircle size={14} />
          Stored
          {storedCount > 0 && (
            <span style={{ background: '#388e3c', color: 'white', borderRadius: 10, padding: '2px 8px', fontSize: '0.7rem' }}>
              {storedCount}
            </span>
          )}
        </button>
        <button 
          className={`tab ${statusFilter === 'archived' ? 'active' : ''}`}
          onClick={() => setStatusFilter('archived')}
          style={{ display: 'flex', alignItems: 'center', gap: 6 }}
        >
          <Truck size={14} />
          Shipped/Archived
        </button>
      </div>

      {/* Search and Sort */}
      <div className="card" style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'center' }}>
          <div className="search-box" style={{ flex: 1, minWidth: 200, marginBottom: 0 }}>
            <Search size={18} className="search-box-icon" />
            <input
              type="text"
              placeholder="Search by DR#, client, PO#, location..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="search-box-input"
            />
          </div>
          <select 
            className="form-select" 
            value={sortBy} 
            onChange={(e) => setSortBy(e.target.value)}
            style={{ width: 'auto', minWidth: 150 }}
          >
            <option value="dr_desc">DR# (Newest)</option>
            <option value="dr_asc">DR# (Oldest)</option>
            <option value="client">Client Name</option>
            <option value="date">Date Received</option>
            <option value="location">Location</option>
          </select>
        </div>
      </div>

      {/* Results count */}
      <div style={{ marginBottom: 12, color: '#666', fontSize: '0.9rem' }}>
        {filteredOrders.length} item{filteredOrders.length !== 1 ? 's' : ''}
      </div>

      {/* Waiting for Instructions - unlinked shipments */}
      
      {/* Shop Floor Completed Notifications */}
      {visibleCompletions.length > 0 && statusFilter !== 'archived' && (
        <div style={{ 
          background: '#e8f5e9', 
          border: '2px solid #4caf50', 
          borderRadius: 8, 
          padding: '14px 18px', 
          marginBottom: 16 
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <h3 style={{ margin: 0, color: '#2e7d32', fontSize: '1rem', display: 'flex', alignItems: 'center', gap: 8 }}>
              <CheckCircle size={18} />
              Shop Floor — Order{visibleCompletions.length > 1 ? 's' : ''} Completed ({visibleCompletions.length})
            </h3>
          </div>
          {visibleCompletions.map(order => (
            <div key={order.id} style={{ 
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              background: '#fff', borderRadius: 6, padding: '10px 14px', marginBottom: 6
            }}>
              <div>
                <span style={{ fontWeight: 700, color: '#1976d2', fontFamily: 'monospace', fontSize: '1.05rem' }}>
                  DR-{order.drNumber}
                </span>
                <span style={{ marginLeft: 12, color: '#333' }}>{order.clientName}</span>
                <span style={{ marginLeft: 12, color: '#888', fontSize: '0.85rem' }}>
                  {order.parts?.length || 0} part{(order.parts?.length || 0) !== 1 ? 's' : ''}
                </span>
                {order.completedAt && (
                  <span style={{ marginLeft: 12, color: '#666', fontSize: '0.8rem' }}>
                    {new Date(order.completedAt).toLocaleString()}
                  </span>
                )}
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button 
                  onClick={() => navigate(`/workorder/${order.id}`)}
                  style={{ padding: '6px 14px', background: '#1976d2', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer', fontWeight: 600, fontSize: '0.85rem' }}
                >
                  View
                </button>
                <button 
                  onClick={() => dismissCompletion(order.id)}
                  style={{ padding: '6px 10px', background: 'none', color: '#999', border: '1px solid #ccc', borderRadius: 4, cursor: 'pointer', fontSize: '0.85rem' }}
                >
                  ✕
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {unlinkedShipments.length > 0 && statusFilter !== 'archived' && (
        <div style={{ 
          background: '#fff3e0', 
          border: '1px solid #ffcc02', 
          borderRadius: 8, 
          padding: 16, 
          marginBottom: 16 
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <AlertCircle size={20} color="#e65100" />
            <strong style={{ color: '#e65100' }}>
              Waiting for Instructions ({unlinkedShipments.length})
            </strong>
            <span style={{ color: '#bf360c', fontSize: '0.85rem' }}>
              — Material received but no work order assigned
            </span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {unlinkedShipments.map(s => (
              <div key={s.id} style={{ 
                background: 'white', 
                borderRadius: 6, 
                padding: '10px 14px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 12
              }}>
                <div style={{ flex: 1 }}>
                  <strong>{s.clientName}</strong>
                  {s.description && (
                    <span style={{ color: '#666', fontSize: '0.85rem', marginLeft: 8 }}>
                      — {s.description.length > 60 ? s.description.slice(0, 60) + '...' : s.description}
                    </span>
                  )}
                  {s.clientPurchaseOrderNumber && (
                    <span style={{ color: '#1976d2', fontSize: '0.8rem', marginLeft: 8 }}>
                      PO# {s.clientPurchaseOrderNumber}
                    </span>
                  )}
                  <div style={{ fontSize: '0.8rem', color: '#999', marginTop: 2 }}>
                    Received {new Date(s.receivedAt || s.createdAt).toLocaleDateString()}
                    {s.location && ` • ${s.location}`}
                    {s.receivedBy && ` • by ${s.receivedBy}`}
                  </div>
                </div>
                <button 
                  className="btn btn-primary" 
                  style={{ whiteSpace: 'nowrap', fontSize: '0.85rem', padding: '6px 14px' }}
                  onClick={() => handleCreateWorkOrder(s.id)}
                >
                  Create Work Order
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Grid */}
      {filteredOrders.length === 0 ? (
        <div className="empty-state">
          <Package size={48} color="#ccc" />
          <div className="empty-state-title" style={{ marginTop: 16 }}>No items found</div>
          <p>
            {searchQuery 
              ? 'Try adjusting your search terms' 
              : 'No items match this filter'}
          </p>
        </div>
      ) : (
        <div className="grid grid-3">
          {filteredOrders.map((order) => {
            const orderImage = getOrderImage(order);
            return (
              <div 
                key={order.id} 
                className="card"
                onClick={() => navigate(`/workorder/${order.id}`)}
                style={{ 
                  cursor: 'pointer',
                  borderLeft: `4px solid ${getStatusColor(order.status)}`,
                  transition: 'transform 0.15s, box-shadow 0.15s',
                  padding: 0,
                  overflow: 'hidden'
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
                {/* Image thumbnail */}
                {orderImage ? (
                  <div style={{ 
                    height: 120, 
                    background: '#f5f5f5',
                    overflow: 'hidden'
                  }}>
                    <img 
                      src={orderImage} 
                      alt={order.clientName || 'Work order'} 
                      style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                      onError={(e) => { e.target.style.display = 'none'; }}
                    />
                  </div>
                ) : (
                  <div style={{ 
                    height: 80, 
                    background: 'linear-gradient(135deg, #f5f5f5 0%, #e0e0e0 100%)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}>
                    <Image size={32} color="#bbb" />
                  </div>
                )}

                <div style={{ padding: 16 }}>
                  {/* Header with DR# and Status */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                    <div>
                      {order.drNumber ? (
                        <div style={{ 
                          fontFamily: 'Courier New, monospace', 
                          fontWeight: 700, 
                          fontSize: '1.2rem', 
                          color: '#1976d2',
                          background: '#e3f2fd',
                          padding: '4px 10px',
                          borderRadius: 6,
                          display: 'inline-block'
                        }}>
                          DR-{order.drNumber}
                        </div>
                      ) : (
                        <div style={{ fontWeight: 600, color: '#666' }}>
                          {order.orderNumber}
                        </div>
                      )}
                    </div>
                    {getStatusBadge(order.status)}
                  </div>

                  {/* Client Name */}
                  <div style={{ fontWeight: 600, fontSize: '1rem', marginBottom: 8 }}>
                    {order.clientName}
                  </div>

                  {/* Client PO */}
                  {order.clientPurchaseOrderNumber && (
                    <div style={{ 
                      display: 'flex', 
                      alignItems: 'center', 
                      gap: 6, 
                      fontSize: '0.85rem',
                      color: '#666',
                      marginBottom: 6
                    }}>
                      <FileText size={14} />
                      <span>PO: <strong>{order.clientPurchaseOrderNumber}</strong></span>
                    </div>
                  )}

                  {/* Location */}
                  {order.storageLocation && (
                    <div style={{ 
                      display: 'inline-flex', 
                      alignItems: 'center', 
                      gap: 6, 
                      fontSize: '0.85rem',
                      color: '#e65100',
                      marginBottom: 6,
                      background: '#fff3e0',
                      padding: '4px 8px',
                      borderRadius: 4
                    }}>
                      <MapPin size={14} />
                      <span style={{ fontWeight: 500 }}>{order.storageLocation}</span>
                    </div>
                  )}

                  {/* Parts count */}
                  <div style={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    gap: 6, 
                    fontSize: '0.85rem',
                    color: '#666',
                    marginBottom: 6
                  }}>
                    <Package size={14} />
                    <span>{order.parts?.length || 0} part{(order.parts?.length || 0) !== 1 ? 's' : ''}</span>
                  </div>

                  {/* Shop completion badge */}
                  {order.completedAt && (
                    <div style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 6,
                      fontSize: '0.8rem',
                      color: '#2e7d32',
                      background: '#e8f5e9',
                      padding: '4px 8px',
                      borderRadius: 4,
                      marginBottom: 6,
                      fontWeight: 600
                    }}>
                      ✅ Shop Complete — {new Date(order.completedAt).toLocaleDateString()}
                    </div>
                  )}

                  {/* Date */}
                  <div style={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    gap: 6, 
                    fontSize: '0.8rem',
                    color: '#999',
                    marginTop: 8,
                    paddingTop: 8,
                    borderTop: '1px solid #eee'
                  }}>
                    <Calendar size={14} />
                    <span>
                      {statusFilter === 'archived' 
                        ? `Shipped ${formatDate(order.shippedAt || order.archivedAt)}`
                        : `Received ${formatDate(order.createdAt)}`
                      }
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default InventoryPage;
