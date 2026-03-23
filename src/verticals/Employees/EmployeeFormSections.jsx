import React from 'react';

export const BasicDetailsSection = ({ formData, onChange, isViewOnly = false }) => (
  <div className="form-section">
    <h3 className="form-section-header">Basic Details</h3>
    <div className="form-grid">
      <div className="form-group">
        <label>Name</label>
        <input type="text" name="name" value={formData.name} onChange={onChange} placeholder="e.g. John Doe" required disabled={isViewOnly} />
      </div>
      <div className="form-group">
        <label>Contact Number</label>
        <input type="tel" name="contactNumber" value={formData.contactNumber} onChange={onChange} placeholder="e.g. +91 9876543210" required disabled={isViewOnly} />
      </div>
      <div className="form-group">
        <label>Email ID <span className="optional">(Optional)</span></label>
        <input type="email" name="emailId" value={formData.emailId} onChange={onChange} placeholder="e.g. john.doe@example.com" disabled={isViewOnly} />
      </div>
      <div className="form-group">
        <label>Gender</label>
        <select name="gender" value={formData.gender} onChange={onChange} required disabled={isViewOnly}>
          <option value="">Select Gender</option>
          <option value="Male">Male</option>
          <option value="Female">Female</option>
          <option value="Other">Other</option>
          <option value="Prefer not to say">Prefer not to say</option>
        </select>
      </div>
      <div className="form-group">
        <label>Date of Birth <span className="optional">(Optional)</span></label>
        <input type="date" name="dob" value={formData.dob} onChange={onChange} disabled={isViewOnly} />
      </div>
    </div>
  </div>
);

export const CompanyDetailsSection = ({ formData, onChange, hubs, departments, roles, employees = [], isViewOnly = false }) => (
  <div className="form-section" style={{ marginTop: '2rem' }}>
    <h3 className="form-section-header">Company Details</h3>
    <div className="form-grid">
      <div className="form-group">
        <label>Employee ID (Permanent)</label>
        <input type="text" value={formData.emp_code || 'Auto-generated'} readOnly style={{ background: 'rgba(255,255,255,0.02)', cursor: 'not-allowed', color: 'var(--brand-green)' }} />
      </div>
      <div className="form-group">
        <label>Current Badge ID</label>
        <input type="text" value={formData.badge_id || 'Auto-generated'} readOnly style={{ background: 'rgba(255,255,255,0.02)', cursor: 'not-allowed', color: '#007aff' }} />
      </div>
      <div className="form-group">
        <label>Date of Joining</label>
        <input type="date" name="doj" value={formData.doj} onChange={onChange} required disabled={isViewOnly} />
      </div>
      <div className="form-group">
        <label>Primary Hub</label>
        <select name="hub_id" value={formData.hub_id} onChange={onChange} required disabled={isViewOnly}>
          <option value="">Select primary hub</option>
          <option value="ALL">ALL (Global Access)</option>
          {hubs.filter(h => h.name !== 'ALL').map(hub => (
            <option key={hub.id} value={hub.id}>{hub.hub_code || hub.name}</option>
          ))}
        </select>
      </div>
      <div className="form-group">
        <label>Role</label>
        <select name="role_id" value={formData.role_id} onChange={onChange} required disabled={isViewOnly}>
          <option value="">Select Role</option>
          {roles.map(r => (
            <option key={r.id} value={r.id}>{r.role_code ? `[${r.role_code}] ` : ''}{r.name}</option>
          ))}
        </select>
      </div>
      <div className="form-group">
        <label>Department</label>
        <select name="department_id" value={formData.department_id} onChange={onChange} required disabled={isViewOnly}>
          <option value="">Select Department</option>
          {departments.map(d => (
            <option key={d.id} value={d.id}>{d.dept_code ? `[${d.dept_code}] ` : ''}{d.name}</option>
          ))}
        </select>
      </div>
      <div className="form-group">
        <label>Reporting Manager <span className="optional">(Optional)</span></label>
        <select name="manager_id" value={formData.manager_id} onChange={onChange} disabled={isViewOnly}>
          <option value="">Select Manager</option>
          {employees
            .filter(e => e.id !== formData.id && e.status === 'Active')
            .map(e => (
              <option key={e.id} value={e.id}>{e.full_name} ({e.role_code || 'No Role'})</option>
            ))
          }
        </select>
      </div>
    </div>
  </div>
);

export const BankDetailsSection = ({ formData, onChange, isViewOnly = false }) => (
  <div className="form-section">
    <h3 className="form-section-header">Bank Details</h3>
    <div className="form-grid">
      <div className="form-group">
        <label>Account Number <span className="optional">(Optional)</span></label>
        <input type="text" name="accountNumber" value={formData.accountNumber} onChange={onChange} placeholder="Enter account number" disabled={isViewOnly} />
      </div>
      <div className="form-group">
        <label>IFSC Code <span className="optional">(Optional)</span></label>
        <input type="text" name="ifscCode" value={formData.ifscCode} onChange={onChange} placeholder="e.g. SBIN0001234" disabled={isViewOnly} />
      </div>
      <div className="form-group">
        <label>Account Name <span className="optional">(Optional)</span></label>
        <input type="text" name="accountName" value={formData.accountName} onChange={onChange} placeholder="Name as per bank records" disabled={isViewOnly} />
      </div>
      <div className="form-group">
        <label>PAN Number <span className="optional">(Optional)</span></label>
        <input type="text" name="panNumber" value={formData.panNumber} onChange={onChange} placeholder="e.g. ABCDE1234F" disabled={isViewOnly} />
      </div>
    </div>
  </div>
);
