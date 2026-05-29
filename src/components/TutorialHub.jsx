import React, { useState } from 'react';
import MasterPageHeader from './MasterPageHeader';
import TutorialSlideshowViewer from './TutorialSlideshowViewer';
import './TutorialHub.css';

/**
 * Categorized Tutorial Flows
 */
const TUTORIAL_FLOWS = [
  {
    id: 'read_homepage',
    title: 'How to read the homepage',
    category: 'Getting Started',
    description: 'Understand the 3 core structural components of your home page and how they organize your daily tasks.',
    accessLevel: 'User',
    badgeColor: 'rgba(34, 197, 94, 0.1)',
    badgeText: '#22c55e',
    desktopSlides: [
      {
        image: '/public/Tutorial Screenshots/01_Dashboard_Desktop.png',
        fallbackImage: '/Tutorial Screenshots/01_Dashboard_Desktop.png',
        caption: 'Component 1: Home Escalations Board. Positioned at the very top of your dashboard, it displays emergency and urgent priorities that require immediate attention or structural normalization.',
        annotations: [
          { type: 'circle', top: 12, left: 16, width: 82, height: 28, label: 'Home Escalations Board' },
          { type: 'thought', top: 25, left: 45, text: 'Displays active urgent and emergency task escalations for immediate processing!' }
        ]
      },
      {
        image: '/public/Tutorial Screenshots/01_Dashboard_Desktop.png',
        fallbackImage: '/Tutorial Screenshots/01_Dashboard_Desktop.png',
        caption: 'Component 2: Centralised Task View. A collapsible, consolidated list containing all of your active assigned tasks across all business verticals, styled as a neat, responsive list.',
        annotations: [
          { type: 'circle', top: 43, left: 16, width: 82, height: 28, label: 'Centralised Task View' },
          { type: 'thought', top: 55, left: 45, text: 'Consolidates all non-escalated standard tasks assigned to you across all verticals.' }
        ]
      },
      {
        image: '/public/Tutorial Screenshots/01_Dashboard_Desktop.png',
        fallbackImage: '/Tutorial Screenshots/01_Dashboard_Desktop.png',
        caption: 'Component 3: Executive Summary Grid. Located at the bottom of the home screen, this section houses your progress graphs, status metrics, and team performance indicators.',
        annotations: [
          { type: 'circle', top: 74, left: 16, width: 82, height: 24, label: 'Executive Summary Metrics' },
          { type: 'thought', top: 80, left: 45, text: 'Provides executive-level operations progress logs and vertical status charts!' }
        ]
      }
    ],
    mobileSlides: [
      {
        image: '/public/Tutorial Screenshots/01_Dashboard_Mobile.png',
        fallbackImage: '/Tutorial Screenshots/01_Dashboard_Mobile.png',
        caption: 'Component 1: Escalations Tab. On mobile, swipe or tap the left tab in the navigation tray to view and process all emergency escalations assigned to your profile.',
        annotations: [
          { type: 'circle', top: 20, left: 4, width: 30, height: 8, label: 'Escalations Tab' },
          { type: 'thought', top: 30, left: 8, text: 'Select to view and manage active emergency escalations.' }
        ]
      },
      {
        image: '/public/Tutorial Screenshots/01_Dashboard_Mobile.png',
        fallbackImage: '/Tutorial Screenshots/01_Dashboard_Mobile.png',
        caption: 'Component 2: Centralised Tasks Tab. Tap the center tab in the switcher tray to display a clean, scrollable list of all your active, non-escalated standard tasks.',
        annotations: [
          { type: 'circle', top: 20, left: 35, width: 30, height: 8, label: 'Centralised Tasks' },
          { type: 'thought', top: 30, left: 35, text: 'Select to view standard assigned tasks across all verticals.' }
        ]
      },
      {
        image: '/public/Tutorial Screenshots/01_Dashboard_Mobile.png',
        fallbackImage: '/Tutorial Screenshots/01_Dashboard_Mobile.png',
        caption: 'Component 3: Executive Summary Tab. Tap the right tab in the switcher tray to monitor high-level aggregates, charts, and metrics for your verticals.',
        annotations: [
          { type: 'circle', top: 20, left: 66, width: 30, height: 8, label: 'Executive Summary' },
          { type: 'thought', top: 30, left: 55, text: 'Select to see progress charts and high-level vertical metrics.' }
        ]
      }
    ]
  },
  {
    id: 'high_level_navigation',
    title: 'How to navigate at the high level',
    category: 'Getting Started',
    description: 'Master high-level navigation: toggle sidebars and return to the dashboard on desktop, or master the pill-style Action Tray and Bottom Navigation sheet on mobile.',
    accessLevel: 'User',
    badgeColor: 'rgba(34, 197, 94, 0.1)',
    badgeText: '#22c55e',
    desktopSlides: [
      {
        image: '/public/Tutorial Screenshots/01_Dashboard_Desktop.png',
        fallbackImage: '/Tutorial Screenshots/01_Dashboard_Desktop.png',
        caption: 'Opening the Sidebar: On desktop, the static sidebar on the left displays all verticals you have access to. Click the Logo button at the very top-left corner to collapse or expand it.',
        annotations: [
          { type: 'circle', top: 1, left: 1, width: 4, height: 6, label: 'Sidebar Toggle' },
          { type: 'circle', top: 1, left: 1, width: 14, height: 98, label: 'Navigation Sidebar' },
          { type: 'thought', top: 10, left: 16, text: 'Click the logo button in the top-left to expand or collapse the sidebar panel!' }
        ]
      },
      {
        image: '/public/Tutorial Screenshots/01_Dashboard_Desktop.png',
        fallbackImage: '/Tutorial Screenshots/01_Dashboard_Desktop.png',
        caption: 'Navigating Verticals: Explore different areas of the business (e.g. Charging Hubs, Employees, Clients) by clicking their names. If you have admin access, click the arrow toggle to reveal nested managers.',
        annotations: [
          { type: 'circle', top: 18, left: 1, width: 14, height: 42, label: 'Vertical Channels' },
          { type: 'thought', top: 25, left: 16, text: 'Click any active vertical (like Charging Hubs) to enter its dedicated workspace.' }
        ]
      },
      {
        image: '/public/Tutorial Screenshots/01_Dashboard_Desktop.png',
        fallbackImage: '/Tutorial Screenshots/01_Dashboard_Desktop.png',
        caption: 'Returning to Dashboard: Regardless of where you are in the application, clicking the top \'Dashboard\' button in the sidebar will instantly bring you back to the main home board.',
        annotations: [
          { type: 'circle', top: 12, left: 1, width: 14, height: 5, label: 'Dashboard Link' },
          { type: 'thought', top: 12, left: 16, text: 'Click "Dashboard" at any time to instantly return to your home board!' }
        ]
      }
    ],
    mobileSlides: [
      {
        image: '/public/Tutorial Screenshots/01_Dashboard_Mobile.png',
        fallbackImage: '/Tutorial Screenshots/01_Dashboard_Mobile.png',
        caption: 'The Mobile Action Tray: Positioned persistently at the bottom of your screen, the pill-style Action Tray lets you switch contexts, view active boards, apply filters, or trigger quick actions.',
        annotations: [
          { type: 'circle', top: 88, left: 2, width: 96, height: 10, label: 'Action Tray Persistent Bar' },
          { type: 'thought', top: 76, left: 15, text: 'This persistent bottom tray provides quick, easy, thumb-friendly access to core functions.' }
        ]
      },
      {
        image: '/public/Tutorial Screenshots/01_Dashboard_Mobile.png',
        fallbackImage: '/Tutorial Screenshots/01_Dashboard_Mobile.png',
        caption: 'Using Bottom Navigation: Tapping the \'Switch\' button in the tray pops up the primary navigation sheet. From here, you can switch directly to Hubs, Team, Clients, or tap \'More\' for configs.',
        annotations: [
          { type: 'circle', top: 88, left: 4, width: 18, height: 10, label: 'Switch Context' },
          { type: 'thought', top: 76, left: 8, text: 'Tap "Switch" to pop open the primary navigation sheet and choose a vertical!' }
        ]
      },
      {
        image: '/public/Tutorial Screenshots/01_Dashboard_Mobile.png',
        fallbackImage: '/Tutorial Screenshots/01_Dashboard_Mobile.png',
        caption: 'Returning to the Home Board: Regardless of how deep you are in a vertical\'s sub-boards, tap the \'Switch\' button in your tray and select \'Dashboard\' (Home icon) to immediately reload the home screens.',
        annotations: [
          { type: 'circle', top: 88, left: 4, width: 18, height: 10, label: 'Switch Icon' },
          { type: 'thought', top: 76, left: 8, text: 'Tap "Switch", then select "Dashboard" from the navigation drawer to return to the home screen.' }
        ]
      }
    ]
  },
  {
    id: 'read_board',
    title: 'How to read the board',
    category: 'Getting Started',
    description: 'Learn the core layout of active task boards, Kanban stages, and navigation drawer workflows.',
    accessLevel: 'User',
    badgeColor: 'rgba(34, 197, 94, 0.1)',
    badgeText: '#22c55e',
    desktopSlides: [
      {
        image: '/public/Tutorial Screenshots/01_Dashboard_Desktop.png',
        fallbackImage: '/Tutorial Screenshots/01_Dashboard_Desktop.png',
        caption: 'Desktop Dashboard Workspace: View aggregates, collapsed centralised lists, and home escalations at a single glance.',
        annotations: [
          { type: 'circle', top: 12, left: 1, width: 14, height: 75, label: 'Navigation Sidebar' },
          { type: 'thought', top: 20, left: 16, text: 'Click any active vertical here to load its boards!' },
          { type: 'circle', top: 2, left: 78, width: 20, height: 8, label: 'Quick Settings & Profile' }
        ]
      },
      {
        image: '/public/Tutorial Screenshots/02_ChargingHubs_Workspace_Desktop.png',
        fallbackImage: '/Tutorial Screenshots/02_ChargingHubs_Workspace_Desktop.png',
        caption: 'Active Task Board Workspace: Renders Kanban columns. Toggle grid/list modes using the header controls.',
        annotations: [
          { type: 'circle', top: 15, left: 2, width: 18, height: 80, label: 'Scope/City Sub-Sidebar' },
          { type: 'arrow', x1: 22, y1: 50, x2: 40, y2: 50, label: 'Kanban columns represent stages (e.g. BACKLOG, IN PROGRESS)' }
        ]
      }
    ],
    mobileSlides: [
      {
        image: '/public/Tutorial Screenshots/01_Dashboard_Mobile.png',
        fallbackImage: '/Tutorial Screenshots/01_Dashboard_Mobile.png',
        caption: 'Mobile Dashboard Workspace: Specialized switcher navigation tray anchors active views snugly.',
        annotations: [
          { type: 'circle', top: 0, left: 0, width: 100, height: 10, label: 'Mobile Switcher Tray' },
          { type: 'thought', top: 12, left: 20, text: 'Tap tabs to slide between Escalations, Tasks, and Metrics.' }
        ]
      },
      {
        image: '/public/Tutorial Screenshots/02_ChargingHubs_Workspace_Mobile.png',
        fallbackImage: '/Tutorial Screenshots/02_ChargingHubs_Workspace_Mobile.png',
        caption: 'Mobile Vertical Workspace: Dense swipe-aware lists replace the wide multi-column layout.',
        annotations: [
          { type: 'circle', top: 88, left: 0, width: 100, height: 12, label: 'Mobile Action BottomNav' },
          { type: 'arrow', x1: 50, y1: 85, x2: 50, y2: 90, label: 'Access settings and add items globally' }
        ]
      }
    ]
  },
  {
    id: 'add_escalations',
    title: 'How to add escalations from the home page',
    category: 'Operations',
    description: 'Learn how to instantly create and normalise emergency task escalations directly from your homepage dashboard.',
    accessLevel: 'Manager',
    badgeColor: 'rgba(249, 115, 22, 0.1)',
    badgeText: '#f97316',
    desktopSlides: [
      {
        image: '/public/Tutorial Screenshots/01_Dashboard_Desktop.png',
        fallbackImage: '/Tutorial Screenshots/01_Dashboard_Desktop.png',
        caption: 'Locate the Home Escalations board at the top of the home screen and click "+ Escalation" to add a new normalisation task.',
        annotations: [
          { type: 'circle', top: 22, left: 88, width: 10, height: 6, label: '+ Escalation Button' }
        ]
      }
    ],
    mobileSlides: [
      {
        image: '/public/Tutorial Screenshots/01_Dashboard_Mobile.png',
        fallbackImage: '/Tutorial Screenshots/01_Dashboard_Mobile.png',
        caption: 'Go to the Escalations Tab on your Mobile home screen and tap the prominent "+ Escalation" button in the board header.',
        annotations: [
          { type: 'circle', top: 4, left: 8, width: 16, height: 5, label: 'Tab Switcher' }
        ]
      }
    ]
  },
  {
    id: 'add_submissions',
    title: 'How to add your submissions',
    category: 'Submissions',
    description: 'Submit technical evidence, files, and completion logs for manager approval and stage transitions.',
    accessLevel: 'User',
    badgeColor: 'rgba(34, 197, 94, 0.1)',
    badgeText: '#22c55e',
    desktopSlides: [
      {
        image: '/public/Tutorial Screenshots/Hub Manager Tutorials/04_ChargingHubs_Orchestrate_Team.png',
        fallbackImage: '/Tutorial Screenshots/Hub Manager Tutorials/04_ChargingHubs_Orchestrate_Team.png',
        caption: 'Task detail panel allows contributors to add comments, details, or trigger formal submissions.',
        annotations: [
          { type: 'circle', top: 60, left: 30, width: 40, height: 25, label: 'Form Submissions & Comments' }
        ]
      }
    ],
    mobileSlides: [
      {
        image: '/public/Tutorial Screenshots/Hub Manager Tutorials/05_Hub_Administration_View.png',
        fallbackImage: '/Tutorial Screenshots/Hub Manager Tutorials/05_Hub_Administration_View.png',
        caption: 'Submit actions open as bottom sheets overlaying mobile workspace task cells.',
        annotations: []
      }
    ]
  },
  {
    id: 'create_task',
    title: 'How to create a new task',
    category: 'Administration',
    description: 'Learn the task creation forms, selecting client scopes, functions, and populating cities/assignees.',
    accessLevel: 'Admin',
    badgeColor: 'rgba(239, 68, 68, 0.15)',
    badgeText: '#ef4444',
    desktopSlides: [
      {
        image: '/public/Tutorial Screenshots/Hub Manager Tutorials/02_ChargingHubs_Add_Task_Modal.png',
        fallbackImage: '/Tutorial Screenshots/Hub Manager Tutorials/02_ChargingHubs_Add_Task_Modal.png',
        caption: 'Fill out standard Block-in-a-Box forms including: City selection, Function Codes, and Assignees.',
        annotations: [
          { type: 'circle', top: 15, left: 25, width: 50, height: 70, label: 'Structured Creation Modal' }
        ]
      }
    ],
    mobileSlides: [
      {
        image: '/public/Tutorial Screenshots/Hub Manager Tutorials/03_ChargingHubs_Add_Task_MultiHub.png',
        fallbackImage: '/Tutorial Screenshots/Hub Manager Tutorials/03_ChargingHubs_Add_Task_MultiHub.png',
        caption: 'Mobile task forms leverage nested value boxes and Master Dropdowns optimized for finger tapping.',
        annotations: []
      }
    ]
  }
];

const TutorialHub = ({ user, permissions, setActiveVertical, onShowBottomNav }) => {
  const [platform, setPlatform] = useState('desktop'); // 'desktop' | 'mobile'
  const [activeFlow, setActiveFlow] = useState(null);

  // Group flows by category
  const categories = Array.from(new Set(TUTORIAL_FLOWS.map(f => f.category)));

  return (
    <div className="management-view-container tutorial-hub-page">
      <MasterPageHeader
        title="System Tutorials"
        description="Explore step-by-step interactive slideshows detailing standard user tasks and manager normalisation flows."
        setActiveVertical={setActiveVertical}
        onShowBottomNav={onShowBottomNav}
        expandedLeft={
          <div className="platform-toggle-container">
            <div className="platform-toggle-label">Target Environment:</div>
            <div className="platform-selector-group">
              <button 
                className={`platform-toggle-btn ${platform === 'desktop' ? 'active' : ''}`}
                onClick={() => setPlatform('desktop')}
              >
                Desktop View
              </button>
              <button 
                className={`platform-toggle-btn ${platform === 'mobile' ? 'active' : ''}`}
                onClick={() => setPlatform('mobile')}
              >
                Mobile View
              </button>
            </div>
          </div>
        }
        rightActions={
          <button 
            className="halo-button header-back-dashboard-btn"
            onClick={() => setActiveVertical(null)}
          >
            ← Back to Dashboard
          </button>
        }
      />

      <div className="tutorial-categories-grid">
        {categories.map(category => (
          <div key={category} className="tutorial-category-section">
            <h3 className="category-section-title">{category}</h3>
            <div className="category-flows-grid">
              {TUTORIAL_FLOWS.filter(f => f.category === category).map(flow => (
                <div 
                  key={flow.id} 
                  className="tutorial-flow-card"
                  onClick={() => setActiveFlow(flow)}
                >
                  <div className="flow-card-header">
                    <span 
                      className="access-level-badge"
                      style={{ 
                        backgroundColor: flow.badgeColor,
                        color: flow.badgeText,
                        border: `1px solid ${flow.badgeText}33`
                      }}
                    >
                      {flow.accessLevel} Scope
                    </span>
                    <span className="flow-indicator-icon">▶</span>
                  </div>
                  <h4 className="flow-card-title">{flow.title}</h4>
                  <p className="flow-card-description">{flow.description}</p>
                  <div className="flow-card-footer">
                    <button 
                      className={`halo-button flow-version-btn ${platform === 'desktop' ? 'active-version' : ''}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        setPlatform('desktop');
                        setActiveFlow(flow);
                      }}
                    >
                      <span className="version-btn-title">Desktop Version</span>
                      <span className="version-btn-subtitle">{flow.desktopSlides?.length || 0} Steps</span>
                    </button>
                    <button 
                      className={`halo-button flow-version-btn ${platform === 'mobile' ? 'active-version' : ''}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        setPlatform('mobile');
                        setActiveFlow(flow);
                      }}
                    >
                      <span className="version-btn-title">Mobile Version</span>
                      <span className="version-btn-subtitle">{flow.mobileSlides?.length || 0} Steps</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {activeFlow && (
        <TutorialSlideshowViewer
          flow={activeFlow}
          platform={platform}
          onClose={() => setActiveFlow(null)}
        />
      )}
    </div>
  );
};

export default TutorialHub;
