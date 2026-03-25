import React, { useMemo, useState, useEffect } from 'react';
import { hierarchyUtils } from '../../utils/hierarchyUtils';
import EmployeeTreeCard from './EmployeeTreeCard';
import './Employees.css';

/**
 * EmployeeTree
 * 
 * Visualizes the organizational structure as a nested tree.
 * Features:
 * - Simplified compact cards (Name, Role, Hub).
 * - Collapsible branches with +/- toggles.
 * - Defaults to showing current user's upstream path.
 */
const EmployeeTree = ({ 
  employees, 
  user, 
  onEdit, 
  onView, 
  onDelete, 
  onToggleStatus, 
  permissions, 
  availableHubs, 
  onUpdateHub,
  selectedIds,
  onSelect
}) => {
  const [expandedIds, setExpandedIds] = useState(new Set());
  const [showOthersIds, setShowOthersIds] = useState(new Set());

  // Build tree from flat data
  const treeData = useMemo(() => {
    return hierarchyUtils.buildTree(employees, 'id', 'manager_id');
  }, [employees]);

  // Identify the "Management Line" (Path from Roots to Current User)
  const pathIds = useMemo(() => {
    if (!user || !employees.length) return new Set();
    const currentUser = employees.find(e => e.email === user.email || e.user_id === user.id);
    if (!currentUser) return new Set();
    const ancestors = hierarchyUtils.getAncestors(employees, currentUser.id, 'id', 'manager_id');
    return new Set([...ancestors.map(a => a.id), currentUser.id]);
  }, [user, employees]);

  // Default behavior: Expand the management line to ensure the path is visible
  useEffect(() => {
    if (pathIds.size > 0) {
      setExpandedIds(new Set(pathIds));
    }
  }, [pathIds]);

  const toggleNode = (nodeId) => {
    setExpandedIds(prev => {
      const next = new Set(prev);
      if (next.has(nodeId)) {
        next.delete(nodeId);
      } else {
        next.add(nodeId);
      }
      return next;
    });
  };

  const toggleShowOthers = (parentId) => {
    setShowOthersIds(prev => {
      const next = new Set(prev);
      if (next.has(parentId)) next.delete(parentId);
      else next.add(parentId);
      return next;
    });
  };

  const renderNode = (node) => {
    const hasChildren = node.children && node.children.length > 0;
    const isExpanded = expandedIds.has(node.id);
    const isOnPath = pathIds.has(node.id);
    const isShowingOthers = showOthersIds.has(node.id);

    // Focused View Logic: On the management line, only show the next child on the path by default
    let visibleChildren = node.children || [];
    let hiddenCount = 0;

    if (isOnPath && !isShowingOthers) {
      const pathChild = (node.children || []).find(c => pathIds.has(c.id));
      if (pathChild) {
        visibleChildren = [pathChild];
        hiddenCount = (node.children || []).length - 1;
      } else {
        // This node is the User (terminal point of path); hide all reportees by default
        visibleChildren = [];
        hiddenCount = (node.children || []).length;
      }
    }

    return (
      <div key={node.id} className={`tree-node-wrapper ${hasChildren ? (isExpanded ? 'is-expanded' : 'is-collapsed') : 'is-leaf'}`}>
        <div className="card-container" style={{ position: 'relative' }}>
          <EmployeeTreeCard 
            emp={node}
            user={user}
            onEdit={onEdit}
            onDelete={onDelete}
            permissions={permissions}
            isSelected={selectedIds.includes(node.id)}
            onSelect={onSelect}
            hasChildren={hasChildren}
            isExpanded={isExpanded}
            onToggle={() => toggleNode(node.id)}
          />
        </div>
        
        {hasChildren && isExpanded && (
          <div className="tree-children">
            {/* Render direct line or current visible children */}
            {visibleChildren.map(child => renderNode(child))}
            
            {/* Show "Show Others" button if siblings are hidden */}
            {hiddenCount > 0 && !isShowingOthers && (
              <div className="show-others-item">
                <button 
                  className="show-others-btn" 
                  onClick={() => toggleShowOthers(node.id)}
                >
                  <span className="others-count">+{hiddenCount}</span> other reportees
                </button>
              </div>
            )}

            {/* Render others if toggled */}
            {isShowingOthers && (
              <>
                <div className="others-header">
                  <span className="others-label">Other Reportees</span>
                  <button className="hide-others-link" onClick={() => toggleShowOthers(node.id)}>Collapse</button>
                </div>
                {(node.children || [])
                  .filter(c => !visibleChildren.includes(c))
                  .map(child => renderNode(child))}
              </>
            )}
          </div>
        )}
      </div>
    );
  };

  if (!employees.length) return <div className="empty-state">No employees found.</div>;

  return (
    <div className="employee-tree-container">
      <div className="tree-root-group">
        {treeData.map(rootNode => (
          <div key={rootNode.id} className="tree-root">
            {renderNode(rootNode)}
          </div>
        ))}
      </div>
    </div>
  );
};

export default EmployeeTree;
