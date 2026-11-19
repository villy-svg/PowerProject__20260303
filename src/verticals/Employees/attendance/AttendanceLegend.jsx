import React from 'react';
import { IconSun, IconMoon, IconCoffee, IconFile } from '../../../components/ui/Icons';
import './AttendanceLegend.css';

/* Single flowing flex container so status items sit cleanly on one row on desktop and wrap gracefully on narrow viewports */
const AttendanceLegend = () => {
  return (
    <div className="attendance-legend">
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
      <span className="attendance-legend__item attendance-legend__item--absent">
        <span className="u-fw-800">ABS</span> <span className="attendance-legend__label">Absent</span>
      </span>
      <span className="attendance-legend__item attendance-legend__item--no-show">
        <span className="u-fw-800">X</span> <span className="attendance-legend__label">No Show</span>
      </span>
      <span className="attendance-legend__item attendance-legend__item--no-call-no-show">
        <span className="u-fw-900 u-text-1-1em">XX</span> <span className="attendance-legend__label">No Call No Show</span>
      </span>
      <span className="attendance-legend__item attendance-legend__item--null">
        <span className="u-fw-800 u-opacity-50">NULL</span> <span className="attendance-legend__label">Not Marked</span>
      </span>
      <span className="attendance-legend__item attendance-legend__item--pending">
        <span className="attendance-legend__icon-pending">⚠</span> <span className="attendance-legend__label">Pending Edit</span>
      </span>
    </div>
  );
};

export default AttendanceLegend;
