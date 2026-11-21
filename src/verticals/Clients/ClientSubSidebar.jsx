import React from 'react';

/**
 * ClientSubSidebar
 *
 * Vertical-specific sidebar navigation for the Client Manager.
 * (Dead unrendered FilterGroup, inline style objects, and unused reference
 *  fetch removed to eliminate wasted network calls and inline styles.)
 */
const ClientSubSidebar = ({
  permissions,
  activeVertical,
  setActiveVertical,
  hideNavigation,
}) => {

  return (
    <div className="sub-sidebar-body">
      {!hideNavigation && (
        <>
          <div className="u-p-12 u-mb-8 u-flex-col-gap-8">
          {permissions?.canAccessClientTasks && (
            <button
              className={`halo-button u-w-full ${activeVertical === 'client_tasks' ? 'active' : ''}`}
              onClick={() => setActiveVertical('client_tasks')}
            >
              Client Task Board
            </button>
          )}
          {permissions?.canAccessLeadsFunnel && (
            <button
              className={`halo-button u-w-full ${activeVertical === 'leads_funnel' ? 'active' : ''}`}
              onClick={() => setActiveVertical('leads_funnel')}
            >
              Leads Funnel
            </button>
          )}
          </div>


        </>
      )}


    </div>
  );
};

export default ClientSubSidebar;
