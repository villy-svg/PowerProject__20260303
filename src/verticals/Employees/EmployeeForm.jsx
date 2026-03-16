import React, { useState, useEffect } from 'react';
import { supabase } from '../../services/supabaseClient';
import './EmployeeForm.css';

/**
 * EmployeeForm
 * 
 * Form for adding or editing employee records.
 * Features a vertical split layout with Basic and Bank details.
 */
const EmployeeForm = ({ onSubmit, loading, initialData = {} }) => {
  const [currentPage, setCurrentPage] = useState(1);
  const [hubs, setHubs] = useState([]);

  // Fetch Hubs for Company Details dropdown
  useEffect(() => {
    const fetchHubs = async () => {
      const { data } = await supabase.from('hubs').select('id, name, hub_code').order('name');
      if (data) setHubs(data);
    };
    fetchHubs();
  }, []);

  const [formData, setFormData] = useState({
    name: initialData.name || '',
    contactNumber: initialData.contactNumber || '',
    emailId: initialData.emailId || '',
    gender: initialData.gender || '',
    dob: initialData.dob || '',
    doj: initialData.doj || new Date().toISOString().split('T')[0], // Default today
    hub_id: initialData.hub_id || '',
    role: initialData.role || '',
    department: initialData.department || '',
    accountNumber: initialData.accountNumber || '',
    ifscCode: initialData.ifscCode || '',
    accountName: initialData.accountName || ''
  });

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleNext = (e) => {
    e.preventDefault();
    if (currentPage === 1) setCurrentPage(2);
  };

  const handleBack = (e) => {
    e.preventDefault();
    if (currentPage === 2) setCurrentPage(1);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit(formData);
  };

  return (
    <form className="employee-form slide-transition" onSubmit={currentPage === 2 ? handleSubmit : handleNext}>
      {/* PAGE 1 */}
      {currentPage === 1 && (
        <div className="form-page fade-in">
          {/* Basic Details Section */}
          <div className="form-section">
            <h3 className="form-section-header">Basic Details</h3>
            <div className="form-grid">
              <div className="form-group">
                <label>Name</label>
                <input
                  type="text"
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  placeholder="e.g. John Doe"
                  required
                />
              </div>
              <div className="form-group">
                <label>Contact Number</label>
                <input
                  type="tel"
                  name="contactNumber"
                  value={formData.contactNumber}
                  onChange={handleChange}
                  placeholder="e.g. +91 9876543210"
                  required
                />
              </div>
              <div className="form-group">
                <label>Email ID <span className="optional">(Optional)</span></label>
                <input
                  type="email"
                  name="emailId"
                  value={formData.emailId}
                  onChange={handleChange}
                  placeholder="e.g. john.doe@example.com"
                />
              </div>
              <div className="form-group">
                <label>Gender</label>
                <select
                  name="gender"
                  value={formData.gender}
                  onChange={handleChange}
                  required
                >
                  <option value="">Select Gender</option>
                  <option value="Male">Male</option>
                  <option value="Female">Female</option>
                  <option value="Other">Other</option>
                  <option value="Prefer not to say">Prefer not to say</option>
                </select>
              </div>
              <div className="form-group">
                <label>Date of Birth</label>
                <input
                  type="date"
                  name="dob"
                  value={formData.dob}
                  onChange={handleChange}
                  required
                />
              </div>
            </div>
          </div>

          {/* Company Details Section */}
          <div className="form-section" style={{ marginTop: '2rem' }}>
            <h3 className="form-section-header">Company Details</h3>
            <div className="form-grid">
              <div className="form-group">
                <label>Date of Joining</label>
                <input
                  type="date"
                  name="doj"
                  value={formData.doj}
                  onChange={handleChange}
                  required
                />
              </div>
              <div className="form-group">
                <label>Primary Hub</label>
                <select
                  name="hub_id"
                  value={formData.hub_id}
                  onChange={handleChange}
                  required
                >
                  <option value="">Select primary hub</option>
                  <option value="ALL">ALL (Global Access)</option>
                  {hubs.filter(h => h.name !== 'ALL').map(hub => (
                    <option key={hub.id} value={hub.id}>{hub.hub_code || hub.name}</option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label>Role</label>
                <input
                  type="text"
                  name="role"
                  value={formData.role}
                  onChange={handleChange}
                  placeholder="e.g. Site Manager"
                  required
                />
              </div>
              <div className="form-group">
                <label>Department</label>
                <select
                  name="department"
                  value={formData.department}
                  onChange={handleChange}
                  required
                >
                  <option value="">Select Department</option>
                  <option value="Operations">Operations</option>
                  <option value="Maintenance">Maintenance</option>
                  <option value="Support">Support</option>
                  <option value="Management">Management</option>
                </select>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* PAGE 2 */}
      {currentPage === 2 && (
        <div className="form-page fade-in">
          {/* Bank Details Section */}
          <div className="form-section">
            <h3 className="form-section-header">Bank Details</h3>
            <div className="form-grid">
              <div className="form-group">
                <label>Account Number</label>
                <input
                  type="text"
                  name="accountNumber"
                  value={formData.accountNumber}
                  onChange={handleChange}
                  placeholder="Enter account number"
                  required
                />
              </div>
              <div className="form-group">
                <label>IFSC Code</label>
                <input
                  type="text"
                  name="ifscCode"
                  value={formData.ifscCode}
                  onChange={handleChange}
                  placeholder="e.g. SBIN0001234"
                  required
                />
              </div>
              <div className="form-group">
                <label>Account Name</label>
                <input
                  type="text"
                  name="accountName"
                  value={formData.accountName}
                  onChange={handleChange}
                  placeholder="Name as per bank records"
                  required
                />
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="form-footer page-controls">
        {currentPage === 2 && (
          <button type="button" className="halo-button back-btn" onClick={handleBack} disabled={loading}>
            Back
          </button>
        )}
        {currentPage === 1 ? (
          <button type="submit" className="halo-button next-btn">
            Next Level ➔
          </button>
        ) : (
          <button type="submit" className="halo-button save-btn" disabled={loading}>
            {loading ? 'Processing...' : (initialData.id ? 'Update Record' : 'Add Employee')}
          </button>
        )}
      </div>
    </form>
  );
};

export default EmployeeForm;
