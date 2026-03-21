import React, { useState, useEffect } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { Package, Inbox, PlusCircle, Settings, Shield, LogOut, CalendarClock, DollarSign, Database, Hash, ShoppingCart, FileCode, Truck, Users, Wrench, FileText } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import WalterJoke from './WalterJoke';
import TodoBar from './TodoBar';
import { getScrapPending, confirmScrapPickup, getPendingOrders, getEmailNotifications, dismissEmailNotification } from '../services/api';

function Layout({ children }) {
  const navigate = useNavigate();
  const { user, logout, isAdmin } = useAuth();
  const [scrapPending, setScrapPending] = useState([]);
  const [pendingOrderCount, setPendingOrderCount] = useState(0);
  const [emailNotifications, setEmailNotifications] = useState([]);

  useEffect(() => {
    const loadPending = () => {
      getScrapPending().then(res => setScrapPending(res.data.data || [])).catch(() => {});
      getPendingOrders('pending').then(res => setPendingOrderCount((res.data.data || []).length)).catch(() => {});
      getEmailNotifications().then(res => setEmailNotifications(res.data.data || [])).catch(() => {});
    };
    loadPending();
    const interval = setInterval(loadPending, 60000);
    return () => clearInterval(interval);
  }, []);

  const handleConfirmPickup = async (type) => {
    const label = type === 'steel' ? 'Steel Scrap' : 'Stainless & Aluminum';
    if (!window.confirm(`Confirm ${label} has been picked up?`)) return;
    try {
      await confirmScrapPickup(type);
      setScrapPending(prev => prev.filter(p => p.type !== type));
    } catch (err) { /* ignore */ }
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="layout">
      <aside className="sidebar" style={{ display: 'flex', flexDirection: 'column' }}>
        <div className="sidebar-header">
          <img 
            src="/logo.png" 
            alt="Carolina Rolling Co." 
            style={{ width: 48, height: 48, borderRadius: '50%', objectFit: 'cover' }} 
          />
          <div>
            <h1>CR Admin</h1>
            <p>Carolina Rolling</p>
          </div>
        </div>
        <nav style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
          <ul className="sidebar-nav">
            <li><NavLink to="/inventory" className={({ isActive }) => isActive ? 'active' : ''}><Package size={20} /><span>Inventory</span></NavLink></li>
            <li><NavLink to="/scheduling" className={({ isActive }) => isActive ? 'active' : ''}><CalendarClock size={20} /><span>Scheduling</span></NavLink></li>
            <li><NavLink to="/shipments" className={({ isActive }) => isActive ? 'active' : ''}><Truck size={20} /><span>Shipments</span></NavLink></li>
            <li><NavLink to="/inbound" className={({ isActive }) => isActive ? 'active' : ''}><Inbox size={20} /><span>Inbound</span></NavLink></li>
            <li><NavLink to="/purchase-orders" className={({ isActive }) => isActive ? 'active' : ''}><ShoppingCart size={20} /><span>Purchase Orders</span></NavLink></li>
            <li><NavLink to="/pending-orders" className={({ isActive }) => isActive ? 'active' : ''}><FileCode size={20} /><span>Pending Orders</span>{pendingOrderCount > 0 && <span style={{ marginLeft: 'auto', background: '#E65100', color: 'white', borderRadius: 10, padding: '1px 7px', fontSize: '0.7rem', fontWeight: 700, minWidth: 18, textAlign: 'center' }}>{pendingOrderCount}</span>}</NavLink></li>
            <li><NavLink to="/estimates" className={({ isActive }) => isActive ? 'active' : ''}><DollarSign size={20} /><span>Estimates</span></NavLink></li>
            <li><NavLink to="/clients-vendors" className={({ isActive }) => isActive ? 'active' : ''}><Users size={20} /><span>Clients & Vendors</span></NavLink></li>
            <li><NavLink to="/shop-supplies" className={({ isActive }) => isActive ? 'active' : ''}><Package size={20} /><span>Shop Supplies</span></NavLink></li>
            <li><NavLink to="/invoicing" className={({ isActive }) => isActive ? 'active' : ''}><FileText size={20} /><span>Invoice Center</span></NavLink></li>
            {isAdmin() && (
              <>
                <li style={{ 
                  marginTop: 16, paddingTop: 16, 
                  borderTop: '1px solid rgba(255,255,255,0.1)',
                  fontSize: '0.7rem', color: 'rgba(255,255,255,0.5)',
                  paddingLeft: 20, textTransform: 'uppercase', letterSpacing: 1
                }}>
                  Admin
                </li>
                <li><NavLink to="/admin/dr-numbers" className={({ isActive }) => isActive ? 'active' : ''}><Hash size={20} /><span>DR Numbers</span></NavLink></li>
                <li><NavLink to="/admin/po-numbers" className={({ isActive }) => isActive ? 'active' : ''}><Hash size={20} /><span>PO Numbers</span></NavLink></li>
                <li><NavLink to="/admin/invoice-numbers" className={({ isActive }) => isActive ? 'active' : ''}><FileText size={20} /><span>Invoice Numbers</span></NavLink></li>
                <li><NavLink to="/admin/users-logs" className={({ isActive }) => isActive ? 'active' : ''}><Shield size={20} /><span>Users & Logs</span></NavLink></li>
                <li><NavLink to="/admin/shop-config" className={({ isActive }) => isActive ? 'active' : ''}><Wrench size={20} /><span>Shop Config</span></NavLink></li>
                <li><NavLink to="/admin/settings" className={({ isActive }) => isActive ? 'active' : ''}><Settings size={20} /><span>Settings</span></NavLink></li>
                <li><NavLink to="/admin/backup" className={({ isActive }) => isActive ? 'active' : ''}><Database size={20} /><span>Backup</span></NavLink></li>
              </>
            )}
          </ul>
        </nav>
        
        {/* User info and logout */}
        <div style={{ 
          flexShrink: 0,
          padding: '12px 20px',
          borderTop: '1px solid rgba(255,255,255,0.1)',
          background: 'rgba(0,0,0,0.1)'
        }}>
          <div style={{ 
            color: 'rgba(255,255,255,0.8)', 
            fontSize: '0.8rem',
            marginBottom: 8
          }}>
            Logged in as <strong>{user?.username}</strong>
            {user?.role === 'admin' && (
              <span style={{ 
                marginLeft: 6,
                background: 'rgba(255,255,255,0.2)',
                padding: '2px 6px',
                borderRadius: 4,
                fontSize: '0.7rem'
              }}>
                Admin
              </span>
            )}
          </div>
          <button
            onClick={handleLogout}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              background: 'rgba(255,255,255,0.1)',
              border: 'none',
              color: 'white',
              padding: '8px 12px',
              borderRadius: 6,
              cursor: 'pointer',
              width: '100%',
              fontSize: '0.85rem'
            }}
          >
            <LogOut size={16} />
            <span>Sign Out</span>
          </button>
        </div>
      </aside>
      <main className="main-content">
        <WalterJoke />
        <TodoBar />
        {scrapPending.length > 0 && (
          <div style={{ margin: '0 0 12px 0' }}>
            {scrapPending.map(p => (
              <div key={p.type} style={{ background: '#FFF3E0', border: '2px solid #FFB74D', borderRadius: 8, padding: '10px 16px', marginBottom: 8, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ fontSize: '1.3rem' }}>♻️</span>
                  <div>
                    <div style={{ fontWeight: 700, color: '#E65100', fontSize: '0.9rem' }}>
                      {p.label} Pickup Requested
                    </div>
                    <div style={{ fontSize: '0.8rem', color: '#888' }}>
                      {p.requestedAt && new Date(p.requestedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                      {p.requestedBy && ` by ${p.requestedBy}`}
                    </div>
                  </div>
                </div>
                <button onClick={() => handleConfirmPickup(p.type)}
                  style={{ background: '#388E3C', color: 'white', border: 'none', borderRadius: 6, padding: '8px 16px', fontWeight: 700, cursor: 'pointer', fontSize: '0.85rem', whiteSpace: 'nowrap' }}>
                  ✅ Confirm Picked Up
                </button>
              </div>
            ))}
          </div>
        )}
        {pendingOrderCount > 0 && (
          <div style={{ margin: '0 0 12px 0' }}>
            <div style={{ background: '#E3F2FD', border: '2px solid #1565C0', borderRadius: 8, padding: '10px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: '1.3rem' }}>📋</span>
                <div>
                  <div style={{ fontWeight: 700, color: '#1565C0', fontSize: '0.9rem' }}>
                    {pendingOrderCount} Pending Order{pendingOrderCount > 1 ? 's' : ''} Awaiting Approval
                  </div>
                  <div style={{ fontSize: '0.8rem', color: '#666' }}>
                    Purchase orders detected from email scanner
                  </div>
                </div>
              </div>
              <button onClick={() => navigate('/pending-orders')}
                style={{ background: '#1565C0', color: 'white', border: 'none', borderRadius: 6, padding: '8px 16px', fontWeight: 700, cursor: 'pointer', fontSize: '0.85rem', whiteSpace: 'nowrap' }}>
                Review Orders
              </button>
            </div>
          </div>
        )}
        {emailNotifications.length > 0 && (
          <div style={{ margin: '0 0 12px 0', display: 'flex', flexDirection: 'column', gap: 6 }}>
            {emailNotifications.map(n => (
              <div key={n.id} style={{ background: '#FFF3E0', border: '1px solid #FFB74D', borderRadius: 8, padding: '8px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, minWidth: 0 }}>
                  <span style={{ fontSize: '1.1rem' }}>📧</span>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontWeight: 600, color: '#E65100', fontSize: '0.85rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      New email from {n.fromName || n.fromEmail}
                    </div>
                    <div style={{ fontSize: '0.78rem', color: '#888', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {n.subject || '(no subject)'} — {n.receivedAt ? new Date(n.receivedAt).toLocaleString() : ''}
                    </div>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                  {n.gmailLink && (
                    <a href={n.gmailLink} target="_blank" rel="noopener noreferrer"
                      onClick={async () => {
                        try {
                          await dismissEmailNotification(n.id);
                          setEmailNotifications(prev => prev.filter(x => x.id !== n.id));
                        } catch {}
                      }}
                      style={{ background: '#E65100', color: 'white', border: 'none', borderRadius: 6, padding: '6px 12px', fontWeight: 600, cursor: 'pointer', fontSize: '0.8rem', textDecoration: 'none', whiteSpace: 'nowrap' }}>
                      Open Email
                    </a>
                  )}
                  <button onClick={async () => {
                    try {
                      await dismissEmailNotification(n.id);
                      setEmailNotifications(prev => prev.filter(x => x.id !== n.id));
                    } catch {}
                  }} style={{ background: 'none', border: '1px solid #ccc', borderRadius: 6, padding: '6px 10px', cursor: 'pointer', fontSize: '0.8rem', color: '#888' }}>
                    ✕
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
        {children}
      </main>
    </div>
  );
}

export default Layout;
