import React, { useMemo } from 'react';
import { hierarchyUtils } from '../../utils/hierarchyUtils';
import EmployeeCard from './EmployeeCard';
import './EmployeeTree.css';

/**
 * EmployeeTree
 * 
 * Visualizes the organizational structure as a nested tree.
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
  // Build tree from flat data
  const treeData = useMemo(() => {
    return hierarchyUtils.buildTree(employees, 'id', 'manager_id');
  }, [employees]);

  // Determine if a node is the current user
  const isUser = (emp) => emp.email === user.email || emp.user_id === user.id;

  const renderNode = (node) => {
    const hasChildren = node.children && node.children.length > 0;
    const isCurrentUser = isUser(node);

    return (
      <div key={node.id} className="tree-node-wrapper">
        <div className="card-container" style={{ position: 'relative' }}>
          {isCurrentUser && <div className="current-user-marker">YOU</div>}
          <EmployeeCard 
            emp={node}
            onEdit={onEdit}
            onView={onView}
            onDelete={onDelete}
            onToggleStatus={onToggleStatus}
            permissions={permissions}
            availableHubs={availableHubs}
            onUpdateHub={onUpdateHub}
            isSelected={selectedIds.includes(node.id)}
            onSelect={onSelect}
            className={isCurrentUser ? 'is-current-user' : ''}
          />
        </div>
        
        {hasChildren && (
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
