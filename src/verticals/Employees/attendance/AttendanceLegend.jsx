import React from 'react';
import { IconSun, IconMoon, IconCoffee, IconFile, IconX } from '../../../components/ui/Icons';
import './AttendanceLegend.css';

const AttendanceLegend = () => {
  return (
    <div className="attendance-legend">
      <span className="attendance-legend__item attendance-legend__item--present">
        <IconSun size={14} /> Present (Day)
      </span>
      <span className="attendance-legend__item attendance-legend__item--present-night">
        <IconMoon size={14} /> Present (Night)
      </span>
      <span className="attendance-legend__item attendance-legend__item--week-off">
        <IconCoffee size={14} /> Week-Off
      </span>
      <span className="attendance-legend__item attendance-legend__item--leave">
        <IconFile size={14} /> Leave
      </span>
      <span className="attendance-legend__item attendance-legend__item--absent">
        <span style={{ fontWeight: 800 }}>ABS</span> Absent
      </span>
      <span className="attendance-legend__item attendance-legend__item--no-show">
        <span style={{ fontWeight: 800 }}>X</span> No Show
      </span>
      <span className="attendance-legend__item attendance-legend__item--no-call-no-show">
        <span style={{ fontWeight: 900, fontSize: '1.1em' }}>XX</span> No Call No Show
      </span>
      <span className="attendance-legend__item attendance-legend__item--null">
        <span style={{ fontWeight: 800, opacity: 0.5 }}>NULL</span> Default
      </span>
      <span className="attendance-legend__item attendance-legend__item--pending">
        <span className="attendance-legend__icon-pending">⚠</span> Pending Edit
      </span>
    </div>
  );
};

export default AttendanceLegend;
