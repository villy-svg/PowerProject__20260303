import React, { useState } from 'react';
import './EmployeeForm.css';

/**
 * EmployeeForm
 * 
 * Form for adding or editing employee records.
 * Features a vertical split layout with Basic and Bank details.
 */
const EmployeeForm = ({ onSubmit, loading, initialData = {} }) => {
  const [formData, setFormData] = useState({
    name: initialData.name || '',
    contactNumber: initialData.contactNumber || '',
    emailId: initialData.emailId || '',
    gender: initialData.gender || '',
    dob: initialData.dob || '',
    accountNumber: initialData.accountNumber || '',
    ifscCode: initialData.ifscCode || '',
    accountName: initialData.accountName || ''
  });

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit(formData);
  };

  return (
    <form className="employee-form" onSubmit={handleSubmit}>
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

      <div className="form-footer">
        <button type="submit" className="halo-button save-btn" disabled={loading}>
          {loading ? 'Processing...' : (initialData.id ? 'Update Record' : 'Add Employee')}
        </button>
      </div>
    </form>
  );
};

export default EmployeeForm;
