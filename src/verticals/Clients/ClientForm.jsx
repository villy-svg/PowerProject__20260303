import React, { useState, useEffect } from 'react';
import { supabase } from '../../services/supabaseClient';
import './ClientForm.css';
import '../ChargingHubs/HubManagement.css'; // For switch/slider styles

/**
 * ClientForm
 *
 * 2-page wizard form for adding/editing client records.
 * Page 1: Client Details (Name, Category, Billing Model)
 * Page 2: PoC Details (PoC Name, Contact Number, Email)
 */
const ClientForm = ({ onSubmit, loading, initialData = {}, isViewOnly = false }) => {
  const [currentPage, setCurrentPage] = useState(1);
  const [vehicleCategories, setVehicleCategories] = useState([]);
  const [serviceCategories, setServiceCategories] = useState([]);
  const [billingModels, setBillingModels] = useState([]);

  useEffect(() => {
    const fetchDropdowns = async () => {
      const [catRes, modelRes] = await Promise.all([
        supabase.from('client_categories').select('id, name, code, category_type').order('name'),
        supabase.from('client_billing_models').select('id, name, code').order('name'),
      ]);
      if (catRes.data) {
        setVehicleCategories(catRes.data.filter(c => c.category_type === 'VEHICLE'));
        setServiceCategories(catRes.data.filter(c => c.category_type === 'SERVICE'));
      }
      if (modelRes.data) setBillingModels(modelRes.data);
    };
    fetchDropdowns();
  }, []);

  const [formData, setFormData] = useState({
    name: initialData.name || '',
    billing_model_id: initialData.billing_model_id || '',
    category_matrix: initialData.category_matrix || {}, // { vehicleId: { serviceId: true } }
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

  const selectStyle = {
    ...inputStyle,
    color: 'var(--brand-green)',
    fontWeight: 600,
    cursor: 'pointer'
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
      className={`client-form multi-page-flow ${isViewOnly ? 'view-only-mode' : ''}`}
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
            <div className="form-group">
              <label>Client Name *</label>
              <input
                type="text"
                name="name"
                value={formData.name}
                onChange={handleChange}
                placeholder="e.g. Tata Motors Ltd."
                required
                readOnly={isViewOnly}
              />
            </div>

            <div className="form-group" style={{ marginTop: '1.5rem' }}>
              <label>Service Category Matrix</label>
              <div className="matrix-container">
                <table className="permissions-table client-matrix-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr>
                      <th style={{ textAlign: 'left', padding: '12px' }}>Vehicle Category</th>
                      {serviceCategories.map(service => (
                        <th key={service.id} style={{ textAlign: 'center', padding: '12px', fontSize: '0.75rem' }}>
                          {service.code || service.name}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {vehicleCategories.map(vehicle => (
                      <tr key={vehicle.id} style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                        <td style={{ padding: '12px', fontSize: '0.85rem', fontWeight: 600 }}>
                          {vehicle.name} <span style={{ opacity: 0.5, fontSize: '0.7rem' }}>({vehicle.code})</span>
                        </td>
                        {serviceCategories.map(service => {
                          const isChecked = formData.category_matrix[vehicle.id]?.[service.id] || false;
                          return (
                            <td key={service.id} style={{ textAlign: 'center', padding: '12px' }}>
                              <label className="switch" style={{ margin: '0 auto' }}>
                                <input
                                  type="checkbox"
                                  checked={isChecked}
                                  onChange={() => {
                                    if (isViewOnly) return;
                                    const currentMatrix = { ...formData.category_matrix };
                                    if (!currentMatrix[vehicle.id]) currentMatrix[vehicle.id] = {};
                                    currentMatrix[vehicle.id][service.id] = !isChecked;
                                    setFormData(prev => ({ ...prev, category_matrix: currentMatrix }));
                                  }}
                                  disabled={isViewOnly}
                                />
                                <span className="slider"></span>
                              </label>
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                    {vehicleCategories.length === 0 && (
                      <tr>
                        <td colSpan={serviceCategories.length + 1} style={{ textAlign: 'center', padding: '20px', opacity: 0.5 }}>
                          No vehicle categories defined.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
              <p style={{ fontSize: '0.7rem', opacity: 0.5, marginTop: '8px' }}>
                * Select the services applicable for each vehicle category.
              </p>
            </div>

            <div className="form-group" style={{ marginTop: '1rem' }}>
              <label>Billing Model</label>
              <select
                name="billing_model_id"
                value={formData.billing_model_id}
                onChange={handleChange}
                disabled={isViewOnly}
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
            <div className="form-group">
              <label>PoC Name</label>
              <input
                type="text"
                name="poc_name"
                value={formData.poc_name}
                onChange={handleChange}
                placeholder="Point of Contact Name"
                readOnly={isViewOnly}
              />
            </div>

            <div className="form-group">
              <label>Contact Number</label>
              <input
                type="tel"
                name="poc_phone"
                value={formData.poc_phone}
                onChange={handleChange}
                placeholder="+91XXXXXXXXXX"
                readOnly={isViewOnly}
              />
            </div>

            <div className="form-group">
              <label>Email ID</label>
              <input
                type="email"
                name="poc_email"
                value={formData.poc_email}
                onChange={handleChange}
                placeholder="poc@client.com"
                readOnly={isViewOnly}
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
