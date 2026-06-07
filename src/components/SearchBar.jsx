import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useTaskBoard } from '../app/contexts/TaskBoardContext';
import { useAuth } from '../app/contexts/AuthContext';
import { useAppNavigation } from '../app/contexts/AppNavigationContext';
import { hierarchyService } from '../services/rules/hierarchyService';
import { getBoardLabelForVertical } from '../constants/taskBoards';
import { MANAGER_SENIORITY_THRESHOLD } from '../constants/roles';
import { resolvePriorityLabel } from '../registry/verticalRegistry';
import { IconSearch, IconX } from './Icons';
import './SearchBar.css';

/**
 * SearchBar
 *
 * Universal search bar with two operational modes:
 *
 * 1. Task Search (default)
 *    context="dashboard" → Global: searches all tasks across every vertical.
 *    context="board"     → Scoped: searches only the current board's task_board label.
 *    Sphere of Influence is enforced via hierarchyService.
 *
 * 2. Records Search (records managers)
 *    Pass `records` (array) and `recordType` ("employee"|"client"|etc.).
 *    The search runs against name/email/code fields in the record objects.
 *    No sphere filtering — records managers handle their own RBAC separately.
 *
 * Props:
 *   context    {string}  "dashboard" | "board"
 *   records    {Array}   Optional — record objects (employees, clients, etc.)
 *   recordType {string}  Optional — label for display ("Employee", "Client", etc.)
 *   onSelect   {fn}      Optional — called with the selected record when clicked
 */
const SearchBar = ({ context = 'dashboard', records = null, recordType = 'Record', onSelect }) => {
  const [query, setQuery] = useState('');
  const [isFocused, setIsFocused] = useState(false);
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const inputRef = useRef(null);
  const containerRef = useRef(null);

  const { tasks } = useTaskBoard();
  const { user } = useAuth();
  const { activeVertical, setActiveVertical } = useAppNavigation();

  // ── Debounce ──────────────────────────────────────────────────────────────
  useEffect(() => {
    const handler = setTimeout(() => setDebouncedQuery(query.trim()), 280);
    return () => clearTimeout(handler);
  }, [query]);

  // ── Close on outside click ────────────────────────────────────────────────
  useEffect(() => {
    const handleOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsFocused(false);
      }
    };
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, []);

  // ── Detect mode ───────────────────────────────────────────────────────────
  const isRecordsMode = Array.isArray(records) && records.length > 0;

  // ── Records search ────────────────────────────────────────────────────────
  const recordResults = useMemo(() => {
    if (!isRecordsMode || !debouncedQuery) return [];
    const lowerQ = debouncedQuery.toLowerCase();
    return records
      .filter(rec => {
        // Try common identifier fields across verticals
        return (
          (rec.full_name   || '').toLowerCase().includes(lowerQ) ||
          (rec.name        || '').toLowerCase().includes(lowerQ) ||
          (rec.email       || '').toLowerCase().includes(lowerQ) ||
          (rec.emp_code    || '').toLowerCase().includes(lowerQ) ||
          (rec.badge_id    || '').toLowerCase().includes(lowerQ) ||
          (rec.phone       || '').toLowerCase().includes(lowerQ) ||
          (rec.company_name|| '').toLowerCase().includes(lowerQ) ||
          (rec.contact_name|| '').toLowerCase().includes(lowerQ) ||
          (rec.role_code   || '').toLowerCase().includes(lowerQ) ||
          (rec.dept_code   || '').toLowerCase().includes(lowerQ)
        );
      })
      .slice(0, 12);
  }, [isRecordsMode, records, debouncedQuery]);

  // ── Task search (Sphere-aware) ────────────────────────────────────────────
  const taskResults = useMemo(() => {
    if (isRecordsMode || !debouncedQuery || !tasks?.length || !user) return [];

    const lowerQuery = debouncedQuery.toLowerCase();

    // 1. Text match
    let candidates = tasks.filter(task =>
      (task.text        || '').toLowerCase().includes(lowerQuery) ||
      (task.description || '').toLowerCase().includes(lowerQuery)
    );

    // 2. Board scoping (board context only)
    if (context === 'board' && activeVertical) {
      const boardLabel = getBoardLabelForVertical(activeVertical);
      if (boardLabel) {
        candidates = candidates.filter(task => {
          const taskBoards = Array.isArray(task.task_board) ? task.task_board : [];
          return taskBoards.includes(boardLabel);
        });
      }
    }

    // 3. Sphere of Influence enforcement
    const isManager = Number(user.seniority ?? 100) > MANAGER_SENIORITY_THRESHOLD;
    const minimalPermissions = isManager ? { scope: 'global' } : {};

    const sphereFiltered = hierarchyService.filterTasksByHierarchy(
      user,
      candidates,
      activeVertical,
      {},
      minimalPermissions
    );

    // 4. Strip context-only (hierarchy-anchor) tasks to prevent data leakage
    return sphereFiltered.filter(t => !t.isContextOnly).slice(0, 12);
  }, [isRecordsMode, debouncedQuery, tasks, user, context, activeVertical]);

  // ── Unified results ───────────────────────────────────────────────────────
  const searchResults = isRecordsMode ? recordResults : taskResults;

  // ── Helpers ───────────────────────────────────────────────────────────────
  const handleResultClick = (item) => {
    if (isRecordsMode) {
      onSelect?.(item);
    } else {
      if (item.verticalId) setActiveVertical(item.verticalId);
    }
    setIsFocused(false);
    setQuery('');
  };

  const handleClear = () => {
    setQuery('');
    setDebouncedQuery('');
    inputRef.current?.focus();
  };

  const showDropdown = isFocused && debouncedQuery.length > 0;
  const scopeLabel = isRecordsMode
    ? `${recordType} records`
    : context === 'board' ? 'this board' : 'all boards';

  const placeholderText = isRecordsMode
    ? `Search ${recordType.toLowerCase()} records…`
    : `Search tasks in ${context === 'board' ? 'this board' : 'all boards'}…`;

  return (
    <div
      className={`search-bar-root ${context}-ctx`}
      ref={containerRef}
      role="search"
    >
      {/* Input */}
      <div className={`search-input-pill ${isFocused ? 'pill-focused' : ''}`}>
        <IconSearch size={14} className="pill-icon" />
        <input
          ref={inputRef}
          type="text"
          className="search-input"
          placeholder={placeholderText}
          value={query}
          onChange={e => setQuery(e.target.value)}
          onFocus={() => setIsFocused(true)}
          aria-label="Search"
          autoComplete="off"
          spellCheck={false}
        />
        {query && (
          <button
            className="search-clear-btn"
            onClick={handleClear}
            tabIndex={-1}
            aria-label="Clear search"
          >
            <IconX size={12} />
          </button>
        )}
      </div>

      {/* Dropdown */}
      {showDropdown && (
        <div className="search-dropdown" role="listbox">
          {searchResults.length > 0 ? (
            <>
              <div className="search-dropdown-header">
                {searchResults.length} result{searchResults.length !== 1 ? 's' : ''} in {scopeLabel}
              </div>
              <ul className="search-results-list">
                {searchResults.map((item, idx) => (
                  isRecordsMode
                    ? <RecordResult key={item.id || idx} rec={item} query={debouncedQuery} onClick={() => handleResultClick(item)} />
                    : <TaskResult  key={item.id}      task={item} query={debouncedQuery} onClick={() => handleResultClick(item)} />
                ))}
              </ul>
            </>
          ) : (
            <div className="search-no-results">
              No {isRecordsMode ? `${recordType.toLowerCase()} records` : 'tasks'} found
            </div>
          )}
        </div>
      )}
    </div>
  );
};

/* ── Task result row ─────────────────────────────────────────────────────── */
function TaskResult({ task, query, onClick }) {
  return (
    <li className="search-result-item" role="option" onClick={onClick}>
      <span className="result-text">{highlightMatch(task.text, query)}</span>
      <div className="result-badges">
        {task.stageId && (
          <span className={`result-badge ${stageClass(task.stageId)}`}>
            {stageLabel(task.stageId)}
          </span>
        )}
        {task.priority && (
          <span className={`result-badge ${priorityClass(task.priority)}`}>
            {resolvePriorityLabel(task.priority, task.verticalId)}
          </span>
        )}
      </div>
    </li>
  );
}

/* ── Record result row ───────────────────────────────────────────────────── */
function RecordResult({ rec, query, onClick }) {
  // Derive a display name from whichever field exists
  const primaryName = rec.full_name || rec.name || rec.company_name || '—';
  const secondaryText = rec.email || rec.emp_code || rec.badge_id || rec.phone || '';
  const metaText = rec.role_code || rec.dept_code || rec.status || '';

  return (
    <li className="search-result-item" role="option" onClick={onClick}>
      <div className="result-record-col">
        <span className="result-text">{highlightMatch(primaryName, query)}</span>
        {secondaryText && (
          <span className="result-sub">{highlightMatch(secondaryText, query)}</span>
        )}
      </div>
      {metaText && (
        <div className="result-badges">
          <span className="result-badge">{metaText}</span>
        </div>
      )}
    </li>
  );
}

/* ── Utility helpers ─────────────────────────────────────────────────────── */
function highlightMatch(text = '', query = '') {
  if (!query) return text;
  const idx = text.toLowerCase().indexOf(query.toLowerCase());
  if (idx === -1) return text;
  return (
    <>
      {text.slice(0, idx)}
      <mark className="search-highlight">{text.slice(idx, idx + query.length)}</mark>
      {text.slice(idx + query.length)}
    </>
  );
}

function stageLabel(stageId) {
  return (stageId || '').replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, c => c.toUpperCase());
}

function stageClass(stageId) {
  return {
    COMPLETED:    'stage-completed',
    IN_PROGRESS:  'stage-in-progress',
    REVIEW:       'stage-review',
    BACKLOG:      'stage-backlog',
    DEPRIORITIZED:'stage-deprioritized',
  }[stageId] || 'stage-default';
}

function priorityClass(priority) {
  return { Urgent: 'pri-urgent', High: 'pri-high', Medium: 'pri-medium', Low: 'pri-low' }[priority] || '';
}

export default SearchBar;
