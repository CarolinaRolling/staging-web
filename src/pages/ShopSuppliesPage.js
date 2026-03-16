import React, { useState, useEffect, useRef } from 'react';
import { Package, Plus, RefreshCw, AlertTriangle, Trash2, Edit, History, Printer, Camera, X } from 'lucide-react';
import { getShopSupplies, createShopSupply, updateShopSupply, refillShopSupply, getShopSupplyLogs, deleteShopSupply, uploadShopSupplyImage, deleteShopSupplyImage } from '../services/api';

const CATEGORIES = ['Gas', 'Paint', 'Safety', 'Welding', 'Cutting', 'Cleaning', 'Hardware', 'Other'];
const UNITS = ['each', 'tanks', 'cans', 'boxes', 'rolls', 'gallons', 'bags', 'pairs', 'bottles', 'packs'];

function ShopSuppliesPage() {
  const [supplies, setSupplies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({ name: '', description: '', category: '', quantity: 0, unit: 'each', minQuantity: 1 });
  const [showRefillModal, setShowRefillModal] = useState(null);
  const [refillQty, setRefillQty] = useState('');
  const [refillNotes, setRefillNotes] = useState('');
  const [showLogsModal, setShowLogsModal] = useState(null);
  const [logs, setLogs] = useState([]);
  const [logsLoading, setLogsLoading] = useState(false);
  const [filterCategory, setFilterCategory] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => { loadSupplies(); }, []);
  useEffect(() => { if (success) { const t = setTimeout(() => setSuccess(''), 4000); return () => clearTimeout(t); } }, [success]);
  useEffect(() => { if (error) { const t = setTimeout(() => setError(''), 5000); return () => clearTimeout(t); } }, [error]);

  const loadSupplies = async () => {
    try {
      setLoading(true);
      const res = await getShopSupplies();
      setSupplies(res.data.data || []);
    } catch (err) {
      setError('Failed to load supplies');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!formData.name.trim()) { setError('Name is required'); return; }
    try {
      setSaving(true);
      if (editing) {
        await updateShopSupply(editing.id, formData);
        setSuccess('Item updated');
      } else {
        await createShopSupply(formData);
        setSuccess('Item added');
      }
      setShowModal(false);
      setEditing(null);
      loadSupplies();
    } catch (err) {
      setError(err.response?.data?.error?.message || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const handleRefill = async () => {
    const qty = parseInt(refillQty);
    if (!qty || qty <= 0) { setError('Enter a positive quantity'); return; }
    try {
      setSaving(true);
      await refillShopSupply(showRefillModal.id, { quantity: qty, notes: refillNotes });
      setSuccess(`Added ${qty} ${showRefillModal.unit} of ${showRefillModal.name}`);
      setShowRefillModal(null);
      setRefillQty('');
      setRefillNotes('');
      loadSupplies();
    } catch (err) {
      setError(err.response?.data?.error?.message || 'Failed to refill');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (item) => {
    if (!window.confirm(`Delete "${item.name}"? This will also delete all history.`)) return;
    try {
      await deleteShopSupply(item.id);
      setSuccess(`${item.name} deleted`);
      loadSupplies();
    } catch (err) {
      setError('Failed to delete');
    }
  };

  const openEdit = (item) => {
    setEditing(item);
    setFormData({
      name: item.name,
      description: item.description || '',
      category: item.category || '',
      unit: item.unit || 'each',
      minQuantity: item.minQuantity || 1
    });
    setShowModal(true);
  };

  const openAdd = () => {
    setEditing(null);
    setFormData({ name: '', description: '', category: '', quantity: 0, unit: 'each', minQuantity: 1 });
    setShowModal(true);
  };

  const openLogs = async (item) => {
    setShowLogsModal(item);
    setLogsLoading(true);
    try {
      const res = await getShopSupplyLogs(item.id);
      setLogs(res.data.data || []);
    } catch { setLogs([]); }
    finally { setLogsLoading(false); }
  };

  const printQRLabel = (item) => {
    const baseUrl = window.location.origin.replace('://localhost:3000', '://carolina-rolling-inventory-api-641af96c90aa.herokuapp.com');
    const qrUrl = `${baseUrl}/api/shop-supplies/qr/${item.qrCode}`;
    // Build label HTML for Brother QL-810W (62mm wide)
    const labelHtml = `<!DOCTYPE html><html><head><title>Print Label</title>
<script src="https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js"></script>
<style>
  @page { size: 62mm auto; margin: 2mm; }
  body { font-family: Arial, sans-serif; margin: 0; padding: 4mm; width: 58mm; }
  .label { text-align: center; }
  .name { font-size: 14pt; font-weight: bold; margin-bottom: 2mm; line-height: 1.1; }
  .category { font-size: 9pt; color: #666; margin-bottom: 3mm; }
  #qrcode { display: flex; justify-content: center; margin-bottom: 2mm; }
  .code { font-size: 7pt; color: #999; font-family: monospace; }
  .instruction { font-size: 8pt; margin-top: 2mm; color: #333; }
</style></head><body>
<div class="label">
  <div class="name">${item.name.replace(/"/g, '&quot;')}</div>
  ${item.category ? `<div class="category">${item.category}</div>` : ''}
  <div id="qrcode"></div>
  <div class="code">${item.qrCode}</div>
  <div class="instruction">Scan to use item</div>
</div>
<script>
  new QRCode(document.getElementById("qrcode"), {
    text: "${item.qrCode}",
    width: 120, height: 120, correctLevel: QRCode.CorrectLevel.M
  });
  setTimeout(function() { window.print(); }, 500);
</script></body></html>`;

    const win = window.open('', '_blank', 'width=400,height=500');
    win.document.write(labelHtml);
    win.document.close();
  };

  // Image upload handler
  const imageInputRef = useRef(null);
  const [uploadingImage, setUploadingImage] = useState(null);
  
  const handleImageUpload = async (itemId, file) => {
    try {
      setUploadingImage(itemId);
      await uploadShopSupplyImage(itemId, file);
      setSuccess('Image uploaded');
      loadSupplies();
    } catch (err) {
      setError('Failed to upload image');
    } finally {
      setUploadingImage(null);
    }
  };

  const handleDeleteImage = async (itemId) => {
    if (!window.confirm('Remove this image?')) return;
    try {
      await deleteShopSupplyImage(itemId);
      setSuccess('Image removed');
      loadSupplies();
    } catch (err) {
      setError('Failed to remove image');
    }
  };

  // Print large label: 2.5" x 4" (62mm x 100mm) — image left, QR right, name below QR
  const printImageLabel = (item) => {
    const labelHtml = `<!DOCTYPE html><html><head><title>Print Label - ${item.name}</title>
<script src="https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js"><\/script>
<style>
  @page { size: 4in 2.5in; margin: 0; }
  * { box-sizing: border-box; }
  body { font-family: Arial, sans-serif; margin: 0; padding: 0; width: 4in; height: 2.5in; }
  .label { display: flex; align-items: center; width: 4in; height: 2.5in; padding: 0.1in; gap: 0.15in; }
  .image-side { width: 1.6in; height: 2.3in; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
  .image-side img { max-width: 100%; max-height: 100%; object-fit: contain; }
  .image-side .no-img { width: 1.4in; height: 1.4in; background: #f0f0f0; border: 2px dashed #ccc; border-radius: 8px; display: flex; align-items: center; justify-content: center; color: #999; font-size: 10pt; }
  .qr-side { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; }
  #qrcode { display: flex; justify-content: center; }
  .item-name { font-size: 13pt; font-weight: bold; margin-top: 0.08in; text-align: center; line-height: 1.15; }
  .item-cat { font-size: 8pt; color: #666; margin-top: 0.03in; }
  .scan-text { font-size: 7pt; color: #999; margin-top: 0.05in; }
</style></head><body>
<div class="label">
  <div class="image-side">
    ${item.imageUrl 
      ? `<img src="${item.imageUrl}" alt="${item.name.replace(/"/g, '&quot;')}" />`
      : `<div class="no-img">No Image</div>`}
  </div>
  <div class="qr-side">
    <div id="qrcode"></div>
    <div class="item-name">${item.name.replace(/"/g, '&quot;')}</div>
    ${item.category ? `<div class="item-cat">${item.category}</div>` : ''}
    <div class="scan-text">Scan to use</div>
  </div>
</div>
<script>
  new QRCode(document.getElementById("qrcode"), {
    text: "${item.qrCode}",
    width: 150, height: 150, correctLevel: QRCode.CorrectLevel.M
  });
  setTimeout(function() { window.print(); }, 800);
<\/script></body></html>`;

    const win = window.open('', '_blank', 'width=500,height=350');
    win.document.write(labelHtml);
    win.document.close();
  };

  // Filtered supplies
  const filtered = supplies.filter(s => {
    if (filterCategory !== 'all' && s.category !== filterCategory) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return s.name.toLowerCase().includes(q) || (s.description || '').toLowerCase().includes(q) || (s.category || '').toLowerCase().includes(q);
    }
    return true;
  });

  const categories = [...new Set(supplies.map(s => s.category).filter(Boolean))];
  const lowStockCount = supplies.filter(s => s.quantity <= s.minQuantity).length;

  if (loading) return <div className="loading"><div className="spinner"></div></div>;

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Shop Supplies</h1>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-primary" onClick={openAdd}><Plus size={18} /> Add Item</button>
          <button className="btn btn-outline" onClick={loadSupplies}><RefreshCw size={18} /></button>
        </div>
      </div>

      {error && <div className="alert alert-error">{error}</div>}
      {success && <div className="alert alert-success">{success}</div>}

      {/* Low stock warning banner */}
      {lowStockCount > 0 && (
        <div style={{ background: '#fff3e0', border: '1px solid #ffcc80', borderRadius: 8, padding: '12px 16px', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 12 }}>
          <AlertTriangle size={24} style={{ color: '#e65100', flexShrink: 0 }} />
          <div>
            <strong style={{ color: '#e65100' }}>{lowStockCount} item{lowStockCount > 1 ? 's' : ''} low on stock</strong>
            <div style={{ fontSize: '0.85rem', color: '#bf360c' }}>
              {supplies.filter(s => s.quantity <= s.minQuantity).map(s => s.name).join(', ')}
            </div>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: 200, position: 'relative' }}>
            <input className="form-input" placeholder="Search supplies..." value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)} style={{ paddingLeft: 12 }} />
          </div>
          <select className="form-select" value={filterCategory} onChange={(e) => setFilterCategory(e.target.value)}
            style={{ width: 'auto', minWidth: 140 }}>
            <option value="all">All Categories</option>
            {categories.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <span style={{ fontSize: '0.85rem', color: '#666' }}>{filtered.length} items</span>
        </div>
      </div>

      {/* Supplies Table */}
      {filtered.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: 40, color: '#999' }}>
          <Package size={48} style={{ marginBottom: 16, opacity: 0.3 }} />
          <p style={{ fontSize: '1.1rem', fontWeight: 500 }}>No supplies yet</p>
          <p>Add your first item to start tracking shop supplies.</p>
        </div>
      ) : (
        <div className="card">
          <table className="table" style={{ width: '100%' }}>
            <thead>
              <tr>
                <th style={{ width: 70 }}>Image</th>
                <th>Item</th>
                <th>Category</th>
                <th style={{ textAlign: 'center' }}>In Stock</th>
                <th style={{ textAlign: 'center' }}>Min</th>
                <th>Last Activity</th>
                <th style={{ width: 280 }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(item => {
                const isLow = item.quantity <= item.minQuantity;
                const isEmpty = item.quantity === 0;
                return (
                  <tr key={item.id} style={{ background: isEmpty ? '#ffebee' : isLow ? '#fff3e0' : 'transparent' }}>
                    <td>
                      <div style={{ width: 56, height: 56, borderRadius: 6, overflow: 'hidden', border: '1px solid #ddd', cursor: 'pointer', position: 'relative' }}
                        onClick={() => { imageInputRef.current.dataset.itemId = item.id; imageInputRef.current.click(); }}>
                        {uploadingImage === item.id ? (
                          <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f5f5f5' }}>⏳</div>
                        ) : item.imageUrl ? (
                          <>
                            <img src={item.imageUrl} alt={item.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                            <button onClick={(e) => { e.stopPropagation(); handleDeleteImage(item.id); }}
                              style={{ position: 'absolute', top: -4, right: -4, background: '#c62828', color: 'white', border: 'none', borderRadius: '50%', width: 18, height: 18, fontSize: '10px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1, padding: 0 }}>×</button>
                          </>
                        ) : (
                          <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f9f9f9', color: '#bbb' }}>
                            <Camera size={20} />
                          </div>
                        )}
                      </div>
                    </td>
                    <td>
                      <div style={{ fontWeight: 600 }}>{item.name}</div>
                      {item.description && <div style={{ fontSize: '0.8rem', color: '#666' }}>{item.description}</div>}
                    </td>
                    <td>
                      {item.category && (
                        <span style={{ background: '#e3f2fd', color: '#1565c0', padding: '2px 8px', borderRadius: 12, fontSize: '0.75rem', fontWeight: 500 }}>
                          {item.category}
                        </span>
                      )}
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <span style={{
                        fontWeight: 700, fontSize: '1.1rem',
                        color: isEmpty ? '#c62828' : isLow ? '#e65100' : '#2e7d32'
                      }}>
                        {item.quantity}
                      </span>
                      <span style={{ fontSize: '0.75rem', color: '#888', marginLeft: 4 }}>{item.unit}</span>
                      {isLow && (
                        <div style={{ fontSize: '0.7rem', color: isEmpty ? '#c62828' : '#e65100', fontWeight: 600 }}>
                          {isEmpty ? '⛔ OUT OF STOCK' : '⚠️ LOW STOCK'}
                        </div>
                      )}
                    </td>
                    <td style={{ textAlign: 'center', color: '#888' }}>{item.minQuantity}</td>
                    <td style={{ fontSize: '0.8rem', color: '#666' }}>
                      {item.lastConsumedAt && (
                        <div>Used: {new Date(item.lastConsumedAt).toLocaleDateString()} by {item.lastConsumedBy}</div>
                      )}
                      {item.lastRefilledAt && (
                        <div>Filled: {new Date(item.lastRefilledAt).toLocaleDateString()} by {item.lastRefilledBy}</div>
                      )}
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                        <button className="btn btn-sm" onClick={() => { setShowRefillModal(item); setRefillQty(''); setRefillNotes(''); }}
                          style={{ background: '#e8f5e9', color: '#2e7d32', border: '1px solid #a5d6a7', padding: '4px 10px', fontSize: '0.75rem' }}>
                          + Refill
                        </button>
                        <button className="btn btn-sm btn-outline" onClick={() => printQRLabel(item)}
                          style={{ padding: '4px 8px', fontSize: '0.75rem' }} title="Print QR Label">
                          <Printer size={13} />
                        </button>
                        {item.imageUrl && (
                          <button className="btn btn-sm" onClick={() => printImageLabel(item)}
                            style={{ padding: '4px 8px', fontSize: '0.75rem', background: '#f3e5f5', color: '#7b1fa2', border: '1px solid #ce93d8' }} title="Print 4x2.5 Label with Image">
                            🖼️
                          </button>
                        )}
                        <button className="btn btn-sm btn-outline" onClick={() => openLogs(item)}
                          style={{ padding: '4px 8px', fontSize: '0.75rem' }} title="History">
                          <History size={13} />
                        </button>
                        <button className="btn btn-sm btn-outline" onClick={() => openEdit(item)}
                          style={{ padding: '4px 8px', fontSize: '0.75rem' }}>
                          <Edit size={13} />
                        </button>
                        <button className="btn btn-sm btn-danger" onClick={() => handleDelete(item)}
                          style={{ padding: '4px 8px', fontSize: '0.75rem' }}>
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Add/Edit Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">{editing ? 'Edit Item' : 'Add Supply Item'}</h3>
              <button className="modal-close" onClick={() => setShowModal(false)}>&times;</button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div className="form-group" style={{ gridColumn: 'span 2' }}>
                <label className="form-label">Item Name *</label>
                <input className="form-input" value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })} placeholder="e.g. Argon Gas Tank" />
              </div>
              <div className="form-group" style={{ gridColumn: 'span 2' }}>
                <label className="form-label">Description</label>
                <input className="form-input" value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })} placeholder="Optional details" />
              </div>
              <div className="form-group">
                <label className="form-label">Category</label>
                <select className="form-select" value={formData.category}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value })}>
                  <option value="">None</option>
                  {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Unit</label>
                <select className="form-select" value={formData.unit}
                  onChange={(e) => setFormData({ ...formData, unit: e.target.value })}>
                  {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
                </select>
              </div>
              {!editing && (
                <div className="form-group">
                  <label className="form-label">Starting Quantity</label>
                  <input type="number" className="form-input" value={formData.quantity}
                    onChange={(e) => setFormData({ ...formData, quantity: e.target.value })} min="0" />
                </div>
              )}
              <div className="form-group">
                <label className="form-label">Low Stock Alert (at or below)</label>
                <input type="number" className="form-input" value={formData.minQuantity}
                  onChange={(e) => setFormData({ ...formData, minQuantity: e.target.value })} min="0" />
                <small style={{ color: '#666' }}>Warning appears when stock reaches this level</small>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-outline" onClick={() => setShowModal(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={handleSave} disabled={saving || !formData.name.trim()}>
                {saving ? 'Saving...' : editing ? 'Update' : 'Add Item'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Refill Modal */}
      {showRefillModal && (
        <div className="modal-overlay" onClick={() => setShowRefillModal(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 400 }}>
            <div className="modal-header">
              <h3 className="modal-title">Refill: {showRefillModal.name}</h3>
              <button className="modal-close" onClick={() => setShowRefillModal(null)}>&times;</button>
            </div>
            <div style={{ marginBottom: 12, padding: 12, background: '#f5f5f5', borderRadius: 8, textAlign: 'center' }}>
              <div style={{ fontSize: '0.85rem', color: '#666' }}>Current Stock</div>
              <div style={{ fontSize: '2rem', fontWeight: 700, color: showRefillModal.quantity <= showRefillModal.minQuantity ? '#e65100' : '#2e7d32' }}>
                {showRefillModal.quantity} <span style={{ fontSize: '0.9rem', fontWeight: 400 }}>{showRefillModal.unit}</span>
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">Quantity to Add *</label>
              <input type="number" className="form-input" value={refillQty}
                onChange={(e) => setRefillQty(e.target.value)} min="1" autoFocus placeholder="How many are you adding?"
                style={{ fontSize: '1.2rem', textAlign: 'center' }} />
            </div>
            <div className="form-group">
              <label className="form-label">Notes</label>
              <input className="form-input" value={refillNotes}
                onChange={(e) => setRefillNotes(e.target.value)} placeholder="Optional — e.g. ordered from Airgas" />
            </div>
            {refillQty && parseInt(refillQty) > 0 && (
              <div style={{ background: '#e8f5e9', padding: 10, borderRadius: 8, textAlign: 'center', marginBottom: 12 }}>
                New total: <strong>{showRefillModal.quantity + parseInt(refillQty)} {showRefillModal.unit}</strong>
              </div>
            )}
            <div className="modal-footer">
              <button className="btn btn-outline" onClick={() => setShowRefillModal(null)}>Cancel</button>
              <button className="btn btn-success" onClick={handleRefill} disabled={saving || !refillQty || parseInt(refillQty) <= 0}>
                {saving ? 'Saving...' : 'Add Stock'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* History Modal */}
      {showLogsModal && (
        <div className="modal-overlay" onClick={() => setShowLogsModal(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 600 }}>
            <div className="modal-header">
              <h3 className="modal-title">History: {showLogsModal.name}</h3>
              <button className="modal-close" onClick={() => setShowLogsModal(null)}>&times;</button>
            </div>
            {logsLoading ? (
              <div style={{ textAlign: 'center', padding: 30 }}>Loading...</div>
            ) : logs.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 30, color: '#999' }}>No activity logged yet</div>
            ) : (
              <div style={{ maxHeight: 400, overflowY: 'auto' }}>
                {logs.map(log => (
                  <div key={log.id} style={{ padding: '10px 0', borderBottom: '1px solid #eee', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <span style={{
                        display: 'inline-block', padding: '2px 8px', borderRadius: 4, fontSize: '0.75rem', fontWeight: 600, marginRight: 8,
                        background: log.action === 'consume' ? '#ffebee' : log.action === 'refill' ? '#e8f5e9' : '#e3f2fd',
                        color: log.action === 'consume' ? '#c62828' : log.action === 'refill' ? '#2e7d32' : '#1565c0'
                      }}>
                        {log.action === 'consume' ? '−' : '+'}{Math.abs(log.quantityChange)}
                      </span>
                      <span style={{ fontWeight: 500 }}>{log.action}</span>
                      <span style={{ color: '#666', fontSize: '0.85rem', marginLeft: 8 }}>
                        by {log.performedBy}{log.deviceName ? ` (${log.deviceName})` : ''}
                      </span>
                      {log.notes && <div style={{ fontSize: '0.8rem', color: '#888', marginTop: 2 }}>{log.notes}</div>}
                    </div>
                    <div style={{ fontSize: '0.8rem', color: '#999', whiteSpace: 'nowrap' }}>
                      <div>{new Date(log.createdAt).toLocaleDateString()}</div>
                      <div>{new Date(log.createdAt).toLocaleTimeString()}</div>
                      <div style={{ textAlign: 'right', color: '#666' }}>→ {log.quantityAfter}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Hidden file input for image uploads */}
      <input type="file" ref={imageInputRef} accept="image/*" style={{ display: 'none' }}
        onChange={(e) => {
          const file = e.target.files?.[0];
          const itemId = e.target.dataset.itemId;
          if (file && itemId) handleImageUpload(itemId, file);
          e.target.value = '';
        }} />
    </div>
  );
}

export default ShopSuppliesPage;
