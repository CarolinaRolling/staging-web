import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Plus, Edit, Trash2, Save, X, GripVertical, Upload, Image } from 'lucide-react';
import { getLocations, addLocation, updateLocation, deleteLocation, getWarehouseMapUrl, uploadWarehouseMap } from '../services/api';

function LocationSettingsPage() {
  const navigate = useNavigate();
  const [locations, setLocations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [editName, setEditName] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [newLocationName, setNewLocationName] = useState('');
  const [mapUrl, setMapUrl] = useState(null);
  const [uploadingMap, setUploadingMap] = useState(false);
  const mapInputRef = useRef(null);

  useEffect(() => {
    loadLocations();
    loadMapUrl();
  }, []);

  const loadMapUrl = async () => {
    try {
      const res = await getWarehouseMapUrl();
      setMapUrl(res.data.data?.url || null);
    } catch { }
  };

  const handleMapUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      setUploadingMap(true);
      setError(null);
      const res = await uploadWarehouseMap(file);
      setMapUrl(res.data.data?.url);
      setSuccess('Warehouse map uploaded successfully');
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError('Failed to upload map image');
    } finally {
      setUploadingMap(false);
    }
  };

  const loadLocations = async () => {
    try {
      setLoading(true);
      const response = await getLocations();
      setLocations(response.data.data || []);
    } catch (err) {
      setError('Failed to load locations');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleAdd = async (e) => {
    e.preventDefault();
    if (!newLocationName.trim()) {
      setError('Location name is required');
      return;
    }

    try {
      setSaving(true);
      setError(null);
      await addLocation({ name: newLocationName.trim() });
      await loadLocations();
      setShowAddModal(false);
      setNewLocationName('');
      setSuccess('Location added successfully');
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError('Failed to add location');
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (location) => {
    setEditingId(location.id);
    setEditName(location.name);
  };

  const handleSaveEdit = async (id) => {
    if (!editName.trim()) {
      setError('Location name is required');
      return;
    }

    try {
      setSaving(true);
      setError(null);
      await updateLocation(id, { name: editName.trim() });
      await loadLocations();
      setEditingId(null);
      setEditName('');
      setSuccess('Location updated successfully');
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError('Failed to update location');
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this location?')) return;

    try {
      setSaving(true);
      await deleteLocation(id);
      await loadLocations();
      setSuccess('Location deleted successfully');
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError('Failed to delete location');
      console.error(err);
    } finally {
      setSaving(false);
    }
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
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <button className="btn btn-icon btn-secondary" onClick={() => navigate('/settings')}>
            <ArrowLeft size={20} />
          </button>
          <h1 className="page-title">Location Settings</h1>
        </div>
        <button className="btn btn-primary" onClick={() => setShowAddModal(true)}>
          <Plus size={18} />
          Add Location
        </button>
      </div>

      {error && <div className="alert alert-error">{error}</div>}
      {success && <div className="alert alert-success">{success}</div>}

      {/* Warehouse Map Image */}
      <div className="card" style={{ marginBottom: 24 }}>
        <h3 className="card-title" style={{ marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
          <Image size={20} /> Warehouse Map
        </h3>
        <p style={{ color: '#666', fontSize: '0.85rem', marginBottom: 12 }}>
          Upload a photo or diagram of your shop floor. This image is shared across the web interface and Android app.
        </p>
        
        {mapUrl ? (
          <div style={{ position: 'relative', borderRadius: 8, overflow: 'hidden', border: '1px solid #ddd', marginBottom: 12 }}>
            <img 
              src={mapUrl} 
              alt="Warehouse Map" 
              style={{ width: '100%', maxHeight: 400, objectFit: 'contain', display: 'block', background: '#f5f5f5' }} 
            />
            {/* Overlay location markers */}
            <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}>
              {locations.map(loc => (
                <div key={loc.id} style={{
                  position: 'absolute',
                  left: `${loc.xPercent * 100}%`,
                  top: `${loc.yPercent * 100}%`,
                  transform: 'translate(-50%, -50%)',
                  background: 'rgba(25, 118, 210, 0.9)',
                  color: 'white',
                  padding: '3px 10px',
                  borderRadius: 20,
                  fontSize: '0.75rem',
                  fontWeight: 700,
                  whiteSpace: 'nowrap',
                  boxShadow: '0 2px 6px rgba(0,0,0,0.3)'
                }}>
                  {loc.name}
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div style={{ 
            border: '2px dashed #ccc', borderRadius: 8, padding: 40, textAlign: 'center', 
            background: '#fafafa', marginBottom: 12 
          }}>
            <div style={{ fontSize: '2rem', marginBottom: 8 }}>📷</div>
            <p style={{ color: '#999' }}>No warehouse map uploaded yet</p>
          </div>
        )}
        
        <input type="file" accept="image/*" ref={mapInputRef} style={{ display: 'none' }} onChange={handleMapUpload} />
        <button 
          className="btn btn-primary btn-sm" 
          onClick={() => mapInputRef.current?.click()} 
          disabled={uploadingMap}
        >
          <Upload size={16} />
          {uploadingMap ? 'Uploading...' : mapUrl ? 'Replace Map Image' : 'Upload Map Image'}
        </button>
      </div>

      <div className="card">
        <h3 className="card-title" style={{ marginBottom: 16 }}>Warehouse Locations</h3>
        
        {locations.length === 0 ? (
          <div className="empty-state" style={{ padding: 40 }}>
            <div className="empty-state-icon">📍</div>
            <div className="empty-state-title">No locations configured</div>
            <p>Add locations to organize your warehouse inventory</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {locations.map((location) => (
              <div 
                key={location.id}
                style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: 12,
                  padding: 12,
                  background: '#f9f9f9',
                  borderRadius: 8
                }}
              >
                <GripVertical size={18} color="#999" style={{ cursor: 'grab' }} />
                
                {editingId === location.id ? (
                  <>
                    <input
                      type="text"
                      className="form-input"
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      style={{ flex: 1 }}
                      autoFocus
                    />
                    <button 
                      className="btn btn-sm btn-primary"
                      onClick={() => handleSaveEdit(location.id)}
                      disabled={saving}
                    >
                      <Save size={14} />
                    </button>
                    <button 
                      className="btn btn-sm btn-secondary"
                      onClick={() => setEditingId(null)}
                    >
                      <X size={14} />
                    </button>
                  </>
                ) : (
                  <>
                    <span style={{ flex: 1, fontWeight: 500 }}>{location.name}</span>
                    <button 
                      className="btn btn-sm btn-outline"
                      onClick={() => handleEdit(location)}
                    >
                      <Edit size={14} />
                    </button>
                    <button 
                      className="btn btn-sm btn-danger"
                      onClick={() => handleDelete(location.id)}
                    >
                      <Trash2 size={14} />
                    </button>
                  </>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Add Location Modal */}
      {showAddModal && (
        <div className="modal-overlay" onClick={() => setShowAddModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">Add Location</h3>
              <button className="modal-close" onClick={() => setShowAddModal(false)}>&times;</button>
            </div>
            <form onSubmit={handleAdd}>
              <div className="form-group">
                <label className="form-label">Location Name *</label>
                <input
                  type="text"
                  className="form-input"
                  value={newLocationName}
                  onChange={(e) => setNewLocationName(e.target.value)}
                  placeholder="e.g., Bay 1, Shelf A, etc."
                  required
                  autoFocus
                />
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowAddModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving ? 'Adding...' : 'Add Location'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default LocationSettingsPage;
