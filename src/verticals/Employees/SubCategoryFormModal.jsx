import React, { useState, useEffect, useRef } from 'react';
import { createSubCategory, updateSubCategory } from '../../services/employees/rulesService';
import CustomSelect from '../../components/ui/CustomSelect';
import RuleModalShell from './RuleModalShell';

const SubCategoryFormModal = ({ isOpen, onClose, editingItem, categories = [], onSave }) => {
  const [form, setForm] = useState({ category_id: '', name: '', sort_order: 0 });
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
        category_id: editingItem.category_id || '',
        name: editingItem.name || '',
        sort_order: editingItem.sort_order || 0,
      });
    } else {
      setForm({ category_id: categories[0]?.id || '', name: '', sort_order: 0 });
    }
    setStatus({ type: '', text: '' });
  }, [editingItem, isOpen, categories]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.category_id) {
      setStatus({ type: 'error', text: 'Please select a parent category.' });
      return;
    }
    setSaving(true);
    try {
      if (editingItem) {
        await updateSubCategory(editingItem.id, form);
      } else {
        await createSubCategory(form);
      }
      setStatus({ type: 'success', text: `Sub-category ${editingItem ? 'updated' : 'created'}!` });
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

  const categoryOptions = categories.map((cat) => ({
    value: cat.id,
    label: cat.icon ? `${cat.icon} ${cat.name}` : cat.name,
  }));

  return (
    <RuleModalShell
      isOpen={isOpen}
      onClose={onClose}
      title={editingItem ? 'Edit Sub-Category' : 'New Sub-Category'}
      onSubmit={handleSubmit}
      saving={saving}
      submitLabel={editingItem ? 'Update' : 'Create'}
      status={status}
    >
      <div className="form-group">
        <label>Parent Category</label>
        <div className="form-input-container">
          <CustomSelect
            value={form.category_id}
            onChange={(val) => setForm((p) => ({ ...p, category_id: val }))}
            options={categoryOptions}
            placeholder="Select Category"
            required
          />
        </div>
      </div>

      <div className="form-row-grid">
        <div className="form-group">
          <label>Sub-Category Name</label>
          <div className="form-input-container">
            <input
              type="text"
              value={form.name}
              onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
              placeholder="e.g. Emergency Procedures"
              required
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
      </div>
    </RuleModalShell>
  );
};

export default SubCategoryFormModal;
