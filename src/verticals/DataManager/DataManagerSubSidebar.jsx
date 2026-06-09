import React from 'react';

const DataManagerSubSidebar = ({ activeVertical, setActiveVertical, permissions }) => {
  const showDataSheet = permissions?.canAccessDataSheetBoard !== false;
  const showModelVerification = permissions?.canAccessModelVerificationBoard !== false;

  return (
    <div className="sub-sidebar-body">
      {showDataSheet && (
        <div className="employee-tasks-btn-wrapper">
          <button
            className="halo-button employee-tasks-nav-btn"
            style={{ opacity: (activeVertical === 'DATA_MANAGER' || !activeVertical) ? 1 : 0.7 }}
            onClick={() => setActiveVertical('DATA_MANAGER')}
          >
            Data Sheet Board
          </button>
        </div>
      )}

      {showModelVerification && (
        <div className="employee-tasks-btn-wrapper">
          <button
            className="halo-button employee-tasks-nav-btn"
            style={{ opacity: activeVertical === 'model_verification_board' ? 1 : 0.7 }}
            onClick={() => setActiveVertical('model_verification_board')}
          >
            Model Verification Board
          </button>
        </div>
      )}
    </div>
  );
};

export default DataManagerSubSidebar;
