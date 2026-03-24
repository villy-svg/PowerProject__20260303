/**
 * Hierarchy Utils (Master Hierarchy System)
 * 
 * Generic utilities for handling parent-child (tree) relationships.
 * Designed for use with Employees (Manager/Employee) and Tasks (Parent/Subtask).
 */

export const hierarchyUtils = {
  /**
   * Build a recursive tree from a flat array of nodes.
   * @param {Array} data - The flat array of objects.
   * @param {string} idKey - The property name for the unique ID.
   * @param {string} parentIdKey - The property name for the parent's ID.
   * @param {string} childrenKey - The property name to store children in.
   * @returns {Array} Array of root nodes (nodes with no parent).
   */
  buildTree(data, idKey = 'id', parentIdKey = 'parent_id', childrenKey = 'children') {
    const map = new Map();
    const roots = [];

    // First pass: Create a map of all nodes
    data.forEach(item => {
      map.set(item[idKey], { ...item, [childrenKey]: [] });
    });

    // Second pass: Link children to parents
    data.forEach(item => {
      const parentId = item[parentIdKey];
      if (parentId && map.has(parentId)) {
        map.get(parentId)[childrenKey].push(map.get(item[idKey]));
      } else {
        roots.push(map.get(item[idKey]));
      }
    });

    return roots;
  },

  /**
   * Get all ancestors for a given node (root-most first).
   * @param {Array} data - Flat array of nodes.
   * @param {string} nodeId - ID of the node to start from.
   * @param {string} idKey 
   * @param {string} parentIdKey 
   * @returns {Array} List of ancestor nodes.
   */
  getAncestors(data, nodeId, idKey = 'id', parentIdKey = 'parent_id') {
    const ancestors = [];
    let currentId = nodeId;
    const map = new Map(data.map(item => [item[idKey], item]));

    while (currentId) {
      const node = map.get(currentId);
      const parentId = node?.[parentIdKey];
      if (parentId && map.has(parentId)) {
        const parent = map.get(parentId);
        ancestors.unshift(parent);
        currentId = parentId;
      } else {
        break;
      }
    }
    return ancestors;
  },

  /**
   * Get all descendants (recursive children) for a node.
   * @param {Array} data - Flat array of nodes.
   * @param {string} nodeId - ID of the parent node.
   * @param {string} idKey 
   * @param {string} parentIdKey 
   * @returns {Array} List of all descendant nodes.
   */
  getDescendants(data, nodeId, idKey = 'id', parentIdKey = 'parent_id') {
    const descendants = [];
    const children = data.filter(item => item[parentIdKey] === nodeId);
    
    children.forEach(child => {
      descendants.push(child);
      descendants.push(...this.getDescendants(data, child[idKey], idKey, parentIdKey));
    });
    
    return descendants;
  },

  /**
   * Detect if assigning a new parent would create a cycle.
   * (Checks if the proposed parent is the node itself OR an existing descendant).
   * @param {Array} data - Flat array of nodes.
   * @param {string} nodeId - ID of the node being moved.
   * @param {string} proposedParentId - ID of the proposed new parent.
   * @param {string} idKey 
   * @param {string} parentIdKey 
   * @returns {boolean} True if a cycle is detected (assignment is INVALID).
   */
  detectCycle(data, nodeId, proposedParentId, idKey = 'id', parentIdKey = 'parent_id') {
    if (!nodeId || !proposedParentId) return false;
    if (nodeId === proposedParentId) return true;

    const descendants = this.getDescendants(data, nodeId, idKey, parentIdKey);
    return descendants.some(d => d[idKey] === proposedParentId);
  },

  /**
   * Sort a flat array based on hierarchy (DFS order).
   * Useful for indented lists.
   * @param {Array} data
   * @param {string} idKey
   * @param {string} parentIdKey
   * @param {function} sortFn - Optional compare function for siblings.
   */
  sortByHierarchy(data, idKey = 'id', parentIdKey = 'parent_id', sortFn = null) {
    const tree = this.buildTree(data, idKey, parentIdKey);
    
    if (sortFn) {
      const recursiveSort = (nodes) => {
        nodes.sort(sortFn);
        nodes.forEach(node => {
          if (node.children?.length > 0) recursiveSort(node.children);
        });
      };
      recursiveSort(tree);
    }

    const result = [];
    
    const flatten = (nodes, level = 0) => {
      nodes.forEach(node => {
        const { children, ...rest } = node;
        result.push({ ...rest, depth: level });
        if (children && children.length > 0) {
          flatten(children, level + 1);
        }
      });
    };
    
    flatten(tree);
    return result;
  }
};
