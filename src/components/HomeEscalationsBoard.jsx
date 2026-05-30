import React from 'react';
import CentralisedTaskBoard from './CentralisedTaskBoard';
import './HomeEscalationsBoard.css';

/**
 * HomeEscalationsBoard Component
 * A wrapper around CentralisedTaskBoard specifically for handling and displaying Escalations on the Home page.
 */
const HomeEscalationsBoard = (props) => {
  return (
    <div className="home-escalations-board-wrapper">
      <CentralisedTaskBoard
        title="Team Support"
        description="High priority issues and blocks that require your immediate attention."
        {...props}
      />
    </div>
  );
};

export default HomeEscalationsBoard;
