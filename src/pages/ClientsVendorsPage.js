import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Plus, Edit, Trash2, Users, Building2, Search, Check, X } from 'lucide-react';
import { getClients, createClient, updateClient, deleteClient, getVendors, createVendor, updateVendor, deleteVendor, verifySinglePermit, startBatchVerification, getBatchStatus, downloadResaleReport } from '../services/api';

const formatPhone = (val) => {
  const digits = val.replace(/\D/g, '').slice(0, 10);
  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `(${digits.slice(0,3)})${digits.slice(3)}`;
  return `(${digits.slice(0,3)})${digits.slice(3,6)}-${digits.slice(6)}`;
};

const formatResale = (val) => {
  const digits = val.replace(/\D/g, '').slice(0, 9);
  if (digits.length <= 3) return digits;
  return `${digits.slice(0, 3)}-${digits.slice(3)}`;
};

const isValidResale = (val) => {
  if (!val) return false;
  return /^\d{3}-\d{6}$/.test(val.trim());
};

const ClientsVendorsPage = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState('clients');
  const [clients, setClients] = useState([]);
  const [vendors, setVendors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [search, setSearch] = useState('');
  const [showInactive, setShowInactive] = useState(false);
  
  // Modal state
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [formData, setFormData] = useState({});
  const [saving, setSaving] = useState(false);
  const [verifying, setVerifying] = useState(false);

  useEffect(() => {
    loadData();
  }, [showInactive]);

  // Auto-open add client form if navigated with ?addClient=Name
  useEffect(() => {
    const addClientName = searchParams.get('addClient');
    if (addClientName && !loading) {
      setActiveTab('clients');
      setEditing(null);
      setFormData({
        name: addClientName,
        contactName: '', contactPhone: '', contactEmail: '',
        address: '', taxStatus: 'taxable', resaleCertificate: '',
        customTaxRate: '', paymentTerms: '', apEmail: '', quickbooksName: '', notes: ''
      });
      setShowModal(true);
      // Clear the query param so it doesn't re-trigger
      setSearchParams({}, { replace: true });
    }
  }, [searchParams, loading]);

  const loadData = async () => {
    try {
      setLoading(true);
      const [clientsRes, vendorsRes] = await Promise.all([
        getClients({ active: showInactive ? undefined : 'true' }),
        getVendors({ active: showInactive ? undefined : 'true' })
      ]);
      setClients(clientsRes.data.data || []);
      setVendors(vendorsRes.data.data || []);
    } catch (err) {
      setError('Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const showMessage = (msg) => {
    setSuccess(msg);
    setTimeout(() => setSuccess(''), 3000);
  };

  // Client functions
  const openClientModal = (client = null) => {
    setEditing(client);
    setFormData(client ? { ...client } : {
      name: '',
      contactName: '',
      contactPhone: '',
      contactEmail: '',
      address: '',
      taxStatus: 'taxable',
      resaleCertificate: '',
      customTaxRate: '',
      paymentTerms: '', apEmail: '', quickbooksName: '',
      notes: ''
    });
    setShowModal(true);
  };

  const handleSaveClient = async () => {
    if (!formData.name?.trim()) {
      setError('Client name is required');
      return;
    }
    try {
      setSaving(true);
      if (editing) {
        await updateClient(editing.id, formData);
        showMessage('Client updated');
      } else {
        await createClient(formData);
        showMessage('Client created');
      }
      setShowModal(false);
      loadData();
    } catch (err) {
      setError(err.response?.data?.error?.message || 'Failed to save client');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteClient = async (client) => {
    if (!window.confirm(`Deactivate client "${client.name}"?`)) return;
    try {
      await deleteClient(client.id);
      showMessage('Client deactivated');
      loadData();
    } catch (err) {
      setError('Failed to deactivate client');
    }
  };

  const handleReactivateClient = async (client) => {
    try {
      await updateClient(client.id, { isActive: true });
      showMessage('Client reactivated');
      loadData();
    } catch (err) {
      setError('Failed to reactivate client');
    }
  };

  const handleVerifyPermit = async (clientId, permitNumber) => {
    if (!permitNumber || !permitNumber.trim()) {
      setError('No resale certificate number to verify');
      return;
    }
    try {
      setVerifying(true);
      const res = await verifySinglePermit({ clientId, permitNumber: permitNumber.trim() });
      const result = res.data?.data;
      if (result) {
        // Update local formData if editing this client
        if (editing && editing.id === clientId) {
          setFormData(prev => ({
            ...prev,
            permitStatus: result.status,
            permitLastVerified: result.verifiedDate,
            permitRawResponse: result.rawResponse,
            permitOwnerName: result.ownerName || '',
            permitDbaName: result.dbaName || '',
            _permitRawFields: result.rawFields || {},
            _permitLabelMap: result.labelMap || {},
            // Auto-set tax status to resale when permit is verified active
            ...(result.status === 'active' ? { taxStatus: 'resale' } : {})
          }));
        }
        showMessage(`Permit verified: ${result.status.toUpperCase()}${result.rawResponse ? ' — ' + result.rawResponse : ''}`);
        loadData();
      }
    } catch (err) {
      setError('Failed to verify permit: ' + (err.response?.data?.error?.message || err.message));
    } finally {
      setVerifying(false);
    }
  };

  // Vendor functions
  const openVendorModal = (vendor = null) => {
    setEditing(vendor);
    setFormData(vendor ? { ...vendor } : {
      name: '',
      contactName: '',
      contactPhone: '',
      contactEmail: '',
      address: '',
      accountNumber: '',
      notes: ''
    });
    setShowModal(true);
  };

  const handleSaveVendor = async () => {
    if (!formData.name?.trim()) {
      setError('Vendor name is required');
      return;
    }
    try {
      setSaving(true);
      if (editing) {
        await updateVendor(editing.id, formData);
        showMessage('Vendor updated');
      } else {
        await createVendor(formData);
        showMessage('Vendor created');
      }
      setShowModal(false);
      loadData();
    } catch (err) {
      setError(err.response?.data?.error?.message || 'Failed to save vendor');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteVendor = async (vendor) => {
    if (!window.confirm(`Deactivate vendor "${vendor.name}"?`)) return;
    try {
      await deleteVendor(vendor.id);
      showMessage('Vendor deactivated');
      loadData();
    } catch (err) {
      setError('Failed to deactivate vendor');
    }
  };

  const handleReactivateVendor = async (vendor) => {
    try {
      await updateVendor(vendor.id, { isActive: true });
      showMessage('Vendor reactivated');
      loadData();
    } catch (err) {
      setError('Failed to reactivate vendor');
    }
  };

  // Filter data
  const filteredClients = clients.filter(c => 
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    c.contactName?.toLowerCase().includes(search.toLowerCase())
  );

  const filteredVendors = vendors.filter(v => 
    v.name.toLowerCase().includes(search.toLowerCase()) ||
    v.contactName?.toLowerCase().includes(search.toLowerCase())
  );

  const getTaxStatusBadge = (status) => {
    const styles = {
      taxable: { bg: '#e3f2fd', color: '#1565c0', label: 'Taxable' },
      resale: { bg: '#fff3e0', color: '#e65100', label: 'Resale' },
      exempt: { bg: '#e8f5e9', color: '#2e7d32', label: 'Tax Exempt' }
    };
    const s = styles[status] || styles.taxable;
    return (
      <span style={{ background: s.bg, color: s.color, padding: '2px 8px', borderRadius: 4, fontSize: '0.75rem', fontWeight: 500 }}>
        {s.label}
      </span>
    );
  };

  if (loading) return <div className="loading"><div className="spinner"></div></div>;

  return (
    <div>
      <div className="page-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <button className="btn btn-secondary" onClick={() => navigate('/admin')} style={{ borderRadius: '50%', padding: 8 }}>
            <ArrowLeft size={20} />
          </button>
          <h1 className="page-title">Clients & Vendors</h1>
        </div>
      </div>

      {error && <div className="alert alert-error" onClick={() => setError('')}>{error}</div>}
      {success && <div className="alert alert-success">{success}</div>}

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        <button
          className={`btn ${activeTab === 'clients' ? 'btn-primary' : 'btn-outline'}`}
          onClick={() => setActiveTab('clients')}
        >
          <Users size={18} /> Clients ({clients.length})
        </button>
        <button
          className={`btn ${activeTab === 'vendors' ? 'btn-primary' : 'btn-outline'}`}
          onClick={() => setActiveTab('vendors')}
        >
          <Building2 size={18} /> Vendors ({vendors.length})
        </button>
        <button
          className={`btn ${activeTab === 'permits' ? 'btn-primary' : 'btn-outline'}`}
          onClick={() => setActiveTab('permits')}
        >
          🔐 Permit Status
        </button>
      </div>

      {/* Search and Actions */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: 200 }}>
            <div style={{ position: 'relative' }}>
              <Search size={18} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#666' }} />
              <input
                className="form-input"
                placeholder={`Search ${activeTab}...`}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                style={{ paddingLeft: 40 }}
              />
            </div>
          </div>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
            <input type="checkbox" checked={showInactive} onChange={(e) => setShowInactive(e.target.checked)} />
            Show Inactive
          </label>
          <button
            className="btn btn-primary"
            onClick={() => activeTab === 'clients' ? openClientModal() : openVendorModal()}
          >
            <Plus size={18} /> Add {activeTab === 'clients' ? 'Client' : 'Vendor'}
          </button>
        </div>
      </div>

      {/* Clients Tab */}
      {activeTab === 'clients' && (
        <div className="card">
          {filteredClients.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 40, color: '#666' }}>
              <Users size={48} style={{ opacity: 0.3 }} />
              <p style={{ marginTop: 12 }}>No clients found</p>
              <button className="btn btn-primary" onClick={() => openClientModal()} style={{ marginTop: 8 }}>
                <Plus size={18} /> Add First Client
              </button>
            </div>
          ) : (
            <table className="table">
              <thead>
                <tr>
                  <th>Client Name</th>
                  <th>Contact</th>
                  <th>Tax Status</th>
                  <th>Terms</th>
                  <th>Custom Rate</th>
                  <th>Status</th>
                  <th style={{ width: 100 }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredClients.map(client => (
                  <tr key={client.id} style={{ opacity: client.isActive ? 1 : 0.5 }}>
                    <td>
                      <strong>{client.name}</strong>
                      {client.noTag && <span style={{ marginLeft: 8, fontSize: '0.75rem', background: '#fff3e0', color: '#e65100', padding: '2px 6px', borderRadius: 4, fontWeight: 600 }}>🚫 No Tag</span>}
                      {client.requiresPartLabels && <span style={{ marginLeft: 8, fontSize: '0.75rem', background: '#e3f2fd', color: '#1565c0', padding: '2px 6px', borderRadius: 4, fontWeight: 600 }}>🏷️ Part Labels</span>}
                      {client.emailScanEnabled && <span style={{ marginLeft: 8, fontSize: '0.75rem', background: '#FFF3E0', color: '#E65100', padding: '2px 6px', borderRadius: 4, fontWeight: 600 }}>📧 Email Scan</span>}
                      {client.resaleCertificate && client.permitStatus === 'active' && <span style={{ marginLeft: 6, fontSize: '0.7rem', background: '#e8f5e9', color: '#2e7d32', padding: '1px 5px', borderRadius: 3, fontWeight: 600 }}>✅ Permit</span>}
                      {client.resaleCertificate && client.permitStatus === 'closed' && <span style={{ marginLeft: 6, fontSize: '0.7rem', background: '#ffebee', color: '#c62828', padding: '1px 5px', borderRadius: 3, fontWeight: 600 }}>❌ Permit Closed</span>}
                      {client.resaleCertificate && client.permitStatus === 'not_found' && <span style={{ marginLeft: 6, fontSize: '0.7rem', background: '#ffebee', color: '#c62828', padding: '1px 5px', borderRadius: 3, fontWeight: 600 }}>❌ Permit Not Found</span>}
                      {client.resaleCertificate && (!client.permitStatus || client.permitStatus === 'unverified') && <span style={{ marginLeft: 6, fontSize: '0.7rem', background: '#fff3e0', color: '#e65100', padding: '1px 5px', borderRadius: 3, fontWeight: 600 }}>⚠️ Unverified</span>}
                      {client.address && <div style={{ fontSize: '0.8rem', color: '#666' }}>{client.address}</div>}
                    </td>
                    <td>
                      {client.contactName && <div>{client.contactName}</div>}
                      {client.contactPhone && <div style={{ fontSize: '0.85rem', color: '#666' }}>{formatPhone(client.contactPhone)}</div>}
                      {client.contactEmail && <div style={{ fontSize: '0.85rem', color: '#666' }}>{client.contactEmail}</div>}
                      {client.apEmail && <div style={{ fontSize: '0.75rem', color: '#1565c0' }}>📧 AP: {client.apEmail}</div>}
                      {client.quickbooksName && <div style={{ fontSize: '0.75rem', color: '#2E7D32', fontFamily: 'monospace' }}>📗 QB: {client.quickbooksName}</div>}
                      {client.contacts && client.contacts.length > 0 && (
                        <div style={{ fontSize: '0.75rem', color: '#1565c0', marginTop: 2 }}>+{client.contacts.length} more contact{client.contacts.length > 1 ? 's' : ''}</div>
                      )}
                    </td>
                    <td>{getTaxStatusBadge(client.taxStatus)}</td>
                    <td>
                      {client.paymentTerms ? (
                        <span style={{ fontWeight: 500, fontSize: '0.85rem' }}>{client.paymentTerms}</span>
                      ) : (
                        <span style={{ color: '#999', fontSize: '0.85rem' }}>—</span>
                      )}
                    </td>
                    <td>
                      {client.customTaxRate ? (
                        <span style={{ fontWeight: 500 }}>{(parseFloat(client.customTaxRate) * 100).toFixed(2)}%</span>
                      ) : (
                        <span style={{ color: '#999' }}>Default</span>
                      )}
                    </td>
                    <td>
                      {client.isActive ? (
                        <span style={{ color: '#2e7d32' }}>✓ Active</span>
                      ) : (
                        <span style={{ color: '#d32f2f' }}>Inactive</span>
                      )}
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: 4 }}>
                        <button className="btn btn-sm btn-outline" onClick={() => openClientModal(client)}><Edit size={14} /></button>
                        {client.isActive ? (
                          <button className="btn btn-sm btn-danger" onClick={() => handleDeleteClient(client)}><X size={14} /></button>
                        ) : (
                          <button className="btn btn-sm btn-success" onClick={() => handleReactivateClient(client)}><Check size={14} /></button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* Vendors Tab */}
      {activeTab === 'vendors' && (
        <div className="card">
          {filteredVendors.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 40, color: '#666' }}>
              <Building2 size={48} style={{ opacity: 0.3 }} />
              <p style={{ marginTop: 12 }}>No vendors found</p>
              <button className="btn btn-primary" onClick={() => openVendorModal()} style={{ marginTop: 8 }}>
                <Plus size={18} /> Add First Vendor
              </button>
            </div>
          ) : (
            <table className="table">
              <thead>
                <tr>
                  <th>Vendor Name</th>
                  <th>Contact</th>
                  <th>Account #</th>
                  <th>Status</th>
                  <th style={{ width: 100 }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredVendors.map(vendor => (
                  <tr key={vendor.id} style={{ opacity: vendor.isActive ? 1 : 0.5 }}>
                    <td>
                      <strong>{vendor.name}</strong>
                      {vendor.address && <div style={{ fontSize: '0.8rem', color: '#666' }}>{vendor.address}</div>}
                    </td>
                    <td>
                      {vendor.contactName && <div>{vendor.contactName}</div>}
                      {vendor.contactPhone && <div style={{ fontSize: '0.85rem', color: '#666' }}>{formatPhone(vendor.contactPhone)}</div>}
                      {vendor.contactEmail && <div style={{ fontSize: '0.85rem', color: '#666' }}>{vendor.contactEmail}</div>}
                    </td>
                    <td>{vendor.accountNumber || <span style={{ color: '#999' }}>—</span>}</td>
                    <td>
                      {vendor.isActive ? (
                        <span style={{ color: '#2e7d32' }}>✓ Active</span>
                      ) : (
                        <span style={{ color: '#d32f2f' }}>Inactive</span>
                      )}
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: 4 }}>
                        <button className="btn btn-sm btn-outline" onClick={() => openVendorModal(vendor)}><Edit size={14} /></button>
                        {vendor.isActive ? (
                          <button className="btn btn-sm btn-danger" onClick={() => handleDeleteVendor(vendor)}><X size={14} /></button>
                        ) : (
                          <button className="btn btn-sm btn-success" onClick={() => handleReactivateVendor(vendor)}><Check size={14} /></button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* Client Modal */}
      {showModal && activeTab === 'clients' && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 600 }}>
            <div className="modal-header">
              <h3>{editing ? 'Edit Client' : 'Add Client'}</h3>
              <button className="btn btn-icon" onClick={() => setShowModal(false)}><X size={20} /></button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div className="form-group" style={{ gridColumn: 'span 2' }}>
                <label className="form-label">Client Name *</label>
                <input className="form-input" value={formData.name || ''} onChange={(e) => setFormData({ ...formData, name: e.target.value })} placeholder="Company or person name" />
              </div>
              <div className="form-group">
                <label className="form-label">Primary Contact</label>
                <input className="form-input" value={formData.contactName || ''} onChange={(e) => setFormData({ ...formData, contactName: e.target.value })} />
              </div>
              <div className="form-group">
                <label className="form-label">Primary Phone</label>
                <input className="form-input" value={formatPhone(formData.contactPhone || '')} onChange={(e) => setFormData({ ...formData, contactPhone: formatPhone(e.target.value) })} />
              </div>
              <div className="form-group" style={{ gridColumn: 'span 2' }}>
                <label className="form-label">Primary Email</label>
                <input className="form-input" type="email" value={formData.contactEmail || ''} onChange={(e) => setFormData({ ...formData, contactEmail: e.target.value })} />
              </div>

              {/* Additional Contacts (purchasing reps, etc.) */}
              <div style={{ gridColumn: 'span 2', borderTop: '1px solid #e0e0e0', paddingTop: 12, marginTop: 4 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                  <h4 style={{ margin: 0, color: '#1976d2', fontSize: '0.9rem' }}>👥 Additional Contacts</h4>
                  <button type="button" onClick={() => {
                    const contacts = [...(formData.contacts || []), { name: '', email: '', phone: '' }];
                    setFormData({ ...formData, contacts });
                  }} style={{ background: '#e3f2fd', border: '1px solid #90caf9', borderRadius: 4, padding: '4px 12px', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 600, color: '#1565c0' }}>
                    + Add Contact
                  </button>
                </div>
                {(formData.contacts || []).length === 0 && (
                  <div style={{ fontSize: '0.8rem', color: '#999', padding: 8, textAlign: 'center' }}>No additional contacts. Add purchasing reps here.</div>
                )}
                {(formData.contacts || []).map((contact, idx) => (
                  <div key={idx} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr auto', gap: 6, marginBottom: 6, padding: 8, background: '#f9f9f9', borderRadius: 6, border: '1px solid #eee' }}>
                    <input className="form-input" placeholder="Name" value={contact.name || ''} style={{ fontSize: '0.85rem' }}
                      onChange={(e) => { const c = [...(formData.contacts || [])]; c[idx] = { ...c[idx], name: e.target.value }; setFormData({ ...formData, contacts: c }); }} />
                    <input className="form-input" placeholder="Email" type="email" value={contact.email || ''} style={{ fontSize: '0.85rem' }}
                      onChange={(e) => { const c = [...(formData.contacts || [])]; c[idx] = { ...c[idx], email: e.target.value }; setFormData({ ...formData, contacts: c }); }} />
                    <input className="form-input" placeholder="Phone" value={formatPhone(contact.phone || '')} style={{ fontSize: '0.85rem' }}
                      onChange={(e) => { const c = [...(formData.contacts || [])]; c[idx] = { ...c[idx], phone: formatPhone(e.target.value) }; setFormData({ ...formData, contacts: c }); }} />
                    <button type="button" onClick={() => { const c = [...(formData.contacts || [])]; c.splice(idx, 1); setFormData({ ...formData, contacts: c }); }}
                      style={{ background: '#ffebee', border: '1px solid #ef9a9a', borderRadius: 4, padding: '4px 8px', cursor: 'pointer', alignSelf: 'center' }}>
                      <X size={14} color="#c62828" />
                    </button>
                  </div>
                ))}
              </div>
              <div className="form-group" style={{ gridColumn: 'span 2' }}>
                <label className="form-label">Address</label>
                <textarea className="form-textarea" value={formData.address || ''} onChange={(e) => setFormData({ ...formData, address: e.target.value })} rows={2} />
              </div>
              
              <div style={{ gridColumn: 'span 2', borderTop: '1px solid #e0e0e0', paddingTop: 12, marginTop: 8 }}>
                <h4 style={{ marginBottom: 12, color: '#1976d2' }}>💰 Tax Settings</h4>
              </div>
              
              <div className="form-group">
                <label className="form-label">Tax Status</label>
                <select className="form-select" value={formData.taxStatus || 'taxable'} onChange={(e) => setFormData({ ...formData, taxStatus: e.target.value })}>
                  <option value="taxable">Taxable</option>
                  <option value="resale">Resale (Tax Exempt)</option>
                  <option value="exempt">Tax Exempt (Other)</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Custom Tax Rate (%)</label>
                <input 
                  type="number" 
                  step="0.01" 
                  className="form-input" 
                  value={formData.customTaxRate ? (parseFloat(formData.customTaxRate) * 100).toFixed(2) : ''} 
                  onChange={(e) => setFormData({ ...formData, customTaxRate: e.target.value ? parseFloat(e.target.value) / 100 : '' })} 
                  placeholder="Leave blank for default (9.75%)"
                />
              </div>
              <div className="form-group">
                <label className="form-label">Payment Terms</label>
                <select className="form-select" value={formData.paymentTerms || ''} onChange={(e) => setFormData({ ...formData, paymentTerms: e.target.value })}>
                  <option value="">Not Set</option>
                  <option value="C.O.D.">C.O.D.</option>
                  <option value="1% 10 NET 30">1% 10 NET 30</option>
                  <option value="1% 10 DAYS NET 30">1% 10 DAYS NET 30</option>
                  <option value="1/2% 10 NET 30">1/2% 10 NET 30</option>
                  <option value="2% 10 DAYS NET 30">2% 10 DAYS NET 30</option>
                  <option value="10 DAYS">10 DAYS</option>
                  <option value="15 DAYS">15 DAYS</option>
                  <option value="NET 60 DAYS">NET 60 DAYS</option>
                </select>
              </div>
              <div className="form-group" style={{ gridColumn: 'span 2' }}>
                <label className="form-label">Accounts Payable Email <span style={{ fontWeight: 400, color: '#999', fontSize: '0.8rem' }}>(for sending invoices)</span></label>
                <input className="form-input" type="email" placeholder="ap@clientcompany.com"
                  value={formData.apEmail || ''} onChange={(e) => setFormData({ ...formData, apEmail: e.target.value })} />
              </div>
              <div className="form-group" style={{ gridColumn: 'span 2' }}>
                <label className="form-label">QuickBooks Desktop Name <span style={{ fontWeight: 400, color: '#999', fontSize: '0.8rem' }}>(must match QB exactly — used for IIF export)</span></label>
                <input className="form-input" placeholder="e.g. NOWELL STEEL AND SUPPLY"
                  value={formData.quickbooksName || ''} onChange={(e) => setFormData({ ...formData, quickbooksName: e.target.value.toUpperCase() })}
                  style={{ fontFamily: 'monospace', letterSpacing: 0.5 }} />
                {formData.quickbooksName && (
                  <div style={{ fontSize: '0.75rem', color: '#1565C0', marginTop: 4 }}>
                    📗 IIF exports will use: <strong>{formData.quickbooksName}</strong>
                  </div>
                )}
              </div>
              {formData.taxStatus === 'resale' && (
                <div className="form-group" style={{ gridColumn: 'span 2' }}>
                  <label className="form-label">Resale Certificate # <span style={{ fontWeight: 400, color: '#999', fontSize: '0.8rem' }}>(format: 123-456789)</span></label>
                  <input className="form-input" value={formData.resaleCertificate || ''} 
                    onChange={(e) => setFormData({ ...formData, resaleCertificate: formatResale(e.target.value) })}
                    placeholder="000-000000" maxLength={10}
                    style={{ fontFamily: 'monospace', fontSize: '1rem', letterSpacing: 1, borderColor: formData.resaleCertificate && !isValidResale(formData.resaleCertificate) ? '#e65100' : undefined }} />
                  {formData.resaleCertificate && !isValidResale(formData.resaleCertificate) && (
                    <div style={{ fontSize: '0.75rem', color: '#e65100', marginTop: 4 }}>
                      ⚠️ Must be 9 digits in format: 123-456789
                    </div>
                  )}
                </div>
              )}
              {formData.taxStatus === 'resale' && formData.resaleCertificate && (
                <div style={{ gridColumn: 'span 2', padding: 12, background: '#f5f5f5', borderRadius: 8, border: '1px solid #e0e0e0' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                    <div>
                      <div style={{ fontSize: '0.8rem', color: '#888', marginBottom: 2 }}>CDTFA Permit Status</div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        {formData.permitStatus === 'active' && <span style={{ padding: '2px 8px', borderRadius: 4, fontSize: '0.8rem', fontWeight: 700, background: '#e8f5e9', color: '#2e7d32', border: '1px solid #a5d6a7' }}>✅ Active</span>}
                        {formData.permitStatus === 'closed' && <span style={{ padding: '2px 8px', borderRadius: 4, fontSize: '0.8rem', fontWeight: 700, background: '#ffebee', color: '#c62828', border: '1px solid #ef9a9a' }}>❌ Closed</span>}
                        {formData.permitStatus === 'not_found' && <span style={{ padding: '2px 8px', borderRadius: 4, fontSize: '0.8rem', fontWeight: 700, background: '#ffebee', color: '#c62828', border: '1px solid #ef9a9a' }}>❌ Not Found</span>}
                        {formData.permitStatus === 'error' && <span style={{ padding: '2px 8px', borderRadius: 4, fontSize: '0.8rem', fontWeight: 700, background: '#fff3e0', color: '#e65100', border: '1px solid #ffcc80' }}>⚠️ Error</span>}
                        {formData.permitStatus === 'unknown' && <span style={{ padding: '2px 8px', borderRadius: 4, fontSize: '0.8rem', fontWeight: 700, background: '#fff3e0', color: '#e65100', border: '1px solid #ffcc80' }}>⚠️ Unknown</span>}
                        {(!formData.permitStatus || formData.permitStatus === 'unverified') && <span style={{ padding: '2px 8px', borderRadius: 4, fontSize: '0.8rem', fontWeight: 600, background: '#fff3e0', color: '#e65100', border: '1px solid #ffcc80' }}>Never verified</span>}
                        {formData.permitLastVerified && (
                          <span style={{ fontSize: '0.75rem', color: '#888' }}>
                            Last verified: {new Date(formData.permitLastVerified).toLocaleDateString()}
                          </span>
                        )}
                      </div>
                      {formData.permitRawResponse && (
                        <div style={{ fontSize: '0.75rem', color: '#666', marginTop: 4, fontStyle: 'italic' }}>
                          "{formData.permitRawResponse}"
                        </div>
                      )}
                      {(formData.permitOwnerName || formData.permitDbaName) && (
                        <div style={{ marginTop: 6 }}>
                          {formData.permitOwnerName && (
                            <div style={{ fontSize: '0.8rem', color: '#555' }}>
                              <strong>CDTFA Owner:</strong> {formData.permitOwnerName}
                            </div>
                          )}
                          {formData.permitDbaName && (
                            <div style={{ fontSize: '0.8rem', color: '#555', marginTop: 2 }}>
                              <strong>DBA:</strong> {formData.permitDbaName}
                            </div>
                          )}
                          {(() => {
                            const clean = (s) => (s || '').toLowerCase().replace(/\b(incorporated|inc|corporation|corp|company|co|limited|ltd|llc|llp|lp|plc|dba|the)\b/g, '').replace(/[^a-z0-9]/g, '');
                            const clientLower = clean(formData.name);
                            const ownerLower = clean(formData.permitOwnerName);
                            const dbaLower = clean(formData.permitDbaName);
                            if (!clientLower) return null;
                            const matchesOwner = ownerLower && (ownerLower.includes(clientLower) || clientLower.includes(ownerLower));
                            const matchesDba = dbaLower && (dbaLower.includes(clientLower) || clientLower.includes(dbaLower));
                            if (!matchesOwner && !matchesDba && (ownerLower || dbaLower)) {
                              return (
                                <div style={{ marginTop: 4, padding: '4px 8px', background: '#fff3e0', border: '1px solid #ffcc80', borderRadius: 4, fontSize: '0.75rem', color: '#e65100', fontWeight: 600 }}>
                                  ⚠️ Name mismatch — Client: "{formData.name}"{ownerLower ? ` vs Owner: "${formData.permitOwnerName}"` : ''}{dbaLower ? ` vs DBA: "${formData.permitDbaName}"` : ''}
                                </div>
                              );
                            }
                            return null;
                          })()}
                        </div>
                      )}
                    </div>
                    <button type="button" className="btn btn-sm" disabled={verifying || !isValidResale(formData.resaleCertificate)}
                      onClick={() => handleVerifyPermit(editing?.id, formData.resaleCertificate)}
                      style={{ padding: '6px 14px', background: (verifying || !isValidResale(formData.resaleCertificate)) ? '#bbb' : '#1565c0', color: '#fff', border: 'none', borderRadius: 6, fontWeight: 600, fontSize: '0.8rem', cursor: (verifying || !isValidResale(formData.resaleCertificate)) ? 'not-allowed' : 'pointer', whiteSpace: 'nowrap' }}>
                      {verifying ? '⏳ Verifying...' : '🔍 Verify Now'}
                    </button>
                  </div>
                  {/* DEBUG: Raw CDTFA fields — remove after fixing owner name */}
                  {formData._permitRawFields && Object.keys(formData._permitRawFields).length > 0 && (
                    <details style={{ marginTop: 8, fontSize: '0.7rem', color: '#888' }}>
                      <summary style={{ cursor: 'pointer', fontWeight: 600 }}>🔧 Debug: Raw CDTFA Fields (click to expand)</summary>
                      {formData._permitLabelMap && Object.keys(formData._permitLabelMap).length > 0 && (
                        <div style={{ background: '#e8f5e9', padding: 8, borderRadius: 4, marginTop: 4, marginBottom: 4 }}>
                          <strong>Label → Value Map:</strong>
                          <pre style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-all', margin: 0 }}>
                            {JSON.stringify(formData._permitLabelMap, null, 2)}
                          </pre>
                        </div>
                      )}
                      <pre style={{ background: '#f5f5f5', padding: 8, borderRadius: 4, maxHeight: 200, overflow: 'auto', whiteSpace: 'pre-wrap', wordBreak: 'break-all', marginTop: 4 }}>
                        {JSON.stringify(formData._permitRawFields, null, 2)}
                      </pre>
                    </details>
                  )}
                </div>
              )}
              <div className="form-group" style={{ gridColumn: 'span 2' }}>
                <label className="form-label">Notes</label>
                <textarea className="form-textarea" value={formData.notes || ''} onChange={(e) => setFormData({ ...formData, notes: e.target.value })} rows={2} />
              </div>

              <div style={{ gridColumn: 'span 2', borderTop: '1px solid #e0e0e0', paddingTop: 12, marginTop: 8 }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
                  <input type="checkbox" checked={formData.noTag || false} onChange={(e) => setFormData({ ...formData, noTag: e.target.checked })}
                    style={{ width: 18, height: 18, accentColor: '#e65100' }} />
                  <span style={{ fontWeight: 600, color: formData.noTag ? '#e65100' : '#333' }}>
                    🚫 No QR Tag — Do not place QR stickers on this client's material
                  </span>
                </label>
                {formData.noTag && (
                  <div style={{ marginTop: 8, padding: 10, background: '#fff3e0', borderRadius: 8, fontSize: '0.85rem', color: '#bf360c' }}>
                    When material is received for this client, the QR code print page will be skipped and a warning will be shown instead.
                  </div>
                )}
              </div>
              <div style={{ gridColumn: 'span 2', borderTop: '1px solid #e0e0e0', paddingTop: 12, marginTop: 8 }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
                  <input type="checkbox" checked={formData.requiresPartLabels || false} onChange={(e) => setFormData({ ...formData, requiresPartLabels: e.target.checked })}
                    style={{ width: 18, height: 18, accentColor: '#1565c0' }} />
                  <span style={{ fontWeight: 600, color: formData.requiresPartLabels ? '#1565c0' : '#333' }}>
                    🏷️ Part Info Labels — Print part info stickers (Part#, PO#, Heat#) on Android tablets
                  </span>
                </label>
                {formData.requiresPartLabels && (
                  <div style={{ marginTop: 8, padding: 10, background: '#e3f2fd', borderRadius: 8, fontSize: '0.85rem', color: '#0d47a1' }}>
                    A "Print Label" button will appear next to each part on the Android tablet. Labels include client part number, purchase order number, and heat number.
                  </div>
                )}
              </div>

              {/* Email Scanning */}
              <div style={{ gridColumn: 'span 2', borderTop: '1px solid #eee', paddingTop: 12 }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', marginBottom: 8 }}>
                  <input type="checkbox" checked={formData.emailScanEnabled || false} onChange={(e) => setFormData({ ...formData, emailScanEnabled: e.target.checked })}
                    style={{ width: 18, height: 18, accentColor: '#E65100' }} />
                  <span style={{ fontWeight: 600, color: formData.emailScanEnabled ? '#E65100' : '#333' }}>
                    📧 Email Scanning — Auto-detect RFQs and POs from this client's emails
                  </span>
                </label>
                {formData.emailScanEnabled && (
                  <div style={{ padding: 12, background: '#FFF3E0', borderRadius: 8, marginTop: 4 }}>
                    <div className="form-group" style={{ marginBottom: 10 }}>
                      <label className="form-label" style={{ fontSize: '0.85rem', fontWeight: 600 }}>Email addresses to scan</label>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                        {(formData.emailScanAddresses || []).map((addr, i) => (
                          <div key={i} style={{ display: 'flex', gap: 6 }}>
                            <input className="form-input" value={addr} placeholder="email@company.com"
                              onChange={(e) => {
                                const addrs = [...(formData.emailScanAddresses || [])];
                                addrs[i] = e.target.value;
                                setFormData({ ...formData, emailScanAddresses: addrs });
                              }} style={{ flex: 1 }} />
                            <button className="btn btn-sm" onClick={() => {
                              const addrs = (formData.emailScanAddresses || []).filter((_, j) => j !== i);
                              setFormData({ ...formData, emailScanAddresses: addrs });
                            }} style={{ color: '#c62828', background: 'none', border: '1px solid #c62828', padding: '4px 8px' }}>✕</button>
                          </div>
                        ))}
                        <button className="btn btn-sm btn-outline" onClick={() => {
                          setFormData({ ...formData, emailScanAddresses: [...(formData.emailScanAddresses || []), ''] });
                        }} style={{ alignSelf: 'flex-start', fontSize: '0.8rem' }}>+ Add Email</button>
                      </div>
                    </div>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label className="form-label" style={{ fontSize: '0.85rem', fontWeight: 600 }}>Parsing Notes <span style={{ fontWeight: 400, color: '#888' }}>(helps the AI understand this client's email format)</span></label>
                      <textarea className="form-input" rows={2} value={formData.emailScanParsingNotes || ''}
                        onChange={(e) => setFormData({ ...formData, emailScanParsingNotes: e.target.value })}
                        placeholder='e.g. "OR numbers are their reference numbers, use as estimate number" or "Ted uses shorthand — cone means cone_roll"' />
                    </div>
                  </div>
                )}
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={handleSaveClient} disabled={saving}>
                {saving ? 'Saving...' : (editing ? 'Update Client' : 'Add Client')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Vendor Modal */}
      {showModal && activeTab === 'vendors' && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 600 }}>
            <div className="modal-header">
              <h3>{editing ? 'Edit Vendor' : 'Add Vendor'}</h3>
              <button className="btn btn-icon" onClick={() => setShowModal(false)}><X size={20} /></button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div className="form-group" style={{ gridColumn: 'span 2' }}>
                <label className="form-label">Vendor Name *</label>
                <input className="form-input" value={formData.name || ''} onChange={(e) => setFormData({ ...formData, name: e.target.value })} placeholder="Company name" />
              </div>
              <div className="form-group">
                <label className="form-label">Contact Name</label>
                <input className="form-input" value={formData.contactName || ''} onChange={(e) => setFormData({ ...formData, contactName: e.target.value })} />
              </div>
              <div className="form-group">
                <label className="form-label">Phone</label>
                <input className="form-input" value={formatPhone(formData.contactPhone || '')} onChange={(e) => setFormData({ ...formData, contactPhone: formatPhone(e.target.value) })} />
              </div>
              <div className="form-group" style={{ gridColumn: 'span 2' }}>
                <label className="form-label">Email</label>
                <input className="form-input" type="email" value={formData.contactEmail || ''} onChange={(e) => setFormData({ ...formData, contactEmail: e.target.value })} />
              </div>
              <div className="form-group" style={{ gridColumn: 'span 2' }}>
                <label className="form-label">Address</label>
                <textarea className="form-textarea" value={formData.address || ''} onChange={(e) => setFormData({ ...formData, address: e.target.value })} rows={2} />
              </div>
              <div className="form-group">
                <label className="form-label">Account Number</label>
                <input className="form-input" value={formData.accountNumber || ''} onChange={(e) => setFormData({ ...formData, accountNumber: e.target.value })} placeholder="Your account # with vendor" />
              </div>
              <div className="form-group" style={{ gridColumn: 'span 2' }}>
                <label className="form-label">Notes</label>
                <textarea className="form-textarea" value={formData.notes || ''} onChange={(e) => setFormData({ ...formData, notes: e.target.value })} rows={2} />
              </div>
              
              {/* Email Scanning */}
              <div style={{ gridColumn: 'span 2', borderTop: '1px solid #eee', paddingTop: 12 }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', marginBottom: 8 }}>
                  <input type="checkbox" checked={formData.emailScanEnabled || false} onChange={(e) => setFormData({ ...formData, emailScanEnabled: e.target.checked })}
                    style={{ width: 18, height: 18, accentColor: '#7B1FA2' }} />
                  <span style={{ fontWeight: 600, color: formData.emailScanEnabled ? '#7B1FA2' : '#333' }}>
                    📧 Monitor Vendor Emails — Auto-detect RFQ responses and quotes
                  </span>
                </label>
                {formData.emailScanEnabled && (
                  <div style={{ padding: 12, background: '#F3E5F5', borderRadius: 8, marginTop: 4 }}>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label className="form-label" style={{ fontSize: '0.85rem', fontWeight: 600 }}>Additional email addresses to monitor</label>
                      <p style={{ fontSize: '0.75rem', color: '#888', marginBottom: 6 }}>The primary email above is always monitored. Add more addresses here.</p>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                        {(formData.emailScanAddresses || []).map((addr, i) => (
                          <div key={i} style={{ display: 'flex', gap: 6 }}>
                            <input className="form-input" value={addr} placeholder="sales@vendor.com"
                              onChange={(e) => {
                                const addrs = [...(formData.emailScanAddresses || [])];
                                addrs[i] = e.target.value;
                                setFormData({ ...formData, emailScanAddresses: addrs });
                              }} style={{ flex: 1 }} />
                            <button className="btn btn-sm" onClick={() => {
                              const addrs = (formData.emailScanAddresses || []).filter((_, j) => j !== i);
                              setFormData({ ...formData, emailScanAddresses: addrs });
                            }} style={{ color: '#c62828', background: 'none', border: '1px solid #c62828', padding: '4px 8px' }}>✕</button>
                          </div>
                        ))}
                        <button className="btn btn-sm btn-outline" onClick={() => {
                          setFormData({ ...formData, emailScanAddresses: [...(formData.emailScanAddresses || []), ''] });
                        }} style={{ alignSelf: 'flex-start', fontSize: '0.8rem' }}>+ Add Email</button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={handleSaveVendor} disabled={saving}>
                {saving ? 'Saving...' : (editing ? 'Update Vendor' : 'Add Vendor')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Permits Tab */}
      {activeTab === 'permits' && (
        <div>
          <div className="card">
            <h3 style={{ marginBottom: 16 }}>🔐 CDTFA Seller's Permit Status</h3>
            <p style={{ color: '#666', marginBottom: 16, fontSize: '0.9rem' }}>
              Shows permit verification status for clients with resale certificates on file. 
              Permits are automatically verified annually on January 2nd.
            </p>

            {/* Action buttons */}
            <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
              <button className="btn btn-primary" onClick={async () => {
                try {
                  setSuccess(''); setError('');
                  setSuccess('Starting batch verification — this may take a few minutes...');
                  const res = await startBatchVerification();
                  setSuccess(res.data?.message || 'Batch verification started');
                  // Poll for completion
                  const poll = setInterval(async () => {
                    try {
                      const status = await getBatchStatus();
                      if (status.data?.data?.status === 'complete' || status.data?.data?.status === 'idle') {
                        clearInterval(poll);
                        loadData();
                        setSuccess(`Verification complete — ${status.data?.data?.results?.active || 0} active, ${status.data?.data?.results?.closed || 0} closed, ${status.data?.data?.results?.failed || 0} failed`);
                      }
                    } catch (e) { clearInterval(poll); }
                  }, 5000);
                } catch (err) {
                  setError('Failed to start verification: ' + (err.response?.data?.error?.message || err.message));
                }
              }} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                🔄 Verify All Clients Now
              </button>

              <button className="btn btn-outline" onClick={async () => {
                try {
                  setSuccess('Generating report...');
                  const res = await downloadResaleReport();
                  const blob = new Blob([res.data], { type: 'application/pdf' });
                  const url = window.URL.createObjectURL(blob);
                  window.open(url, '_blank');
                  setSuccess('Report generated');
                } catch (err) {
                  setError('Failed to generate report: ' + (err.response?.data?.error?.message || err.message));
                }
              }} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                📄 Download Verification Report PDF
              </button>
            </div>

            {/* Annual cron info */}
            <div style={{ padding: 12, background: '#f0f7ff', border: '1px solid #bbdefb', borderRadius: 8, marginBottom: 16, fontSize: '0.85rem' }}>
              <strong>📅 Annual Verification Schedule</strong>
              <p style={{ margin: '6px 0 0', color: '#555' }}>
                All client resale certificates are automatically verified against the CDTFA database every <strong>January 2nd at 3:00 AM Pacific</strong>. 
                The system checks each permit number, records the status (Active/Closed), the registered owner name, and flags any name mismatches. 
                Use the "Verify All" button above to run this check manually at any time.
              </p>
            </div>

            {/* Client permit table */}
            {(() => {
              const clientsWithPermits = clients.filter(c => c.resaleCertificate);
              if (clientsWithPermits.length === 0) {
                return <p style={{ color: '#999', fontStyle: 'italic' }}>No clients have resale certificates on file.</p>;
              }
              return (
                <table className="table">
                  <thead>
                    <tr>
                      <th>Client</th>
                      <th>Permit #</th>
                      <th>Status</th>
                      <th>CDTFA Owner</th>
                      <th>Last Verified</th>
                      <th>Warnings</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {clientsWithPermits.map(c => {
                      const clean = (s) => (s || '').toLowerCase().replace(/\b(incorporated|inc|corporation|corp|company|co|limited|ltd|llc|llp|lp|plc|dba|the)\b/g, '').replace(/[^a-z0-9]/g, '');
                      const clientClean = clean(c.name);
                      const ownerClean = clean(c.permitOwnerName);
                      const dbaClean = clean(c.permitDbaName);
                      const matchesOwner = ownerClean && (ownerClean.includes(clientClean) || clientClean.includes(ownerClean));
                      const matchesDba = dbaClean && (dbaClean.includes(clientClean) || clientClean.includes(dbaClean));
                      const nameMismatch = clientClean && (ownerClean || dbaClean) && !matchesOwner && !matchesDba;
                      return (
                        <tr key={c.id} style={nameMismatch ? { background: '#fff8e1' } : {}}>
                          <td style={{ fontWeight: 600 }}>{c.name}</td>
                          <td style={{ fontFamily: 'monospace' }}>{c.resaleCertificate}</td>
                          <td>
                            <span style={{
                              padding: '3px 10px', borderRadius: 12, fontSize: '0.75rem', fontWeight: 600,
                              background: c.permitStatus === 'Active' || c.permitStatus === 'active' ? '#e8f5e9' : c.permitStatus === 'Closed' || c.permitStatus === 'closed' ? '#ffebee' : '#f5f5f5',
                              color: c.permitStatus === 'Active' || c.permitStatus === 'active' ? '#2e7d32' : c.permitStatus === 'Closed' || c.permitStatus === 'closed' ? '#c62828' : '#666'
                            }}>
                              {c.permitStatus || 'Not Verified'}
                            </span>
                          </td>
                          <td style={{ fontSize: '0.85rem', color: '#555' }}>
                            {c.permitOwnerName || '—'}
                            {c.permitDbaName && <div style={{ fontSize: '0.75rem', color: '#888' }}>DBA: {c.permitDbaName}</div>}
                          </td>
                          <td style={{ fontSize: '0.85rem', color: '#666' }}>
                            {c.permitLastVerified ? new Date(c.permitLastVerified).toLocaleDateString() : 'Never'}
                          </td>
                          <td>
                            {nameMismatch && (
                              <span style={{ fontSize: '0.75rem', color: '#e65100', fontWeight: 600 }}>⚠️ Name mismatch</span>
                            )}
                          </td>
                          <td>
                            <button className="btn btn-sm btn-outline" onClick={async () => {
                              try {
                                setSuccess(''); setError('');
                                const res = await verifySinglePermit({ clientId: c.id, permitNumber: c.resaleCertificate });
                                const result = res.data?.data;
                                if (result?.status) {
                                  setSuccess(`${c.name}: Permit is ${result.status}`);
                                }
                                loadData();
                              } catch (err) {
                                setError(`Verification failed for ${c.name}: ${err.response?.data?.error?.message || err.message}`);
                              }
                            }} style={{ padding: '4px 12px', fontSize: '0.8rem' }}>
                              Verify
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              );
            })()}
          </div>
        </div>
      )}
    </div>
  );
};

export default ClientsVendorsPage;
