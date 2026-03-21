import React, { useState, useEffect, useRef } from 'react';
import { Package, Plus, RefreshCw, AlertTriangle, Trash2, Edit, History, Printer, Camera, X } from 'lucide-react';
import { getShopSupplies, createShopSupply, updateShopSupply, refillShopSupply, getShopSupplyLogs, deleteShopSupply, uploadShopSupplyImage, deleteShopSupplyImage, getShopSupplyCategories, updateShopSupplyCategories } from '../services/api';

const UNITS = ['each', 'tanks', 'cans', 'boxes', 'rolls', 'gallons', 'bags', 'pairs', 'bottles', 'packs'];

function ShopSuppliesPage() {
  const [supplies, setSupplies] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({ name: '', description: '', category: '', quantity: 0, unit: 'each', minQuantity: 1, maxQuantity: '' });
  const [showRefillModal, setShowRefillModal] = useState(null);
  const [refillQty, setRefillQty] = useState('');
  const [refillNotes, setRefillNotes] = useState('');
  const [showLogsModal, setShowLogsModal] = useState(null);
  const [logs, setLogs] = useState([]);
  const [logsLoading, setLogsLoading] = useState(false);
  const [filterCategory, setFilterCategory] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [showCategoryManager, setShowCategoryManager] = useState(false);
  const [newCategory, setNewCategory] = useState('');
  const [editingStock, setEditingStock] = useState(null);
  const [stockInput, setStockInput] = useState('');
  const [showShoppingModal, setShowShoppingModal] = useState(false);
  const [shoppingCategories, setShoppingCategories] = useState(new Set());

  useEffect(() => { loadSupplies(); loadCategories(); }, []);
  useEffect(() => { if (success) { const t = setTimeout(() => setSuccess(''), 4000); return () => clearTimeout(t); } }, [success]);
  useEffect(() => { if (error) { const t = setTimeout(() => setError(''), 5000); return () => clearTimeout(t); } }, [error]);

  const loadCategories = async () => {
    try {
      const res = await getShopSupplyCategories();
      setCategories(res.data.data || ['Gas', 'Safety', 'Consumables', 'Other']);
    } catch (err) { /* use defaults */ }
  };

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
      minQuantity: item.minQuantity || 1,
      maxQuantity: item.maxQuantity || ''
    });
    setShowModal(true);
  };

  const openAdd = () => {
    setEditing(null);
    setFormData({ name: '', description: '', category: '', quantity: 0, unit: 'each', minQuantity: 1, maxQuantity: '' });
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

  const usedCategories = [...new Set(supplies.map(s => s.category).filter(Boolean))];
  const allCategories = [...new Set([...categories, ...usedCategories])].sort();
  const lowStockCount = supplies.filter(s => s.quantity <= s.minQuantity).length;

  const handleStockSave = async (item) => {
    const newQty = parseInt(stockInput);
    if (isNaN(newQty) || newQty < 0) { setError('Enter a valid quantity'); return; }
    try {
      await updateShopSupply(item.id, { quantity: newQty });
      setSuccess(`${item.name} stock updated to ${newQty}`);
      setEditingStock(null);
      loadSupplies();
    } catch (err) { setError('Failed to update stock'); }
  };

  const handleSaveCategories = async (cats) => {
    try {
      await updateShopSupplyCategories(cats);
      setCategories(cats);
      setSuccess('Categories updated');
    } catch (err) { setError('Failed to save categories'); }
  };

  const openShoppingList = () => {
    const catsWithNeeds = new Set();
    supplies.forEach(s => {
      const max = s.maxQuantity || s.minQuantity * 2 || 4;
      if (s.quantity < max && s.isActive && s.category) catsWithNeeds.add(s.category);
    });
    setShoppingCategories(catsWithNeeds);
    setShowShoppingModal(true);
  };

  const printShoppingList = () => {
    const selectedCats = shoppingCategories;
    const needsRefill = supplies.filter(s => {
      const max = s.maxQuantity || s.minQuantity * 2 || 4;
      if (s.quantity >= max || !s.isActive) return false;
      if (selectedCats.size > 0 && !selectedCats.has(s.category || 'Uncategorized')) return false;
      return true;
    }).sort((a, b) => (a.category || 'zzz').localeCompare(b.category || 'zzz'));

    if (needsRefill.length === 0) { setSuccess('All selected categories are fully stocked!'); setShowShoppingModal(false); return; }

    const grouped = {};
    needsRefill.forEach(s => {
      const cat = s.category || 'Uncategorized';
      if (!grouped[cat]) grouped[cat] = [];
      const max = s.maxQuantity || s.minQuantity * 2 || 4;
      const need = max - s.quantity;
      grouped[cat].push({ name: s.name, have: s.quantity, need, max, unit: s.unit });
    });

    const rows = Object.entries(grouped).sort(([a],[b]) => a.localeCompare(b)).map(([cat, items]) =>
      `<tr><td colspan="5" style="background:#1565C0;color:white;font-weight:700;padding:8px 12px;font-size:0.95rem">${cat}</td></tr>` +
      items.map(i => `<tr><td style="padding:6px 12px">☐</td><td style="padding:6px 12px;font-weight:600">${i.name}</td><td style="padding:6px 12px;text-align:center">${i.have} ${i.unit}</td><td style="padding:6px 12px;text-align:center;color:#c62828;font-weight:700">Need ${i.need}</td><td style="padding:6px 12px;text-align:center">${i.max} ${i.unit}</td></tr>`).join('')
    ).join('');

    const win = window.open('', '_blank');
    win.document.write(`<html><head><title>Shopping List</title><style>body{font-family:Arial,sans-serif;margin:20px}table{width:100%;border-collapse:collapse}td{border-bottom:1px solid #eee}@media print{button{display:none}}</style></head><body>`);
    win.document.write(`<h2>🛒 Shop Supply Shopping List</h2><p style="color:#666">${new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>`);
    win.document.write(`<table><thead><tr style="background:#f5f5f5"><th style="padding:8px 12px;text-align:left;width:30px">✓</th><th style="padding:8px 12px;text-align:left">Item</th><th style="padding:8px 12px;text-align:center">Have</th><th style="padding:8px 12px;text-align:center">Need</th><th style="padding:8px 12px;text-align:center">Max</th></tr></thead><tbody>${rows}</tbody></table>`);
    win.document.write(`<br/><button onclick="window.print()" style="padding:10px 24px;font-size:1rem;cursor:pointer">Print</button></body></html>`);
    win.document.close();
    setShowShoppingModal(false);
  };

  if (loading) return <div className="loading"><div className="spinner"></div></div>;

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Shop Supplies</h1>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn" onClick={openShoppingList} style={{ background: '#E65100', color: 'white', border: 'none' }}>🛒 Shopping List</button>
          <button className="btn btn-outline" onClick={() => setShowCategoryManager(true)}>📁 Categories</button>
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
            {allCategories.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <span style={{ fontSize: '0.85rem', color: '#666' }}>{filtered.length} items</span>
        </div>
      </div>

      {/* Supplies Table — grouped by category */}
      {filtered.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: 40, color: '#999' }}>
          <Package size={48} style={{ marginBottom: 16, opacity: 0.3 }} />
          <p style={{ fontSize: '1.1rem', fontWeight: 500 }}>No supplies yet</p>
          <p>Add your first item to start tracking shop supplies.</p>
        </div>
      ) : (() => {
        const grouped = {};
        filtered.forEach(item => {
          const cat = item.category || 'Uncategorized';
          if (!grouped[cat]) grouped[cat] = [];
          grouped[cat].push(item);
        });
        const sortedCats = Object.keys(grouped).sort((a, b) => a === 'Uncategorized' ? 1 : b === 'Uncategorized' ? -1 : a.localeCompare(b));
        return sortedCats.map(cat => (
          <div key={cat} style={{ marginBottom: 20 }}>
            <div style={{ padding: '8px 16px', background: '#1565C0', color: 'white', fontWeight: 700, fontSize: '0.95rem', borderRadius: '8px 8px 0 0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span>{cat}</span>
              <span style={{ fontSize: '0.8rem', fontWeight: 400, opacity: 0.85 }}>{grouped[cat].length} item{grouped[cat].length !== 1 ? 's' : ''}</span>
            </div>
            <div className="card" style={{ borderRadius: '0 0 8px 8px', marginTop: 0, borderTop: 'none' }}>
              <table className="table" style={{ width: '100%', marginBottom: 0 }}>
                <thead>
                  <tr>
                    <th style={{ width: 60 }}>Image</th>
                    <th>Item</th>
                    <th style={{ textAlign: 'center', width: 130 }}>Stock</th>
                    <th style={{ textAlign: 'center', width: 50 }}>Min</th>
                    <th style={{ width: 160 }}>Last Activity</th>
                    <th style={{ width: 260 }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {grouped[cat].map(item => {
                    const isLow = item.quantity <= item.minQuantity;
                    const isEmpty = item.quantity === 0;
                    return (
                      <tr key={item.id} style={{ background: isEmpty ? '#ffebee' : isLow ? '#fff3e0' : 'transparent' }}>
                        <td>
                          <div style={{ width: 50, height: 50, borderRadius: 6, overflow: 'hidden', border: '1px solid #ddd', cursor: 'pointer', position: 'relative', background: '#fff' }}
                            onClick={() => { imageInputRef.current.dataset.itemId = item.id; imageInputRef.current.click(); }}>
                            {uploadingImage === item.id ? (
                              <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f5f5f5' }}>⏳</div>
                            ) : item.imageUrl ? (
                              <>
                                <img src={item.imageUrl} alt={item.name} style={{ width: '100%', height: '100%', objectFit: 'contain', padding: 2 }} />
                                <button onClick={(e) => { e.stopPropagation(); handleDeleteImage(item.id); }}
                                  style={{ position: 'absolute', top: -4, right: -4, background: '#c62828', color: 'white', border: 'none', borderRadius: '50%', width: 18, height: 18, fontSize: '10px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1, padding: 0 }}>×</button>
                              </>
                            ) : (
                              <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f9f9f9', color: '#bbb' }}>
                                <Camera size={18} />
                              </div>
                            )}
                          </div>
                        </td>
                        <td>
                          <div style={{ fontWeight: 600 }}>{item.name}</div>
                          {item.description && <div style={{ fontSize: '0.8rem', color: '#666' }}>{item.description}</div>}
                        </td>
                    <td style={{ textAlign: 'center', minWidth: 120 }}>
                      {editingStock === item.id ? (
                        <div style={{ display: 'flex', gap: 4, alignItems: 'center', justifyContent: 'center' }}>
                          <input type="number" value={stockInput} onChange={e => setStockInput(e.target.value)}
                            onKeyDown={e => { if (e.key === 'Enter') handleStockSave(item); if (e.key === 'Escape') setEditingStock(null); }}
                            autoFocus style={{ width: 60, textAlign: 'center', padding: '2px 4px' }} min="0" />
                          <button onClick={() => handleStockSave(item)} style={{ background: '#388E3C', color: 'white', border: 'none', borderRadius: 4, padding: '2px 6px', cursor: 'pointer', fontSize: '0.75rem' }}>✓</button>
                          <button onClick={() => setEditingStock(null)} style={{ background: '#888', color: 'white', border: 'none', borderRadius: 4, padding: '2px 6px', cursor: 'pointer', fontSize: '0.75rem' }}>✕</button>
                        </div>
                      ) : (
                        <div onClick={() => { setEditingStock(item.id); setStockInput(String(item.quantity)); }} style={{ cursor: 'pointer' }} title="Click to edit stock">
                          <span style={{
                            fontWeight: 700, fontSize: '1.05rem',
                            color: isEmpty ? '#c62828' : isLow ? '#e65100' : '#2e7d32'
                          }}>
                            {item.quantity}{item.maxQuantity ? `/${item.maxQuantity}` : ''}
                          </span>
                          <span style={{ fontSize: '0.7rem', color: '#888', marginLeft: 4 }}>{item.unit}</span>
                          {item.maxQuantity && (
                            <div style={{ width: '100%', height: 6, background: '#e0e0e0', borderRadius: 3, marginTop: 4, overflow: 'hidden' }}>
                              <div style={{
                                width: `${Math.min(100, (item.quantity / item.maxQuantity) * 100)}%`,
                                height: '100%',
                                borderRadius: 3,
                                background: isEmpty ? '#c62828' : isLow ? '#ff9800' : item.quantity >= item.maxQuantity ? '#2e7d32' : '#42a5f5',
                                transition: 'width 0.3s'
                              }} />
                            </div>
                          )}
                          {isEmpty && <div style={{ fontSize: '0.65rem', color: '#c62828', fontWeight: 700, marginTop: 2 }}>OUT OF STOCK</div>}
                          {!isEmpty && isLow && <div style={{ fontSize: '0.65rem', color: '#e65100', fontWeight: 600, marginTop: 2 }}>LOW</div>}
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
          </div>
        ));
      })()}

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
                  {allCategories.map(c => <option key={c} value={c}>{c}</option>)}
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
                <label className="form-label">Max Stock</label>
                <input type="number" className="form-input" value={formData.maxQuantity}
                  onChange={(e) => setFormData({ ...formData, maxQuantity: e.target.value })} min="0" placeholder="e.g. 4" />
                <small style={{ color: '#666' }}>Full capacity — shows progress bar</small>
              </div>
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

      {/* Shopping List Category Picker Modal */}
      {showShoppingModal && (
        <div className="modal-overlay" onClick={() => setShowShoppingModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 440 }}>
            <div className="modal-header">
              <h3 className="modal-title">🛒 Shopping List</h3>
              <button className="modal-close" onClick={() => setShowShoppingModal(false)}>&times;</button>
            </div>
            <p style={{ color: '#666', fontSize: '0.9rem', marginBottom: 12 }}>Select categories to include in the shopping list:</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 16 }}>
              {allCategories.map(cat => {
                const itemsInCat = supplies.filter(s => s.category === cat && s.isActive);
                const needsRefill = itemsInCat.filter(s => { const max = s.maxQuantity || s.minQuantity * 2 || 4; return s.quantity < max; }).length;
                return (
                  <label key={cat} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', background: shoppingCategories.has(cat) ? '#E3F2FD' : '#f9f9f9', borderRadius: 6, cursor: 'pointer', border: shoppingCategories.has(cat) ? '2px solid #1565C0' : '2px solid transparent' }}>
                    <input type="checkbox" checked={shoppingCategories.has(cat)} onChange={() => {
                      setShoppingCategories(prev => { const n = new Set(prev); n.has(cat) ? n.delete(cat) : n.add(cat); return n; });
                    }} style={{ width: 18, height: 18 }} />
                    <span style={{ fontWeight: 600, flex: 1 }}>{cat}</span>
                    {needsRefill > 0 && <span style={{ fontSize: '0.75rem', background: '#FFE0B2', color: '#E65100', padding: '2px 8px', borderRadius: 10 }}>{needsRefill} need refill</span>}
                  </label>
                );
              })}
              {(() => {
                const uncatItems = supplies.filter(s => !s.category && s.isActive);
                const uncatNeeds = uncatItems.filter(s => { const max = s.maxQuantity || s.minQuantity * 2 || 4; return s.quantity < max; }).length;
                if (uncatItems.length === 0) return null;
                return (
                  <label style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', background: shoppingCategories.has('Uncategorized') ? '#E3F2FD' : '#f9f9f9', borderRadius: 6, cursor: 'pointer', border: shoppingCategories.has('Uncategorized') ? '2px solid #1565C0' : '2px solid transparent' }}>
                    <input type="checkbox" checked={shoppingCategories.has('Uncategorized')} onChange={() => {
                      setShoppingCategories(prev => { const n = new Set(prev); n.has('Uncategorized') ? n.delete('Uncategorized') : n.add('Uncategorized'); return n; });
                    }} style={{ width: 18, height: 18 }} />
                    <span style={{ fontWeight: 600, flex: 1 }}>Uncategorized</span>
                    {uncatNeeds > 0 && <span style={{ fontSize: '0.75rem', background: '#FFE0B2', color: '#E65100', padding: '2px 8px', borderRadius: 10 }}>{uncatNeeds} need refill</span>}
                  </label>
                );
              })()}
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'space-between' }}>
              <button className="btn btn-outline" onClick={() => {
                const all = new Set(allCategories);
                if (supplies.some(s => !s.category)) all.add('Uncategorized');
                setShoppingCategories(all);
              }} style={{ fontSize: '0.85rem' }}>Select All</button>
              <div style={{ display: 'flex', gap: 8 }}>
                <button className="btn btn-outline" onClick={() => setShowShoppingModal(false)}>Cancel</button>
                <button className="btn" onClick={printShoppingList} disabled={shoppingCategories.size === 0}
                  style={{ background: shoppingCategories.size > 0 ? '#E65100' : '#ccc', color: 'white', border: 'none', fontWeight: 700 }}>
                  🖨️ Print Shopping List
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Category Manager Modal */}
      {showCategoryManager && (
        <div className="modal-overlay" onClick={() => setShowCategoryManager(false)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 400 }}>
            <div className="modal-header">
              <h3 className="modal-title">📁 Manage Categories</h3>
              <button className="modal-close" onClick={() => setShowCategoryManager(false)}>&times;</button>
            </div>
            <div style={{ marginBottom: 12 }}>
              <div style={{ display: 'flex', gap: 8 }}>
                <input className="form-input" placeholder="New category name" value={newCategory}
                  onChange={e => setNewCategory(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter' && newCategory.trim()) { handleSaveCategories([...categories, newCategory.trim()]); setNewCategory(''); }}} />
                <button className="btn btn-primary" disabled={!newCategory.trim()} onClick={() => {
                  if (newCategory.trim()) { handleSaveCategories([...categories, newCategory.trim()]); setNewCategory(''); }
                }}>Add</button>
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {categories.map((cat, i) => {
                const inUse = supplies.some(s => s.category === cat);
                return (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', background: '#f9f9f9', borderRadius: 6 }}>
                    <span style={{ fontWeight: 500 }}>{cat}</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      {inUse && <span style={{ fontSize: '0.7rem', color: '#888' }}>In use</span>}
                      <button className="btn btn-sm" onClick={() => {
                        if (inUse && !window.confirm(`"${cat}" is used by some items. Remove it from the list? (Items won't be affected)`)) return;
                        handleSaveCategories(categories.filter((_, j) => j !== i));
                      }} style={{ padding: '2px 8px', fontSize: '0.75rem', color: '#c62828', background: 'none', border: '1px solid #c62828' }}>
                        Remove
                      </button>
                    </div>
                  </div>
                );
              })}
              {categories.length === 0 && <div style={{ color: '#999', textAlign: 'center', padding: 16 }}>No categories yet</div>}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default ShopSuppliesPage;
