import React, { useState, useEffect } from 'react';
import { supabase } from '../../services/core/supabaseClient';
import './EmployeeForm.css';
import { BasicDetailsSection, CompanyDetailsSection, BankDetailsSection } from './EmployeeFormSections';
import { hierarchyUtils } from '../../utils/hierarchyUtils';
import { getEmployeeSubmissions, submitProofOfWork } from '../../services/tasks/submissionService';

/**
 * EmployeeForm
 * 
 * Form for adding or editing employee records.
 * Features a 4-page wizard flow with View-Only support.
 */
const EmployeeForm = ({ onSubmit, onCancel, loading, initialData = {}, isViewOnly = false }) => {
  const [currentPage, setCurrentPage] = useState(1);
  const [hubs, setHubs] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [roles, setRoles] = useState([]);
  const [allEmployees, setAllEmployees] = useState([]);

  // Document management state
  const [submissions, setSubmissions] = useState([]);
  const [fetchingDocs, setFetchingDocs] = useState(false);
  const [uploadingDocs, setUploadingDocs] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(null);

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

  // Fetch employee documents
  useEffect(() => {
    if (currentPage === 4 && initialData.id) {
      const loadDocuments = async () => {
        setFetchingDocs(true);
        try {
          const docs = await getEmployeeSubmissions(initialData.id);
          setSubmissions(docs);
        } catch (err) {
          console.error('Failed to load employee documents:', err);
        } finally {
          setFetchingDocs(false);
        }
      };
      loadDocuments();
    }
  }, [currentPage, initialData.id]);

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

  // Check if form has changes
  const isDirty = initialData.id ? Object.keys(formData).some(key => {
    const initialVal = initialData[key] || '';
    const currentVal = formData[key] || '';
    return String(initialVal) !== String(currentVal);
  }) : true; // Always dirty for new records

  const handleChange = (e) => {
    if (isViewOnly) return;
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleFileUpload = async (e) => {
    const files = Array.from(e.target.files);
    if (files.length === 0) return;

    setUploadingDocs(true);
    setUploadProgress({ current: 0, total: files.length, label: 'Compressing & uploading...' });

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User is not logged in');

      await submitProofOfWork({
        employeeId: initialData.id,
        userId: user.id,
        comment: 'Employee Document Upload',
        files,
        onProgress: (p) => setUploadProgress(p)
      });

      // Reload
      const docs = await getEmployeeSubmissions(initialData.id);
      setSubmissions(docs);
    } catch (err) {
      console.error('File upload failed:', err);
      alert(`Upload failed: ${err.message}`);
    } finally {
      setUploadingDocs(false);
      setUploadProgress(null);
      e.target.value = '';
    }
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
      setCurrentPage(prev => Math.min(prev + 1, 4));
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

  const handleStepClick = (targetPage) => {
    if (targetPage === currentPage) return;
    
    // BACKWARD: Always allowed
    if (targetPage < currentPage) {
      setCurrentPage(targetPage);
    } 
    // FORWARD: Sequential validation required
    else {
      let canProceed = true;
      for (let p = currentPage; p < targetPage; p++) {
        if (!validatePage(p)) {
          canProceed = false;
          break;
        }
      }
      if (canProceed) {
        if (targetPage === 4 && !initialData.id) {
          alert('Documents can only be uploaded after the employee record has been created.');
          return;
        }
        setCurrentPage(targetPage);
      }
    }
  };

  return (
    <form className={`employee-form multi-page-flow ${isViewOnly ? 'view-only-mode' : ''}`} onSubmit={currentPage === 4 ? handleSubmit : handleNext}>
      <div className="task-form-tabs wizard-tabs">
        <div 
          className={`step ${currentPage === 1 ? 'active' : ''} ${currentPage > 1 ? 'completed' : ''}`}
          onClick={() => handleStepClick(1)}
        >
          1. Basic Details
        </div>
        <div 
          className={`step ${currentPage === 2 ? 'active' : ''} ${currentPage > 2 ? 'completed' : ''}`}
          onClick={() => handleStepClick(2)}
        >
          2. Company Details
        </div>
        <div 
          className={`step ${currentPage === 3 ? 'active' : ''} ${currentPage > 3 ? 'completed' : ''}`}
          onClick={() => handleStepClick(3)}
        >
          3. Banking & PAN
        </div>
        <div 
          className={`step ${currentPage === 4 ? 'active' : ''} ${!initialData.id ? 'disabled-tab' : ''}`}
          onClick={() => handleStepClick(4)}
          title={!initialData.id ? 'Please save the record first to enable document uploads' : ''}
        >
          4. Documents
        </div>
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

          {currentPage === 4 && (
            <div className="form-page fade-in">
              <div className="form-section">
                <h3 className="form-section-header">Employee Documents</h3>
                {fetchingDocs ? (
                  <div className="loading-spinner">Loading documents...</div>
                ) : (
                  <div className="documents-section-container">
                    {!isViewOnly && (
                      <div className="upload-dropzone">
                        <input
                          type="file"
                          id="employee-doc-upload"
                          multiple
                          onChange={handleFileUpload}
                          disabled={uploadingDocs}
                          style={{ display: 'none' }}
                        />
                        <label htmlFor="employee-doc-upload" className="upload-label">
                          {uploadingDocs ? (
                            <div className="upload-progress-wrapper">
                              <div className="spinner-mini"></div>
                              <p className="progress-label-text">{uploadProgress?.label || 'Uploading...'}</p>
                              {uploadProgress && (
                                <div className="progress-bar-container">
                                  <div 
                                    className="progress-bar-fill" 
                                    style={{ width: `${(uploadProgress.current / uploadProgress.total) * 100}%` }}
                                  />
                                </div>
                              )}
                            </div>
                          ) : (
                            <>
                              <span className="upload-icon">📤</span>
                              <span className="upload-text">Click to upload documents or pictures</span>
                              <span className="upload-subtext">PDF, PNG, JPG (Auto-compressed)</span>
                            </>
                          )}
                        </label>
                      </div>
                    )}

                    <div className="documents-list">
                      {submissions.length === 0 ? (
                        <div className="no-documents-state">
                          <span className="no-doc-icon">📄</span>
                          <p>No documents uploaded yet.</p>
                        </div>
                      ) : (
                        <div className="doc-grid">
                          {submissions.flatMap((sub) => 
                            (sub.links || []).map((link, idx) => (
                              <div key={`${sub.id}-${idx}`} className="doc-card">
                                <div className="doc-preview">
                                  {link.mime_type?.startsWith('image/') ? (
                                    <img src={link.url} alt={link.file_name} className="doc-thumbnail" />
                                  ) : (
                                    <div className="doc-icon-placeholder">📄</div>
                                  )}
                                </div>
                                <div className="doc-info">
                                  <span className="doc-name" title={link.file_name}>{link.file_name}</span>
                                  <span className="doc-meta">Uploaded on {new Date(sub.created_at).toLocaleDateString()}</span>
                                  <span className="doc-uploader">By {sub.submitted_by_profile?.name || 'Unknown'}</span>
                                </div>
                                <div className="doc-actions">
                                  <a href={link.url} target="_blank" rel="noopener noreferrer" className="halo-button view-doc-btn">
                                    View
                                  </a>
                                </div>
                              </div>
                            ))
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
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
        
        {currentPage < 4 ? (
          <div className="button-group">
            {!isViewOnly && initialData.id && (
              isDirty ? (
                <button type="button" className="halo-button save-btn secondary-action" onClick={handleSaveAndExit} disabled={loading}>
                  {loading ? 'Processing...' : 'Save Changes'}
                </button>
              ) : (
                <button type="button" className="halo-button close-btn secondary-action" onClick={onCancel} style={{ opacity: 0.6 }}>
                  Close
                </button>
              )
            )}
            <button type="submit" className="halo-button next-btn">
              {isViewOnly ? 'Next Step ➔' : 'Continue ➔'}
            </button>
          </div>
        ) : (
          !isViewOnly ? (
            isDirty ? (
              <button type="submit" className="halo-button save-btn" disabled={loading}>
                {loading ? 'Processing...' : (initialData.id ? 'Save Changes' : 'Create Record')}
              </button>
            ) : (
              <button type="button" className="halo-button close-btn" onClick={onCancel} style={{ opacity: 0.6 }}>
                Close
              </button>
            )
          ) : (
            <button type="button" className="halo-button close-btn" onClick={onCancel}>
              Done
            </button>
          )
        )}
      </div>
    </form>
  );
};

export default EmployeeForm;
