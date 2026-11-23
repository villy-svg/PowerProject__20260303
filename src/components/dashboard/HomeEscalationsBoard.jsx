import React from 'react';
import CentralisedTaskBoard from '../tasks/CentralisedTaskBoard';
import './HomeEscalationsBoard.css';

/**
 * HomeEscalationsBoard Component
 * A wrapper around CentralisedTaskBoard rendered as "Track Requests" on the Home page.
 *
 * Scope (see .agent/rules/verticals-and-boards-architecture.md):
 *   Displays active CHARGING_HUBS / ['Escalations'] tasks scoped to the logged-in user:
 *   - Support tickets & escalations assigned to or created by the user
 *   - Employee approval requests for reviewers
 *   - Attendance alerts (Overtime, Forced Checkout) for managers / Master Admin
 *   - Attendance closure tasks (Unmarked Attendance, Consecutive Week-Off) for
 *     Makers, Checkers, upward managers, Master Admin, AND read-only awareness
 *     warnings for the subject employee themselves.
 */
const HomeEscalationsBoard = (props) => {
  return (
    <div className="home-escalations-board-wrapper">
      <CentralisedTaskBoard
        title="Track Requests"
        description={"Track Requests has all the requests and support tickets raised by all the members of PowerPod\nಪವರ್ಪಾಡ್ನ ಎಲ್ಲಾ ಸದಸ್ಯರು ಎತ್ತಿರುವ ಎಲ್ಲಾ ವಿನಂತಿಗಳು ಮತ್ತು ಬೆಂಬಲ ಟಿಕೆಟ್ಗಳನ್ನು ಟ್ರ್ಯಾಕ್ ರಿಕ್ವೆಸ್ಟ್ಸ್ ಹೊಂದಿದೆ."}
        {...props}
      />
    </div>
  );
};

export default HomeEscalationsBoard;
