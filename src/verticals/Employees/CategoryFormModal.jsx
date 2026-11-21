import React, { useState, useEffect, useRef } from 'react';
import { createCategory, updateCategory } from '../../services/employees/rulesService';
import RuleModalShell from './RuleModalShell';

const EMPTY_CATEGORY_FORM = { name: '', icon: '', description: '', sort_order: 0 };

const CategoryFormModal = ({ isOpen, onClose, editingItem, onSave }) => {
  const [form, setForm] = useState(EMPTY_CATEGORY_FORM);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState({ type: '', text: '' });
  const closeTimerRef = useRef(null);

  useEffect(() => {
    return () => {
      if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
    };
  }, []);

  useEffect(() => {
    if (!isOpen) {
      if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
      return;
    }

    if (editingItem) {
      setForm({
        name: editingItem.name || '',
        icon: editingItem.icon || '',
        description: editingItem.description || '',
        sort_order: editingItem.sort_order || 0,
      });
    } else {
      setForm(EMPTY_CATEGORY_FORM);
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
      closeTimerRef.current = setTimeout(() => {
        onSave();
        onClose();
      }, 800);
    } catch (err) {
      setStatus({ type: 'error', text: `Error: ${err.message}` });
    } finally {
      setSaving(false);
    }
  };

  return (
    <RuleModalShell
      isOpen={isOpen}
      onClose={onClose}
      title={editingItem ? 'Edit Category' : 'New Category'}
      onSubmit={handleSubmit}
      saving={saving}
      submitLabel={editingItem ? 'Update' : 'Create'}
      status={status}
    >
      <div className="form-row-grid">
        <div className="form-group">
          <label>Category Name</label>
          <div className="form-input-container">
            <input
              type="text"
              value={form.name}
              onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
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
              onChange={(e) => setForm((p) => ({ ...p, icon: e.target.value }))}
              placeholder="e.g. 🛡️ 📋 👥"
            />
          </div>
        </div>
      </div>

      <div className="form-group">
        <label>Description</label>
        <div className="form-input-container">
          <textarea
            rows={3}
            value={form.description}
            onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
            placeholder="Brief description of this category"
            onKeyDown={(e) => {
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
            onChange={(e) => setForm((p) => ({ ...p, sort_order: Number(e.target.value) }))}
            min={0}
          />
        </div>
      </div>
    </RuleModalShell>
  );
};

export default CategoryFormModal;
