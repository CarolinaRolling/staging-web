import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Trash2, Archive, Package, ArrowLeft, CheckSquare, Square, Link, AlertCircle, Edit2, X, Save, FileText } from 'lucide-react';
import { getShipments, deleteShipment, archiveShipment, bulkArchiveShipments, bulkDeleteShipments, updateShipment, linkShipmentToWorkOrder, getWorkOrders } from '../services/api';

const STATUS_CONFIG = {
  received: { label: 'Received', color: '#1976d2', bg: '#e3f2fd' },
  processing: { label: 'Processing', color: '#0288d1', bg: '#e1f5fe' },
  stored: { label: 'Stored', color: '#388e3c', bg: '#e8f5e9' },
  shipped: { label: 'Shipped', color: '#7b1fa2', bg: '#f3e5f5' },
  archived: { label: 'Archived', color: '#616161', bg: '#eeeeee' },
};

function ShipmentsAdminPage() {
  const navigate = useNavigate();
  const [shipments, setShipments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selected, setSelected] = useState(new Set());
  const [editingId, setEditingId] = useState(null);
  const [editData, setEditData] = useState({});
  const [confirmDelete, setConfirmDelete] = useState(null); // id or 'bulk'
  const [message, setMessage] = useState(null);
  const [linkingShipmentId, setLinkingShipmentId] = useState(null);
  const [woSearchQuery, setWoSearchQuery] = useState('');
  const [woSearchResults, setWoSearchResults] = useState([]);
  const [woSearchLoading, setWoSearchLoading] = useState(false);
  const [linking, setLinking] = useState(false);
  const woSearchTimeout = useRef(null);

  const loadShipments = useCallback(async () => {
    try {
      setLoading(true);
      const params = { limit: 500 };
      if (search) params.search = search;
      if (statusFilter !== 'all') params.status = statusFilter;
      const res = await getShipments(params);
      setShipments(res.data.data || []);
    } catch (err) {
      console.error('Failed to load shipments:', err);
    } finally {
      setLoading(false);
    }
  }, [search, statusFilter]);

  useEffect(() => {
    loadShipments();
  }, [loadShipments]);

  const showMessage = (msg) => {
    setMessage(msg);
    setTimeout(() => setMessage(null), 3000);
  };

  const toggleSelect = (id) => {
    const next = new Set(selected);
    next.has(id) ? next.delete(id) : next.add(id);
    setSelected(next);
  };

  const selectAll = () => {
    if (selected.size === shipments.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(shipments.map(s => s.id)));
    }
  };

  const handleArchive = async (id) => {
    try {
      await archiveShipment(id);
      showMessage('Shipment archived');
      loadShipments();
    } catch (err) {
      console.error(err);
    }
  };

  const handleDelete = async (id) => {
    try {
      await deleteShipment(id);
      showMessage('Shipment deleted');
      setConfirmDelete(null);
      loadShipments();
    } catch (err) {
      console.error(err);
    }
  };

  const handleBulkArchive = async () => {
    try {
      await bulkArchiveShipments([...selected]);
      showMessage(`${selected.size} shipments archived`);
      setSelected(new Set());
      loadShipments();
    } catch (err) {
      console.error(err);
    }
  };

  const handleBulkDelete = async () => {
    try {
      await bulkDeleteShipments([...selected]);
      showMessage(`${selected.size} shipments deleted`);
      setSelected(new Set());
      setConfirmDelete(null);
      loadShipments();
    } catch (err) {
      console.error(err);
    }
  };

  const handleCreateWorkOrder = async (shipmentId) => {
    try {
      const res = await linkShipmentToWorkOrder(shipmentId);
      const wo = res.data.data.workOrder;
      showMessage(`Linked to DR-${wo.drNumber}`);
      loadShipments();
    } catch (err) {
      console.error(err);
    }
  };

  const openLinkModal = (shipmentId) => {
    setLinkingShipmentId(shipmentId);
    setWoSearchQuery('');
    setWoSearchResults([]);
  };

  const searchWorkOrders = (query) => {
    setWoSearchQuery(query);
    if (woSearchTimeout.current) clearTimeout(woSearchTimeout.current);
    if (!query || query.length < 1) { setWoSearchResults([]); return; }
    woSearchTimeout.current = setTimeout(async () => {
      try {
        setWoSearchLoading(true);
        const isDR = /^\d+$/.test(query.trim());
        const params = isDR ? { drNumber: query.trim(), limit: 20 } : { clientName: query.trim(), limit: 20 };
        const response = await getWorkOrders(params);
        setWoSearchResults(response.data.data || []);
      } catch (err) { console.error('WO search failed:', err); }
      finally { setWoSearchLoading(false); }
    }, 300);
  };

  const handleLinkToExistingWO = async (workOrderId) => {
    if (!linkingShipmentId) return;
    try {
      setLinking(true);
      await linkShipmentToWorkOrder(linkingShipmentId, workOrderId);
      showMessage('Shipment linked to work order');
      setLinkingShipmentId(null);
      loadShipments();
    } catch (err) {
      showMessage('Failed to link: ' + (err.response?.data?.error?.message || err.message));
    } finally {
      setLinking(false);
    }
  };

  const startEdit = (s) => {
    setEditingId(s.id);
    setEditData({
      clientName: s.clientName || '',
      description: s.description || '',
      clientPurchaseOrderNumber: s.clientPurchaseOrderNumber || '',
      location: s.location || '',
      notes: s.notes || '',
      status: s.status || 'received'
    });
  };

  const saveEdit = async () => {
    try {
      await updateShipment(editingId, editData);
      setEditingId(null);
      showMessage('Shipment updated');
      loadShipments();
    } catch (err) {
      console.error(err);
    }
  };

  const formatDate = (d) => {
    if (!d) return '—';
    return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const unlinkedCount = shipments.filter(s => !s.workOrderId && s.status !== 'archived').length;

  return (
    <div>
      <div className="page-header">
        <div>
          <button className="btn btn-outline" onClick={() => navigate('/admin')} style={{ marginBottom: 8 }}>
            <ArrowLeft size={16} /> Back to Admin
          </button>
          <h1 style={{ margin: 0 }}>📦 Shipments Admin</h1>
          <p style={{ color: '#666', margin: '4px 0 0' }}>
            {shipments.length} shipments total
            {unlinkedCount > 0 && (
              <span style={{ color: '#e65100', marginLeft: 8 }}>
                • {unlinkedCount} waiting for instructions
              </span>
            )}
          </p>
        </div>
      </div>

      {/* Message */}
      {message && (
        <div style={{ 
          background: '#e8f5e9', border: '1px solid #66bb6a', borderRadius: 8,
          padding: '10px 16px', marginBottom: 12, color: '#2e7d32', fontWeight: 500
        }}>
          ✓ {message}
        </div>
      )}

      {/* Filters & Search */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ position: 'relative', flex: 1, minWidth: 200 }}>
            <Search size={16} style={{ position: 'absolute', left: 10, top: 10, color: '#999' }} />
            <input
              type="text"
              className="form-input"
              placeholder="Search client, description, PO#, location..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ paddingLeft: 32 }}
            />
          </div>
          <select
            className="form-select"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            style={{ width: 'auto' }}
          >
            <option value="all">All Statuses</option>
            <option value="received">Received</option>
            <option value="processing">Processing</option>
            <option value="stored">Stored</option>
            <option value="shipped">Shipped</option>
            <option value="archived">Archived</option>
          </select>
          <button className="btn btn-outline" onClick={loadShipments}>
            Refresh
          </button>
        </div>
      </div>

      {/* Bulk Actions */}
      {selected.size > 0 && (
        <div style={{ 
          background: '#e3f2fd', border: '1px solid #90caf9', borderRadius: 8,
          padding: '10px 16px', marginBottom: 12, 
          display: 'flex', alignItems: 'center', gap: 12
        }}>
          <strong>{selected.size} selected</strong>
          <button className="btn btn-outline" onClick={handleBulkArchive} style={{ fontSize: '0.85rem' }}>
            <Archive size={14} /> Archive Selected
          </button>
          <button 
            className="btn" 
            onClick={() => setConfirmDelete('bulk')}
            style={{ fontSize: '0.85rem', background: '#ef5350', color: 'white', border: 'none' }}
          >
            <Trash2 size={14} /> Delete Selected
          </button>
          <button className="btn btn-outline" onClick={() => setSelected(new Set())} style={{ fontSize: '0.85rem' }}>
            Clear Selection
          </button>
        </div>
      )}

      {/* Confirm Delete Dialog */}
      {confirmDelete && (
        <div style={{ 
          background: '#ffebee', border: '1px solid #ef5350', borderRadius: 8,
          padding: 16, marginBottom: 12
        }}>
          <strong style={{ color: '#c62828' }}>
            ⚠️ {confirmDelete === 'bulk' 
              ? `Permanently delete ${selected.size} shipments?` 
              : 'Permanently delete this shipment?'}
          </strong>
          <p style={{ color: '#c62828', margin: '4px 0 12px', fontSize: '0.85rem' }}>
            This cannot be undone. Photos and documents will also be deleted.
          </p>
          <div style={{ display: 'flex', gap: 8 }}>
            <button 
              className="btn" 
              onClick={confirmDelete === 'bulk' ? handleBulkDelete : () => handleDelete(confirmDelete)}
              style={{ background: '#c62828', color: 'white', border: 'none' }}
            >
              Yes, Delete
            </button>
            <button className="btn btn-outline" onClick={() => setConfirmDelete(null)}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Table */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: 40, color: '#999' }}>Loading...</div>
      ) : shipments.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 40, color: '#999' }}>
          <Package size={48} />
          <p>No shipments found</p>
        </div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
            <thead>
              <tr style={{ background: '#f5f5f5', borderBottom: '2px solid #ddd' }}>
                <th style={{ padding: '10px 8px', textAlign: 'left', width: 32 }}>
                  <span onClick={selectAll} style={{ cursor: 'pointer' }}>
                    {selected.size === shipments.length && shipments.length > 0 
                      ? <CheckSquare size={16} color="#1976d2" /> 
                      : <Square size={16} color="#999" />}
                  </span>
                </th>
                <th style={{ padding: '10px 8px', textAlign: 'left' }}>Client</th>
                <th style={{ padding: '10px 8px', textAlign: 'left' }}>Description</th>
                <th style={{ padding: '10px 8px', textAlign: 'left' }}>PO#</th>
                <th style={{ padding: '10px 8px', textAlign: 'left' }}>Location</th>
                <th style={{ padding: '10px 8px', textAlign: 'left' }}>Received</th>
                <th style={{ padding: '10px 8px', textAlign: 'left' }}>Status</th>
                <th style={{ padding: '10px 8px', textAlign: 'left' }}>Work Order</th>
                <th style={{ padding: '10px 8px', textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {shipments.map(s => {
                const isEditing = editingId === s.id;
                const isSelected = selected.has(s.id);
                const config = STATUS_CONFIG[s.status] || STATUS_CONFIG.received;
                
                return (
                  <tr 
                    key={s.id} 
                    style={{ 
                      borderBottom: '1px solid #eee',
                      background: isSelected ? '#e3f2fd' : isEditing ? '#fff8e1' : 'white'
                    }}
                  >
                    <td style={{ padding: '8px' }}>
                      <span onClick={() => toggleSelect(s.id)} style={{ cursor: 'pointer' }}>
                        {isSelected 
                          ? <CheckSquare size={16} color="#1976d2" /> 
                          : <Square size={16} color="#ccc" />}
                      </span>
                    </td>
                    <td style={{ padding: '8px', fontWeight: 600 }}>
                      {isEditing ? (
                        <input 
                          className="form-input" value={editData.clientName} 
                          onChange={e => setEditData({...editData, clientName: e.target.value})}
                          style={{ fontSize: '0.85rem', padding: '4px 6px' }}
                        />
                      ) : s.clientName}
                    </td>
                    <td style={{ padding: '8px', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {isEditing ? (
                        <input 
                          className="form-input" value={editData.description}
                          onChange={e => setEditData({...editData, description: e.target.value})}
                          style={{ fontSize: '0.85rem', padding: '4px 6px' }}
                        />
                      ) : (s.description || '—')}
                    </td>
                    <td style={{ padding: '8px' }}>
                      {isEditing ? (
                        <input 
                          className="form-input" value={editData.clientPurchaseOrderNumber}
                          onChange={e => setEditData({...editData, clientPurchaseOrderNumber: e.target.value})}
                          style={{ fontSize: '0.85rem', padding: '4px 6px', width: 80 }}
                        />
                      ) : (s.clientPurchaseOrderNumber || '—')}
                    </td>
                    <td style={{ padding: '8px' }}>
                      {isEditing ? (
                        <input 
                          className="form-input" value={editData.location}
                          onChange={e => setEditData({...editData, location: e.target.value})}
                          style={{ fontSize: '0.85rem', padding: '4px 6px', width: 80 }}
                        />
                      ) : (s.location || '—')}
                    </td>
                    <td style={{ padding: '8px', whiteSpace: 'nowrap' }}>
                      {formatDate(s.receivedAt || s.createdAt)}
                      {s.receivedBy && <div style={{ fontSize: '0.75rem', color: '#999' }}>by {s.receivedBy}</div>}
                    </td>
                    <td style={{ padding: '8px' }}>
                      {isEditing ? (
                        <select 
                          className="form-select" value={editData.status}
                          onChange={e => setEditData({...editData, status: e.target.value})}
                          style={{ fontSize: '0.85rem', padding: '4px 6px' }}
                        >
                          <option value="received">Received</option>
                          <option value="processing">Processing</option>
                          <option value="stored">Stored</option>
                          <option value="shipped">Shipped</option>
                          <option value="archived">Archived</option>
                        </select>
                      ) : (
                        <span style={{ 
                          background: config.bg, color: config.color, 
                          padding: '2px 8px', borderRadius: 4, fontSize: '0.8rem', fontWeight: 600 
                        }}>
                          {config.label}
                        </span>
                      )}
                    </td>
                    <td style={{ padding: '8px' }}>
                      {s.workOrderId ? (
                        <span style={{ color: '#1976d2', fontSize: '0.8rem' }}>
                          <Link size={12} /> Linked
                        </span>
                      ) : s.status !== 'archived' ? (
                        <div style={{ display: 'flex', gap: 4 }}>
                          <button 
                            className="btn btn-primary"
                            onClick={() => handleCreateWorkOrder(s.id)}
                            style={{ fontSize: '0.7rem', padding: '3px 6px' }}
                            title="Create a new work order"
                          >
                            + New WO
                          </button>
                          <button 
                            onClick={() => openLinkModal(s.id)}
                            style={{ fontSize: '0.7rem', padding: '3px 6px', background: '#e3f2fd', color: '#1565c0', border: '1px solid #90caf9', borderRadius: 4, cursor: 'pointer', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 2 }}
                            title="Link to existing work order"
                          >
                            <Link size={10} /> Link
                          </button>
                        </div>
                      ) : (
                        <span style={{ color: '#999', fontSize: '0.8rem' }}>—</span>
                      )}
                    </td>
                    <td style={{ padding: '8px', textAlign: 'right', whiteSpace: 'nowrap' }}>
                      {isEditing ? (
                        <>
                          <button onClick={saveEdit} title="Save" style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#388e3c' }}>
                            <Save size={16} />
                          </button>
                          <button onClick={() => setEditingId(null)} title="Cancel" style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#999' }}>
                            <X size={16} />
                          </button>
                        </>
                      ) : (
                        <>
                          <button onClick={() => startEdit(s)} title="Edit" style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#1976d2' }}>
                            <Edit2 size={14} />
                          </button>
                          {s.status !== 'archived' && (
                            <button onClick={() => handleArchive(s.id)} title="Archive" style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#f57c00' }}>
                              <Archive size={14} />
                            </button>
                          )}
                          <button onClick={() => setConfirmDelete(s.id)} title="Delete" style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef5350' }}>
                            <Trash2 size={14} />
                          </button>
                        </>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Link to Existing Work Order Modal */}
      {linkingShipmentId && (
        <div className="modal-overlay" onClick={() => setLinkingShipmentId(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ width: '90vw', maxWidth: 600, maxHeight: '80vh', display: 'flex', flexDirection: 'column' }}>
            <div className="modal-header">
              <h3 className="modal-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Link size={18} /> Link Shipment to Work Order
              </h3>
              <button className="modal-close" onClick={() => setLinkingShipmentId(null)}>&times;</button>
            </div>
            <div style={{ padding: 16 }}>
              <div style={{ marginBottom: 12 }}>
                <input
                  className="form-input"
                  type="text"
                  placeholder="Search by client name or DR number..."
                  value={woSearchQuery}
                  onChange={(e) => searchWorkOrders(e.target.value)}
                  autoFocus
                  style={{ width: '100%', padding: '10px 14px', fontSize: '0.95rem' }}
                />
              </div>
              <div style={{ maxHeight: '50vh', overflowY: 'auto' }}>
                {woSearchLoading && (
                  <div style={{ textAlign: 'center', padding: 20, color: '#888' }}>Searching...</div>
                )}
                {!woSearchLoading && woSearchQuery && woSearchResults.length === 0 && (
                  <div style={{ textAlign: 'center', padding: 20, color: '#888' }}>No work orders found</div>
                )}
                {woSearchResults.map(wo => (
                  <div
                    key={wo.id}
                    onClick={() => !linking && handleLinkToExistingWO(wo.id)}
                    style={{
                      padding: '12px 14px', borderBottom: '1px solid #eee', cursor: linking ? 'not-allowed' : 'pointer',
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
                      transition: 'background 0.15s', borderRadius: 6
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.background = '#f0f7ff'}
                    onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                  >
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                        {wo.drNumber && (
                          <span style={{ fontWeight: 700, color: '#1565c0', fontSize: '0.95rem' }}>
                            DR-{wo.drNumber}
                          </span>
                        )}
                        <span style={{ fontWeight: 600, color: '#333' }}>{wo.clientName}</span>
                        <span style={{
                          padding: '1px 6px', borderRadius: 3, fontSize: '0.7rem', fontWeight: 600,
                          background: wo.status === 'in_progress' ? '#fff3e0' : wo.status === 'received' ? '#e3f2fd' : wo.status === 'ready' ? '#e8f5e9' : '#f5f5f5',
                          color: wo.status === 'in_progress' ? '#e65100' : wo.status === 'received' ? '#1565c0' : wo.status === 'ready' ? '#2e7d32' : '#888'
                        }}>
                          {wo.status?.replace('_', ' ')}
                        </span>
                      </div>
                      <div style={{ fontSize: '0.75rem', color: '#888', marginTop: 2 }}>
                        {wo.orderNumber}
                        {wo.clientPurchaseOrderNumber && <span> · PO: {wo.clientPurchaseOrderNumber}</span>}
                        {wo.parts && wo.parts.length > 0 && <span> · {wo.parts.length} part{wo.parts.length > 1 ? 's' : ''}</span>}
                      </div>
                    </div>
                    <div style={{ flexShrink: 0 }}>
                      <span style={{ padding: '4px 10px', background: '#1565c0', color: '#fff', borderRadius: 4, fontSize: '0.8rem', fontWeight: 600 }}>
                        Link
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default ShipmentsAdminPage;
