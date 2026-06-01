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
        description={"Team Support has all the requests and support tickets raised by all the members of PowerPod\nಪವರ್ಪಾಡ್ನ ಎಲ್ಲಾ ಸದಸ್ಯರು ಎತ್ತಿರುವ ಎಲ್ಲಾ ವಿನಂತಿಗಳು ಮತ್ತು ಬೆಂಬಲ ಟಿಕೆಟ್ಗಳನ್ನು ಟೀಮ್ ಸಪೋರ್ಟ್ ಹೊಂದಿದೆ."}
        {...props}
      />
    </div>
  );
};

export default HomeEscalationsBoard;
