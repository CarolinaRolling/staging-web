import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Calendar, Clock, Search, 
  AlertTriangle, Filter, Edit2, Check, X
} from 'lucide-react';
import { getWorkOrders, updateWorkOrder } from '../services/api';

// Match inventory page statuses exactly
const STATUSES = {
  quoted: { label: 'Quoted', color: '#9e9e9e', bg: '#f5f5f5' },
  work_order_generated: { label: 'WO Generated', color: '#7b1fa2', bg: '#f3e5f5' },
  waiting_for_materials: { label: 'Waiting for Materials', color: '#f57c00', bg: '#fff3e0' },
  received: { label: 'Received', color: '#1976d2', bg: '#e3f2fd' },
  processing: { label: 'Processing', color: '#0288d1', bg: '#e1f5fe' },
  stored: { label: 'Stored', color: '#388e3c', bg: '#e8f5e9' },
  shipped: { label: 'Shipped', color: '#7b1fa2', bg: '#f3e5f5' },
  archived: { label: 'Archived', color: '#616161', bg: '#eeeeee' },
  // Legacy mappings
  draft: { label: 'Received', color: '#1976d2', bg: '#e3f2fd' },
  in_progress: { label: 'Processing', color: '#0288d1', bg: '#e1f5fe' },
  completed: { label: 'Stored', color: '#388e3c', bg: '#e8f5e9' }
};

// Statuses that mean the job is done — hide from schedule
const DONE_STATUSES = ['stored', 'completed', 'shipped', 'archived'];

// Active statuses for filter dropdown
const ACTIVE_STATUSES = [
  { value: 'waiting_for_materials', label: 'Waiting for Materials' },
  { value: 'received', label: 'Received' },
  { value: 'processing', label: 'Processing' },
];

function SchedulingPage() {
  const navigate = useNavigate();
  const [workOrders, setWorkOrders] = useState([]);
  const [filteredOrders, setFilteredOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  
  const [sortBy, setSortBy] = useState(() => {
    return localStorage.getItem('scheduling_sortBy') || 'smart';
  });
  const [statusFilter, setStatusFilter] = useState(() => {
    return localStorage.getItem('scheduling_statusFilter') || 'all';
  });
  const [editingDate, setEditingDate] = useState(null); // { orderId, field, value }

  const handleDateSave = async () => {
    if (!editingDate) return;
    try {
      await updateWorkOrder(editingDate.orderId, { [editingDate.field]: editingDate.value || null });
      setWorkOrders(prev => prev.map(o => 
        o.id === editingDate.orderId ? { ...o, [editingDate.field]: editingDate.value || null } : o
      ));
      setEditingDate(null);
    } catch (err) {
      console.error('Failed to save date:', err);
    }
  };

  useEffect(() => {
    localStorage.setItem('scheduling_sortBy', sortBy);
  }, [sortBy]);

  useEffect(() => {
    localStorage.setItem('scheduling_statusFilter', statusFilter);
  }, [statusFilter]);

  useEffect(() => {
    loadWorkOrders();
    const interval = setInterval(() => loadWorkOrders(true), 30000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    filterAndSort();
  }, [workOrders, searchQuery, sortBy, statusFilter]);

  const loadWorkOrders = async (silent = false) => {
    try {
      if (!silent) setLoading(true);
      const response = await getWorkOrders();
      const all = response.data.data || [];
      const active = all.filter(o => !DONE_STATUSES.includes(o.status));
      
      // Auto-set high priority for orders received > 7 days ago that are still normal
      const now = new Date();
      const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
      active.forEach(order => {
        const received = new Date(order.receivedAt || order.createdAt);
        const age = now - received;
        if (age > sevenDaysMs && (!order.priority || order.priority === 'normal')) {
          // Fire and forget — update in background
          order.priority = 'high';
          updateWorkOrder(order.id, { priority: 'high' }).catch(() => {});
        }
      });
      
      setWorkOrders(active);
    } catch (err) {
      if (!silent) setError('Failed to load work orders');
      console.error(err);
    } finally {
      if (!silent) setLoading(false);
    }
  };

  const filterAndSort = () => {
    let filtered = [...workOrders];

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(o =>
        o.clientName?.toLowerCase().includes(query) ||
        o.clientPurchaseOrderNumber?.toLowerCase().includes(query) ||
        (o.drNumber && `DR-${o.drNumber}`.toLowerCase().includes(query)) ||
        (o.drNumber && o.drNumber.toString().includes(query)) ||
        o.orderNumber?.toLowerCase().includes(query) ||
        o.description?.toLowerCase().includes(query)
      );
    }

    if (statusFilter !== 'all') {
      filtered = filtered.filter(o => {
        // Handle legacy mappings
        if (statusFilter === 'processing') {
          return o.status === 'processing' || o.status === 'in_progress';
        }
        if (statusFilter === 'received') {
          return o.status === 'received' || o.status === 'draft';
        }
        return o.status === statusFilter;
      });
    }

    filtered.sort((a, b) => {
      // Rush orders always go to top
      const aRush = a.parts?.some(p => p.partType === 'rush_service');
      const bRush = b.parts?.some(p => p.partType === 'rush_service');
      if (aRush && !bRush) return -1;
      if (!aRush && bRush) return 1;

      if (sortBy === 'smart') {
        // Priority sort: urgent → high → normal/low, then by promised date, then by age
        const priorityOrder = { urgent: 0, high: 1, normal: 2, low: 3 };
        const aPri = priorityOrder[a.priority] ?? 2;
        const bPri = priorityOrder[b.priority] ?? 2;
        if (aPri !== bPri) return aPri - bPri;

        // Within same priority: earliest promise date first
        const aPromised = a.promisedDate ? new Date(a.promisedDate).getTime() : Infinity;
        const bPromised = b.promisedDate ? new Date(b.promisedDate).getTime() : Infinity;
        if (aPromised !== bPromised) return aPromised - bPromised;

        // Same promise date or both no promise: oldest received first
        const aAge = new Date(a.receivedAt || a.createdAt || 0).getTime();
        const bAge = new Date(b.receivedAt || b.createdAt || 0).getTime();
        return aAge - bAge;
      }

      switch (sortBy) {
        case 'name_asc':
          return (a.clientName || '').localeCompare(b.clientName || '');
        case 'name_desc':
          return (b.clientName || '').localeCompare(a.clientName || '');
        case 'dr_asc':
          return (a.drNumber || 0) - (b.drNumber || 0);
        case 'dr_desc':
          return (b.drNumber || 0) - (a.drNumber || 0);
        case 'received_asc':
          return new Date(a.receivedAt || a.createdAt || 0) - new Date(b.receivedAt || b.createdAt || 0);
        case 'received_desc':
          return new Date(b.receivedAt || b.createdAt || 0) - new Date(a.receivedAt || a.createdAt || 0);
        case 'promised_asc':
          if (!a.promisedDate && !b.promisedDate) return 0;
          if (!a.promisedDate) return 1;
          if (!b.promisedDate) return -1;
          return new Date(a.promisedDate) - new Date(b.promisedDate);
        case 'promised_desc':
          if (!a.promisedDate && !b.promisedDate) return 0;
          if (!a.promisedDate) return 1;
          if (!b.promisedDate) return -1;
          return new Date(b.promisedDate) - new Date(a.promisedDate);
        case 'requested_asc':
          if (!a.requestedDueDate && !b.requestedDueDate) return 0;
          if (!a.requestedDueDate) return 1;
          if (!b.requestedDueDate) return -1;
          return new Date(a.requestedDueDate) - new Date(b.requestedDueDate);
        case 'requested_desc':
          if (!a.requestedDueDate && !b.requestedDueDate) return 0;
          if (!a.requestedDueDate) return 1;
          if (!b.requestedDueDate) return -1;
          return new Date(b.requestedDueDate) - new Date(a.requestedDueDate);
        default:
          return 0;
      }
    });

    setFilteredOrders(filtered);
  };

  const formatDate = (dateString) => {
    if (!dateString) return '—';
    const d = typeof dateString === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dateString) ? dateString + 'T12:00:00' : dateString;
    return new Date(d).toLocaleDateString('en-US', {
      month: 'short', day: 'numeric', year: 'numeric',
    });
  };

  const getDaysUntil = (dateString) => {
    if (!dateString) return null;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const target = new Date(dateString);
    target.setHours(0, 0, 0, 0);
    return Math.ceil((target - today) / (1000 * 60 * 60 * 24));
  };

  const getDateStatus = (dateString) => {
    const days = getDaysUntil(dateString);
    if (days === null) return 'none';
    if (days < 0) return 'overdue';
    if (days === 0) return 'today';
    if (days <= 3) return 'urgent';
    if (days <= 7) return 'soon';
    return 'normal';
  };

  const getDateBadgeStyle = (status) => {
    switch (status) {
      case 'overdue':
        return { background: '#ffebee', color: '#c62828', border: '1px solid #ef9a9a' };
      case 'today':
        return { background: '#fff3e0', color: '#e65100', border: '1px solid #ffcc80' };
      case 'urgent':
        return { background: '#fff8e1', color: '#f57f17', border: '1px solid #ffe082' };
      case 'soon':
        return { background: '#e3f2fd', color: '#1565c0', border: '1px solid #90caf9' };
      default:
        return { background: '#f5f5f5', color: '#666', border: '1px solid #e0e0e0' };
    }
  };

  const getStatusConfig = (status) => {
    return STATUSES[status] || { label: status, color: '#666', bg: '#f5f5f5' };
  };

  // Stats
  const overdueCount = workOrders.filter(o => 
    getDateStatus(o.promisedDate) === 'overdue' || 
    getDateStatus(o.requestedDueDate) === 'overdue'
  ).length;
  const todayCount = workOrders.filter(o => 
    getDateStatus(o.promisedDate) === 'today' || 
    getDateStatus(o.requestedDueDate) === 'today'
  ).length;
  const urgentCount = workOrders.filter(o => 
    getDateStatus(o.promisedDate) === 'urgent' || 
    getDateStatus(o.requestedDueDate) === 'urgent'
  ).length;
  const rushCount = workOrders.filter(o => o.parts?.some(p => p.partType === 'rush_service')).length;
  const urgentPriorityCount = workOrders.filter(o => o.priority === 'urgent' && !o.parts?.some(p => p.partType === 'rush_service')).length;
  const highPriorityCount = workOrders.filter(o => o.priority === 'high').length;

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
        <div>
          <h1 className="page-title">Scheduling</h1>
          <p style={{ color: '#666', fontSize: '0.875rem', marginTop: 4 }}>
            {filteredOrders.length} active jobs
          </p>
        </div>
      </div>

      {/* Stats Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12, marginBottom: 20 }}>
        <div style={{
          padding: '16px',
          background: overdueCount > 0 ? '#ffebee' : 'white',
          borderRadius: 8,
          borderLeft: `4px solid ${overdueCount > 0 ? '#c62828' : '#e0e0e0'}`
        }}>
          <div style={{ fontSize: '2rem', fontWeight: 700, color: overdueCount > 0 ? '#c62828' : '#999' }}>
            {overdueCount}
          </div>
          <div style={{ fontSize: '0.8rem', color: overdueCount > 0 ? '#c62828' : '#666' }}>Overdue</div>
        </div>
        <div style={{
          padding: '16px',
          background: todayCount > 0 ? '#fff3e0' : 'white',
          borderRadius: 8,
          borderLeft: `4px solid ${todayCount > 0 ? '#e65100' : '#e0e0e0'}`
        }}>
          <div style={{ fontSize: '2rem', fontWeight: 700, color: todayCount > 0 ? '#e65100' : '#999' }}>
            {todayCount}
          </div>
          <div style={{ fontSize: '0.8rem', color: todayCount > 0 ? '#e65100' : '#666' }}>Due Today</div>
        </div>
        <div style={{
          padding: '16px',
          background: urgentCount > 0 ? '#fff8e1' : 'white',
          borderRadius: 8,
          borderLeft: `4px solid ${urgentCount > 0 ? '#f57f17' : '#e0e0e0'}`
        }}>
          <div style={{ fontSize: '2rem', fontWeight: 700, color: urgentCount > 0 ? '#f57f17' : '#999' }}>
            {urgentCount}
          </div>
          <div style={{ fontSize: '0.8rem', color: urgentCount > 0 ? '#f57f17' : '#666' }}>Within 3 Days</div>
        </div>
        <div style={{
          padding: '16px',
          background: rushCount > 0 ? '#ffebee' : 'white',
          borderRadius: 8,
          borderLeft: `4px solid ${rushCount > 0 ? '#c62828' : '#e0e0e0'}`
        }}>
          <div style={{ fontSize: '2rem', fontWeight: 700, color: rushCount > 0 ? '#c62828' : '#999' }}>
            {rushCount}
          </div>
          <div style={{ fontSize: '0.8rem', color: rushCount > 0 ? '#c62828' : '#666' }}>🚨 Rush Orders</div>
        </div>
        <div style={{
          padding: '16px',
          background: 'white',
          borderRadius: 8,
          borderLeft: '4px solid #1976d2'
        }}>
          <div style={{ fontSize: '2rem', fontWeight: 700, color: '#1976d2' }}>
            {filteredOrders.length}
          </div>
          <div style={{ fontSize: '0.8rem', color: '#666' }}>Total Active</div>
        </div>
      </div>

      {/* Filters */}
      <div className="card" style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'center' }}>
          <div className="search-box" style={{ flex: 1, minWidth: 200, marginBottom: 0 }}>
            <Search size={18} className="search-box-icon" />
            <input
              type="text"
              placeholder="Search by name, DR#, PO#..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <select
            className="form-select"
            style={{ width: 'auto' }}
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="all">All Statuses</option>
            {ACTIVE_STATUSES.map(s => (
              <option key={s.value} value={s.value}>{s.label}</option>
            ))}
          </select>
          <select
            className="form-select"
            style={{ width: 'auto' }}
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
          >
            <option value="smart">🎯 Smart (Priority → Promised → Age)</option>
            <optgroup label="By DR Number">
              <option value="dr_desc">DR# (Newest)</option>
              <option value="dr_asc">DR# (Oldest)</option>
            </optgroup>
            <optgroup label="By Name">
              <option value="name_asc">Name A-Z</option>
              <option value="name_desc">Name Z-A</option>
            </optgroup>
            <optgroup label="By Date Received">
              <option value="received_asc">Oldest First</option>
              <option value="received_desc">Newest First</option>
            </optgroup>
            <optgroup label="By Promised Date">
              <option value="promised_asc">Promised (Soonest)</option>
              <option value="promised_desc">Promised (Latest)</option>
            </optgroup>
            <optgroup label="By Requested Date">
              <option value="requested_asc">Requested (Soonest)</option>
              <option value="requested_desc">Requested (Latest)</option>
            </optgroup>
          </select>
        </div>
      </div>

      {/* Schedule Board */}
      {filteredOrders.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">📅</div>
          <div className="empty-state-title">No jobs to schedule</div>
          <p>{searchQuery || statusFilter !== 'all' ? 'No jobs match your filters' : 'All jobs are complete!'}</p>
        </div>
      ) : (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          {/* Table Header */}
          <div style={{ 
            display: 'grid', 
            gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr 100px 140px',
            background: '#f5f5f5',
            padding: '12px 16px',
            fontWeight: 600,
            fontSize: '0.75rem',
            textTransform: 'uppercase',
            color: '#666',
            borderBottom: '2px solid #e0e0e0'
          }}>
            <div>DR# / Client</div>
            <div>Client PO#</div>
            <div>Received</div>
            <div>Requested</div>
            <div>Promised</div>
            <div>Progress</div>
            <div>Status</div>
          </div>

          {/* Table Body */}
          {filteredOrders.map((order, index) => {
            const promisedStatus = getDateStatus(order.promisedDate);
            const requestedStatus = getDateStatus(order.requestedDueDate);
            const statusCfg = getStatusConfig(order.status);
            const isRush = order.parts?.some(p => p.partType === 'rush_service');
            const priority = order.priority || 'normal';

            // Row background: rush=red, urgent=orange, high=yellow, normal=alternating
            const rowBg = isRush ? '#ffebee' 
              : priority === 'urgent' ? '#fff3e0'
              : priority === 'high' ? '#fffde7'
              : (index % 2 === 0 ? 'white' : '#fafafa');
            const rowHoverBg = isRush ? '#ffcdd2'
              : priority === 'urgent' ? '#ffe0b2'
              : priority === 'high' ? '#fff9c4'
              : '#f0f7ff';
            const rowBorder = isRush ? '4px solid #c62828'
              : priority === 'urgent' ? '4px solid #e65100'
              : priority === 'high' ? '4px solid #f9a825'
              : undefined;

            return (
              <div key={order.id}>
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr 100px 140px',
                    padding: '16px',
                    borderBottom: isRush ? '2px solid #ef5350' : '1px solid #eee',
                    cursor: 'pointer',
                    background: rowBg,
                    transition: 'background 0.2s',
                    alignItems: 'center',
                    borderLeft: rowBorder
                  }}
                  onClick={() => navigate(`/workorders/${order.id}`)}
                  onMouseEnter={(e) => e.currentTarget.style.background = rowHoverBg}
                  onMouseLeave={(e) => e.currentTarget.style.background = rowBg}
                >
                  {/* DR# / Client */}
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, flexWrap: 'wrap' }}>
                      {order.drNumber ? (
                        <span style={{ 
                          fontWeight: 700, 
                          color: isRush ? '#c62828' : '#1565c0',
                          fontSize: '0.95rem'
                        }}>
                          DR-{order.drNumber}
                        </span>
                      ) : (
                        <span style={{ fontWeight: 600, color: '#666' }}>
                          {order.orderNumber || '—'}
                        </span>
                      )}
                      {isRush && (
                        <span style={{
                          background: '#c62828', color: 'white', padding: '2px 8px',
                          borderRadius: 4, fontSize: '0.7rem', fontWeight: 700
                        }}>
                          🚨 RUSH
                        </span>
                      )}
                      {!isRush && priority === 'urgent' && (
                        <span style={{
                          background: '#e65100', color: 'white', padding: '2px 8px',
                          borderRadius: 4, fontSize: '0.7rem', fontWeight: 700
                        }}>
                          🔴 URGENT
                        </span>
                      )}
                      {!isRush && priority === 'high' && (
                        <span style={{
                          background: '#f9a825', color: '#333', padding: '2px 8px',
                          borderRadius: 4, fontSize: '0.7rem', fontWeight: 700
                        }}>
                          ⚡ HIGH
                        </span>
                      )}
                    </div>
                    <div style={{ fontWeight: 500, fontSize: '0.9rem' }}>{order.clientName}</div>
                    {order.description && (
                      <div style={{ 
                        fontSize: '0.8rem', 
                        color: '#999',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        maxWidth: 280
                      }}>
                        {order.description}
                      </div>
                    )}
                  </div>

                  {/* Client PO# */}
                  <div style={{ fontFamily: 'monospace', fontSize: '0.9rem' }}>
                    {order.clientPurchaseOrderNumber || '—'}
                  </div>

                  {/* Received Date */}
                  <div style={{ fontSize: '0.9rem', color: '#666' }}>
                    {formatDate(order.receivedAt || order.createdAt)}
                  </div>

                  {/* Requested Date - click to edit */}
                  <div onClick={(e) => e.stopPropagation()}>
                    {editingDate?.orderId === order.id && editingDate?.field === 'requestedDueDate' ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        <input type="date" value={editingDate.value || ''} 
                          onChange={(e) => setEditingDate({ ...editingDate, value: e.target.value })}
                          autoFocus
                          style={{ fontSize: '0.8rem', padding: '3px 6px', border: '1px solid #1976d2', borderRadius: 4, width: 130 }}
                        />
                        <button onClick={handleDateSave} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 2, color: '#4caf50' }}><Check size={14} /></button>
                        <button onClick={() => setEditingDate(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 2, color: '#999' }}><X size={14} /></button>
                      </div>
                    ) : (
                      <div style={{ cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 4 }}
                        onClick={() => setEditingDate({ orderId: order.id, field: 'requestedDueDate', value: order.requestedDueDate || '' })}
                        title="Click to edit"
                      >
                        {order.requestedDueDate ? (
                          <span style={{
                            display: 'inline-flex', alignItems: 'center', gap: 6,
                            padding: '4px 8px', borderRadius: 4, fontSize: '0.85rem',
                            ...getDateBadgeStyle(requestedStatus)
                          }}>
                            {requestedStatus === 'overdue' && <AlertTriangle size={14} />}
                            {formatDate(order.requestedDueDate)}
                          </span>
                        ) : (
                          <span style={{ color: '#bbb', fontSize: '0.8rem' }}>+ Add</span>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Promised Date - click to edit */}
                  <div onClick={(e) => e.stopPropagation()}>
                    {editingDate?.orderId === order.id && editingDate?.field === 'promisedDate' ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        <input type="date" value={editingDate.value || ''} 
                          onChange={(e) => setEditingDate({ ...editingDate, value: e.target.value })}
                          autoFocus
                          style={{ fontSize: '0.8rem', padding: '3px 6px', border: '1px solid #1976d2', borderRadius: 4, width: 130 }}
                        />
                        <button onClick={handleDateSave} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 2, color: '#4caf50' }}><Check size={14} /></button>
                        <button onClick={() => setEditingDate(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 2, color: '#999' }}><X size={14} /></button>
                      </div>
                    ) : (
                      <div style={{ cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 4 }}
                        onClick={() => setEditingDate({ orderId: order.id, field: 'promisedDate', value: order.promisedDate || '' })}
                        title="Click to edit"
                      >
                        {order.promisedDate ? (
                          <span style={{
                            display: 'inline-flex', alignItems: 'center', gap: 6,
                            padding: '4px 8px', borderRadius: 4, fontSize: '0.85rem', fontWeight: 500,
                            ...getDateBadgeStyle(promisedStatus)
                          }}>
                            {promisedStatus === 'overdue' && <AlertTriangle size={14} />}
                            {promisedStatus === 'today' && <Clock size={14} />}
                            {formatDate(order.promisedDate)}
                            {getDaysUntil(order.promisedDate) !== null && (
                              <span style={{ fontSize: '0.7rem', opacity: 0.8 }}>
                                ({getDaysUntil(order.promisedDate) === 0 
                                  ? 'Today' 
                                  : getDaysUntil(order.promisedDate) < 0 
                                    ? `${Math.abs(getDaysUntil(order.promisedDate))}d late`
                                    : `${getDaysUntil(order.promisedDate)}d`})
                              </span>
                            )}
                          </span>
                        ) : (
                          <span style={{ color: '#bbb', fontSize: '0.8rem' }}>+ Add</span>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Progress */}
                  <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                    {(() => {
                      const total = order.parts?.length || 0;
                      const done = (order.parts || []).filter(p => p.status === 'completed').length;
                      const pct = total > 0 ? Math.round((done / total) * 100) : 0;
                      return total > 0 ? (
                        <>
                          <div style={{ fontSize: '0.75rem', color: pct === 100 ? '#2e7d32' : '#666', marginBottom: 2, fontWeight: pct === 100 ? 600 : 400 }}>
                            {done}/{total}
                          </div>
                          <div style={{ height: 4, background: '#e0e0e0', borderRadius: 2, overflow: 'hidden' }}>
                            <div style={{ height: '100%', width: `${pct}%`, background: pct === 100 ? '#4caf50' : '#1976d2', borderRadius: 2, transition: 'width 0.5s ease' }} />
                          </div>
                        </>
                      ) : <span style={{ color: '#ccc', fontSize: '0.75rem' }}>—</span>;
                    })()}
                  </div>

                  {/* Status */}
                  <div>
                    <span style={{
                      display: 'inline-block',
                      padding: '4px 10px',
                      borderRadius: 12,
                      fontSize: '0.75rem',
                      fontWeight: 500,
                      background: statusCfg.bg,
                      color: statusCfg.color,
                    }}>
                      {statusCfg.label}
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

export default SchedulingPage;
