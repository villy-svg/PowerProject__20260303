import React, { useState, useEffect } from 'react';
import { createRule, updateRule, createCategory, fetchCategories } from '../../services/employees/rulesService';
import StatusMsg from '../../components/ui/StatusMsg';
import '../../styles/ManagementForms.css';

const TutorialFormModal = ({ isOpen, onClose, editingItem, user, onSave }) => {
  const [categories, setCategories] = useState([]);
  const [form, setForm] = useState({
    title: '',
    description: '',
    category_id: '',
    new_category_name: '',
    content: '',
  });
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState({ type: '', text: '' });

  useEffect(() => {
    const loadCategories = async () => {
      try {
        const cats = await fetchCategories();
        setCategories(cats);
      } catch (err) {
        console.error('Failed to load categories:', err);
      }
    };
    if (isOpen) {
      loadCategories();
    }
  }, [isOpen]);

  useEffect(() => {
    if (isOpen) {
      if (editingItem) {
        // We are editing an existing tutorial card
        const isRule = editingItem.id.startsWith('rule_');
        setForm({
          title: editingItem.title || '',
          description: editingItem.description || '',
          category_id: isRule ? (editingItem.category_id || '') : '',
          new_category_name: !isRule ? (editingItem.category || '') : '',
          content: isRule ? (editingItem.content || '') : '',
        });
      } else {
        // Creating a new tutorial (which will be a dynamic rule under the hood)
        setForm({
          title: '',
          description: '',
          category_id: '',
          new_category_name: '',
          content: '1. First step text here.',
        });
      }
      setStatus({ type: '', text: '' });
    }
  }, [editingItem, isOpen]);

  if (!isOpen) return null;

  const isEditing = !!editingItem;
  const isRule = editingItem?.id?.startsWith('rule_');
  const isStatic = isEditing && !isRule;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setStatus({ type: '', text: '' });

    try {
      if (isStatic) {
        // Overwriting metadata of a static tutorial in localStorage
        const metaOverrideKey = `powerpod_tutorial_meta_override_${editingItem.id}`;
        const newMetadata = {
          title: form.title,
          description: form.description,
          category: form.new_category_name || editingItem.category
        };
        localStorage.setItem(metaOverrideKey, JSON.stringify(newMetadata));
        
        setStatus({ type: 'success', text: 'Static tutorial info updated in local storage!' });
        setTimeout(() => {
          onSave();
          onClose();
        }, 800);
      } else {
        // Dynamic DB-backed tutorial (rule)
        let finalCategoryId = form.category_id;

        // If user entered a custom category name, create it first
        if (form.new_category_name && (!form.category_id || form.category_id === 'new')) {
          const newCat = await createCategory({
            name: form.new_category_name,
            sort_order: categories.length + 1,
            description: `Generated from tutorial creation.`
          });
          finalCategoryId = newCat.id;
        }

        if (!finalCategoryId && !isEditing) {
          throw new Error('Please select a category or type a new one.');
        }

        const payload = {
          title: form.title,
          impact: form.description, // Subtitle/description maps to impact
          content: form.content || '',
          category_id: finalCategoryId,
          is_active: true,
          created_by: user?.id || null
        };

        if (isEditing) {
          const ruleId = editingItem.id.replace('rule_', '');
          // Keep existing properties of rule unless updated
          const updatedPayload = {
            title: payload.title,
            impact: payload.impact,
          };
          if (finalCategoryId) {
            updatedPayload.category_id = finalCategoryId;
          }
          await updateRule(ruleId, updatedPayload);
          setStatus({ type: 'success', text: 'Tutorial updated successfully!' });
        } else {
          await createRule(payload);
          setStatus({ type: 'success', text: 'New tutorial created successfully!' });
        }

        setTimeout(() => {
          onSave();
          onClose();
        }, 800);
      }
    } catch (err) {
      setStatus({ type: 'error', text: err.message });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content hub-modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '580px' }}>
        <header className="modal-header">
          <h2>{isEditing ? `Edit Tutorial: ${editingItem.title}` : 'Create New Tutorial'}</h2>
          <button className="close-modal" onClick={onClose}>&times;</button>
        </header>

        <form onSubmit={handleSubmit} className="vertical-task-form">
          <div className="modal-content-area">
            
            {/* Category selection - Hidden for static updates unless custom typed */}
            {!isStatic && (
              <div className="form-row-grid">
                <div className="form-group">
                  <label>Select Category</label>
                  <div className="form-input-container">
                    <select
                      className="master-dropdown"
                      value={form.category_id}
                      onChange={e => setForm(p => ({ ...p, category_id: e.target.value }))}
                      required={!form.new_category_name}
                    >
                      <option value="">— Choose Existing —</option>
                      {categories.map(cat => (
                        <option key={cat.id} value={cat.id}>{cat.name}</option>
                      ))}
                      <option value="new">+ Type New Category...</option>
                    </select>
                  </div>
                </div>
              </div>
            )}

            {/* Custom Category Input */}
            {(!isStatic && (form.category_id === 'new' || !form.category_id)) && (
              <div className="form-group">
                <label>New Category Name</label>
                <div className="form-input-container">
                  <input
                    type="text"
                    value={form.new_category_name}
                    onChange={e => setForm(p => ({ ...p, new_category_name: e.target.value }))}
                    placeholder="e.g. Daily Routines"
                    required
                  />
                </div>
              </div>
            )}

            {/* Title */}
            <div className="form-group">
              <label>Tutorial Title</label>
              <div className="form-input-container">
                <input
                  type="text"
                  value={form.title}
                  onChange={e => setForm(p => ({ ...p, title: e.target.value }))}
                  placeholder="e.g. Getting Started with Charging Stations"
                  required
                />
              </div>
            </div>

            {/* Description / Subtitle */}
            <div className="form-group">
              <label>Description / Sub-title</label>
              <div className="form-input-container">
                <textarea
                  value={form.description}
                  onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
                  placeholder="A short summary of what this tutorial covers..."
                  rows={3}
                  required
                />
              </div>
            </div>

            {/* Initial Slide Content (Only for new rules/tutorials) */}
            {!isEditing && (
              <div className="form-group">
                <label>Initial Slide Content (Rules Format)</label>
                <div className="form-input-container">
                  <textarea
                    value={form.content}
                    onChange={e => setForm(p => ({ ...p, content: e.target.value }))}
                    placeholder="Write the initial slide texts here. E.g.:&#10;Welcome to this system onboarding.&#10;1. This is the first slide point.&#10;2. This is the second slide point."
                    rows={5}
                    required
                  />
                </div>
              </div>
            )}

            <StatusMsg msg={status} />
          </div>

          <div className="modal-footer">
            <button type="button" className="halo-button cancel-btn" onClick={onClose}>Cancel</button>
            <button type="submit" className="halo-button save-btn" disabled={saving}>
              {saving ? 'Saving...' : (isEditing ? 'Save Changes' : 'Create Tutorial')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default TutorialFormModal;
