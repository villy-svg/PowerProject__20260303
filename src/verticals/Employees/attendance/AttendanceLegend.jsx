import React from 'react';
import { IconSun, IconMoon, IconCoffee, IconFile, IconX } from '../../../components/ui/Icons';
import './AttendanceLegend.css';

const AttendanceLegend = () => {
  return (
    <div className="attendance-legend">
      <div className="attendance-legend__row">
        <span className="attendance-legend__item attendance-legend__item--present">
          <IconSun size={14} strokeWidth={3} className="attendance-legend__icon" /> <span className="attendance-legend__label">Present (Day)</span>
        </span>
        <span className="attendance-legend__item attendance-legend__item--present-night">
          <IconMoon size={14} strokeWidth={3} className="attendance-legend__icon" /> <span className="attendance-legend__label">Present (Night)</span>
        </span>
        <span className="attendance-legend__item attendance-legend__item--week-off">
          <IconCoffee size={14} strokeWidth={3} className="attendance-legend__icon" /> <span className="attendance-legend__label">Week-Off</span>
        </span>
        <span className="attendance-legend__item attendance-legend__item--leave">
          <IconFile size={14} strokeWidth={3} className="attendance-legend__icon" /> <span className="attendance-legend__label">Leave</span>
        </span>
      </div>
      <div className="attendance-legend__row">
        <span className="attendance-legend__item attendance-legend__item--absent">
          <span style={{ fontWeight: 800 }}>ABS</span> <span className="attendance-legend__label">Absent</span>
        </span>
        <span className="attendance-legend__item attendance-legend__item--no-show">
          <span style={{ fontWeight: 800 }}>X</span> <span className="attendance-legend__label">No Show</span>
        </span>
        <span className="attendance-legend__item attendance-legend__item--no-call-no-show">
          <span style={{ fontWeight: 900, fontSize: '1.1em' }}>XX</span> <span className="attendance-legend__label">No Call No Show</span>
        </span>
        <span className="attendance-legend__item attendance-legend__item--null">
          <span style={{ fontWeight: 800, opacity: 0.5 }}>NULL</span> <span className="attendance-legend__label">Not Marked</span>
        </span>
        <span className="attendance-legend__item attendance-legend__item--pending">
          <span className="attendance-legend__icon-pending">⚠</span> <span className="attendance-legend__label">Pending Edit</span>
        </span>
      </div>
    </div>
  );
};

export default AttendanceLegend;
