import React, { useState, useEffect } from 'react';
import { createCategory, updateCategory } from '../../services/employees/rulesService';
import StatusMsg from '../../components/ui/StatusMsg';
import '../../styles/ManagementForms.css';

const CategoryFormModal = ({ isOpen, onClose, editingItem, onSave }) => {
  const [form, setForm] = useState({ name: '', icon: '', description: '', sort_order: 0 });
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState({ type: '', text: '' });

  useEffect(() => {
    if (editingItem) {
      setForm({
        name: editingItem.name || '',
        icon: editingItem.icon || '',
        description: editingItem.description || '',
        sort_order: editingItem.sort_order || 0,
      });
    } else {
      setForm({ name: '', icon: '', description: '', sort_order: 0 });
    }
    setStatus({ type: '', text: '' });
  }, [editingItem, isOpen]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (editingItem) {
        await updateCategory(editingItem.id, form);
      } else {
        await createCategory(form);
      }
      setStatus({ type: 'success', text: `Category ${editingItem ? 'updated' : 'created'} successfully!` });
      setTimeout(() => { onSave(); onClose(); }, 800);
    } catch (err) {
      setStatus({ type: 'error', text: `Error: ${err.message}` });
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content hub-modal" onClick={e => e.stopPropagation()}>
        <header className="modal-header">
          <h2>{editingItem ? 'Edit Category' : 'New Category'}</h2>
          <button className="close-modal" onClick={onClose}>&times;</button>
        </header>
        <form onSubmit={handleSubmit} className="vertical-task-form">
          <div className="modal-content-area">
            <div className="form-row-grid">
              <div className="form-group">
                <label>Category Name</label>
                <div className="form-input-container">
                  <input
                    type="text"
                    value={form.name}
                    onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                    placeholder="e.g. Safety, HR Policy, Conduct"
                    required
                  />
                </div>
              </div>
              <div className="form-group">
                <label>Icon (Emoji)</label>
                <div className="form-input-container">
                  <input
                    type="text"
                    value={form.icon}
                    onChange={e => setForm(p => ({ ...p, icon: e.target.value }))}
                    placeholder="e.g. 🛡️ 📋 👥"
                  />
                </div>
              </div>
            </div>
            <div className="form-group">
              <label>Description</label>
              <div className="form-input-container">
                <textarea
                  style={{ minHeight: '80px' }}
                  rows={3}
                  value={form.description}
                  onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
                  placeholder="Brief description of this category"
                  onKeyDown={e => {
                    if (e.key === 'Enter') {
                      e.stopPropagation();
                    }
                  }}
                />
              </div>
            </div>
            <div className="form-group">
              <label>Sort Order</label>
              <div className="form-input-container">
                <input
                  type="number"
                  value={form.sort_order}
                  onChange={e => setForm(p => ({ ...p, sort_order: Number(e.target.value) }))}
                  min={0}
                />
              </div>
            </div>
            <StatusMsg msg={status} />
          </div>
          <div className="modal-footer">
            <button type="button" className="halo-button cancel-btn" onClick={onClose}>Cancel</button>
            <button type="submit" className="halo-button save-btn" disabled={saving}>
              {saving ? 'Saving...' : (editingItem ? 'Update' : 'Create')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CategoryFormModal;
