import fs from 'fs';
import path from 'path';
import ExcelJS from 'exceljs';

function formatIST(dateStr) {
  if (!dateStr) return '-';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return '-';
  
  // Format in IST (UTC+5:30)
  return new Intl.DateTimeFormat('en-IN', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true
  }).format(d);
}

function formatISTTimeOnly(dateStr) {
  if (!dateStr) return '-';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return '-';
  
  return new Intl.DateTimeFormat('en-IN', {
    timeZone: 'Asia/Kolkata',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true
  }).format(d);
}

function calculateDuration(startStr, endStr) {
  if (!startStr || !endStr) return { text: '-', minutes: 0, hoursDec: 0 };
  const start = new Date(startStr).getTime();
  const end = new Date(endStr).getTime();
  if (isNaN(start) || isNaN(end) || end < start) return { text: '-', minutes: 0, hoursDec: 0 };
  
  const diffMinutes = Math.round((end - start) / (1000 * 60));
  const hrs = Math.floor(diffMinutes / 60);
  const mins = diffMinutes % 60;
  return {
    text: `${hrs}h ${mins}m`,
    minutes: diffMinutes,
    hoursDec: Number((diffMinutes / 60).toFixed(2))
  };
}

function readJsonSafely(filePath) {
  const buf = fs.readFileSync(filePath);
  let str;
  if (buf[0] === 0xff && buf[1] === 0xfe) {
    str = buf.toString('utf16le');
  } else if (buf[0] === 0xef && buf[1] === 0xbb && buf[2] === 0xbf) {
    str = buf.toString('utf8').slice(1);
  } else {
    str = buf.toString('utf8');
  }
  return JSON.parse(str.trim());
}

async function buildExcel() {
  const rawData = readJsonSafely('scratch/target_attendance_raw.json').rows;
  const hubsData = readJsonSafely('scratch/hubs.json').rows;
  
  const hubMap = new Map();
  hubsData.forEach(h => {
    hubMap.set(h.id, `${h.name} (${h.hub_code})`);
  });

  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'PowerProject Attendance Engine';
  workbook.created = new Date();

  // Color constants
  const PRIMARY_HEADER_FILL = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: '1F4E78' } // Dark Navy
  };
  const SECONDARY_HEADER_FILL = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: '2F5597' }
  };
  const ACCENT_FILL = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'D9E1F2' }
  };
  const ZEBRA_FILL = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'F9FAFB' }
  };
  const WHITE_FONT_BOLD = {
    name: 'Calibri',
    size: 11,
    bold: true,
    color: { argb: 'FFFFFF' }
  };
  const BORDER_THIN = {
    top: { style: 'thin', color: { argb: 'D9D9D9' } },
    bottom: { style: 'thin', color: { argb: 'D9D9D9' } },
    left: { style: 'thin', color: { argb: 'D9D9D9' } },
    right: { style: 'thin', color: { argb: 'D9D9D9' } }
  };

  // Helper to apply header style
  function styleHeaderRow(row, fill = PRIMARY_HEADER_FILL) {
    row.eachCell((cell) => {
      cell.fill = fill;
      cell.font = WHITE_FONT_BOLD;
      cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
      cell.border = BORDER_THIN;
    });
    row.height = 28;
  }

  // -------------------------------------------------------------------------
  // 1. OVERVIEW & SUMMARY SHEET
  // -------------------------------------------------------------------------
  const summarySheet = workbook.addWorksheet('Summary Overview', { views: [{ showGridLines: true }] });

  // Title
  summarySheet.mergeCells('B2:H2');
  const titleCell = summarySheet.getCell('B2');
  titleCell.value = 'PowerProject - Employee Attendance & Time Log Report';
  titleCell.font = { name: 'Calibri', size: 16, bold: true, color: { argb: '1F4E78' } };
  titleCell.alignment = { vertical: 'middle' };
  summarySheet.getRow(2).height = 32;

  summarySheet.getCell('B3').value = `Generated on: ${new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })} (IST) | Target: Uchirappa, Vikas & Srinivas`;
  summarySheet.getCell('B3').font = { name: 'Calibri', size: 10, italic: true, color: { argb: '595959' } };

  // Calculate employee stats
  const employees = [
    { name: 'Pothappagari Uchirappa', code: '7SYRCD', key: 'Uchirappa' },
    { name: 'Vikash Vishwakarma', code: '7OEO8Y', key: 'Vikas' },
    { name: 'Srinivasa S K', code: '89FXYE', key: 'Srinivas' }
  ];

  const stats = employees.map(emp => {
    const records = rawData.filter(r => r.emp_code === emp.code);
    const presentRecords = records.filter(r => r.attendance_status === 'present');
    const withLogout = records.filter(r => r.first_login_time && r.logout_time);
    
    let totalMinutes = 0;
    records.forEach(r => {
      if (r.session_logs_data && Array.isArray(r.session_logs_data)) {
        r.session_logs_data.forEach(s => {
          if (s.login_time && s.logout_time) {
            const m = Math.round((new Date(s.logout_time) - new Date(s.login_time)) / 60000);
            if (m > 0) totalMinutes += m;
          }
        });
      } else if (r.first_login_time && r.logout_time) {
        const m = Math.round((new Date(r.logout_time) - new Date(r.first_login_time)) / 60000);
        if (m > 0) totalMinutes += m;
      }
    });

    const dates = records.map(r => r.shift_date).filter(Boolean).sort();
    const firstDate = dates[0] || '-';
    const lastDate = dates[dates.length - 1] || '-';
    const avgHrsPerDay = withLogout.length > 0 ? (totalMinutes / withLogout.length / 60).toFixed(1) : '0';

    return {
      ...emp,
      totalRecords: records.length,
      presentDays: presentRecords.length,
      dateRange: `${firstDate} to ${lastDate}`,
      firstDate,
      lastDate,
      totalHours: (totalMinutes / 60).toFixed(1),
      avgHrsPerDay: `${avgHrsPerDay} hrs`
    };
  });

  // KPI Cards Table in Summary Sheet
  summarySheet.getRow(5).values = ['', 'Employee Name', 'Emp Code', 'Total Records', 'Days Present', 'Date Span (From - To)', 'Total Logged Hours', 'Avg Hours/Day'];
  styleHeaderRow(summarySheet.getRow(5), PRIMARY_HEADER_FILL);

  stats.forEach((st, idx) => {
    const row = summarySheet.getRow(6 + idx);
    row.values = [
      '',
      st.name,
      st.code,
      st.totalRecords,
      st.presentDays,
      st.dateRange,
      `${st.totalHours} hrs`,
      st.avgHrsPerDay
    ];
    row.height = 24;
    row.eachCell((cell, colNum) => {
      if (colNum > 1) {
        cell.border = BORDER_THIN;
        cell.alignment = { vertical: 'middle', horizontal: colNum in [4, 5, 7, 8] ? 'center' : 'left' };
        if (idx % 2 === 1) cell.fill = ZEBRA_FILL;
      }
    });
  });

  summarySheet.columns = [
    { width: 4 },
    { width: 28 },
    { width: 14 },
    { width: 16 },
    { width: 16 },
    { width: 28 },
    { width: 20 },
    { width: 18 }
  ];

  // -------------------------------------------------------------------------
  // 2. ALL ATTENDANCE DAILY RECORDS SHEET
  // -------------------------------------------------------------------------
  const dailySheet = workbook.addWorksheet('Daily Attendance Master', { views: [{ showGridLines: true, state: 'frozen', ySplit: 1 }] });

  dailySheet.columns = [
    { header: 'Date', key: 'shift_date', width: 14 },
    { header: 'Employee Name', key: 'full_name', width: 26 },
    { header: 'Emp Code', key: 'emp_code', width: 14 },
    { header: 'Shift Type', key: 'shift_type', width: 12 },
    { header: 'Status', key: 'attendance_status', width: 14 },
    { header: 'First Login (IST)', key: 'first_login_time', width: 22 },
    { header: 'Last Logout (IST)', key: 'logout_time', width: 22 },
    { header: 'Total Duration', key: 'duration_text', width: 16 },
    { header: 'Hours (Decimal)', key: 'hours_dec', width: 16 },
    { header: 'Sessions', key: 'session_count', width: 12 },
    { header: 'Hub(s) Logged', key: 'hubs', width: 24 },
    { header: 'Max Distance (m)', key: 'max_dist', width: 18 },
    { header: 'Notes / Flags', key: 'notes', width: 22 }
  ];

  styleHeaderRow(dailySheet.getRow(1), PRIMARY_HEADER_FILL);

  rawData.forEach((record, index) => {
    const sessions = Array.isArray(record.session_logs_data) ? record.session_logs_data : [];
    const sessionCount = sessions.length;
    
    // Hubs
    const hubsUsed = sessions.map(s => hubMap.get(s.hub_id) || s.hub_id).filter(Boolean);
    const uniqueHubs = [...new Set(hubsUsed)].join(', ') || '-';

    // Distances
    const distances = sessions.map(s => s.distance_from_hub_m).filter(d => typeof d === 'number');
    const maxDist = distances.length > 0 ? Math.max(...distances) : '-';

    // Duration calculation
    let totalMinutes = 0;
    if (sessions.length > 0) {
      sessions.forEach(s => {
        if (s.login_time && s.logout_time) {
          const m = Math.round((new Date(s.logout_time) - new Date(s.login_time)) / 60000);
          if (m > 0) totalMinutes += m;
        }
      });
    } else if (record.first_login_time && record.logout_time) {
      const m = Math.round((new Date(record.logout_time) - new Date(record.first_login_time)) / 60000);
      if (m > 0) totalMinutes += m;
    }

    const durationText = totalMinutes > 0 ? `${Math.floor(totalMinutes / 60)}h ${totalMinutes % 60}m` : (record.first_login_time && !record.logout_time ? 'Open Shift' : '-');
    const hoursDec = totalMinutes > 0 ? Number((totalMinutes / 60).toFixed(2)) : (record.first_login_time && !record.logout_time ? 'Active' : 0);

    // Notes
    let notes = [];
    if (sessions.some(s => s.auto_closed)) notes.push('Auto-closed session');
    if (record.first_login_time && !record.logout_time) notes.push('Shift in progress / Open');

    const row = dailySheet.addRow({
      shift_date: record.shift_date,
      full_name: record.full_name,
      emp_code: record.emp_code,
      shift_type: (record.shift_type || 'day').toUpperCase(),
      attendance_status: (record.attendance_status || 'present').toUpperCase(),
      first_login_time: formatIST(record.first_login_time),
      logout_time: formatIST(record.logout_time),
      duration_text: durationText,
      hours_dec: hoursDec,
      session_count: sessionCount || 1,
      hubs: uniqueHubs,
      max_dist: maxDist,
      notes: notes.join('; ') || 'Standard'
    });

    row.height = 20;
    row.eachCell((cell, colNum) => {
      cell.border = BORDER_THIN;
      cell.alignment = { vertical: 'middle', horizontal: [1, 3, 4, 5, 8, 9, 10, 12].includes(colNum) ? 'center' : 'left' };
      if (index % 2 === 1) cell.fill = ZEBRA_FILL;
    });
  });

  // -------------------------------------------------------------------------
  // 3. DETAILED SESSIONS SHEET
  // -------------------------------------------------------------------------
  const sessionSheet = workbook.addWorksheet('Session-Level Logs', { views: [{ showGridLines: true, state: 'frozen', ySplit: 1 }] });

  sessionSheet.columns = [
    { header: 'Date', key: 'shift_date', width: 14 },
    { header: 'Employee Name', key: 'full_name', width: 26 },
    { header: 'Emp Code', key: 'emp_code', width: 14 },
    { header: 'Session #', key: 'session_num', width: 12 },
    { header: 'Hub Name', key: 'hub_name', width: 22 },
    { header: 'Login Time (IST)', key: 'login_time', width: 22 },
    { header: 'Logout Time (IST)', key: 'logout_time', width: 22 },
    { header: 'Duration', key: 'duration_text', width: 16 },
    { header: 'Hours (Dec)', key: 'hours_dec', width: 14 },
    { header: 'Distance from Hub (m)', key: 'dist_m', width: 22 },
    { header: 'Auto Closed?', key: 'auto_closed', width: 14 },
    { header: 'Device ID', key: 'device_id', width: 22 }
  ];

  styleHeaderRow(sessionSheet.getRow(1), SECONDARY_HEADER_FILL);

  let sessionRowIdx = 0;
  rawData.forEach(record => {
    const sessions = Array.isArray(record.session_logs_data) ? record.session_logs_data : [];
    if (sessions.length === 0) {
      // Create single entry from top level
      const dur = calculateDuration(record.first_login_time, record.logout_time);
      const row = sessionSheet.addRow({
        shift_date: record.shift_date,
        full_name: record.full_name,
        emp_code: record.emp_code,
        session_num: 1,
        hub_name: '-',
        login_time: formatIST(record.first_login_time),
        logout_time: formatIST(record.logout_time),
        duration_text: dur.text,
        hours_dec: dur.hoursDec,
        dist_m: '-',
        auto_closed: 'No',
        device_id: '-'
      });
      row.height = 20;
      row.eachCell((cell, colNum) => {
        cell.border = BORDER_THIN;
        cell.alignment = { vertical: 'middle', horizontal: [1, 3, 4, 8, 9, 10, 11].includes(colNum) ? 'center' : 'left' };
        if (sessionRowIdx % 2 === 1) cell.fill = ZEBRA_FILL;
      });
      sessionRowIdx++;
    } else {
      sessions.forEach((s, sIdx) => {
        const dur = calculateDuration(s.login_time, s.logout_time);
        const hubName = hubMap.get(s.hub_id) || s.hub_id || '-';
        const row = sessionSheet.addRow({
          shift_date: record.shift_date,
          full_name: record.full_name,
          emp_code: record.emp_code,
          session_num: sIdx + 1,
          hub_name: hubName,
          login_time: formatIST(s.login_time),
          logout_time: formatIST(s.logout_time),
          duration_text: dur.text,
          hours_dec: dur.hoursDec,
          dist_m: typeof s.distance_from_hub_m === 'number' ? s.distance_from_hub_m : '-',
          auto_closed: s.auto_closed ? 'Yes' : 'No',
          device_id: s.device_id || '-'
        });
        row.height = 20;
        row.eachCell((cell, colNum) => {
          cell.border = BORDER_THIN;
          cell.alignment = { vertical: 'middle', horizontal: [1, 3, 4, 8, 9, 10, 11].includes(colNum) ? 'center' : 'left' };
          if (sessionRowIdx % 2 === 1) cell.fill = ZEBRA_FILL;
        });
        sessionRowIdx++;
      });
    }
  });

  // -------------------------------------------------------------------------
  // 4, 5, 6. INDIVIDUAL EMPLOYEE SHEETS
  // -------------------------------------------------------------------------
  employees.forEach(emp => {
    const empRecords = rawData.filter(r => r.emp_code === emp.code);
    const empSheet = workbook.addWorksheet(emp.key, { views: [{ showGridLines: true, state: 'frozen', ySplit: 1 }] });

    empSheet.columns = [
      { header: 'Shift Date', key: 'shift_date', width: 14 },
      { header: 'Status', key: 'attendance_status', width: 14 },
      { header: 'Shift Type', key: 'shift_type', width: 12 },
      { header: 'First Login (IST)', key: 'first_login_time', width: 22 },
      { header: 'Last Logout (IST)', key: 'logout_time', width: 22 },
      { header: 'Duration', key: 'duration_text', width: 16 },
      { header: 'Hours (Dec)', key: 'hours_dec', width: 14 },
      { header: 'Sessions', key: 'session_count', width: 12 },
      { header: 'Hub(s)', key: 'hubs', width: 26 },
      { header: 'Max Dist (m)', key: 'max_dist', width: 16 },
      { header: 'Notes', key: 'notes', width: 22 }
    ];

    styleHeaderRow(empSheet.getRow(1), PRIMARY_HEADER_FILL);

    empRecords.forEach((record, idx) => {
      const sessions = Array.isArray(record.session_logs_data) ? record.session_logs_data : [];
      const hubsUsed = sessions.map(s => hubMap.get(s.hub_id) || s.hub_id).filter(Boolean);
      const uniqueHubs = [...new Set(hubsUsed)].join(', ') || '-';
      const distances = sessions.map(s => s.distance_from_hub_m).filter(d => typeof d === 'number');
      const maxDist = distances.length > 0 ? Math.max(...distances) : '-';

      let totalMinutes = 0;
      if (sessions.length > 0) {
        sessions.forEach(s => {
          if (s.login_time && s.logout_time) {
            const m = Math.round((new Date(s.logout_time) - new Date(s.login_time)) / 60000);
            if (m > 0) totalMinutes += m;
          }
        });
      } else if (record.first_login_time && record.logout_time) {
        const m = Math.round((new Date(record.logout_time) - new Date(record.first_login_time)) / 60000);
        if (m > 0) totalMinutes += m;
      }

      const durationText = totalMinutes > 0 ? `${Math.floor(totalMinutes / 60)}h ${totalMinutes % 60}m` : (record.first_login_time && !record.logout_time ? 'Open Shift' : '-');
      const hoursDec = totalMinutes > 0 ? Number((totalMinutes / 60).toFixed(2)) : 0;

      let notes = [];
      if (sessions.some(s => s.auto_closed)) notes.push('Auto-closed session');
      if (record.first_login_time && !record.logout_time) notes.push('Shift in progress / Open');

      const row = empSheet.addRow({
        shift_date: record.shift_date,
        attendance_status: (record.attendance_status || 'present').toUpperCase(),
        shift_type: (record.shift_type || 'day').toUpperCase(),
        first_login_time: formatIST(record.first_login_time),
        logout_time: formatIST(record.logout_time),
        duration_text: durationText,
        hours_dec: hoursDec,
        session_count: sessions.length || 1,
        hubs: uniqueHubs,
        max_dist: maxDist,
        notes: notes.join('; ') || 'OK'
      });

      row.height = 20;
      row.eachCell((cell, colNum) => {
        cell.border = BORDER_THIN;
        cell.alignment = { vertical: 'middle', horizontal: [1, 2, 3, 6, 7, 8, 10].includes(colNum) ? 'center' : 'left' };
        if (idx % 2 === 1) cell.fill = ZEBRA_FILL;
      });
    });
  });

  const outputPath = 'PowerProject_Attendance_Uchirappa_Vikas_Srinivas.xlsx';
  await workbook.xlsx.writeFile(outputPath);
  console.log(`Excel file generated successfully at: ${outputPath}`);
}

buildExcel().catch(console.error);
