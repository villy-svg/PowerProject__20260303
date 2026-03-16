import React, { useState, useEffect } from 'react';
import { supabase } from '../../services/supabaseClient';
import './EmployeeForm.css';
import { BasicDetailsSection, CompanyDetailsSection, BankDetailsSection } from './EmployeeFormSections';

/**
 * EmployeeForm
 * 
 * Form for adding or editing employee records.
 * Features a vertical split layout with Basic and Bank details.
 */
const EmployeeForm = ({ onSubmit, loading, initialData = {} }) => {
  const [currentPage, setCurrentPage] = useState(1);
  const [hubs, setHubs] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [roles, setRoles] = useState([]);

  // Fetch Hubs, Departments, and Roles for Company Details dropdowns
  useEffect(() => {
    const fetchCompanyData = async () => {
      const [hubsRes, deptRes, roleRes] = await Promise.all([
        supabase.from('hubs').select('id, name, hub_code').order('name'),
        supabase.from('departments').select('id, name, dept_code').order('name'),
        supabase.from('employee_roles').select('id, name, role_code').order('name')
      ]);
      
      if (hubsRes.data) setHubs(hubsRes.data);
      if (deptRes.data) setDepartments(deptRes.data);
      if (roleRes.data) setRoles(roleRes.data);
    };
    fetchCompanyData();
  }, []);

  const [formData, setFormData] = useState({
    name: initialData.name || '',
    contactNumber: initialData.contactNumber || '',
    emailId: initialData.emailId || '',
    gender: initialData.gender || '',
    dob: initialData.dob || '',
    doj: initialData.doj || new Date().toISOString().split('T')[0], // Default today
    hub_id: initialData.hub_id || '',
    role_id: initialData.role_id || '',
    department_id: initialData.department_id || '',
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
    if (currentPage === 1) {
      // Validate and format phone number
      let phone = formData.contactNumber.replace(/\s+/g, '');
      if (phone.startsWith('0')) {
        phone = '+91' + phone.substring(1);
      } else if (!phone.startsWith('+')) {
        phone = '+91' + phone;
      }
      
      // Length check
      if (phone.startsWith('+91') && phone.length < 13) {
        alert('Indian phone numbers must have at least 10 digits after +91.');
        return;
      } else if (phone.length < 10) {
        alert('Phone number must have at least 10 basic digits.');
        return;
      }

      // Update state with formatted phone before proceeding
      setFormData(prev => ({ ...prev, contactNumber: phone }));

      setCurrentPage(2);
    }
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
          <BasicDetailsSection formData={formData} onChange={handleChange} />
          <CompanyDetailsSection 
            formData={formData} 
            onChange={handleChange} 
            hubs={hubs} 
            departments={departments} 
            roles={roles} 
          />
        </div>
      )}

      {/* PAGE 2 */}
      {currentPage === 2 && (
        <div className="form-page fade-in">
          <BankDetailsSection formData={formData} onChange={handleChange} />
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
