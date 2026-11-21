import React from 'react';

const DataManagerSubSidebar = ({ activeVertical, setActiveVertical, permissions }) => {
  const showDataSheet = permissions?.canAccessDataSheetBoard !== false;
  const showModelVerification = permissions?.canAccessModelVerificationBoard !== false;

  return (
    <div className="sub-sidebar-body">
      {showDataSheet && (
        <div className="dm-sub-nav-wrapper">
          <button
            className={`halo-button dm-sub-nav-btn ${(activeVertical === 'DATA_MANAGER' || !activeVertical) ? 'active' : ''}`}
            onClick={() => setActiveVertical('DATA_MANAGER')}
          >
            Data Sheet Board
          </button>
        </div>
      )}

      {showModelVerification && (
        <div className="dm-sub-nav-wrapper">
          <button
            className={`halo-button dm-sub-nav-btn ${activeVertical === 'model_verification_board' ? 'active' : ''}`}
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

