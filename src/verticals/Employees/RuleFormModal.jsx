import React, { useState, useEffect } from 'react';
import { createRule, updateRule } from '../../services/employees/rulesService';
import StatusMsg from '../../components/ui/StatusMsg';
import CustomSelect from '../../components/ui/CustomSelect';
import '../../styles/ManagementForms.css';

const RuleFormModal = ({ isOpen, onClose, editingItem, categories, subCategories, userId, onSave }) => {
  const [form, setForm] = useState({
    category_id: '',
    sub_category_id: '',
    title: '',
    impact: '',
    content: '',
    drive_url: '',
    effective_date: '',
    is_active: true,
    sort_order: 0,
  });
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState({ type: '', text: '' });
  const [hasDraft, setHasDraft] = useState(false);

  const filteredSubs = form.category_id
    ? subCategories.filter(s => s.category_id === form.category_id)
    : [];

  useEffect(() => {
    if (isOpen) {
      if (editingItem) {
        setForm({
          category_id: editingItem.category_id || '',
          sub_category_id: editingItem.sub_category_id || '',
          title: editingItem.title || '',
          impact: editingItem.impact || '',
          content: editingItem.content || '',
          drive_url: editingItem.drive_url || '',
          effective_date: editingItem.effective_date || '',
          is_active: editingItem.is_active !== false,
          sort_order: editingItem.sort_order || 0,
        });
        setHasDraft(false);
      } else {
        const savedDraft = localStorage.getItem('rule_form_draft');
        if (savedDraft) {
          try {
            const parsed = JSON.parse(savedDraft);
            setForm(parsed);
            setHasDraft(true);
          } catch (e) {
            console.error('Error parsing draft:', e);
          }
        } else {
          setForm({
            category_id: categories[0]?.id || '',
            sub_category_id: '',
            title: '',
            impact: '',
            content: '',
            drive_url: '',
            effective_date: '',
            is_active: true,
            sort_order: 0,
          });
          setHasDraft(false);
        }
      }
      setStatus({ type: '', text: '' });
    }
  }, [editingItem, isOpen, categories]);

  // Save draft to localStorage on change if not editing.
  // Require category_id so a restored draft never fails validation immediately.
  useEffect(() => {
    if (!editingItem && isOpen && form.category_id && (form.title || form.impact || form.content || form.drive_url)) {
      localStorage.setItem('rule_form_draft', JSON.stringify(form));
    }
  }, [form, editingItem, isOpen]);

  const handleDiscardDraft = () => {
    localStorage.removeItem('rule_form_draft');
    setForm({
      category_id: categories[0]?.id || '',
      sub_category_id: '',
      title: '',
      impact: '',
      content: '',
      drive_url: '',
      effective_date: '',
      is_active: true,
      sort_order: 0,
    });
    setHasDraft(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.category_id) {
      setStatus({ type: 'error', text: 'Please select a category.' });
      return;
    }
    setSaving(true);
    try {
      const payload = {
        ...form,
        sub_category_id: form.sub_category_id || null,
        impact: form.impact || null,
        drive_url: form.drive_url || null,
        effective_date: form.effective_date || null,
        created_by: userId,
      };
      if (editingItem) {
        await updateRule(editingItem.id, payload);
      } else {
        await createRule(payload);
        localStorage.removeItem('rule_form_draft');
        setHasDraft(false);
      }
      setStatus({ type: 'success', text: `Rule ${editingItem ? 'updated' : 'created'}!` });
      setTimeout(() => {
        onSave();
        onClose();
      }, 800);
    } catch (err) {
      setStatus({ type: 'error', text: `Error: ${err.message}` });
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  const categoryOptions = categories.map(cat => ({
    value: cat.id,
    label: cat.icon ? `${cat.icon} ${cat.name}` : cat.name
  }));

  const subCategoryOptions = filteredSubs.map(sub => ({
    value: sub.id,
    label: sub.name
  }));

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content hub-modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '680px' }}>
        <header className="modal-header">
          <h2>{editingItem ? 'Edit Rule' : 'New Rule'}</h2>
          <button className="close-modal" onClick={onClose}>&times;</button>
        </header>
        <form onSubmit={handleSubmit} className="vertical-task-form">
          <div className="modal-content-area">
            {hasDraft && (
              <div className="status-message success" style={{ marginBottom: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span>📝 Restored unfinished draft from your browser.</span>
                <button 
                  type="button" 
                  onClick={handleDiscardDraft} 
                  style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontWeight: 'bold', fontSize: '0.75rem', textDecoration: 'underline' }}
                >
                  Discard Draft
                </button>
              </div>
            )}
            <div className="form-row-grid">
              <div className="form-group">
                <label>Category</label>
                <div className="form-input-container">
                  <CustomSelect
                    value={form.category_id}
                    onChange={val => setForm(p => ({ ...p, category_id: val, sub_category_id: '' }))}
                    options={categoryOptions}
                    placeholder="Select Category"
                    required
                  />
                </div>
              </div>
              <div className="form-group">
                <label>Sub-Category (optional)</label>
                <div className="form-input-container">
                  <CustomSelect
                    value={form.sub_category_id}
                    onChange={val => setForm(p => ({ ...p, sub_category_id: val }))}
                    options={subCategoryOptions}
                    placeholder={filteredSubs.length === 0 ? "No Sub-Categories" : "None"}
                    disabled={filteredSubs.length === 0}
                  />
                </div>
              </div>
            </div>
            <div className="form-group">
              <label>Rule Title</label>
              <div className="form-input-container">
                <input
                  type="text"
                  value={form.title}
                  onChange={e => setForm(p => ({ ...p, title: e.target.value }))}
                  placeholder="e.g. Mandatory Safety Gear Policy"
                  required
                />
              </div>
            </div>
            <div className="form-group">
              <label>Impact (optional)</label>
              <div className="form-input-container">
                <textarea
                  value={form.impact}
                  onChange={e => setForm(p => ({ ...p, impact: e.target.value }))}
                  placeholder="e.g. High, Medium, Low, or key consequences"
                  rows={2}
                />
              </div>
            </div>
            <div className="form-group">
              <label>Content / Description</label>
              <div className="form-input-container">
                <textarea
                  value={form.content}
                  onChange={e => setForm(p => ({ ...p, content: e.target.value }))}
                  placeholder="Write the full rule text here. Supports plain text and line breaks."
                />
              </div>
            </div>
            <div className="form-row-grid">
              <div className="form-group">
                <label>Google Drive URL (optional)</label>
                <div className="form-input-container">
                  <input
                    type="url"
                    value={form.drive_url}
                    onChange={e => setForm(p => ({ ...p, drive_url: e.target.value }))}
                    placeholder="https://drive.google.com/..."
                  />
                </div>
              </div>
              <div className="form-group">
                <label>Effective Date</label>
                <div className="form-input-container">
                  <input
                    type="date"
                    value={form.effective_date}
                    onChange={e => setForm(p => ({ ...p, effective_date: e.target.value }))}
                  />
                </div>
              </div>
            </div>
            <div className="form-row-grid">
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
              <div className="form-group" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', paddingTop: '0.25rem' }}>
                <label style={{ margin: 0 }}>Active</label>
                <button
                  type="button"
                  className={`rule-toggle ${form.is_active ? 'on' : ''}`}
                  onClick={() => setForm(p => ({ ...p, is_active: !p.is_active }))}
                  title={form.is_active ? 'Active — click to deactivate' : 'Inactive — click to activate'}
                />
              </div>
            </div>
            <StatusMsg msg={status} />
          </div>
          <div className="modal-footer">
            <button type="button" className="halo-button cancel-btn" onClick={onClose}>Cancel</button>
            <button type="submit" className="halo-button save-btn" disabled={saving}>
              {saving ? 'Saving...' : (editingItem ? 'Update Rule' : 'Create Rule')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default RuleFormModal;
