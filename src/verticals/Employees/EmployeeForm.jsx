import React, { useState, useEffect } from 'react';
import { supabase } from '../../services/core/supabaseClient';
import './EmployeeForm.css';
import { BasicDetailsSection, CompanyDetailsSection, BankDetailsSection } from './EmployeeFormSections';
import { hierarchyUtils } from '../../utils/hierarchyUtils';

/**
 * EmployeeForm
 * 
 * Form for adding or editing employee records.
 * Features a 3-page wizard flow with View-Only support.
 */
const EmployeeForm = ({ onSubmit, loading, initialData = {}, isViewOnly = false }) => {
  const [currentPage, setCurrentPage] = useState(1);
  const [hubs, setHubs] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [roles, setRoles] = useState([]);
  const [allEmployees, setAllEmployees] = useState([]);

  // Fetch Hubs, Departments, Roles, and Employees for dropdowns
  useEffect(() => {
    const fetchCompanyData = async () => {
      const [hubsRes, deptRes, roleRes, empRes] = await Promise.all([
        supabase.from('hubs').select('id, name, hub_code').order('name'),
        supabase.from('departments').select('id, name, dept_code').order('name'),
        supabase.from('employee_roles').select('id, name, role_code').order('name'),
        supabase.from('employees').select('id, full_name, role_id, status').order('full_name')
      ]);
      
      if (hubsRes.data) setHubs(hubsRes.data);
      if (deptRes.data) setDepartments(deptRes.data);
      if (roleRes.data) setRoles(roleRes.data);
      
      if (empRes.data) {
        const roleSubset = roleRes.data || [];
        const enrichedEmps = empRes.data.map(e => ({
          ...e,
          role_code: roleSubset.find(r => r.id === e.role_id)?.role_code || ''
        }));
        setAllEmployees(enrichedEmps);
      }
    };
    fetchCompanyData();
  }, []);

  const [formData, setFormData] = useState({
    name: initialData.name || '',
    contactNumber: initialData.contactNumber || '',
    emailId: initialData.emailId || '',
    gender: initialData.gender || '',
    dob: initialData.dob || '',
    doj: initialData.doj || new Date().toISOString().split('T')[0],
    hub_id: initialData.hub_id || '',
    role_id: initialData.role_id || '',
    department_id: initialData.department_id || '',
    manager_id: initialData.manager_id || '',
    accountNumber: initialData.accountNumber || '',
    ifscCode: initialData.ifscCode || '',
    accountName: initialData.accountName || '',
    panNumber: initialData.panNumber || '',
    emp_code: initialData.emp_code || '',
    badge_id: initialData.badge_id || ''
  });

  const handleChange = (e) => {
    if (isViewOnly) return;
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const validatePage = (page) => {
    if (page === 1) {
      if (!formData.name.trim()) { alert('Name is required'); return false; }
      
      let phone = formData.contactNumber.replace(/\s+/g, '');
      if (phone.startsWith('0')) phone = '+91' + phone.substring(1);
      else if (phone && !phone.startsWith('+')) phone = '+91' + phone;
      
      if (phone && phone.startsWith('+91') && phone.length < 13) {
        alert('Indian phone numbers must have at least 10 digits after +91.');
        return false;
      }
      setFormData(prev => ({ ...prev, contactNumber: phone }));
      return true;
    }
    if (page === 2) {
      if (formData.manager_id && initialData.id) {
        const isCycle = hierarchyUtils.detectCycle(allEmployees, initialData.id, formData.manager_id);
        if (isCycle) {
          alert('Circular Reporting Error: This manager reports to this employee (directly or indirectly). Please select a different manager.');
          return false;
        }
      }
      return true;
    }
    return true;
  };

  const handleNext = (e) => {
    e.preventDefault();
    if (validatePage(currentPage)) {
      setCurrentPage(prev => Math.min(prev + 1, 3));
    }
  };

  const handleBack = (e) => {
    e.preventDefault();
    setCurrentPage(prev => Math.max(prev - 1, 1));
  };

  const handleSubmit = (e) => {
    if (e) e.preventDefault();
    if (isViewOnly) return;
    onSubmit(formData);
  };

  const handleSaveAndExit = (e) => {
    e.preventDefault();
    if (isViewOnly) return;
    if (validatePage(currentPage)) {
      onSubmit(formData);
    }
  };

  return (
    <form className={`employee-form multi-page-flow ${isViewOnly ? 'view-only-mode' : ''}`} onSubmit={currentPage === 3 ? handleSubmit : handleNext}>
      <div className="task-form-tabs wizard-tabs">
        <div className={`step ${currentPage >= 1 ? 'active' : ''}`}>1. Basic Details</div>
        <div className={`step ${currentPage >= 2 ? 'active' : ''}`}>2. Company Details</div>
        <div className={`step ${currentPage >= 3 ? 'active' : ''}`}>3. Banking & PAN</div>
      </div>

      <div className="modal-content-area">
        <div className="form-content-area">
          {currentPage === 1 && (
            <div className="form-page fade-in">
              <BasicDetailsSection formData={formData} onChange={handleChange} isViewOnly={isViewOnly} />
            </div>
          )}

          {currentPage === 2 && (
            <div className="form-page fade-in">
              <CompanyDetailsSection 
                formData={formData} 
                onChange={handleChange} 
                hubs={hubs} 
                departments={departments} 
                roles={roles} 
                employees={allEmployees}
                isViewOnly={isViewOnly}
              />
            </div>
          )}

          {currentPage === 3 && (
            <div className="form-page fade-in">
              <BankDetailsSection formData={formData} onChange={handleChange} isViewOnly={isViewOnly} />
            </div>
          )}
        </div>
      </div>

      <div className="form-footer sticky page-controls">
        {currentPage > 1 && (
          <button type="button" className="halo-button back-btn" onClick={handleBack} disabled={loading}>
            Back
          </button>
        )}
        
        {currentPage < 3 ? (
          <div className="button-group">
            {!isViewOnly && initialData.id && (
              <button type="button" className="halo-button save-btn secondary-action" onClick={handleSaveAndExit} disabled={loading}>
                {loading ? 'Processing...' : 'Save Changes'}
              </button>
            )}
            <button type="submit" className="halo-button next-btn">
              {isViewOnly ? 'Next Step ➔' : 'Continue ➔'}
            </button>
          </div>
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

export default EmployeeForm;
