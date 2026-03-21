import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Plus, Check, X, ClipboardList, Eye, ChevronDown, ChevronUp, Edit2 } from 'lucide-react';
import { getTodos, createTodo, updateTodo, completeTodo, acceptTodo, denyTodo, deleteTodo } from '../services/api';

function TodoBar() {
  const [todos, setTodos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newPriority, setNewPriority] = useState('normal');
  const [denyingId, setDenyingId] = useState(null);
  const [denyReason, setDenyReason] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [editTitle, setEditTitle] = useState('');
  const [editPriority, setEditPriority] = useState('normal');
  const navigate = useNavigate();
  const { user, isHeadEstimator, isAdmin } = useAuth();

  const loadTodos = useCallback(async () => {
    try {
      const response = await getTodos();
      setTodos(response.data.data || []);
    } catch (err) {}
    finally { setLoading(false); }
  }, []);

  useEffect(() => {
    loadTodos();
    const interval = setInterval(loadTodos, 30000);
    return () => clearInterval(interval);
  }, [loadTodos]);

  // Estimate review tasks only visible to head estimator or admin
  const canSeeEstimateReviews = isHeadEstimator() || isAdmin();
  const visibleTodos = todos.filter(t => {
    if (t.type === 'estimate_review' && !canSeeEstimateReviews) return false;
    return true;
  });

  // Auto-expand when there are tasks
  useEffect(() => {
    if (visibleTodos.length > 0 && !expanded) setExpanded(true);
  }, [visibleTodos.length]);

  const handleAdd = async () => {
    if (!newTitle.trim()) return;
    try {
      await createTodo({ title: newTitle.trim(), priority: newPriority });
      setNewTitle('');
      setNewPriority('normal');
      setShowAddForm(false);
      loadTodos();
    } catch (err) {}
  };

  const handleComplete = async (id) => {
    try { await completeTodo(id); loadTodos(); } catch (err) {}
  };
  const handleAccept = async (id) => {
    try { await acceptTodo(id); loadTodos(); } catch (err) {}
  };
  const handleDeny = async (id) => {
    try { await denyTodo(id, denyReason); setDenyingId(null); setDenyReason(''); loadTodos(); } catch (err) {}
  };
  const handleDelete = async (id) => {
    try { await deleteTodo(id); loadTodos(); } catch (err) {}
  };

  const startEdit = (todo) => {
    setEditingId(todo.id);
    setEditTitle(todo.title);
    setEditPriority(todo.priority);
  };

  const handleSaveEdit = async (id) => {
    if (!editTitle.trim()) return;
    try {
      await updateTodo(id, { title: editTitle.trim(), priority: editPriority });
      setEditingId(null);
      loadTodos();
    } catch (err) {}
  };

  if (loading) return null;

  const priorityColors = {
    urgent: { bg: '#ffebee', border: '#ef5350', text: '#c62828', icon: '🔴' },
    high: { bg: '#fff3e0', border: '#ff9800', text: '#e65100', icon: '🟠' },
    normal: { bg: '#e3f2fd', border: '#90caf9', text: '#1565c0', icon: '🔵' },
    low: { bg: '#f5f5f5', border: '#e0e0e0', text: '#666', icon: '⚪' }
  };
  const typeIcons = { estimate_review: '📋', material_order: '📦', urgent: '🚨', general: '📌' };

  // Empty state — clean bar with prominent Add button
  if (visibleTodos.length === 0 && !showAddForm) {
    return (
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '6px 14px', background: '#fafafa', borderRadius: 8,
        border: '1px solid #e0e0e0', marginBottom: 12
      }}>
        <span style={{ fontSize: '0.8rem', color: '#999', display: 'flex', alignItems: 'center', gap: 6 }}>
          <ClipboardList size={14} /> No open tasks
        </span>
        <button onClick={() => setShowAddForm(true)}
          style={{ background: '#1976d2', color: 'white', border: 'none', borderRadius: 4, padding: '4px 12px', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}>
          <Plus size={14} /> Add Task
        </button>
      </div>
    );
  }

  // Add form only (no tasks yet)
  if (visibleTodos.length === 0 && showAddForm) {
    return (
      <div style={{ padding: '10px 14px', background: 'white', borderRadius: 8, border: '1px solid #ffe082', marginBottom: 12 }}>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <input type="text" value={newTitle} onChange={(e) => setNewTitle(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
            placeholder="New task..." autoFocus
            style={{ flex: 1, padding: '8px 12px', border: '1px solid #ddd', borderRadius: 6, fontSize: '0.9rem' }} />
          <select value={newPriority} onChange={(e) => setNewPriority(e.target.value)}
            style={{ padding: '8px', border: '1px solid #ddd', borderRadius: 6, fontSize: '0.85rem' }}>
            <option value="low">Low</option>
            <option value="normal">Normal</option>
            <option value="high">High</option>
            <option value="urgent">Urgent</option>
          </select>
          <button onClick={handleAdd}
            style={{ background: '#1976d2', color: 'white', border: 'none', borderRadius: 6, padding: '8px 16px', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 600 }}>
            Add
          </button>
          <button onClick={() => { setShowAddForm(false); setNewTitle(''); }}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#999', padding: 4 }}>
            <X size={18} />
          </button>
        </div>
      </div>
    );
  }

  // Full bar with tasks
  const urgentCount = visibleTodos.filter(t => t.priority === 'urgent').length;
  const reviewCount = visibleTodos.filter(t => t.type === 'estimate_review').length;

  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '8px 14px', background: '#fff8e1', borderRadius: expanded ? '8px 8px 0 0' : 8,
        border: '1px solid #ffe082', cursor: 'pointer'
      }} onClick={() => setExpanded(!expanded)}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 600, fontSize: '0.85rem', color: '#f57f17' }}>
          <ClipboardList size={16} />
          Tasks ({visibleTodos.length})
          {urgentCount > 0 && <span style={{ background: '#c62828', color: 'white', padding: '1px 8px', borderRadius: 10, fontSize: '0.7rem' }}>{urgentCount} urgent</span>}
          {reviewCount > 0 && <span style={{ background: '#ff9800', color: 'white', padding: '1px 8px', borderRadius: 10, fontSize: '0.7rem' }}>{reviewCount} review</span>}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button onClick={(e) => { e.stopPropagation(); setShowAddForm(!showAddForm); setExpanded(true); }}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#f57f17', padding: 2 }}>
            <Plus size={16} />
          </button>
          {expanded ? <ChevronUp size={16} color="#f57f17" /> : <ChevronDown size={16} color="#f57f17" />}
        </div>
      </div>

      {expanded && (
        <div style={{ border: '1px solid #ffe082', borderTop: 'none', borderRadius: '0 0 8px 8px', background: 'white' }}>
          {showAddForm && (
            <div style={{ padding: '10px 14px', borderBottom: '1px solid #f0f0f0', display: 'flex', gap: 8, alignItems: 'center' }}>
              <input type="text" value={newTitle} onChange={(e) => setNewTitle(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
                placeholder="New task..." autoFocus
                style={{ flex: 1, padding: '6px 10px', border: '1px solid #ddd', borderRadius: 4, fontSize: '0.85rem' }} />
              <select value={newPriority} onChange={(e) => setNewPriority(e.target.value)}
                style={{ padding: '6px 8px', border: '1px solid #ddd', borderRadius: 4, fontSize: '0.8rem' }}>
                <option value="low">Low</option>
                <option value="normal">Normal</option>
                <option value="high">High</option>
                <option value="urgent">Urgent</option>
              </select>
              <button onClick={handleAdd}
                style={{ background: '#1976d2', color: 'white', border: 'none', borderRadius: 4, padding: '6px 12px', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 600 }}>
                Add
              </button>
              <button onClick={() => { setShowAddForm(false); setNewTitle(''); }}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#999', padding: 2 }}>
                <X size={16} />
              </button>
            </div>
          )}

          {visibleTodos.map(todo => {
            const colors = priorityColors[todo.priority] || priorityColors.normal;
            const isEstimateReview = todo.type === 'estimate_review';
            return (
              <div key={todo.id} style={{
                display: 'flex', alignItems: 'center', gap: 10, padding: '8px 14px',
                borderBottom: '1px solid #f5f5f5', fontSize: '0.85rem',
                background: colors.bg, borderLeft: `3px solid ${colors.border}`
              }}>
                <span style={{ fontSize: '0.9rem', flexShrink: 0 }}>{typeIcons[todo.type] || colors.icon}</span>

                {/* Content — edit mode or display */}
                {editingId === todo.id ? (
                  <div style={{ flex: 1, display: 'flex', gap: 6, alignItems: 'center' }}>
                    <input type="text" value={editTitle} onChange={(e) => setEditTitle(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter') handleSaveEdit(todo.id); if (e.key === 'Escape') setEditingId(null); }}
                      autoFocus
                      style={{ flex: 1, padding: '4px 8px', border: '1px solid #90caf9', borderRadius: 4, fontSize: '0.85rem' }} />
                    <select value={editPriority} onChange={(e) => setEditPriority(e.target.value)}
                      style={{ padding: '4px 6px', border: '1px solid #ddd', borderRadius: 4, fontSize: '0.75rem' }}>
                      <option value="low">Low</option>
                      <option value="normal">Normal</option>
                      <option value="high">High</option>
                      <option value="urgent">Urgent</option>
                    </select>
                    <button onClick={() => handleSaveEdit(todo.id)}
                      style={{ background: '#1976d2', color: 'white', border: 'none', borderRadius: 4, padding: '4px 10px', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 600 }}>
                      Save
                    </button>
                    <button onClick={() => setEditingId(null)}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#999' }}>
                      <X size={14} />
                    </button>
                  </div>
                ) : (
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 600, color: colors.text }}>{todo.title}</div>
                    {todo.description && <div style={{ fontSize: '0.8rem', color: '#666', marginTop: 2 }}>{todo.description}</div>}
                    <div style={{ fontSize: '0.7rem', color: '#999', marginTop: 2 }}>
                      {todo.createdBy && `by ${todo.createdBy}`}
                      {todo.assignedTo && ` → ${todo.assignedTo}`}
                      {' · '}{new Date(todo.createdAt).toLocaleDateString()}
                    </div>
                  </div>
                )}

                {todo.estimateId && (
                  <button onClick={() => navigate(`/estimates/${todo.estimateId}`)}
                    style={{ background: '#e3f2fd', border: '1px solid #90caf9', borderRadius: 4, padding: '4px 10px', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 600, color: '#1565c0', display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0, whiteSpace: 'nowrap' }}>
                    <Eye size={12} /> {todo.estimateNumber || 'View Estimate'}
                  </button>
                )}

                {isEstimateReview ? (
                  <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                    {denyingId === todo.id ? (
                      <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                        <input type="text" value={denyReason} onChange={(e) => setDenyReason(e.target.value)}
                          onKeyDown={(e) => e.key === 'Enter' && handleDeny(todo.id)}
                          placeholder="Reason..." autoFocus
                          style={{ padding: '4px 8px', border: '1px solid #ddd', borderRadius: 4, fontSize: '0.75rem', width: 150 }} />
                        <button onClick={() => handleDeny(todo.id)}
                          style={{ background: '#c62828', color: 'white', border: 'none', borderRadius: 4, padding: '4px 8px', cursor: 'pointer', fontSize: '0.7rem' }}>Send</button>
                        <button onClick={() => { setDenyingId(null); setDenyReason(''); }}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#999' }}><X size={14} /></button>
                      </div>
                    ) : (
                      <>
                        <button onClick={() => handleAccept(todo.id)} title="Accept — pricing looks good"
                          style={{ background: '#2e7d32', color: 'white', border: 'none', borderRadius: 4, padding: '4px 10px', cursor: 'pointer', fontSize: '0.7rem', fontWeight: 600 }}>✓ Accept</button>
                        <button onClick={() => setDenyingId(todo.id)} title="Deny — needs changes"
                          style={{ background: '#c62828', color: 'white', border: 'none', borderRadius: 4, padding: '4px 10px', cursor: 'pointer', fontSize: '0.7rem', fontWeight: 600 }}>✕ Deny</button>
                      </>
                    )}
                  </div>
                ) : (
                  <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                    <button onClick={() => startEdit(todo)} title="Edit task"
                      style={{ background: '#e3f2fd', border: '1px solid #90caf9', borderRadius: 4, padding: '4px 8px', cursor: 'pointer' }}>
                      <Edit2 size={14} color="#1565c0" />
                    </button>
                    <button onClick={() => { if (window.confirm(`Complete task: "${todo.title}"?`)) handleComplete(todo.id); }} title="Mark complete"
                      style={{ background: '#e8f5e9', border: '1px solid #a5d6a7', borderRadius: 4, padding: '4px 8px', cursor: 'pointer' }}>
                      <Check size={14} color="#2e7d32" />
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default TodoBar;
