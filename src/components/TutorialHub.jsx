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
        image: '/Tutorial Screenshots/01_ReadHomepage_Escalations_Desktop.png',
        fallbackImage: '/Tutorial Screenshots/01_ReadHomepage_Escalations_Desktop.png',
        caption: 'Component 1: Home Escalations Board. Positioned at the very top of your dashboard, it displays emergency and urgent priorities that require immediate attention or structural normalization.',
        annotations: [
          { type: 'circle', top: 12, left: 16, width: 82, height: 28, label: 'Home Escalations Board' },
          { type: 'thought', top: 25, left: 45, text: 'Displays active urgent and emergency task escalations for immediate processing!' }
        ]
      },
      {
        image: '/Tutorial Screenshots/01_ReadHomepage_Tasks_Desktop.png',
        fallbackImage: '/Tutorial Screenshots/01_ReadHomepage_Tasks_Desktop.png',
        caption: 'Component 2: Centralised Task View. A collapsible, consolidated list containing all of your active assigned tasks across all business verticals, styled as a neat, responsive list.',
        annotations: [
          { type: 'circle', top: 43, left: 16, width: 82, height: 28, label: 'Centralised Task View' },
          { type: 'thought', top: 55, left: 45, text: 'Consolidates all non-escalated standard tasks assigned to you across all verticals.' }
        ]
      },
      {
        image: '/Tutorial Screenshots/01_ReadHomepage_Metrics_Desktop.png',
        fallbackImage: '/Tutorial Screenshots/01_ReadHomepage_Metrics_Desktop.png',
        caption: 'Component 3: Executive Summary Grid. Located at the bottom of the home screen, this section houses your progress graphs, status metrics, and team performance indicators.',
        annotations: [
          { type: 'circle', top: 74, left: 16, width: 82, height: 24, label: 'Executive Summary Metrics' },
          { type: 'thought', top: 80, left: 45, text: 'Provides executive-level operations progress logs and vertical status charts!' }
        ]
      }
    ],
    mobileSlides: [
      {
        image: '/Tutorial Screenshots/01_ReadHomepage_Escalations_Mobile.png',
        fallbackImage: '/Tutorial Screenshots/01_ReadHomepage_Escalations_Mobile.png',
        caption: 'Component 1: Escalations Tab. On mobile, swipe or tap the left tab in the navigation tray to view and process all emergency escalations assigned to your profile.',
        annotations: [
          { type: 'circle', top: 20, left: 4, width: 30, height: 8, label: 'Escalations Tab' },
          { type: 'thought', top: 30, left: 8, text: 'Select to view and manage active emergency escalations.' }
        ]
      },
      {
        image: '/Tutorial Screenshots/01_ReadHomepage_Tasks_Mobile.png',
        fallbackImage: '/Tutorial Screenshots/01_ReadHomepage_Tasks_Mobile.png',
        caption: 'Component 2: Centralised Tasks Tab. Tap the center tab in the switcher tray to display a clean, scrollable list of all your active, non-escalated standard tasks.',
        annotations: [
          { type: 'circle', top: 20, left: 35, width: 30, height: 8, label: 'Centralised Tasks' },
          { type: 'thought', top: 30, left: 35, text: 'Select to view standard assigned tasks across all verticals.' }
        ]
      },
      {
        image: '/Tutorial Screenshots/01_ReadHomepage_Metrics_Mobile.png',
        fallbackImage: '/Tutorial Screenshots/01_ReadHomepage_Metrics_Mobile.png',
        caption: 'Component 3: Executive Summary Tab. Tap the right tab in the switcher tray to monitor high-level aggregates, charts, and metrics for your verticals.',
        annotations: [
          { type: 'circle', top: 20, left: 66, width: 30, height: 8, label: 'Executive Summary' },
          { type: 'thought', top: 30, left: 55, text: 'Select to see progress charts and high-level vertical metrics.' }
        ]
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
