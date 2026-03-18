import React, { useState, useEffect } from 'react';
import { supabase } from '../../services/supabaseClient';

/**
 * ClientForm
 *
 * 2-page wizard form for adding/editing client records.
 * Page 1: Client Details (Name, Category, Billing Model)
 * Page 2: PoC Details (PoC Name, Contact Number, Email)
 */
const ClientForm = ({ onSubmit, loading, initialData = {}, isViewOnly = false }) => {
  const [currentPage, setCurrentPage] = useState(1);
  const [categories, setCategories] = useState([]);
  const [billingModels, setBillingModels] = useState([]);

  useEffect(() => {
    const fetchDropdowns = async () => {
      const [catRes, modelRes] = await Promise.all([
        supabase.from('client_categories').select('id, name, code').order('name'),
        supabase.from('client_billing_models').select('id, name, code').order('name'),
      ]);
      if (catRes.data) setCategories(catRes.data);
      if (modelRes.data) setBillingModels(modelRes.data);
    };
    fetchDropdowns();
  }, []);

  const [formData, setFormData] = useState({
    name: initialData.name || '',
    category_id: initialData.category_id || '',
    billing_model_id: initialData.billing_model_id || '',
    poc_name: initialData.poc_name || '',
    poc_phone: initialData.poc_phone || '',
    poc_email: initialData.poc_email || '',
  });

  const handleChange = (e) => {
    if (isViewOnly) return;
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const normalizePhone = (phone) => {
    let p = phone.replace(/\s+/g, '');
    if (p.startsWith('0')) p = '+91' + p.substring(1);
    else if (p && !p.startsWith('+')) p = '+91' + p;
    return p;
  };

  const validatePage = (page) => {
    if (page === 1) {
      if (!formData.name.trim()) {
        alert('Client Name is required.');
        return false;
      }
    }
    if (page === 2) {
      if (formData.poc_phone) {
        const p = normalizePhone(formData.poc_phone);
        if (p.startsWith('+91') && p.length < 13) {
          alert('Indian phone numbers must have at least 10 digits after +91.');
          return false;
        }
        setFormData(prev => ({ ...prev, poc_phone: p }));
      }
    }
    return true;
  };

  const handleNext = (e) => {
    e.preventDefault();
    if (validatePage(currentPage)) {
      setCurrentPage(prev => Math.min(prev + 1, 2));
    }
  };

  const handleBack = (e) => {
    e.preventDefault();
    setCurrentPage(prev => Math.max(prev - 1, 1));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (isViewOnly) return;
    if (!validatePage(currentPage)) return;

    const finalPhone = formData.poc_phone ? normalizePhone(formData.poc_phone) : '';
    onSubmit({ ...formData, poc_phone: finalPhone });
  };

  const inputStyle = {
    width: '100%',
    padding: '10px 14px',
    background: 'var(--input-bg, rgba(255,255,255,0.05))',
    border: '1px solid var(--border-color, rgba(255,255,255,0.1))',
    borderRadius: '8px',
    color: 'var(--text-color, #fff)',
    fontSize: '0.9rem',
    outline: 'none',
    boxSizing: 'border-box',
    opacity: isViewOnly ? 0.7 : 1,
  };

  const labelStyle = {
    display: 'block',
    marginBottom: '6px',
    fontSize: '0.8rem',
    fontWeight: 600,
    color: 'var(--text-color)',
    opacity: 0.7,
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
  };

  const fieldStyle = { marginBottom: '1.25rem' };

  return (
    <form
      className={`employee-form multi-page-flow ${isViewOnly ? 'view-only-mode' : ''}`}
      onSubmit={currentPage === 2 ? handleSubmit : handleNext}
    >
      {/* Wizard Step Indicator */}
      <div className="form-wizard-header">
        <div className={`step ${currentPage >= 1 ? 'active' : ''}`}>1. Client Details</div>
        <div className={`step ${currentPage >= 2 ? 'active' : ''}`}>2. PoC Details</div>
      </div>

      <div className="form-content-area">
        {/* PAGE 1: Client Details */}
        {currentPage === 1 && (
          <div className="form-page fade-in">
            <div style={fieldStyle}>
              <label style={labelStyle}>Client Name *</label>
              <input
                type="text"
                name="name"
                value={formData.name}
                onChange={handleChange}
                placeholder="e.g. Tata Motors Ltd."
                required
                readOnly={isViewOnly}
                style={inputStyle}
              />
            </div>

            <div style={fieldStyle}>
              <label style={labelStyle}>Category</label>
              <select
                name="category_id"
                value={formData.category_id}
                onChange={handleChange}
                disabled={isViewOnly}
                style={inputStyle}
              >
                <option value="">— Select Category —</option>
                {categories.map(cat => (
                  <option key={cat.id} value={cat.id}>{cat.name} ({cat.code})</option>
                ))}
              </select>
            </div>

            <div style={fieldStyle}>
              <label style={labelStyle}>Billing Model</label>
              <select
                name="billing_model_id"
                value={formData.billing_model_id}
                onChange={handleChange}
                disabled={isViewOnly}
                style={inputStyle}
              >
                <option value="">— Select Billing Model —</option>
                {billingModels.map(model => (
                  <option key={model.id} value={model.id}>{model.name} ({model.code})</option>
                ))}
              </select>
            </div>
          </div>
        )}

        {/* PAGE 2: PoC Details */}
        {currentPage === 2 && (
          <div className="form-page fade-in">
            <div style={fieldStyle}>
              <label style={labelStyle}>PoC Name</label>
              <input
                type="text"
                name="poc_name"
                value={formData.poc_name}
                onChange={handleChange}
                placeholder="Point of Contact Name"
                readOnly={isViewOnly}
                style={inputStyle}
              />
            </div>

            <div style={fieldStyle}>
              <label style={labelStyle}>Contact Number</label>
              <input
                type="tel"
                name="poc_phone"
                value={formData.poc_phone}
                onChange={handleChange}
                placeholder="+91XXXXXXXXXX"
                readOnly={isViewOnly}
                style={inputStyle}
              />
            </div>

            <div style={fieldStyle}>
              <label style={labelStyle}>Email ID</label>
              <input
                type="email"
                name="poc_email"
                value={formData.poc_email}
                onChange={handleChange}
                placeholder="poc@client.com"
                readOnly={isViewOnly}
                style={inputStyle}
              />
            </div>
          </div>
        )}
      </div>

      {/* Footer Controls */}
      <div className="form-footer page-controls">
        {currentPage > 1 && (
          <button type="button" className="halo-button back-btn" onClick={handleBack} disabled={loading}>
            Back
          </button>
        )}
        {currentPage < 2 ? (
          <button type="submit" className="halo-button next-btn">
            {isViewOnly ? 'Next ➔' : 'Continue ➔'}
          </button>
        ) : (
          !isViewOnly && (
            <button type="submit" className="halo-button save-btn" disabled={loading}>
              {loading ? 'Processing...' : (initialData.id ? 'Save Changes' : 'Create Record')}
            </button>
          )
        )}
      </div>
    </form>
  );
};

export default ClientForm;
