import React from 'react';

const DataManagerSubSidebar = ({ activeVertical, setActiveVertical, permissions }) => {
  const showDataSheet = permissions?.canAccessDataSheetBoard !== false;
  const showModelVerification = permissions?.canAccessModelVerificationBoard !== false;
  // Cleaning QR Generator is restricted to config-level access (Admin only)
  const showCleaningQR = permissions?.canAccessConfig === true;

  return (
    <div className="sub-sidebar-body">
      {showDataSheet && (
        <div className="dm-sub-nav-wrapper">
          <button
            className="halo-button dm-sub-nav-btn"
            style={{ opacity: (activeVertical === 'DATA_MANAGER' || !activeVertical) ? 1 : 0.7 }}
            onClick={() => setActiveVertical('DATA_MANAGER')}
          >
            Data Sheet Board
          </button>
        </div>
      )}

      {showModelVerification && (
        <div className="dm-sub-nav-wrapper">
          <button
            className="halo-button dm-sub-nav-btn"
            style={{ opacity: activeVertical === 'model_verification_board' ? 1 : 0.7 }}
            onClick={() => setActiveVertical('model_verification_board')}
          >
            Model Verification Board
          </button>
        </div>
      )}

      {showCleaningQR && (
        <div className="dm-sub-nav-wrapper">
          <button
            className="halo-button dm-sub-nav-btn"
            style={{ opacity: activeVertical === 'cleaning_qr_generator' ? 1 : 0.7 }}
            onClick={() => setActiveVertical('cleaning_qr_generator')}
          >
            Cleaning QR Generator
          </button>
        </div>
      )}
    </div>
  );
};

export default DataManagerSubSidebar;

