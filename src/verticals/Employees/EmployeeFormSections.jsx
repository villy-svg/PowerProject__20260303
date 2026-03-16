import React from 'react';

export const BasicDetailsSection = ({ formData, onChange }) => (
  <div className="form-section">
    <h3 className="form-section-header">Basic Details</h3>
    <div className="form-grid">
      <div className="form-group">
        <label>Name</label>
        <input type="text" name="name" value={formData.name} onChange={onChange} placeholder="e.g. John Doe" required />
      </div>
      <div className="form-group">
        <label>Contact Number</label>
        <input type="tel" name="contactNumber" value={formData.contactNumber} onChange={onChange} placeholder="e.g. +91 9876543210" required />
      </div>
      <div className="form-group">
        <label>Email ID <span className="optional">(Optional)</span></label>
        <input type="email" name="emailId" value={formData.emailId} onChange={onChange} placeholder="e.g. john.doe@example.com" />
      </div>
      <div className="form-group">
        <label>Gender</label>
        <select name="gender" value={formData.gender} onChange={onChange} required>
          <option value="">Select Gender</option>
          <option value="Male">Male</option>
          <option value="Female">Female</option>
          <option value="Other">Other</option>
          <option value="Prefer not to say">Prefer not to say</option>
        </select>
      </div>
      <div className="form-group">
        <label>Date of Birth</label>
        <input type="date" name="dob" value={formData.dob} onChange={onChange} required />
      </div>
    </div>
  </div>
);

export const CompanyDetailsSection = ({ formData, onChange, hubs, departments, roles }) => (
  <div className="form-section" style={{ marginTop: '2rem' }}>
    <h3 className="form-section-header">Company Details</h3>
    <div className="form-grid">
      <div className="form-group">
        <label>Date of Joining</label>
        <input type="date" name="doj" value={formData.doj} onChange={onChange} required />
      </div>
      <div className="form-group">
        <label>Primary Hub</label>
        <select name="hub_id" value={formData.hub_id} onChange={onChange} required>
          <option value="">Select primary hub</option>
          <option value="ALL">ALL (Global Access)</option>
          {hubs.filter(h => h.name !== 'ALL').map(hub => (
            <option key={hub.id} value={hub.id}>{hub.hub_code || hub.name}</option>
          ))}
        </select>
      </div>
      <div className="form-group">
        <label>Role</label>
        <select name="role" value={formData.role} onChange={onChange} required>
          <option value="">Select Role</option>
          {roles.map(r => (
            <option key={r.name} value={r.name}>{r.role_code ? `[${r.role_code}] ` : ''}{r.name}</option>
          ))}
        </select>
      </div>
      <div className="form-group">
        <label>Department</label>
        <select name="department" value={formData.department} onChange={onChange} required>
          <option value="">Select Department</option>
          {departments.map(d => (
            <option key={d.name} value={d.name}>{d.dept_code ? `[${d.dept_code}] ` : ''}{d.name}</option>
          ))}
        </select>
      </div>
    </div>
  </div>
);

export const BankDetailsSection = ({ formData, onChange }) => (
  <div className="form-section">
    <h3 className="form-section-header">Bank Details</h3>
    <div className="form-grid">
      <div className="form-group">
        <label>Account Number</label>
        <input type="text" name="accountNumber" value={formData.accountNumber} onChange={onChange} placeholder="Enter account number" required />
      </div>
      <div className="form-group">
        <label>IFSC Code</label>
        <input type="text" name="ifscCode" value={formData.ifscCode} onChange={onChange} placeholder="e.g. SBIN0001234" required />
      </div>
      <div className="form-group">
        <label>Account Name</label>
        <input type="text" name="accountName" value={formData.accountName} onChange={onChange} placeholder="Name as per bank records" required />
      </div>
    </div>
  </div>
);
