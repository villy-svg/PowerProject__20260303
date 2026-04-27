import CustomSelect from '../../components/CustomSelect';

export const BasicDetailsSection = ({ formData, onChange, isViewOnly = false }) => (
  <div className="form-section">
    <h3 className="form-section-header">Basic Details</h3>
    <div className="form-grid">
      <div className="form-group">
        <label>Name</label>
        <div className="form-input-container">
          <input type="text" name="name" value={formData.name} onChange={onChange} placeholder="e.g. John Doe" required disabled={isViewOnly} />
        </div>
      </div>
      <div className="form-group">
        <label>Contact Number</label>
        <div className="form-input-container">
          <input type="tel" name="contactNumber" value={formData.contactNumber} onChange={onChange} placeholder="e.g. +91 9876543210" required disabled={isViewOnly} />
        </div>
      </div>
      <div className="form-group">
        <label>Email ID <span className="optional">(Optional)</span></label>
        <div className="form-input-container">
          <input type="email" name="emailId" value={formData.emailId} onChange={onChange} placeholder="e.g. john.doe@example.com" disabled={isViewOnly} />
        </div>
      </div>
      <div className="form-group">
        <label>Gender</label>
        <div className="form-input-container">
          <CustomSelect
            value={formData.gender}
            onChange={(val) => onChange({ target: { name: 'gender', value: val } })}
            options={[
              { label: 'Select Gender', value: '' },
              { label: 'Male', value: 'Male' },
              { label: 'Female', value: 'Female' },
              { label: 'Other', value: 'Other' },
              { label: 'Prefer not to say', value: 'Prefer not to say' }
            ]}
            disabled={isViewOnly}
          />
        </div>
      </div>
      <div className="form-group">
        <label>Date of Birth <span className="optional">(Optional)</span></label>
        <div className="form-input-container">
          <input type="date" name="dob" value={formData.dob} onChange={onChange} disabled={isViewOnly} />
        </div>
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
        <div className="form-input-container">
          <input type="text" value={formData.emp_code || 'Auto-generated'} readOnly style={{ background: 'transparent', cursor: 'not-allowed', color: 'var(--brand-green)' }} />
        </div>
      </div>
      <div className="form-group">
        <label>Current Badge ID</label>
        <div className="form-input-container">
          <input type="text" value={formData.badge_id || 'Auto-generated'} readOnly style={{ background: 'transparent', cursor: 'not-allowed', color: '#007aff' }} />
        </div>
      </div>
      <div className="form-group">
        <label>Date of Joining</label>
        <div className="form-input-container">
          <input type="date" name="doj" value={formData.doj} onChange={onChange} required disabled={isViewOnly} />
        </div>
      </div>
      <div className="form-group">
        <label>Primary Hub</label>
        <div className="form-input-container">
          <CustomSelect
            value={formData.hub_id}
            onChange={(val) => onChange({ target: { name: 'hub_id', value: val } })}
            options={[
              { label: 'Select primary hub', value: '' },
              { label: 'ALL (Global Access)', value: 'ALL' },
              ...hubs.filter(h => h.name !== 'ALL').map(hub => ({
                label: hub.hub_code || hub.name,
                value: hub.id
              }))
            ]}
            disabled={isViewOnly}
          />
        </div>
      </div>
      <div className="form-group">
        <label>Role</label>
        <div className="form-input-container">
          <CustomSelect
            value={formData.role_id}
            onChange={(val) => onChange({ target: { name: 'role_id', value: val } })}
            options={[
              { label: 'Select Role', value: '' },
              ...roles.map(r => ({
                label: r.role_code ? `[${r.role_code}] ${r.name}` : r.name,
                value: r.id
              }))
            ]}
            disabled={isViewOnly}
          />
        </div>
      </div>
      <div className="form-group">
        <label>Department</label>
        <div className="form-input-container">
          <CustomSelect
            value={formData.department_id}
            onChange={(val) => onChange({ target: { name: 'department_id', value: val } })}
            options={[
              { label: 'Select Department', value: '' },
              ...departments.map(d => ({
                label: d.dept_code ? `[${d.dept_code}] ${d.name}` : d.name,
                value: d.id
              }))
            ]}
            disabled={isViewOnly}
          />
        </div>
      </div>
      <div className="form-group">
        <label>Reporting Manager <span className="optional">(Optional)</span></label>
        <div className="form-input-container">
          <CustomSelect
            value={formData.manager_id}
            onChange={(val) => onChange({ target: { name: 'manager_id', value: val } })}
            options={[
              { label: 'Select Manager', value: '' },
              ...employees
                .filter(e => e.id !== formData.id && e.status === 'Active')
                .map(e => ({
                  label: `${e.full_name} (${e.role_code || 'No Role'})`,
                  value: e.id
                }))
            ]}
            disabled={isViewOnly}
          />
        </div>
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
        <div className="form-input-container">
          <input type="text" name="accountNumber" value={formData.accountNumber} onChange={onChange} placeholder="Enter account number" disabled={isViewOnly} />
        </div>
      </div>
      <div className="form-group">
        <label>IFSC Code <span className="optional">(Optional)</span></label>
        <div className="form-input-container">
          <input type="text" name="ifscCode" value={formData.ifscCode} onChange={onChange} placeholder="e.g. SBIN0001234" disabled={isViewOnly} />
        </div>
      </div>
      <div className="form-group">
        <label>Account Name <span className="optional">(Optional)</span></label>
        <div className="form-input-container">
          <input type="text" name="accountName" value={formData.accountName} onChange={onChange} placeholder="Name as per bank records" disabled={isViewOnly} />
        </div>
      </div>
      <div className="form-group">
        <label>PAN Number <span className="optional">(Optional)</span></label>
        <div className="form-input-container">
          <input type="text" name="panNumber" value={formData.panNumber} onChange={onChange} placeholder="e.g. ABCDE1234F" disabled={isViewOnly} />
        </div>
      </div>
    </div>
  </div>
);
