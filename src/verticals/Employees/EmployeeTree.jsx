import React, { useMemo, useState, useEffect } from 'react';
import { hierarchyUtils } from '../../utils/hierarchyUtils';
import EmployeeTreeCard from './EmployeeTreeCard';
import './EmployeeTree.css';

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

  // Build tree from flat data
  const treeData = useMemo(() => {
    return hierarchyUtils.buildTree(employees, 'id', 'manager_id');
  }, [employees]);

  // Initial setup: Expand the upstream path (ancestors) for the current user
  useEffect(() => {
    if (user && employees.length > 0) {
      const currentUser = employees.find(e => e.email === user.email || e.user_id === user.id);
      if (currentUser) {
        const ancestors = hierarchyUtils.getAncestors(employees, currentUser.id, 'id', 'manager_id');
        const ancestorIds = ancestors.map(a => a.id);
        // Only expand ancestors to show the management line, keep the user's own reportees collapsed
        setExpandedIds(new Set(ancestorIds));
      }
    }
  }, [user, employees]);

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

  const renderNode = (node) => {
    const hasChildren = node.children && node.children.length > 0;
    const isExpanded = expandedIds.has(node.id);

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
            {node.children.map(child => renderNode(child))}
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
