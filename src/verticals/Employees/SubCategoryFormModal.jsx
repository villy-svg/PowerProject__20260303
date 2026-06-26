import React, { useState, useEffect } from 'react';
import { createSubCategory, updateSubCategory } from '../../services/employees/rulesService';
import CustomSelect from '../../components/ui/CustomSelect';
import StatusMsg from '../../components/ui/StatusMsg';
import '../../styles/ManagementForms.css';

const SubCategoryFormModal = ({ isOpen, onClose, editingItem, categories, onSave }) => {
  const [form, setForm] = useState({ category_id: '', name: '', sort_order: 0 });
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState({ type: '', text: '' });

  useEffect(() => {
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
    if (!form.category_id) { setStatus({ type: 'error', text: 'Please select a parent category.' }); return; }
    setSaving(true);
    try {
      if (editingItem) {
        await updateSubCategory(editingItem.id, form);
      } else {
        await createSubCategory(form);
      }
      setStatus({ type: 'success', text: `Sub-category ${editingItem ? 'updated' : 'created'}!` });
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
          <h2>{editingItem ? 'Edit Sub-Category' : 'New Sub-Category'}</h2>
          <button className="close-modal" onClick={onClose}>&times;</button>
        </header>
        <form onSubmit={handleSubmit} className="vertical-task-form">
          <div className="modal-content-area">
            <div className="form-group">
              <label>Parent Category</label>
              <div className="form-input-container">
                <CustomSelect
                  className="master-dropdown"
                  value={form.category_id}
                  onChange={val => setForm(p => ({ ...p, category_id: val }))}
                  options={[
                    { value: '', label: '— Select Category —' },
                    ...categories.map(cat => ({ value: cat.id, label: `${cat.icon ? `${cat.icon} ` : ''}${cat.name}` }))
                  ]}
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
                    onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
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
                    onChange={e => setForm(p => ({ ...p, sort_order: Number(e.target.value) }))}
                    min={0}
                  />
                </div>
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

export default SubCategoryFormModal;
