import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Users, Activity, Plus, Trash2, Edit, Save, X, 
  Shield, User, Clock, ChevronLeft, ChevronRight, Key, Check, AlertTriangle, RefreshCw,
  Mail, Send, DollarSign
} from 'lucide-react';
import { getUsers, createUser, updateUser, deleteUser, getActivityLogs, getScheduleEmailSettings, updateScheduleEmailSettings, sendScheduleEmailNow, getSettings, updateSettings, startBatchVerification, getBatchStatus, downloadResaleReport } from '../services/api';
import { useAuth } from '../context/AuthContext';

// Global error log for NAS uploads
window.nasErrorLog = window.nasErrorLog || [];

export const logNasError = (error, details = {}) => {
  const entry = {
    timestamp: new Date().toISOString(),
    error: error.message || error,
    details: details,
    type: 'NAS_UPLOAD_ERROR'
  };
  window.nasErrorLog.unshift(entry);
  // Keep only last 50 errors
  if (window.nasErrorLog.length > 50) {
    window.nasErrorLog = window.nasErrorLog.slice(0, 50);
  }
  console.error('NAS Error logged:', entry);
};

function AdminPage() {
  const navigate = useNavigate();
  const { user: currentUser, isAdmin } = useAuth();
  const [activeTab, setActiveTab] = useState('tax');
  const [users, setUsers] = useState([]);
  const [logs, setLogs] = useState([]);
  const [logsTotal, setLogsTotal] = useState(0);
  const [logsPage, setLogsPage] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [systemLogs, setSystemLogs] = useState([]);
  
  // New user modal
  const [showNewUserModal, setShowNewUserModal] = useState(false);
  const [newUser, setNewUser] = useState({ username: '', password: '', role: 'user' });
  const [saving, setSaving] = useState(false);
  
  // Edit user modal
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [editData, setEditData] = useState({ username: '', role: 'user' });
  
  // Reset password modal
  const [showResetPasswordModal, setShowResetPasswordModal] = useState(false);
  const [resetPasswordUser, setResetPasswordUser] = useState(null);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  
  // Schedule email settings
  const [scheduleEmail, setScheduleEmail] = useState('carolinarolling@gmail.com');
  const [scheduleEmailEnabled, setScheduleEmailEnabled] = useState(true);
  const [scheduleEmailSaving, setScheduleEmailSaving] = useState(false);
  const [scheduleEmailSending, setScheduleEmailSending] = useState(false);
  
  // Tax settings
  const [taxSettings, setTaxSettings] = useState({
    defaultTaxRate: 9.75,
    defaultLaborRate: 125,
    defaultMaterialMarkup: 20
  });
  const [taxSettingsSaving, setTaxSettingsSaving] = useState(false);

  // Labor minimums
  const [laborMinimums, setLaborMinimums] = useState([]);
  const [laborMinSaving, setLaborMinSaving] = useState(false);

  // Roll limits (min rollable diameter per size/material)
  const [rollLimits, setRollLimits] = useState([]);
  const [rollLimitsSaving, setRollLimitsSaving] = useState(false);

  // Mandrel dies
  const [mandrelDies, setMandrelDies] = useState([]);
  const [mandrelDiesSaving, setMandrelDiesSaving] = useState(false);

  // Material grades
  const [materialGrades, setMaterialGrades] = useState([]);
  const [materialGradesSaving, setMaterialGradesSaving] = useState(false);

  // Weld rates
  const [weldRates, setWeldRates] = useState([{ grade: 'A36', rate: '' }, { grade: '304 S/S', rate: '' }, { grade: '316 S/S', rate: '' }]);
  const [weldDefaultRate, setWeldDefaultRate] = useState('');
  const [weldRatesSaving, setWeldRatesSaving] = useState(false);

  // Permit verification batch
  const [batchStatus, setBatchStatus] = useState(null);
  const [batchPolling, setBatchPolling] = useState(false);

  useEffect(() => {
    if (!isAdmin()) {
      navigate('/inventory');
      return;
    }
    
    if (activeTab === 'users') {
      loadUsers();
    } else if (activeTab === 'logs') {
      loadLogs();
    } else if (activeTab === 'schedule') {
      loadScheduleEmailSettings();
    } else if (activeTab === 'tax') {
      loadTaxSettings();
    } else if (activeTab === 'minimums') {
      loadLaborMinimums();
    } else if (activeTab === 'rolllimits') {
      loadRollLimits();
    } else if (activeTab === 'mandreldies') {
      loadMandrelDies();
    } else if (activeTab === 'grades') {
      loadMaterialGrades();
    } else if (activeTab === 'weldrates') {
      loadWeldRates();
    } else if (activeTab === 'system') {
      setSystemLogs([...window.nasErrorLog]);
      setLoading(false);
    } else if (activeTab === 'permits') {
      loadBatchStatus();
    }
  }, [activeTab, logsPage]);

  const loadTaxSettings = async () => {
    try {
      setLoading(true);
      const response = await getSettings('tax_settings');
      if (response.data.data?.value) {
        setTaxSettings(response.data.data.value);
      }
    } catch (err) {
      // Settings may not exist yet, use defaults
      console.log('Using default tax settings');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveTaxSettings = async () => {
    try {
      setTaxSettingsSaving(true);
      setError(null);
      await updateSettings('tax_settings', taxSettings);
      setSuccess('Tax settings saved successfully');
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError('Failed to save tax settings');
    } finally {
      setTaxSettingsSaving(false);
    }
  };

  const loadLaborMinimums = async () => {
    try {
      setLoading(true);
      const response = await getSettings('labor_minimums');
      if (response.data.data?.value) {
        setLaborMinimums(response.data.data.value);
      } else {
        // Default minimums
        setLaborMinimums([
          { partType: 'plate_roll', label: 'Plate ≤ 3/8"', sizeField: 'thickness', maxSize: '0.375', minWidth: '', maxWidth: '', minimum: 125 },
          { partType: 'plate_roll', label: 'Plate ≤ 3/8" (24-60" wide)', sizeField: 'thickness', maxSize: '0.375', minWidth: '24', maxWidth: '60', minimum: 150 },
          { partType: 'plate_roll', label: 'Plate > 3/8"', sizeField: 'thickness', minSize: '0.376', minWidth: '', maxWidth: '', minimum: 200 },
          { partType: 'angle_roll', label: 'Angle ≤ 2x2', sizeField: 'angleSize', maxSize: '2', minWidth: '', maxWidth: '', minimum: 150 },
          { partType: 'angle_roll', label: 'Angle > 2x2', sizeField: 'angleSize', minSize: '2.01', minWidth: '', maxWidth: '', minimum: 250 },
        ]);
      }
    } catch (err) {
      setLaborMinimums([
        { partType: 'plate_roll', label: 'Plate ≤ 3/8"', sizeField: 'thickness', maxSize: '0.375', minWidth: '', maxWidth: '', minimum: 125 },
        { partType: 'plate_roll', label: 'Plate ≤ 3/8" (24-60" wide)', sizeField: 'thickness', maxSize: '0.375', minWidth: '24', maxWidth: '60', minimum: 150 },
        { partType: 'plate_roll', label: 'Plate > 3/8"', sizeField: 'thickness', minSize: '0.376', minWidth: '', maxWidth: '', minimum: 200 },
        { partType: 'angle_roll', label: 'Angle ≤ 2x2', sizeField: 'angleSize', maxSize: '2', minWidth: '', maxWidth: '', minimum: 150 },
        { partType: 'angle_roll', label: 'Angle > 2x2', sizeField: 'angleSize', minSize: '2.01', minWidth: '', maxWidth: '', minimum: 250 },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveLaborMinimums = async () => {
    try {
      setLaborMinSaving(true);
      setError(null);
      await updateSettings('labor_minimums', laborMinimums);
      setSuccess('Labor minimums saved successfully');
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError('Failed to save labor minimums');
    } finally {
      setLaborMinSaving(false);
    }
  };

  const addLaborMinimum = () => {
    setLaborMinimums([...laborMinimums, { partType: 'plate_roll', label: '', sizeField: 'thickness', minSize: '', maxSize: '', minWidth: '', maxWidth: '', minimum: 0 }]);
  };

  const updateLaborMinimum = (index, field, value) => {
    const updated = [...laborMinimums];
    updated[index] = { ...updated[index], [field]: value };
    setLaborMinimums(updated);
  };

  const removeLaborMinimum = (index) => {
    setLaborMinimums(laborMinimums.filter((_, i) => i !== index));
  };

  // ── ROLL LIMITS ──
  const defaultRollLimits = [
    { od: '0.625', materialCategory: 'steel', minDiameter: '6', label: '.625" Tube Steel' },
    { od: '0.75', materialCategory: 'steel', minDiameter: '7', label: '.75" Tube Steel' },
    { od: '1', materialCategory: 'steel', minDiameter: '8', label: '1" Tube Steel' },
    { od: '1.25', materialCategory: 'steel', minDiameter: '10', label: '1.25" Tube Steel' },
    { od: '1.5', materialCategory: 'steel', minDiameter: '12', label: '1.5" Tube Steel' },
    { od: '2', materialCategory: 'steel', minDiameter: '16', label: '2" Tube/Pipe Steel' },
    { od: '3', materialCategory: 'steel', minDiameter: '24', label: '3" Tube/Pipe Steel' },
    { od: '4', materialCategory: 'steel', minDiameter: '32', label: '4" Tube/Pipe Steel' },
    { od: '1', materialCategory: 'aluminum', minDiameter: '12', label: '1" Tube Aluminum' },
    { od: '1.5', materialCategory: 'aluminum', minDiameter: '18', label: '1.5" Tube Aluminum' },
    { od: '2', materialCategory: 'aluminum', minDiameter: '24', label: '2" Tube/Pipe Aluminum' },
  ];

  const loadRollLimits = async () => {
    try {
      setLoading(true);
      const resp = await getSettings('roll_limits');
      if (resp.data.data?.value && Array.isArray(resp.data.data.value) && resp.data.data.value.length > 0) {
        setRollLimits(resp.data.data.value);
      } else {
        setRollLimits(defaultRollLimits);
      }
    } catch {
      setRollLimits(defaultRollLimits);
    } finally { setLoading(false); }
  };

  const handleSaveRollLimits = async () => {
    try {
      setRollLimitsSaving(true); setError(null);
      await updateSettings('roll_limits', rollLimits);
      setSuccess('Roll limits saved'); setTimeout(() => setSuccess(null), 3000);
    } catch { setError('Failed to save roll limits'); }
    finally { setRollLimitsSaving(false); }
  };

  // ── MANDREL DIES ──
  const loadMandrelDies = async () => {
    try {
      setLoading(true);
      const resp = await getSettings('mandrel_dies');
      if (resp.data.data?.value && Array.isArray(resp.data.data.value)) {
        setMandrelDies(resp.data.data.value);
      } else {
        setMandrelDies([]);
      }
    } catch { setMandrelDies([]); }
    finally { setLoading(false); }
  };

  const handleSaveMandrelDies = async () => {
    try {
      setMandrelDiesSaving(true); setError(null);
      await updateSettings('mandrel_dies', mandrelDies);
      setSuccess('Mandrel dies saved'); setTimeout(() => setSuccess(null), 3000);
    } catch { setError('Failed to save mandrel dies'); }
    finally { setMandrelDiesSaving(false); }
  };

  // ── MATERIAL GRADES ──
  const defaultMaterialGrades = [
    { name: 'A36', partTypes: ['plate_roll', 'flat_stock'], yieldStrength: '36,000', tensileStrength: '58,000-80,000' },
    { name: 'A500 Gr B', partTypes: ['pipe_roll', 'tube_roll'], yieldStrength: '42,000', tensileStrength: '58,000' },
    { name: 'A513', partTypes: ['pipe_roll', 'tube_roll'], yieldStrength: '32,000', tensileStrength: '48,000' },
    { name: 'DOM', partTypes: ['pipe_roll', 'tube_roll'], yieldStrength: '70,000', tensileStrength: '80,000' },
    { name: 'A572 Gr 50', partTypes: ['plate_roll', 'beam_roll', 'channel_roll'], yieldStrength: '50,000', tensileStrength: '65,000' },
    { name: '304 S/S', partTypes: ['plate_roll', 'pipe_roll', 'tube_roll', 'angle_roll', 'flat_stock'], yieldStrength: '30,000', tensileStrength: '75,000' },
    { name: '316 S/S', partTypes: ['plate_roll', 'pipe_roll', 'tube_roll', 'angle_roll', 'flat_stock'], yieldStrength: '30,000', tensileStrength: '75,000' },
    { name: 'AR400', partTypes: ['plate_roll'], yieldStrength: '100,000', tensileStrength: '120,000' },
    { name: '6061-T6 Alum', partTypes: ['plate_roll', 'pipe_roll', 'tube_roll', 'angle_roll'], yieldStrength: '40,000', tensileStrength: '45,000' },
    { name: '5052 Alum', partTypes: ['plate_roll', 'pipe_roll', 'tube_roll'], yieldStrength: '28,000', tensileStrength: '33,000' },
    { name: '6063-T6 Alum', partTypes: ['pipe_roll', 'tube_roll'], yieldStrength: '25,000', tensileStrength: '30,000' },
  ];

  const loadMaterialGrades = async () => {
    try {
      setLoading(true);
      const resp = await getSettings('material_grades');
      if (resp.data.data?.value && Array.isArray(resp.data.data.value) && resp.data.data.value.length > 0) {
        setMaterialGrades(resp.data.data.value);
      } else {
        setMaterialGrades(defaultMaterialGrades);
      }
    } catch { setMaterialGrades(defaultMaterialGrades); }
    finally { setLoading(false); }
  };

  const handleSaveMaterialGrades = async () => {
    try {
      setMaterialGradesSaving(true); setError(null);
      await updateSettings('material_grades', materialGrades);
      setSuccess('Material grades saved'); setTimeout(() => setSuccess(null), 3000);
    } catch { setError('Failed to save material grades'); }
    finally { setMaterialGradesSaving(false); }
  };

  const loadWeldRates = async () => {
    try {
      setLoading(true);
      const resp = await getSettings('weld_rates');
      if (resp.data.data?.value) {
        const val = resp.data.data.value;
        // Convert from { grade: rate, ... } to array format
        const defaultRate = val['default'] || '';
        const entries = Object.entries(val).filter(([k]) => k !== 'default').map(([grade, rate]) => ({ grade, rate: rate.toString() }));
        if (entries.length > 0) setWeldRates(entries);
        setWeldDefaultRate(defaultRate.toString());
      }
    } catch {}
    finally { setLoading(false); }
  };

  const handleSaveWeldRates = async () => {
    try {
      setWeldRatesSaving(true); setError(null);
      const rateObj = {};
      weldRates.forEach(r => { if (r.grade && r.rate) rateObj[r.grade] = parseFloat(r.rate); });
      if (weldDefaultRate) rateObj['default'] = parseFloat(weldDefaultRate);
      await updateSettings('weld_rates', rateObj);
      setSuccess('Weld rates saved'); setTimeout(() => setSuccess(null), 3000);
    } catch { setError('Failed to save weld rates'); }
    finally { setWeldRatesSaving(false); }
  };

  const loadBatchStatus = async () => {
    try {
      setLoading(true);
      const res = await getBatchStatus();
      setBatchStatus(res.data?.data || null);
      // If running, start polling
      if (res.data?.data?.status === 'running') {
        startBatchPolling();
      }
    } catch (err) {
      console.error('Failed to load batch status:', err);
    } finally {
      setLoading(false);
    }
  };

  const startBatchPolling = () => {
    if (batchPolling) return;
    setBatchPolling(true);
    const interval = setInterval(async () => {
      try {
        const res = await getBatchStatus();
        const data = res.data?.data;
        setBatchStatus(data);
        if (data?.status !== 'running') {
          clearInterval(interval);
          setBatchPolling(false);
        }
      } catch {
        clearInterval(interval);
        setBatchPolling(false);
      }
    }, 5000); // Poll every 5 seconds
  };

  const handleStartBatch = async () => {
    if (!window.confirm('Start batch verification of all client seller\'s permits? This may take several minutes (1 minute per client).')) return;
    try {
      setError(null);
      const res = await startBatchVerification();
      setBatchStatus({ status: 'running', total: res.data?.data?.total || 0, completed: 0, results: [] });
      setSuccess(res.data?.message || 'Batch started');
      setTimeout(() => setSuccess(null), 3000);
      startBatchPolling();
    } catch (err) {
      setError('Failed to start batch: ' + (err.response?.data?.error?.message || err.message));
    }
  };

  const loadScheduleEmailSettings = async () => {
    try {
      setLoading(true);
      const response = await getScheduleEmailSettings();
      const data = response.data.data;
      setScheduleEmail(data.email || 'carolinarolling@gmail.com');
      setScheduleEmailEnabled(data.enabled !== false);
    } catch (err) {
      console.error('Failed to load schedule email settings:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveScheduleEmail = async () => {
    try {
      setScheduleEmailSaving(true);
      setError(null);
      await updateScheduleEmailSettings(scheduleEmail, scheduleEmailEnabled);
      setSuccess('Schedule email settings saved successfully');
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError(err.response?.data?.error?.message || 'Failed to save settings');
    } finally {
      setScheduleEmailSaving(false);
    }
  };

  const handleSendTestEmail = async () => {
    try {
      setScheduleEmailSending(true);
      setError(null);
      const response = await sendScheduleEmailNow();
      if (response.data.success) {
        setSuccess(response.data.message || 'Schedule email sent successfully');
      } else {
        setError(response.data.message || 'Failed to send email');
      }
      setTimeout(() => setSuccess(null), 5000);
    } catch (err) {
      setError(err.response?.data?.error?.message || 'Failed to send email. Make sure SMTP is configured.');
    } finally {
      setScheduleEmailSending(false);
    }
  };

  const refreshSystemLogs = () => {
    setSystemLogs([...window.nasErrorLog]);
  };

  const clearSystemLogs = () => {
    window.nasErrorLog = [];
    setSystemLogs([]);
  };

  const loadUsers = async () => {
    try {
      setLoading(true);
      const response = await getUsers();
      setUsers(response.data.data || []);
    } catch (err) {
      setError('Failed to load users');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const loadLogs = async () => {
    try {
      setLoading(true);
      const response = await getActivityLogs(50, logsPage * 50);
      setLogs(response.data.data || []);
      setLogsTotal(response.data.total || 0);
    } catch (err) {
      setError('Failed to load activity logs');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateUser = async (e) => {
    e.preventDefault();
    if (!newUser.username || !newUser.password) {
      setError('Username and password are required');
      return;
    }

    try {
      setSaving(true);
      await createUser(newUser);
      await loadUsers();
      setShowNewUserModal(false);
      setNewUser({ username: '', password: '', role: 'user' });
      setSuccess('User created successfully');
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError(err.response?.data?.error?.message || 'Failed to create user');
    } finally {
      setSaving(false);
    }
  };

  const openEditModal = (user) => {
    setEditingUser(user);
    setEditData({ username: user.username, role: user.role });
    setShowEditModal(true);
    setError(null);
  };

  const handleUpdateUser = async (e) => {
    e.preventDefault();
    if (!editData.username) {
      setError('Username is required');
      return;
    }

    try {
      setSaving(true);
      await updateUser(editingUser.id, editData);
      await loadUsers();
      setShowEditModal(false);
      setEditingUser(null);
      setSuccess('User updated successfully');
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError(err.response?.data?.error?.message || 'Failed to update user');
    } finally {
      setSaving(false);
    }
  };

  const openResetPasswordModal = (user) => {
    setResetPasswordUser(user);
    setNewPassword('');
    setConfirmPassword('');
    setShowResetPasswordModal(true);
    setError(null);
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();
    if (!newPassword) {
      setError('Password is required');
      return;
    }
    if (newPassword.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    try {
      setSaving(true);
      await updateUser(resetPasswordUser.id, { password: newPassword });
      await loadUsers();
      setShowResetPasswordModal(false);
      setResetPasswordUser(null);
      setNewPassword('');
      setConfirmPassword('');
      setSuccess(`Password reset for ${resetPasswordUser.username}`);
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError(err.response?.data?.error?.message || 'Failed to reset password');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteUser = async (userId) => {
    if (!window.confirm('Are you sure you want to delete this user?')) return;
    
    try {
      await deleteUser(userId);
      await loadUsers();
      setSuccess('User deleted successfully');
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError(err.response?.data?.error?.message || 'Failed to delete user');
    }
  };

  const handleToggleActive = async (user) => {
    try {
      await updateUser(user.id, { isActive: !user.isActive });
      await loadUsers();
      setSuccess(`User ${user.isActive ? 'disabled' : 'enabled'} successfully`);
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError('Failed to update user');
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit'
    });
  };

  const getActionColor = (action) => {
    if (action.includes('LOGIN_SUCCESS')) return '#2e7d32';
    if (action.includes('LOGIN_FAILED')) return '#d32f2f';
    if (action.includes('CREATED')) return '#1976d2';
    if (action.includes('DELETED')) return '#d32f2f';
    if (action.includes('UPDATED')) return '#e65100';
    return '#666';
  };

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Admin Panel</h1>
      </div>

      {error && <div className="alert alert-error">{error}</div>}
      {success && <div className="alert alert-success">{success}</div>}

      {/* Quick Links */}
      <div className="card" style={{ marginBottom: 16 }}>
        <h3 style={{ marginBottom: 12 }}>Quick Links</h3>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button className="btn btn-outline" onClick={() => navigate('/admin/clients-vendors')}>
            👥 Clients & Vendors
          </button>
          <button className="btn btn-outline" onClick={() => navigate('/admin/dr-numbers')}>
            📋 DR Numbers
          </button>
          <button className="btn btn-outline" onClick={() => navigate('/admin/po-numbers')}>
            🔢 PO Numbers
          </button>
          <button className="btn btn-outline" onClick={() => navigate('/admin/email')}>
            📧 Email Settings
          </button>
          <button className="btn btn-outline" onClick={() => navigate('/admin/shipments')}>
            📦 Shipments
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="tabs" style={{ flexWrap: 'wrap', gap: '2px 0' }}>
        {/* ── SHOP CONFIGURATION ── */}
        <span style={{ fontSize: '0.65rem', color: '#999', textTransform: 'uppercase', letterSpacing: 1, padding: '8px 10px 4px', fontWeight: 700, userSelect: 'none' }}>Shop Config</span>
        <button 
          className={`tab ${activeTab === 'tax' ? 'active' : ''}`}
          onClick={() => setActiveTab('tax')}
        >
          <DollarSign size={16} style={{ marginRight: 6 }} />
          Tax & Rates
        </button>
        <button 
          className={`tab ${activeTab === 'minimums' ? 'active' : ''}`}
          onClick={() => setActiveTab('minimums')}
        >
          <Shield size={16} style={{ marginRight: 6 }} />
          Labor Minimums
        </button>
        <button 
          className={`tab ${activeTab === 'rolllimits' ? 'active' : ''}`}
          onClick={() => setActiveTab('rolllimits')}
        >
          🔧 Roll Limits
        </button>
        <button 
          className={`tab ${activeTab === 'mandreldies' ? 'active' : ''}`}
          onClick={() => setActiveTab('mandreldies')}
        >
          ⚙️ Mandrel Dies
        </button>
        <button 
          className={`tab ${activeTab === 'grades' ? 'active' : ''}`}
          onClick={() => setActiveTab('grades')}
        >
          📊 Material Grades
        </button>
        <button 
          className={`tab ${activeTab === 'weldrates' ? 'active' : ''}`}
          onClick={() => setActiveTab('weldrates')}
        >
          🔥 Weld Rates
        </button>

        {/* ── DIVIDER ── */}
        <span style={{ borderLeft: '2px solid #ddd', height: 24, margin: '6px 8px', alignSelf: 'center' }} />

        {/* ── COMPLIANCE ── */}
        <span style={{ fontSize: '0.65rem', color: '#999', textTransform: 'uppercase', letterSpacing: 1, padding: '8px 10px 4px', fontWeight: 700, userSelect: 'none' }}>Compliance</span>
        <button 
          className={`tab ${activeTab === 'permits' ? 'active' : ''}`}
          onClick={() => setActiveTab('permits')}
        >
          🔐 Permit Verify
        </button>

        {/* ── DIVIDER ── */}
        <span style={{ borderLeft: '2px solid #ddd', height: 24, margin: '6px 8px', alignSelf: 'center' }} />

        {/* ── NOTIFICATIONS ── */}
        <span style={{ fontSize: '0.65rem', color: '#999', textTransform: 'uppercase', letterSpacing: 1, padding: '8px 10px 4px', fontWeight: 700, userSelect: 'none' }}>Notifications</span>
        <button 
          className={`tab ${activeTab === 'schedule' ? 'active' : ''}`}
          onClick={() => setActiveTab('schedule')}
        >
          <Clock size={16} style={{ marginRight: 6 }} />
          Daily Digest
        </button>

        {/* ── DIVIDER ── */}
        <span style={{ borderLeft: '2px solid #ddd', height: 24, margin: '6px 8px', alignSelf: 'center' }} />

        {/* ── USERS & LOGS ── */}
        <span style={{ fontSize: '0.65rem', color: '#999', textTransform: 'uppercase', letterSpacing: 1, padding: '8px 10px 4px', fontWeight: 700, userSelect: 'none' }}>Users & Logs</span>
        <button 
          className={`tab ${activeTab === 'users' ? 'active' : ''}`}
          onClick={() => setActiveTab('users')}
        >
          <Users size={16} style={{ marginRight: 6 }} />
          Users
        </button>
        <button 
          className={`tab ${activeTab === 'logs' ? 'active' : ''}`}
          onClick={() => setActiveTab('logs')}
        >
          <Activity size={16} style={{ marginRight: 6 }} />
          Activity Logs
        </button>
        <button 
          className={`tab ${activeTab === 'system' ? 'active' : ''}`}
          onClick={() => setActiveTab('system')}
        >
          <AlertTriangle size={16} style={{ marginRight: 6 }} />
          System Logs
          {window.nasErrorLog?.length > 0 && (
            <span style={{ 
              marginLeft: 6, 
              background: '#e53935', 
              color: 'white', 
              borderRadius: 10, 
              padding: '2px 8px',
              fontSize: '0.75rem'
            }}>
              {window.nasErrorLog.length}
            </span>
          )}
        </button>
      </div>

      {loading ? (
        <div className="loading">
          <div className="spinner"></div>
        </div>
      ) : activeTab === 'tax' ? (
        <div>
          <div className="card">
            <h3 style={{ marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
              <DollarSign size={20} />
              Default Tax & Rate Settings
            </h3>
            <p style={{ color: '#666', marginBottom: 20 }}>
              These defaults will be used for new estimates and work orders. Individual clients can have custom rates set in the Clients & Vendors section.
            </p>
            
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: 20 }}>
              <div className="form-group">
                <label className="form-label">Default Tax Rate (%)</label>
                <input 
                  type="number" 
                  step="0.01" 
                  className="form-input" 
                  value={taxSettings.defaultTaxRate || ''} 
                  onChange={(e) => setTaxSettings({ ...taxSettings, defaultTaxRate: parseFloat(e.target.value) || 0 })}
                  placeholder="9.75"
                />
                <small style={{ color: '#666', marginTop: 4, display: 'block' }}>
                  Standard sales tax rate (e.g., 9.75 for 9.75%)
                </small>
              </div>
              
              <div className="form-group">
                <label className="form-label">Default Labor Rate ($/hour)</label>
                <input 
                  type="number" 
                  step="0.01" 
                  className="form-input" 
                  value={taxSettings.defaultLaborRate || ''} 
                  onChange={(e) => setTaxSettings({ ...taxSettings, defaultLaborRate: parseFloat(e.target.value) || 0 })}
                  placeholder="125.00"
                />
                <small style={{ color: '#666', marginTop: 4, display: 'block' }}>
                  Default hourly rate for labor on estimates
                </small>
              </div>
              
              <div className="form-group">
                <label className="form-label">Default Material Markup (%)</label>
                <input 
                  type="number" 
                  step="0.01" 
                  className="form-input" 
                  value={taxSettings.defaultMaterialMarkup || ''} 
                  onChange={(e) => setTaxSettings({ ...taxSettings, defaultMaterialMarkup: parseFloat(e.target.value) || 0 })}
                  placeholder="20"
                />
                <small style={{ color: '#666', marginTop: 4, display: 'block' }}>
                  Default markup percentage on materials
                </small>
              </div>
            </div>
            
            <div style={{ marginTop: 20, paddingTop: 16, borderTop: '1px solid #e0e0e0' }}>
              <button 
                className="btn btn-primary" 
                onClick={handleSaveTaxSettings}
                disabled={taxSettingsSaving}
              >
                <Save size={16} style={{ marginRight: 6 }} />
                {taxSettingsSaving ? 'Saving...' : 'Save Settings'}
              </button>
            </div>
          </div>
          
          <div className="card" style={{ marginTop: 16 }}>
            <h4 style={{ marginBottom: 12 }}>📋 Tax Status Reference</h4>
            <div style={{ display: 'grid', gap: 12 }}>
              <div style={{ padding: 12, background: '#e3f2fd', borderRadius: 8 }}>
                <strong style={{ color: '#1565c0' }}>Taxable</strong>
                <p style={{ margin: '4px 0 0', fontSize: '0.9rem', color: '#666' }}>
                  Standard customers who pay sales tax at the default rate (or custom rate if set)
                </p>
              </div>
              <div style={{ padding: 12, background: '#fff3e0', borderRadius: 8 }}>
                <strong style={{ color: '#e65100' }}>Resale</strong>
                <p style={{ margin: '4px 0 0', fontSize: '0.9rem', color: '#666' }}>
                  Customers with a valid resale certificate - no tax charged (they collect from end customer)
                </p>
              </div>
              <div style={{ padding: 12, background: '#e8f5e9', borderRadius: 8 }}>
                <strong style={{ color: '#2e7d32' }}>Tax Exempt</strong>
                <p style={{ margin: '4px 0 0', fontSize: '0.9rem', color: '#666' }}>
                  Government, non-profit, or other exempt organizations - no tax charged
                </p>
              </div>
            </div>
          </div>
        </div>
      ) : activeTab === 'minimums' ? (
        <div>
          <div className="card">
            <h3 style={{ marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
              <Shield size={20} />
              Labor Minimum Charges
            </h3>
            <p style={{ color: '#666', marginBottom: 16, fontSize: '0.9rem' }}>
              Set minimum labor charges by part type and size range. Estimates will warn when labor is below these thresholds.
            </p>

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
              <button className="btn btn-primary btn-sm" onClick={addLaborMinimum}>
                <Plus size={14} style={{ marginRight: 4 }} /> Add Rule
              </button>
            </div>

            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                <thead>
                  <tr style={{ background: '#f5f5f5', borderBottom: '2px solid #ddd' }}>
                    <th style={{ padding: '10px 6px', textAlign: 'left' }}>Part Type</th>
                    <th style={{ padding: '10px 6px', textAlign: 'left' }}>Label</th>
                    <th style={{ padding: '10px 6px', textAlign: 'left' }}>Size Field</th>
                    <th style={{ padding: '10px 4px', textAlign: 'center' }}>Min Size</th>
                    <th style={{ padding: '10px 4px', textAlign: 'center' }}>Max Size</th>
                    <th style={{ padding: '10px 4px', textAlign: 'center' }}>Min Width</th>
                    <th style={{ padding: '10px 4px', textAlign: 'center' }}>Max Width</th>
                    <th style={{ padding: '10px 6px', textAlign: 'right' }}>Minimum $</th>
                    <th style={{ padding: '10px 4px', textAlign: 'center' }}></th>
                  </tr>
                </thead>
                <tbody>
                  {laborMinimums.map((rule, idx) => (
                    <tr key={idx} style={{ borderBottom: '1px solid #eee' }}>
                      <td style={{ padding: '6px 4px' }}>
                        <select className="form-input" value={rule.partType} onChange={(e) => updateLaborMinimum(idx, 'partType', e.target.value)} style={{ padding: '4px', fontSize: '0.8rem' }}>
                          <option value="plate_roll">Plate Roll</option>
                          <option value="angle_roll">Angle Roll</option>
                          <option value="pipe_roll">Pipes/Tubes/Round</option>
                          <option value="tube_roll">Sq/Rect Tube Roll</option>
                          <option value="beam_roll">Beam Roll</option>
                          <option value="channel_roll">Channel Roll</option>
                          <option value="flat_bar">Flat Bar</option>
                          <option value="flat_stock">Flat Stock</option>
                          <option value="section_roll">Section Roll</option>
                          <option value="other">Other</option>
                        </select>
                      </td>
                      <td style={{ padding: '6px 4px' }}>
                        <input className="form-input" value={rule.label} onChange={(e) => updateLaborMinimum(idx, 'label', e.target.value)} placeholder="e.g. Plate ≤ 3/8&quot;" style={{ padding: '4px 6px', fontSize: '0.8rem' }} />
                      </td>
                      <td style={{ padding: '6px 4px' }}>
                        <select className="form-input" value={rule.sizeField} onChange={(e) => updateLaborMinimum(idx, 'sizeField', e.target.value)} style={{ padding: '4px', fontSize: '0.8rem' }}>
                          <option value="thickness">Thickness</option>
                          <option value="angleSize">Angle Size (leg)</option>
                          <option value="sectionSize">Section Size</option>
                          <option value="outerDiameter">OD</option>
                        </select>
                      </td>
                      <td style={{ padding: '6px 4px', textAlign: 'center' }}>
                        <input type="number" step="0.001" className="form-input" value={rule.minSize || ''} onChange={(e) => updateLaborMinimum(idx, 'minSize', e.target.value)} placeholder="—" style={{ width: 60, textAlign: 'center', padding: '4px', fontSize: '0.8rem' }} />
                      </td>
                      <td style={{ padding: '6px 4px', textAlign: 'center' }}>
                        <input type="number" step="0.001" className="form-input" value={rule.maxSize || ''} onChange={(e) => updateLaborMinimum(idx, 'maxSize', e.target.value)} placeholder="—" style={{ width: 60, textAlign: 'center', padding: '4px', fontSize: '0.8rem' }} />
                      </td>
                      <td style={{ padding: '6px 4px', textAlign: 'center' }}>
                        <input type="number" step="0.1" className="form-input" value={rule.minWidth || ''} onChange={(e) => updateLaborMinimum(idx, 'minWidth', e.target.value)} placeholder="—" style={{ width: 60, textAlign: 'center', padding: '4px', fontSize: '0.8rem' }} />
                      </td>
                      <td style={{ padding: '6px 4px', textAlign: 'center' }}>
                        <input type="number" step="0.1" className="form-input" value={rule.maxWidth || ''} onChange={(e) => updateLaborMinimum(idx, 'maxWidth', e.target.value)} placeholder="—" style={{ width: 60, textAlign: 'center', padding: '4px', fontSize: '0.8rem' }} />
                      </td>
                      <td style={{ padding: '6px 4px', textAlign: 'right' }}>
                        <input type="number" step="1" className="form-input" value={rule.minimum} onChange={(e) => updateLaborMinimum(idx, 'minimum', parseFloat(e.target.value) || 0)} style={{ width: 80, textAlign: 'right', padding: '4px', fontSize: '0.8rem' }} />
                      </td>
                      <td style={{ padding: '6px 4px', textAlign: 'center' }}>
                        <button className="btn btn-sm btn-danger" onClick={() => removeLaborMinimum(idx)} style={{ padding: '3px 6px' }}>
                          <Trash2 size={12} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {laborMinimums.length === 0 && (
              <div style={{ textAlign: 'center', padding: 24, color: '#999' }}>
                No minimum rules defined. Click "Add Rule" to create one.
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 16 }}>
              <button className="btn btn-primary" onClick={handleSaveLaborMinimums} disabled={laborMinSaving}>
                <Save size={16} style={{ marginRight: 6 }} />
                {laborMinSaving ? 'Saving...' : 'Save Minimums'}
              </button>
            </div>

            <div style={{ marginTop: 16, padding: 12, background: '#f5f5f5', borderRadius: 8, fontSize: '0.8rem', color: '#666' }}>
              <strong>How it works:</strong> The minimum applies to the <em>entire estimate's total labor</em>. 
              All parts' labor is summed, then compared against the highest applicable minimum from any part on the estimate.
              If total labor is below that minimum, the minimum charge replaces total labor. Material is unaffected.
              <br /><br />
              <strong>Width:</strong> Use Min/Max Width for plate rules to set different minimums by width range (e.g. 24-60" plates).
              Leave blank to match any width. The most specific matching rule (highest minimum) wins.
            </div>
          </div>
        </div>

      ) : activeTab === 'rolllimits' ? (
        <div>
          <div className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h3 style={{ margin: 0 }}>🔧 Minimum Rollable Diameters</h3>
              <button className="btn btn-primary btn-sm" onClick={() => setRollLimits([...rollLimits, { od: '', materialCategory: 'steel', minDiameter: '', label: '' }])}>
                + Add Rule
              </button>
            </div>

            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                <thead>
                  <tr style={{ background: '#f5f5f5', borderBottom: '2px solid #ddd' }}>
                    <th style={{ padding: '10px 6px', textAlign: 'left' }}>Label</th>
                    <th style={{ padding: '10px 6px', textAlign: 'center' }}>OD (inches)</th>
                    <th style={{ padding: '10px 6px', textAlign: 'center' }}>Material</th>
                    <th style={{ padding: '10px 6px', textAlign: 'center' }}>Min CL Diameter</th>
                    <th style={{ padding: '10px 4px', textAlign: 'center' }}></th>
                  </tr>
                </thead>
                <tbody>
                  {rollLimits.map((rule, idx) => (
                    <tr key={idx} style={{ borderBottom: '1px solid #eee' }}>
                      <td style={{ padding: '6px 4px' }}>
                        <input className="form-input" value={rule.label || ''} onChange={(e) => { const u = [...rollLimits]; u[idx] = { ...u[idx], label: e.target.value }; setRollLimits(u); }} placeholder="e.g. 2&quot; Tube Steel" style={{ padding: '4px 6px', fontSize: '0.8rem' }} />
                      </td>
                      <td style={{ padding: '6px 4px', textAlign: 'center' }}>
                        <input type="number" step="0.001" className="form-input" value={rule.od || ''} onChange={(e) => { const u = [...rollLimits]; u[idx] = { ...u[idx], od: e.target.value }; setRollLimits(u); }} style={{ width: 70, textAlign: 'center', padding: '4px', fontSize: '0.8rem' }} />
                      </td>
                      <td style={{ padding: '6px 4px', textAlign: 'center' }}>
                        <select className="form-input" value={rule.materialCategory || 'steel'} onChange={(e) => { const u = [...rollLimits]; u[idx] = { ...u[idx], materialCategory: e.target.value }; setRollLimits(u); }} style={{ padding: '4px', fontSize: '0.8rem' }}>
                          <option value="steel">Steel</option>
                          <option value="stainless">Stainless</option>
                          <option value="aluminum">Aluminum</option>
                          <option value="all">All Materials</option>
                        </select>
                      </td>
                      <td style={{ padding: '6px 4px', textAlign: 'center' }}>
                        <input type="number" step="0.1" className="form-input" value={rule.minDiameter || ''} onChange={(e) => { const u = [...rollLimits]; u[idx] = { ...u[idx], minDiameter: e.target.value }; setRollLimits(u); }} style={{ width: 80, textAlign: 'center', padding: '4px', fontSize: '0.8rem' }} />
                      </td>
                      <td style={{ padding: '6px 4px', textAlign: 'center' }}>
                        <button className="btn btn-sm btn-danger" onClick={() => setRollLimits(rollLimits.filter((_, i) => i !== idx))} style={{ padding: '3px 6px' }}>
                          <Trash2 size={12} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 16 }}>
              <button className="btn btn-primary" onClick={handleSaveRollLimits} disabled={rollLimitsSaving}>
                <Save size={16} style={{ marginRight: 6 }} />
                {rollLimitsSaving ? 'Saving...' : 'Save Roll Limits'}
              </button>
            </div>

            <div style={{ marginTop: 16, padding: 12, background: '#f5f5f5', borderRadius: 8, fontSize: '0.8rem', color: '#666' }}>
              <strong>How it works:</strong> Set the smallest centerline diameter you can roll for each pipe/tube OD size.
              Different materials can have different limits (aluminum typically needs a larger min diameter than steel).
              If no rule matches, a default of 8× OD (steel) or 12× OD (aluminum) is used.
            </div>
          </div>
        </div>

      ) : activeTab === 'mandreldies' ? (
        <div>
          <div className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h3 style={{ margin: 0 }}>⚙️ Mandrel Bending Dies</h3>
              <button className="btn btn-primary btn-sm" onClick={() => setMandrelDies([...mandrelDies, { od: '', wallThickness: '', minDiameter: '', label: '', notes: '' }])}>
                + Add Die
              </button>
            </div>

            {mandrelDies.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 24, color: '#999' }}>
                No mandrel dies configured. Click "Add Die" to add one.
              </div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                  <thead>
                    <tr style={{ background: '#f5f5f5', borderBottom: '2px solid #ddd' }}>
                      <th style={{ padding: '10px 6px', textAlign: 'left' }}>Label</th>
                      <th style={{ padding: '10px 6px', textAlign: 'center' }}>Tube/Pipe OD</th>
                      <th style={{ padding: '10px 6px', textAlign: 'center' }}>Wall Thickness</th>
                      <th style={{ padding: '10px 6px', textAlign: 'center' }}>Min CLR</th>
                      <th style={{ padding: '10px 6px', textAlign: 'left' }}>Notes</th>
                      <th style={{ padding: '10px 4px', textAlign: 'center' }}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {mandrelDies.map((die, idx) => (
                      <tr key={idx} style={{ borderBottom: '1px solid #eee' }}>
                        <td style={{ padding: '6px 4px' }}>
                          <input className="form-input" value={die.label || ''} onChange={(e) => { const u = [...mandrelDies]; u[idx] = { ...u[idx], label: e.target.value }; setMandrelDies(u); }} placeholder='e.g. 2" CLR die' style={{ padding: '4px 6px', fontSize: '0.8rem' }} />
                        </td>
                        <td style={{ padding: '6px 4px', textAlign: 'center' }}>
                          <input type="number" step="0.001" className="form-input" value={die.od || ''} onChange={(e) => { const u = [...mandrelDies]; u[idx] = { ...u[idx], od: e.target.value }; setMandrelDies(u); }} style={{ width: 70, textAlign: 'center', padding: '4px', fontSize: '0.8rem' }} />
                        </td>
                        <td style={{ padding: '6px 4px', textAlign: 'center' }}>
                          <input className="form-input" value={die.wallThickness || ''} onChange={(e) => { const u = [...mandrelDies]; u[idx] = { ...u[idx], wallThickness: e.target.value }; setMandrelDies(u); }} placeholder='e.g. .120"' style={{ width: 80, textAlign: 'center', padding: '4px', fontSize: '0.8rem' }} />
                        </td>
                        <td style={{ padding: '6px 4px', textAlign: 'center' }}>
                          <input type="number" step="0.1" className="form-input" value={die.minDiameter || ''} onChange={(e) => { const u = [...mandrelDies]; u[idx] = { ...u[idx], minDiameter: e.target.value }; setMandrelDies(u); }} style={{ width: 80, textAlign: 'center', padding: '4px', fontSize: '0.8rem' }} />
                        </td>
                        <td style={{ padding: '6px 4px' }}>
                          <input className="form-input" value={die.notes || ''} onChange={(e) => { const u = [...mandrelDies]; u[idx] = { ...u[idx], notes: e.target.value }; setMandrelDies(u); }} placeholder="Optional notes" style={{ padding: '4px 6px', fontSize: '0.8rem' }} />
                        </td>
                        <td style={{ padding: '6px 4px', textAlign: 'center' }}>
                          <button className="btn btn-sm btn-danger" onClick={() => setMandrelDies(mandrelDies.filter((_, i) => i !== idx))} style={{ padding: '3px 6px' }}>
                            <Trash2 size={12} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 16 }}>
              <button className="btn btn-primary" onClick={handleSaveMandrelDies} disabled={mandrelDiesSaving}>
                <Save size={16} style={{ marginRight: 6 }} />
                {mandrelDiesSaving ? 'Saving...' : 'Save Mandrel Dies'}
              </button>
            </div>

            <div style={{ marginTop: 16, padding: 12, background: '#f5f5f5', borderRadius: 8, fontSize: '0.8rem', color: '#666' }}>
              <strong>How it works:</strong> When a requested roll diameter is below the minimum rollable limit for that size,
              the system checks for available mandrel dies. If a die exists for that OD and can achieve the requested diameter,
              it shows as an option. Otherwise, a warning appears with the smallest achievable diameter.
            </div>
          </div>
        </div>

      ) : activeTab === 'grades' ? (
        <div>
          <div className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h3 style={{ margin: 0 }}>📊 Material Grades</h3>
              <button className="btn btn-primary btn-sm" onClick={() => setMaterialGrades([...materialGrades, { name: '', partTypes: [], yieldStrength: '', tensileStrength: '' }])}>
                + Add Grade
              </button>
            </div>

            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                <thead>
                  <tr style={{ background: '#f5f5f5', borderBottom: '2px solid #ddd' }}>
                    <th style={{ padding: '10px 6px', textAlign: 'left' }}>Grade Name</th>
                    <th style={{ padding: '10px 6px', textAlign: 'left' }}>Part Types</th>
                    <th style={{ padding: '10px 6px', textAlign: 'center' }}>Yield (PSI)</th>
                    <th style={{ padding: '10px 6px', textAlign: 'center' }}>Tensile (PSI)</th>
                    <th style={{ padding: '10px 4px', textAlign: 'center' }}></th>
                  </tr>
                </thead>
                <tbody>
                  {materialGrades.map((grade, idx) => (
                    <tr key={idx} style={{ borderBottom: '1px solid #eee' }}>
                      <td style={{ padding: '6px 4px' }}>
                        <input className="form-input" value={grade.name || ''} onChange={(e) => { const u = [...materialGrades]; u[idx] = { ...u[idx], name: e.target.value }; setMaterialGrades(u); }} placeholder="e.g. A36" style={{ padding: '4px 6px', fontSize: '0.8rem', width: 120 }} />
                      </td>
                      <td style={{ padding: '6px 4px' }}>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                          {[
                            { key: 'plate_roll', label: 'Plate' },
                            { key: 'angle_roll', label: 'Angle' },
                            { key: 'pipe_roll', label: 'Pipes/Tubes/Round' },
                            { key: 'tube_roll', label: 'Sq/Rect Tube' },
                            { key: 'flat_bar', label: 'Flat Bar' },
                            { key: 'beam_roll', label: 'Beam' },
                            { key: 'channel_roll', label: 'Channel' },
                            { key: 'tee_bar', label: 'Tee Bar' },
                            { key: 'flat_stock', label: 'Flat Stock' },
                            { key: 'press_brake', label: 'Press Brake' },
                            { key: 'cone_roll', label: 'Cone' },
                          ].map(pt => (
                            <label key={pt.key} style={{ display: 'flex', alignItems: 'center', gap: 2, fontSize: '0.75rem', cursor: 'pointer',
                              background: (grade.partTypes || []).includes(pt.key) ? '#e3f2fd' : '#f5f5f5',
                              padding: '2px 6px', borderRadius: 4, border: `1px solid ${(grade.partTypes || []).includes(pt.key) ? '#1976d2' : '#ddd'}` }}>
                              <input type="checkbox" checked={(grade.partTypes || []).includes(pt.key)}
                                onChange={(e) => {
                                  const u = [...materialGrades];
                                  const pts = [...(u[idx].partTypes || [])];
                                  if (e.target.checked) { pts.push(pt.key); } else { const i = pts.indexOf(pt.key); if (i > -1) pts.splice(i, 1); }
                                  u[idx] = { ...u[idx], partTypes: pts };
                                  setMaterialGrades(u);
                                }}
                                style={{ width: 12, height: 12 }} />
                              {pt.label}
                            </label>
                          ))}
                        </div>
                      </td>
                      <td style={{ padding: '6px 4px', textAlign: 'center' }}>
                        <input className="form-input" value={grade.yieldStrength || ''} onChange={(e) => { const u = [...materialGrades]; u[idx] = { ...u[idx], yieldStrength: e.target.value }; setMaterialGrades(u); }} placeholder="e.g. 36,000" style={{ width: 100, textAlign: 'center', padding: '4px', fontSize: '0.8rem' }} />
                      </td>
                      <td style={{ padding: '6px 4px', textAlign: 'center' }}>
                        <input className="form-input" value={grade.tensileStrength || ''} onChange={(e) => { const u = [...materialGrades]; u[idx] = { ...u[idx], tensileStrength: e.target.value }; setMaterialGrades(u); }} placeholder="e.g. 58,000" style={{ width: 100, textAlign: 'center', padding: '4px', fontSize: '0.8rem' }} />
                      </td>
                      <td style={{ padding: '6px 4px', textAlign: 'center' }}>
                        <button className="btn btn-sm btn-danger" onClick={() => setMaterialGrades(materialGrades.filter((_, i) => i !== idx))} style={{ padding: '3px 6px' }}>
                          <Trash2 size={12} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 16 }}>
              <button className="btn btn-primary" onClick={handleSaveMaterialGrades} disabled={materialGradesSaving}>
                <Save size={16} style={{ marginRight: 6 }} />
                {materialGradesSaving ? 'Saving...' : 'Save Grades'}
              </button>
            </div>

            <div style={{ marginTop: 16, padding: 12, background: '#f5f5f5', borderRadius: 8, fontSize: '0.8rem', color: '#666' }}>
              <strong>How it works:</strong> Material grades defined here will appear as dropdown options in the part forms.
              Each grade can be assigned to specific part types. Yield and tensile strength are stored as reference data.
              The grade dropdown in each form will show only grades assigned to that part type, plus a "Custom" option.
            </div>
          </div>
        </div>

      ) : activeTab === 'weldrates' ? (
        <div>
          <div className="card">
            <h3 style={{ marginBottom: 16 }}>🔥 Weld Rates (Price Per Foot)</h3>
            <p style={{ color: '#666', fontSize: '0.9rem', marginBottom: 16 }}>
              Set default welding price per foot by material grade. These rates auto-fill when creating Fabrication Service line items.
            </p>
            <div style={{ marginBottom: 16, padding: 12, background: '#f0f7ff', borderRadius: 8, border: '1px solid #bbdefb' }}>
              <label style={{ fontWeight: 600, fontSize: '0.9rem', display: 'block', marginBottom: 6 }}>Default Rate (fallback for unlisted grades)</label>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <span style={{ fontWeight: 600 }}>$</span>
                <input type="number" step="0.01" className="form-input" style={{ maxWidth: 120 }}
                  value={weldDefaultRate} onChange={(e) => setWeldDefaultRate(e.target.value)} placeholder="0.00" />
                <span style={{ color: '#666', fontSize: '0.85rem' }}>/ ft</span>
              </div>
            </div>
            <table className="data-table" style={{ marginBottom: 16 }}>
              <thead>
                <tr>
                  <th>Material Grade</th>
                  <th>Price Per Foot</th>
                  <th style={{ width: 60 }}></th>
                </tr>
              </thead>
              <tbody>
                {weldRates.map((row, idx) => (
                  <tr key={idx}>
                    <td>
                      <input className="form-input" value={row.grade} style={{ fontSize: '0.9rem' }}
                        onChange={(e) => { const nr = [...weldRates]; nr[idx].grade = e.target.value; setWeldRates(nr); }}
                        placeholder="e.g. A36" />
                    </td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        <span style={{ fontWeight: 600 }}>$</span>
                        <input type="number" step="0.01" className="form-input" value={row.rate} style={{ fontSize: '0.9rem' }}
                          onChange={(e) => { const nr = [...weldRates]; nr[idx].rate = e.target.value; setWeldRates(nr); }}
                          placeholder="0.00" />
                        <span style={{ color: '#666', fontSize: '0.85rem' }}>/ft</span>
                      </div>
                    </td>
                    <td>
                      <button onClick={() => setWeldRates(weldRates.filter((_, i) => i !== idx))}
                        style={{ background: 'none', border: 'none', color: '#c62828', cursor: 'pointer', fontSize: '1.1rem' }}>✕</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div style={{ display: 'flex', gap: 12 }}>
              <button className="btn btn-sm" style={{ background: '#e8f5e9', color: '#2e7d32', border: '1px solid #a5d6a7' }}
                onClick={() => setWeldRates([...weldRates, { grade: '', rate: '' }])}>+ Add Grade</button>
              <button className="btn btn-primary" onClick={handleSaveWeldRates} disabled={weldRatesSaving}>
                {weldRatesSaving ? 'Saving...' : 'Save Weld Rates'}
              </button>
            </div>
            <div style={{ marginTop: 20, padding: 12, background: '#fff8e1', borderRadius: 8, fontSize: '0.85rem', color: '#666', border: '1px solid #ffe082' }}>
              <strong>Weld formula:</strong> ⌈Thickness ÷ 0.125⌉ × ⌈Seam Length ÷ 12⌉ × Price Per Foot<br/>
              <em>Passes and seam length both round up. Example: 3/16" plate, 50" seam, $5.00/ft → ⌈1.5⌉ × ⌈4.17⌉ × $5.00 = 2 × 5 × $5 = $50.00</em>
            </div>
          </div>
        </div>

      ) : activeTab === 'schedule' ? (
        <div>
          <div className="card">
            <h3 style={{ marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
              <Mail size={20} />
              Daily Schedule Email
            </h3>
            <p style={{ color: '#666', marginBottom: 20 }}>
              Receive a daily email at 6:00 AM Pacific Time with a summary of upcoming and overdue shipments.
            </p>
            
            <div className="form-group">
              <label className="form-label">Email Address</label>
              <input
                type="email"
                className="form-input"
                value={scheduleEmail}
                onChange={(e) => setScheduleEmail(e.target.value)}
                placeholder="Enter email address"
              />
            </div>
            
            <div className="form-group">
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={scheduleEmailEnabled}
                  onChange={(e) => setScheduleEmailEnabled(e.target.checked)}
                  style={{ width: 18, height: 18 }}
                />
                <span>Enable daily schedule email</span>
              </label>
              <small style={{ color: '#666', display: 'block', marginTop: 4 }}>
                When enabled, an email will be sent every day at 6:00 AM Pacific Time
              </small>
            </div>
            
            <div style={{ display: 'flex', gap: 12, marginTop: 20 }}>
              <button 
                className="btn btn-primary" 
                onClick={handleSaveScheduleEmail}
                disabled={scheduleEmailSaving}
              >
                {scheduleEmailSaving ? 'Saving...' : 'Save Settings'}
              </button>
              <button 
                className="btn btn-secondary" 
                onClick={handleSendTestEmail}
                disabled={scheduleEmailSending}
                style={{ display: 'flex', alignItems: 'center', gap: 6 }}
              >
                <Send size={16} />
                {scheduleEmailSending ? 'Sending...' : 'Send Test Email Now'}
              </button>
            </div>
            
            <div style={{ 
              marginTop: 24, 
              padding: 16, 
              background: '#f5f5f5', 
              borderRadius: 8,
              fontSize: '0.9rem'
            }}>
              <strong style={{ display: 'block', marginBottom: 8 }}>Email Contents:</strong>
              <ul style={{ margin: 0, paddingLeft: 20, color: '#666' }}>
                <li>Overdue shipments (promised date passed)</li>
                <li>Upcoming shipments due within 7 days (promised date)</li>
                <li>Overdue shipments (requested date passed)</li>
                <li>Upcoming shipments due within 7 days (requested date)</li>
              </ul>
              <p style={{ margin: '12px 0 0 0', color: '#666' }}>
                Each entry includes: Client Name, Client PO#, Date Received, Promised Date, Requested Date
              </p>
            </div>
          </div>
        </div>
      ) : activeTab === 'users' ? (
        <div>
          <div style={{ marginBottom: 16 }}>
            <button className="btn btn-primary" onClick={() => setShowNewUserModal(true)}>
              <Plus size={18} />
              Add User
            </button>
          </div>

          <div className="card">
            <table className="table">
              <thead>
                <tr>
                  <th>Username</th>
                  <th>Role</th>
                  <th>Status</th>
                  <th>Created</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map((user) => (
                  <tr key={user.id}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        {user.role === 'admin' ? (
                          <Shield size={16} color="#1976d2" />
                        ) : (
                          <User size={16} color="#666" />
                        )}
                        <span style={{ fontWeight: 500 }}>{user.username}</span>
                        {user.id === currentUser?.id && (
                          <span style={{ 
                            fontSize: '0.7rem', 
                            background: '#e3f2fd', 
                            color: '#1976d2',
                            padding: '2px 6px',
                            borderRadius: 4
                          }}>
                            You
                          </span>
                        )}
                      </div>
                    </td>
                    <td>
                      <span className={`status-badge ${user.role === 'admin' ? 'status-shipped' : 'status-received'}`}>
                        {user.role}
                      </span>
                    </td>
                    <td>
                      <button
                        className={`btn btn-sm ${user.isActive ? 'btn-success' : 'btn-secondary'}`}
                        onClick={() => handleToggleActive(user)}
                        disabled={user.id === currentUser?.id}
                      >
                        {user.isActive ? 'Active' : 'Disabled'}
                      </button>
                    </td>
                    <td>{formatDate(user.createdAt)}</td>
                    <td>
                      <div style={{ display: 'flex', gap: 8 }}>
                        <button
                          className="btn btn-sm btn-outline"
                          onClick={() => openEditModal(user)}
                          title="Edit user"
                        >
                          <Edit size={14} />
                        </button>
                        <button
                          className="btn btn-sm btn-warning"
                          onClick={() => openResetPasswordModal(user)}
                          title="Reset password"
                          style={{ background: '#ff9800', borderColor: '#ff9800' }}
                        >
                          <Key size={14} />
                        </button>
                        <button
                          className="btn btn-sm btn-danger"
                          onClick={() => handleDeleteUser(user.id)}
                          disabled={user.id === currentUser?.id}
                          title="Delete user"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : activeTab === 'logs' ? (
        <div>
          <div className="card">
            <h3 style={{ margin: '0 0 16px', display: 'flex', alignItems: 'center', gap: 8 }}>
              <Activity size={20} />
              Activity Logs
            </h3>
            <table className="table">
              <thead>
                <tr>
                  <th>Time</th>
                  <th>User</th>
                  <th>Action</th>
                  <th>Details</th>
                  <th>IP Address</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => (
                  <tr key={log.id}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <Clock size={14} color="#999" />
                        {formatDate(log.createdAt)}
                      </div>
                    </td>
                    <td style={{ fontWeight: 500 }}>{log.username || '—'}</td>
                    <td>
                      <span style={{ 
                        color: getActionColor(log.action),
                        fontWeight: 500
                      }}>
                        {log.action}
                      </span>
                    </td>
                    <td style={{ fontSize: '0.85rem', color: '#666' }}>
                      {log.resourceType && `${log.resourceType}`}
                      {log.details && (
                        <span style={{ marginLeft: 8 }}>
                          {JSON.stringify(log.details)}
                        </span>
                      )}
                    </td>
                    <td style={{ fontFamily: 'monospace', fontSize: '0.8rem' }}>
                      {log.ipAddress || '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Pagination */}
            <div style={{ 
              display: 'flex', 
              justifyContent: 'space-between', 
              alignItems: 'center',
              marginTop: 16,
              paddingTop: 16,
              borderTop: '1px solid #eee'
            }}>
              <div style={{ color: '#666', fontSize: '0.875rem' }}>
                Showing {logsPage * 50 + 1} - {Math.min((logsPage + 1) * 50, logsTotal)} of {logsTotal}
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  className="btn btn-sm btn-secondary"
                  onClick={() => setLogsPage(p => p - 1)}
                  disabled={logsPage === 0}
                >
                  <ChevronLeft size={16} />
                  Previous
                </button>
                <button
                  className="btn btn-sm btn-secondary"
                  onClick={() => setLogsPage(p => p + 1)}
                  disabled={(logsPage + 1) * 50 >= logsTotal}
                >
                  Next
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {/* System Logs Tab Content */}
      {activeTab === 'permits' && !loading && (
        <div>
          <div className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h3 style={{ margin: 0 }}>🔐 CDTFA Seller's Permit Verification</h3>
              <div style={{ display: 'flex', gap: 8 }}>
                <button className="btn" onClick={async () => {
                  try {
                    const res = await downloadResaleReport();
                    const blob = new Blob([res.data], { type: 'application/pdf' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `Resale_Verification_Report_${new Date().toISOString().slice(0, 10)}.pdf`;
                    a.click();
                    URL.revokeObjectURL(url);
                  } catch (err) {
                    setError('Failed to generate report');
                  }
                }}
                  style={{ fontWeight: 600, background: '#fff', border: '1px solid #1976d2', color: '#1976d2' }}>
                  📄 Download PDF Report
                </button>
                <button className="btn btn-primary" onClick={handleStartBatch}
                  disabled={batchStatus?.status === 'running'}
                  style={{ fontWeight: 600 }}>
                  {batchStatus?.status === 'running' ? '⏳ Running...' : '🔍 Verify All Permits'}
                </button>
              </div>
            </div>

            <div style={{ padding: 12, background: '#f5f5f5', borderRadius: 8, fontSize: '0.85rem', color: '#666', marginBottom: 16 }}>
              <strong>How it works:</strong> This checks each client's resale certificate number against the California CDTFA website.
              Each lookup takes about 1 minute (with a delay between requests to be respectful of the government server).
              You can also verify individual clients from the Clients & Vendors page.
              <div style={{ marginTop: 8, padding: 8, background: '#e8f5e9', borderRadius: 4, color: '#2e7d32' }}>
                🗓️ <strong>Auto-runs annually</strong> on January 2nd at 3:00 AM Pacific. Use the button above for on-demand checks.
              </div>
            </div>

            {/* Batch Progress */}
            {batchStatus && batchStatus.status === 'running' && (
              <div style={{ marginBottom: 16, padding: 16, background: '#e3f2fd', borderRadius: 8, border: '1px solid #90caf9' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                  <strong style={{ color: '#1565c0' }}>⏳ Batch Verification In Progress</strong>
                  <span style={{ fontWeight: 600, color: '#1565c0' }}>{batchStatus.completed}/{batchStatus.total}</span>
                </div>
                <div style={{ background: '#bbdefb', borderRadius: 4, height: 8, overflow: 'hidden' }}>
                  <div style={{ background: '#1976d2', height: '100%', width: `${batchStatus.total > 0 ? (batchStatus.completed / batchStatus.total * 100) : 0}%`, borderRadius: 4, transition: 'width 0.5s' }} />
                </div>
                <div style={{ marginTop: 6, fontSize: '0.8rem', color: '#666' }}>
                  Estimated time remaining: ~{Math.max(0, (batchStatus.total - batchStatus.completed))} minutes
                </div>
              </div>
            )}

            {batchStatus && batchStatus.status === 'complete' && (
              <div style={{ marginBottom: 16, padding: 12, background: '#e8f5e9', borderRadius: 8, border: '1px solid #a5d6a7', fontSize: '0.9rem', color: '#2e7d32' }}>
                ✅ Batch verification complete — {batchStatus.completed}/{batchStatus.total} clients verified
                {batchStatus.completedAt && <span style={{ marginLeft: 8, color: '#888', fontSize: '0.8rem' }}>({new Date(batchStatus.completedAt).toLocaleString()})</span>}
              </div>
            )}

            {batchStatus && batchStatus.status === 'error' && (
              <div style={{ marginBottom: 16, padding: 12, background: '#ffebee', borderRadius: 8, border: '1px solid #ef9a9a', fontSize: '0.9rem', color: '#c62828' }}>
                ❌ Batch error: {batchStatus.error}
              </div>
            )}

            {/* Results Table */}
            {batchStatus && batchStatus.results && batchStatus.results.length > 0 && (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                  <thead>
                    <tr style={{ background: '#f5f5f5', borderBottom: '2px solid #ddd' }}>
                      <th style={{ padding: '10px 8px', textAlign: 'left' }}>Client</th>
                      <th style={{ padding: '10px 8px', textAlign: 'left' }}>Permit #</th>
                      <th style={{ padding: '10px 8px', textAlign: 'center' }}>Status</th>
                      <th style={{ padding: '10px 8px', textAlign: 'left' }}>CDTFA Response</th>
                      <th style={{ padding: '10px 8px', textAlign: 'left' }}>CDTFA Owner</th>
                    </tr>
                  </thead>
                  <tbody>
                    {/* Sort: non-active first, then by name */}
                    {[...batchStatus.results].sort((a, b) => {
                      if (a.status === 'active' && b.status !== 'active') return 1;
                      if (a.status !== 'active' && b.status === 'active') return -1;
                      return (a.clientName || '').localeCompare(b.clientName || '');
                    }).map((r, idx) => (
                      <tr key={idx} style={{ borderBottom: '1px solid #eee', background: r.status !== 'active' && r.status !== 'unknown' ? '#fff8f8' : undefined }}>
                        <td style={{ padding: '8px' }}><strong>{r.clientName}</strong></td>
                        <td style={{ padding: '8px', fontFamily: 'monospace' }}>{r.permitNumber}</td>
                        <td style={{ padding: '8px', textAlign: 'center' }}>
                          {r.status === 'active' && <span style={{ padding: '2px 8px', borderRadius: 4, fontSize: '0.8rem', fontWeight: 700, background: '#e8f5e9', color: '#2e7d32' }}>✅ Active</span>}
                          {r.status === 'closed' && <span style={{ padding: '2px 8px', borderRadius: 4, fontSize: '0.8rem', fontWeight: 700, background: '#ffebee', color: '#c62828' }}>❌ Closed</span>}
                          {r.status === 'not_found' && <span style={{ padding: '2px 8px', borderRadius: 4, fontSize: '0.8rem', fontWeight: 700, background: '#ffebee', color: '#c62828' }}>❌ Not Found</span>}
                          {r.status === 'error' && <span style={{ padding: '2px 8px', borderRadius: 4, fontSize: '0.8rem', fontWeight: 700, background: '#fff3e0', color: '#e65100' }}>⚠️ Error</span>}
                          {r.status === 'unknown' && <span style={{ padding: '2px 8px', borderRadius: 4, fontSize: '0.8rem', fontWeight: 700, background: '#fff3e0', color: '#e65100' }}>⚠️ Unknown</span>}
                        </td>
                        <td style={{ padding: '8px', fontSize: '0.8rem', color: '#666', fontStyle: 'italic', maxWidth: 300, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {r.rawResponse || r.error || '—'}
                        </td>
                        <td style={{ padding: '8px', fontSize: '0.8rem' }}>
                          {(r.ownerName || r.dbaName) ? (
                            <div>
                              {r.ownerName && <div>{r.ownerName}</div>}
                              {r.dbaName && <div style={{ color: '#888', fontSize: '0.75rem' }}>DBA: {r.dbaName}</div>}
                              {(() => {
                                const clean = (s) => (s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
                                const cLow = clean(r.clientName);
                                const oLow = clean(r.ownerName);
                                const dLow = clean(r.dbaName);
                                if (!cLow) return null;
                                const matchesOwner = oLow && (oLow.includes(cLow) || cLow.includes(oLow));
                                const matchesDba = dLow && (dLow.includes(cLow) || cLow.includes(dLow));
                                return (!matchesOwner && !matchesDba && (oLow || dLow)) ? (
                                  <div style={{ color: '#e65100', fontWeight: 600, fontSize: '0.75rem', marginTop: 2 }}>⚠️ Name mismatch</div>
                                ) : null;
                              })()}
                            </div>
                          ) : <span style={{ color: '#ccc' }}>—</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {(!batchStatus || !batchStatus.results || batchStatus.results.length === 0) && batchStatus?.status !== 'running' && (
              <div style={{ textAlign: 'center', padding: 40, color: '#999' }}>
                <div style={{ fontSize: '2rem', marginBottom: 8 }}>🔐</div>
                <p>No batch verification results yet. Click "Verify All Permits" to check all client resale certificates.</p>
                <p style={{ fontSize: '0.8rem' }}>You can also verify individual clients from the <strong>Clients & Vendors</strong> page.</p>
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'system' && !loading && (
        <div>
          <div style={{ marginBottom: 16, display: 'flex', gap: 8 }}>
            <button className="btn btn-outline" onClick={refreshSystemLogs}>
              <RefreshCw size={18} />
              Refresh
            </button>
            <button className="btn btn-danger" onClick={clearSystemLogs} disabled={systemLogs.length === 0}>
              <Trash2 size={18} />
              Clear Logs
            </button>
          </div>

          <div className="card">
            {systemLogs.length === 0 ? (
              <div className="empty-state" style={{ padding: 40 }}>
                <div className="empty-state-icon">✅</div>
                <div className="empty-state-title">No Errors</div>
                <p>No system errors have been logged.</p>
              </div>
            ) : (
              <div style={{ maxHeight: 600, overflowY: 'auto' }}>
                {systemLogs.map((log, index) => (
                  <div 
                    key={index} 
                    style={{ 
                      padding: 16, 
                      borderBottom: '1px solid #eee',
                      background: index % 2 === 0 ? '#fff' : '#fafafa'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                      <span style={{ 
                        background: '#ffebee', 
                        color: '#c62828', 
                        padding: '2px 8px', 
                        borderRadius: 4,
                        fontSize: '0.75rem',
                        fontWeight: 500
                      }}>
                        {log.type}
                      </span>
                      <span style={{ color: '#666', fontSize: '0.8rem' }}>
                        {new Date(log.timestamp).toLocaleString()}
                      </span>
                    </div>
                    <div style={{ 
                      fontWeight: 500, 
                      color: '#c62828',
                      marginBottom: 8
                    }}>
                      {log.error}
                    </div>
                    {log.details && Object.keys(log.details).length > 0 && (
                      <pre style={{ 
                        background: '#f5f5f5', 
                        padding: 12, 
                        borderRadius: 4,
                        fontSize: '0.8rem',
                        overflow: 'auto',
                        margin: 0
                      }}>
                        {JSON.stringify(log.details, null, 2)}
                      </pre>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* New User Modal */}
      {showNewUserModal && (
        <div className="modal-overlay" onClick={() => setShowNewUserModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">Add New User</h3>
              <button className="modal-close" onClick={() => setShowNewUserModal(false)}>&times;</button>
            </div>
            <form onSubmit={handleCreateUser}>
              <div className="form-group">
                <label className="form-label">Username *</label>
                <input
                  type="text"
                  className="form-input"
                  value={newUser.username}
                  onChange={(e) => setNewUser({ ...newUser, username: e.target.value })}
                  required
                />
              </div>
              <div className="form-group">
                <label className="form-label">Password *</label>
                <input
                  type="password"
                  className="form-input"
                  value={newUser.password}
                  onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
                  required
                />
              </div>
              <div className="form-group">
                <label className="form-label">Role</label>
                <select
                  className="form-select"
                  value={newUser.role}
                  onChange={(e) => setNewUser({ ...newUser, role: e.target.value })}
                >
                  <option value="user">User</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowNewUserModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving ? 'Creating...' : 'Create User'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit User Modal */}
      {showEditModal && editingUser && (
        <div className="modal-overlay" onClick={() => setShowEditModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">Edit User</h3>
              <button className="modal-close" onClick={() => setShowEditModal(false)}>&times;</button>
            </div>
            <form onSubmit={handleUpdateUser}>
              <div className="form-group">
                <label className="form-label">Username *</label>
                <input
                  type="text"
                  className="form-input"
                  value={editData.username}
                  onChange={(e) => setEditData({ ...editData, username: e.target.value })}
                  required
                />
              </div>
              <div className="form-group">
                <label className="form-label">Role</label>
                <select
                  className="form-select"
                  value={editData.role}
                  onChange={(e) => setEditData({ ...editData, role: e.target.value })}
                  disabled={editingUser.id === currentUser?.id}
                >
                  <option value="user">User</option>
                  <option value="admin">Admin</option>
                </select>
                {editingUser.id === currentUser?.id && (
                  <small style={{ color: '#666', marginTop: 4, display: 'block' }}>
                    You cannot change your own role
                  </small>
                )}
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowEditModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Reset Password Modal */}
      {showResetPasswordModal && resetPasswordUser && (
        <div className="modal-overlay" onClick={() => setShowResetPasswordModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">Reset Password</h3>
              <button className="modal-close" onClick={() => setShowResetPasswordModal(false)}>&times;</button>
            </div>
            <form onSubmit={handleResetPassword}>
              <div style={{ 
                background: '#fff3e0', 
                padding: 12, 
                borderRadius: 8, 
                marginBottom: 16,
                display: 'flex',
                alignItems: 'center',
                gap: 8
              }}>
                <Key size={18} color="#e65100" />
                <span>
                  Resetting password for <strong>{resetPasswordUser.username}</strong>
                </span>
              </div>
              <div className="form-group">
                <label className="form-label">New Password *</label>
                <input
                  type="password"
                  className="form-input"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Enter new password (min 6 characters)"
                  required
                  minLength={6}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Confirm Password *</label>
                <input
                  type="password"
                  className="form-input"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Confirm new password"
                  required
                />
                {confirmPassword && newPassword !== confirmPassword && (
                  <small style={{ color: '#d32f2f', marginTop: 4, display: 'block' }}>
                    Passwords do not match
                  </small>
                )}
                {confirmPassword && newPassword === confirmPassword && (
                  <small style={{ color: '#2e7d32', marginTop: 4, display: 'flex', alignItems: 'center', gap: 4 }}>
                    <Check size={14} /> Passwords match
                  </small>
                )}
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowResetPasswordModal(false)}>
                  Cancel
                </button>
                <button 
                  type="submit" 
                  className="btn btn-primary" 
                  disabled={saving || newPassword !== confirmPassword || newPassword.length < 6}
                >
                  {saving ? 'Resetting...' : 'Reset Password'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default AdminPage;
