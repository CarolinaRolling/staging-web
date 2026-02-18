import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Upload, X, Save, Package } from 'lucide-react';
import QRCode from 'qrcode';
import { createShipment, uploadPhotos, getLocations, checkClientNoTag } from '../services/api';

function NewShipmentPage() {
  const navigate = useNavigate();
  const photoInputRef = useRef(null);

  const [locations, setLocations] = useState([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [createdData, setCreatedData] = useState(null);
  const [qrCodeUrl, setQrCodeUrl] = useState('');
  const [isNoTagClient, setIsNoTagClient] = useState(false);

  const [formData, setFormData] = useState({
    clientName: '',
    clientPurchaseOrderNumber: '',
    description: '',
    quantity: 1,
    location: '',
    notes: '',
    receivedBy: '',
  });

  const [photos, setPhotos] = useState([]);

  useEffect(() => {
    loadLocations();
  }, []);

  useEffect(() => {
    if (createdData?.shipment?.qrCode && !isNoTagClient) {
      generateQRCode(createdData.shipment.qrCode);
    }
  }, [createdData?.shipment?.qrCode, isNoTagClient]);

  const loadLocations = async () => {
    try {
      const response = await getLocations();
      setLocations(response.data.data || []);
    } catch (err) {
      console.error('Failed to load locations:', err);
    }
  };

  const generateQRCode = async (code) => {
    try {
      const url = await QRCode.toDataURL(code, { width: 300, margin: 2 });
      setQrCodeUrl(url);
    } catch (err) {
      console.error('QR Code generation failed:', err);
    }
  };

  const handlePhotoSelect = (e) => {
    const files = Array.from(e.target.files);
    const newPhotos = files.map(file => ({
      file,
      preview: URL.createObjectURL(file),
      name: file.name
    }));
    setPhotos([...photos, ...newPhotos]);
  };

  const removePhoto = (index) => {
    const newPhotos = [...photos];
    URL.revokeObjectURL(newPhotos[index].preview);
    newPhotos.splice(index, 1);
    setPhotos(newPhotos);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!formData.clientName.trim()) {
      setError('Client name is required');
      return;
    }

    try {
      setSaving(true);
      setError(null);

      // Create shipment (receiving record only — no work order)
      const shipmentData = {
        ...formData,
        createWorkOrder: false,
        assignDRNumber: false,
      };

      const response = await createShipment(shipmentData);
      const result = response.data.data;

      // Upload photos if any
      if (photos.length > 0 && result.shipment?.id) {
        await uploadPhotos(result.shipment.id, photos.map(p => p.file));
      }

      setCreatedData({
        shipment: result.shipment,
        workOrder: result.workOrder,
        drNumber: result.workOrder?.drNumber
      });

      // Check if client has no-tag flag
      try {
        const noTagResp = await checkClientNoTag(formData.clientName.trim());
        setIsNoTagClient(noTagResp.data.data?.noTag === true);
      } catch {
        setIsNoTagClient(false);
      }
    } catch (err) {
      setError('Failed to create shipment');
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  // Show success screen
  if (createdData) {
    return (
      <div>
        <div className="card" style={{ maxWidth: 500, margin: '0 auto', textAlign: 'center' }}>
          <div style={{ fontSize: '3rem', marginBottom: 16 }}>✅</div>
          <h2 style={{ marginBottom: 8 }}>Material Received!</h2>
          <p style={{ color: '#666', marginBottom: 16 }}>{createdData.shipment?.clientName}</p>
          
          {createdData.drNumber ? (
            <div style={{ 
              background: '#e3f2fd', 
              padding: '16px 24px', 
              borderRadius: 8, 
              marginBottom: 24,
              display: 'inline-block'
            }}>
              <div style={{ fontSize: '0.8rem', color: '#666', marginBottom: 4 }}>Linked to Work Order</div>
              <div style={{ 
                fontFamily: 'Courier New, monospace', 
                fontSize: '2rem', 
                fontWeight: 700, 
                color: '#1976d2' 
              }}>
                DR-{createdData.drNumber}
              </div>
            </div>
          ) : (
            <div style={{ 
              background: '#fff3e0', 
              padding: '16px 24px', 
              borderRadius: 8, 
              marginBottom: 24,
            }}>
              <div style={{ fontSize: '1.2rem', fontWeight: 600, color: '#e65100', marginBottom: 4 }}>
                ⏳ Waiting for Instructions
              </div>
              <div style={{ fontSize: '0.85rem', color: '#bf360c' }}>
                Create or link a work order from the Inventory page when ready
              </div>
            </div>
          )}
          
          {isNoTagClient ? (
            <div style={{ 
              background: '#fff3e0', 
              padding: '16px 24px', 
              borderRadius: 8, 
              marginBottom: 24,
              border: '2px solid #ff9800'
            }}>
              <div style={{ fontSize: '1.5rem', marginBottom: 6 }}>🚫</div>
              <div style={{ fontSize: '1.1rem', fontWeight: 700, color: '#e65100', marginBottom: 4 }}>
                No QR code directly on material for this client
              </div>
              <div style={{ fontSize: '0.85rem', color: '#bf360c' }}>
                {createdData.shipment?.clientName} is on the no-tag list. 
                Do not place QR stickers on this material.
              </div>
            </div>
          ) : qrCodeUrl ? (
            <div style={{ marginBottom: 24 }}>
              <img src={qrCodeUrl} alt="QR Code" style={{ maxWidth: '100%' }} />
            </div>
          ) : null}

          <div className="actions-row" style={{ justifyContent: 'center' }}>
            {qrCodeUrl && !isNoTagClient && (
              <button 
                className="btn btn-outline"
                onClick={() => {
                  const link = document.createElement('a');
                  link.download = `shipment-${createdData.shipment?.id?.slice(0, 8)}.png`;
                  link.href = qrCodeUrl;
                  link.click();
                }}
              >
                Download QR Code
              </button>
            )}
            {createdData.workOrder?.id && (
              <button 
                className="btn btn-primary"
                onClick={() => navigate(`/workorder/${createdData.workOrder.id}`)}
              >
                View Work Order
              </button>
            )}
            <button 
              className="btn btn-primary"
              onClick={() => navigate('/inventory')}
            >
              Go to Inventory
            </button>
          </div>
          
          <button 
            className="btn btn-secondary" 
            style={{ marginTop: 16, width: '100%' }}
            onClick={() => {
              setCreatedData(null);
              setFormData({
                clientName: '',
                clientPurchaseOrderNumber: '',
                description: '',
                quantity: 1,
                location: '',
                notes: '',
                receivedBy: '',
              });
              setPhotos([]);
            }}
          >
            Receive Another Shipment
          </button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="page-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <button className="btn btn-icon btn-secondary" onClick={() => navigate('/inventory')}>
            <ArrowLeft size={20} />
          </button>
          <div>
            <h1 className="page-title">Receive Material</h1>
            <p style={{ color: '#666', fontSize: '0.9rem', marginTop: 4 }}>
              Creates a receiving record and work order with DR# assigned
            </p>
          </div>
        </div>
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      <form onSubmit={handleSubmit}>
        <div className="grid grid-2" style={{ gridTemplateColumns: '2fr 1fr' }}>
          {/* Main Form */}
          <div>
            <div className="card">
              <h3 className="card-title" style={{ marginBottom: 16 }}>Client Information</h3>
              
              <div className="grid grid-2">
                <div className="form-group">
                  <label className="form-label">Client Name *</label>
                  <input
                    type="text"
                    className="form-input"
                    value={formData.clientName}
                    onChange={(e) => setFormData({ ...formData, clientName: e.target.value })}
                    required
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Client PO Number</label>
                  <input
                    type="text"
                    className="form-input"
                    value={formData.clientPurchaseOrderNumber}
                    onChange={(e) => setFormData({ ...formData, clientPurchaseOrderNumber: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Received By</label>
                  <input
                    type="text"
                    className="form-input"
                    value={formData.receivedBy}
                    onChange={(e) => setFormData({ ...formData, receivedBy: e.target.value })}
                  />
                </div>
              </div>
            </div>

            <div className="card">
              <h3 className="card-title" style={{ marginBottom: 16 }}>Material Received</h3>
              
              <div className="grid grid-2">
                <div className="form-group">
                  <label className="form-label">Quantity (pieces/bundles)</label>
                  <input
                    type="number"
                    className="form-input"
                    value={formData.quantity}
                    onChange={(e) => setFormData({ ...formData, quantity: e.target.value })}
                    min="1"
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Storage Location</label>
                  <select
                    className="form-select"
                    value={formData.location}
                    onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                  >
                    <option value="">Select location</option>
                    {locations.map((loc) => (
                      <option key={loc.id} value={loc.name}>{loc.name}</option>
                    ))}
                  </select>
                </div>
                <div className="form-group" style={{ gridColumn: 'span 2' }}>
                  <label className="form-label">Material Description</label>
                  <textarea
                    className="form-textarea"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder="e.g., (4) 4x4x1/4 angle, 20' lengths&#10;(2) 6x6x3/8 tube, 24' lengths"
                    rows={3}
                  />
                </div>
                <div className="form-group" style={{ gridColumn: 'span 2' }}>
                  <label className="form-label">Receiving Notes</label>
                  <textarea
                    className="form-textarea"
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    placeholder="e.g., Pallet damaged on corner, material appears OK&#10;Client dropped off, no BOL"
                    rows={2}
                  />
                </div>
              </div>
            </div>

            {/* Photos */}
            <div className="card">
              <div className="card-header">
                <h3 className="card-title">Photos</h3>
              </div>
              
              <div 
                className="file-upload"
                onClick={() => photoInputRef.current?.click()}
              >
                <Upload size={32} className="file-upload-icon" />
                <p>Click to take or select photos of material</p>
                <p style={{ fontSize: '0.75rem', color: '#999' }}>Document condition, labels, damage, etc.</p>
              </div>
              <input
                ref={photoInputRef}
                type="file"
                multiple
                accept="image/*"
                capture="environment"
                style={{ display: 'none' }}
                onChange={handlePhotoSelect}
              />

              {photos.length > 0 && (
                <div className="photo-grid" style={{ marginTop: 16 }}>
                  {photos.map((photo, index) => (
                    <div key={index} className="photo-item">
                      <img src={photo.preview} alt={photo.name} />
                      <button 
                        type="button"
                        className="photo-item-delete"
                        onClick={() => removePhoto(index)}
                      >
                        <X size={16} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Sidebar */}
          <div>
            <div className="card" style={{ position: 'sticky', top: 24 }}>
              <h3 className="card-title" style={{ marginBottom: 16 }}>Summary</h3>
              
              <div style={{ 
                background: '#e8f5e9', 
                padding: 12, 
                borderRadius: 8, 
                marginBottom: 16,
                fontSize: '0.85rem'
              }}>
                <strong>✓ QR code assigned automatically</strong>
              </div>
              
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: '0.875rem', color: '#666', marginBottom: 4 }}>Client</div>
                <div style={{ fontWeight: 500 }}>{formData.clientName || '—'}</div>
              </div>

              {formData.clientPurchaseOrderNumber && (
                <div style={{ marginBottom: 16 }}>
                  <div style={{ fontSize: '0.875rem', color: '#666', marginBottom: 4 }}>PO Number</div>
                  <div style={{ fontWeight: 500 }}>{formData.clientPurchaseOrderNumber}</div>
                </div>
              )}

              {formData.quantity > 1 && (
                <div style={{ marginBottom: 16 }}>
                  <div style={{ fontSize: '0.875rem', color: '#666', marginBottom: 4 }}>Quantity</div>
                  <div style={{ fontWeight: 500 }}>{formData.quantity} pieces</div>
                </div>
              )}
              
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: '0.875rem', color: '#666', marginBottom: 4 }}>Photos</div>
                <div style={{ fontWeight: 500 }}>{photos.length} selected</div>
              </div>

              <div style={{ 
                background: '#e3f2fd', 
                padding: 12, 
                borderRadius: 8, 
                marginBottom: 16,
                fontSize: '0.8rem',
                color: '#1565c0'
              }}>
                <strong>This creates:</strong>
                <ul style={{ margin: '8px 0 0 16px', padding: 0 }}>
                  <li>Receiving record with QR code</li>
                  <li>Goes to Inventory</li>
                </ul>
                <div style={{ marginTop: 8, fontStyle: 'italic' }}>
                  Work order & DR# assigned later from CR Admin
                </div>
              </div>

              <button 
                type="submit" 
                className="btn btn-primary" 
                style={{ width: '100%' }}
                disabled={saving}
              >
                <Save size={18} />
                {saving ? 'Creating...' : 'Receive Material'}
              </button>
            </div>
          </div>
        </div>
      </form>
    </div>
  );
}

export default NewShipmentPage;
