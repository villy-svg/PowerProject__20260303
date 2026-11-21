import React, { useState, useEffect, useRef } from 'react';
import { createRule, updateRule } from '../../services/employees/rulesService';
import CustomSelect from '../../components/ui/CustomSelect';
import RuleModalShell from './RuleModalShell';

const RULE_DRAFT_KEY = 'rule_form_draft';

const getEmptyRuleForm = (defaultCategoryId = '') => ({
  category_id: defaultCategoryId,
  sub_category_id: '',
  title: '',
  impact: '',
  content: '',
  drive_url: '',
  effective_date: '',
  is_active: true,
  sort_order: 0,
});

const RuleFormModal = ({
  isOpen,
  onClose,
  editingItem,
  categories = [],
  subCategories = [],
  userId,
  onSave,
}) => {
  const [form, setForm] = useState(() => getEmptyRuleForm());
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState({ type: '', text: '' });
  const [hasDraft, setHasDraft] = useState(false);
  const closeTimerRef = useRef(null);

  const filteredSubs = form.category_id
    ? subCategories.filter((s) => s.category_id === form.category_id)
    : [];

  // Clear pending auto-close timer on unmount or manual close
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
      const savedDraft = localStorage.getItem(RULE_DRAFT_KEY);
      if (savedDraft) {
        try {
          const parsed = JSON.parse(savedDraft);
          setForm({ ...getEmptyRuleForm(categories[0]?.id || ''), ...parsed });
          setHasDraft(true);
        } catch (e) {
          console.error('[RuleFormModal] Error parsing draft:', e);
          setForm(getEmptyRuleForm(categories[0]?.id || ''));
          setHasDraft(false);
        }
      } else {
        setForm(getEmptyRuleForm(categories[0]?.id || ''));
        setHasDraft(false);
      }
    }
    setStatus({ type: '', text: '' });
  }, [editingItem, isOpen, categories]);

  // Save draft to localStorage on change when creating a new rule.
  // Require category_id so a restored draft never fails validation immediately.
  useEffect(() => {
    if (
      !editingItem &&
      isOpen &&
      form.category_id &&
      (form.title || form.impact || form.content || form.drive_url)
    ) {
      localStorage.setItem(RULE_DRAFT_KEY, JSON.stringify(form));
    }
  }, [form, editingItem, isOpen]);

  const handleDiscardDraft = () => {
    localStorage.removeItem(RULE_DRAFT_KEY);
    setForm(getEmptyRuleForm(categories[0]?.id || ''));
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
      };
      if (editingItem) {
        // Preserve original created_by on updates
        await updateRule(editingItem.id, payload);
      } else {
        await createRule({ ...payload, created_by: userId });
        localStorage.removeItem(RULE_DRAFT_KEY);
        setHasDraft(false);
      }
      setStatus({ type: 'success', text: `Rule ${editingItem ? 'updated' : 'created'}!` });
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

  const subCategoryOptions = filteredSubs.map((sub) => ({
    value: sub.id,
    label: sub.name,
  }));

  return (
    <RuleModalShell
      isOpen={isOpen}
      onClose={onClose}
      title={editingItem ? 'Edit Rule' : 'New Rule'}
      onSubmit={handleSubmit}
      saving={saving}
      submitLabel={editingItem ? 'Update Rule' : 'Create Rule'}
      status={status}
      modalClassName="rule-modal-wide"
    >
      {hasDraft && (
        <div className="status-message success u-flex-between u-mb-16">
          <span>📝 Restored unfinished draft from your browser.</span>
          <button
            type="button"
            onClick={handleDiscardDraft}
            className="rule-discard-draft-btn"
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
              onChange={(val) => setForm((p) => ({ ...p, category_id: val, sub_category_id: '' }))}
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
              onChange={(val) => setForm((p) => ({ ...p, sub_category_id: val }))}
              options={subCategoryOptions}
              placeholder={filteredSubs.length === 0 ? 'No Sub-Categories' : 'None'}
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
            onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))}
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
            onChange={(e) => setForm((p) => ({ ...p, impact: e.target.value }))}
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
            onChange={(e) => setForm((p) => ({ ...p, content: e.target.value }))}
            placeholder="Write the full rule text here. Supports plain text and line breaks."
            rows={4}
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
              onChange={(e) => setForm((p) => ({ ...p, drive_url: e.target.value }))}
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
              onChange={(e) => setForm((p) => ({ ...p, effective_date: e.target.value }))}
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
              onChange={(e) => setForm((p) => ({ ...p, sort_order: Number(e.target.value) }))}
              min={0}
            />
          </div>
        </div>
        <div className="form-group rule-active-toggle-group">
          <label>Active</label>
          <button
            type="button"
            className={`rule-toggle ${form.is_active ? 'on' : ''}`}
            onClick={() => setForm((p) => ({ ...p, is_active: !p.is_active }))}
            title={form.is_active ? 'Active — click to deactivate' : 'Inactive — click to activate'}
            aria-pressed={form.is_active}
          />
        </div>
      </div>
    </RuleModalShell>
  );
};

export default RuleFormModal;
