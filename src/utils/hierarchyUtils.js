/**
 * Hierarchy Utils (Master Hierarchy System)
 * 
 * Generic utilities for handling parent-child (tree) relationships.
 * Designed for use with Employees (Manager/Employee) and Tasks (Parent/Subtask).
 */

/**
 * Shared maximum hierarchy traversal depth across UI and SQL recursive CTEs
 * (matches `depth < 10` in fn_find_first_editor_in_hierarchy and
 * rpc_submit_attendance_task_choice). Prevents infinite loops and keeps
 * frontend/backend upward-reporting parity.
 */
export const MAX_HIERARCHY_DEPTH = 10;

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
   * Cycle-safe via visited Set and depth-capped to MAX_HIERARCHY_DEPTH (10)
   * to match SQL recursive CTEs.
   * @param {Array} data - Flat array of nodes.
   * @param {string} nodeId - ID of the node to start from.
   * @param {string} idKey 
   * @param {string} parentIdKey 
   * @param {number} maxDepth - Maximum upward hops (defaults to MAX_HIERARCHY_DEPTH).
   * @returns {Array} List of ancestor nodes.
   */
  getAncestors(data, nodeId, idKey = 'id', parentIdKey = 'parent_id', maxDepth = MAX_HIERARCHY_DEPTH) {
    const ancestors = [];
    let currentId = nodeId;
    const map = new Map((data || []).map(item => [item[idKey], item]));
    const visited = new Set([nodeId]);
    let depth = 0;

    while (currentId && depth < maxDepth) {
      const node = map.get(currentId);
      const parentId = node?.[parentIdKey];
      if (parentId && map.has(parentId) && !visited.has(parentId)) {
        visited.add(parentId);
        const parent = map.get(parentId);
        ancestors.unshift(parent);
        currentId = parentId;
        depth += 1;
      } else {
        break;
      }
    }
    return ancestors;
  },

  /**
   * Get all descendants (recursive children) for a node.
   * Cycle-safe via visited Set and depth-capped to MAX_HIERARCHY_DEPTH (10)
   * to match SQL recursive CTEs (prevents stack overflow on manager/task loops).
   * @param {Array} data - Flat array of nodes.
   * @param {string} nodeId - ID of the parent node.
   * @param {string} idKey 
   * @param {string} parentIdKey 
   * @param {number} maxDepth - Maximum downward hops (defaults to MAX_HIERARCHY_DEPTH).
   * @returns {Array} List of all descendant nodes.
   */
  getDescendants(data, nodeId, idKey = 'id', parentIdKey = 'parent_id', maxDepth = MAX_HIERARCHY_DEPTH) {
    if (!Array.isArray(data) || !nodeId || maxDepth <= 0) return [];

    // Pre-index children by parentIdKey for O(N) traversal instead of O(N^2) filter
    const childrenByParent = new Map();
    data.forEach(item => {
      const pid = item?.[parentIdKey];
      if (pid != null) {
        if (!childrenByParent.has(pid)) childrenByParent.set(pid, []);
        childrenByParent.get(pid).push(item);
      }
    });

    const descendants = [];
    const visited = new Set([nodeId]);

    const walk = (parentId, currentDepth) => {
      if (currentDepth >= maxDepth) return;
      const children = childrenByParent.get(parentId) || [];
      for (const child of children) {
        const childId = child?.[idKey];
        if (childId == null || visited.has(childId)) continue;
        visited.add(childId);
        descendants.push(child);
        walk(childId, currentDepth + 1);
      }
    };

    walk(nodeId, 0);
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
   * Useful for indented lists. Cycle-safe and depth-capped to MAX_HIERARCHY_DEPTH.
   * @param {Array} data
   * @param {string} idKey
   * @param {string} parentIdKey
   * @param {function} sortFn - Optional compare function for siblings.
   * @param {number} maxDepth - Maximum tree depth (defaults to MAX_HIERARCHY_DEPTH).
   */
  sortByHierarchy(data, idKey = 'id', parentIdKey = 'parent_id', sortFn = null, maxDepth = MAX_HIERARCHY_DEPTH) {
    const tree = this.buildTree(data, idKey, parentIdKey);
    
    if (sortFn) {
      const sortVisited = new Set();
      const recursiveSort = (nodes, depth = 0) => {
        if (depth > maxDepth) return;
        nodes.sort(sortFn);
        nodes.forEach(node => {
          const nid = node?.[idKey];
          if (nid != null && sortVisited.has(nid)) return;
          if (nid != null) sortVisited.add(nid);
          if (node.children?.length > 0) recursiveSort(node.children, depth + 1);
        });
      };
      recursiveSort(tree, 0);
    }

    const result = [];
    const flattenVisited = new Set();
    
    const flatten = (nodes, level = 0) => {
      if (level > maxDepth) return;
      nodes.forEach(node => {
        const nid = node?.[idKey];
        if (nid != null && flattenVisited.has(nid)) return;
        if (nid != null) flattenVisited.add(nid);
        const { children, ...rest } = node;
        result.push({ ...rest, depth: level });
        if (children && children.length > 0 && level < maxDepth) {
          flatten(children, level + 1);
        }
      });
    };
    
    flatten(tree, 0);
    return result;
  },

  /**
   * Walks upward from `startNode` along `parentIdKey`, invoking `visitor(parentNode, depth)`
   * for each ancestor (up to `maxDepth` hops, cycle-safe via visited Set).
   * Returning `false` from `visitor` stops traversal early.
   * Accepts a pre-built Map<id, node> (O(1) per hop) or a flat Array.
   */
  walkAncestors(startNode, nodeLookup, visitor, parentIdKey = 'parentTask', idKey = 'id', maxDepth = MAX_HIERARCHY_DEPTH) {
    if (!startNode || !nodeLookup || typeof visitor !== 'function' || maxDepth <= 0) return;
    const isMap = nodeLookup instanceof Map;
    let curr = startNode;
    const visited = new Set(curr?.[idKey] != null ? [curr[idKey]] : []);
    let depth = 0;

    while (curr?.[parentIdKey] && depth < maxDepth) {
      const parentId = curr[parentIdKey];
      if (visited.has(parentId)) break;
      const parent = isMap
        ? nodeLookup.get(parentId)
        : nodeLookup.find(item => item?.[idKey] === parentId);
      if (!parent) break;
      visited.add(parent[idKey]);
      depth += 1;
      if (visitor(parent, depth) === false) break;
      curr = parent;
    }
  },

  /**
   * True when every ancestor of `node` (up to `maxDepth` hops) is present in `expandedIds`.
   * Expects a pre-built `nodeMap` (id -> node) hoisted via useMemo so filtering N rows is O(N * depth)
   * instead of O(N^2). Cycle-safe via visited Set and depth-capped to MAX_HIERARCHY_DEPTH.
   * @param {Object} node - Starting node.
   * @param {Map} nodeMap - Pre-indexed Map<id, node>.
   * @param {Set} expandedIds - Set of expanded parent IDs.
   * @param {string} parentIdKey - Property name for parent ID (defaults to 'parentTask').
   * @param {number} maxDepth - Maximum upward hops (defaults to MAX_HIERARCHY_DEPTH).
   * @returns {boolean}
   */
  areAncestorsExpanded(node, nodeMap, expandedIds, parentIdKey = 'parentTask', maxDepth = MAX_HIERARCHY_DEPTH) {
    if (!node || !nodeMap || !expandedIds) return true;
    let curr = node;
    const visited = new Set([node.id]);
    let depth = 0;

    while (curr?.[parentIdKey] && depth < maxDepth) {
      const parentId = curr[parentIdKey];
      if (visited.has(parentId)) break;
      if (!expandedIds.has(parentId)) return false;
      curr = nodeMap.get(parentId);
      if (!curr) break;
      visited.add(curr.id);
      depth += 1;
    }
    return true;
  }
};
