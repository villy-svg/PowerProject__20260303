import { useState, useCallback, useEffect } from 'react';

/**
 * useManagementUI
 * 
 * A specialized hook to standardize common UI state and interactions
 * for horizontal management verticals (Employees, Clients, Charging Hubs).
 * 
 * @param {Object} options - Configuration options
 * @param {string} options.storageKey - The localStorage key for view persistence
 * @param {string} options.defaultView - The initial view mode ('grid' or 'list')
 */
export const useManagementUI = ({ 
  storageKey, 
  defaultView = 'grid' 
}) => {
  // ─── 1. View Mode Persistence ───────────────────────────────────────────
  const [viewMode, setViewMode] = useState(() => 
    localStorage.getItem(storageKey) || defaultView
  );

  useEffect(() => {
    localStorage.setItem(storageKey, viewMode);
  }, [viewMode, storageKey]);

  // ─── 2. Modal Management ───────────────────────────────────────────────
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [isViewOnly, setIsViewOnly] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const openAddModal = useCallback(() => {
    setEditingItem(null);
    setIsViewOnly(false);
    setIsAddModalOpen(true);
  }, []);

  const openEditModal = useCallback((item) => {
    setEditingItem(item);
    setIsViewOnly(false);
    setIsAddModalOpen(true);
  }, []);

  const openViewModal = useCallback((item) => {
    setEditingItem(item);
    setIsViewOnly(true);
    setIsAddModalOpen(true);
  }, []);

  const closeModal = useCallback(() => {
    setIsAddModalOpen(false);
    setEditingItem(null);
    setIsViewOnly(false);
    setIsSaving(false);
  }, []);

  // ─── 3. Bulk Selection Logic ─────────────────────────────────────────────
  const [selectedIds, setSelectedIds] = useState([]);

  const handleSelectIndividual = useCallback((id) => {
    setSelectedIds(prev => 
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    );
  }, []);

  const handleSelectAll = useCallback((items) => {
    const itemIds = items.map(i => typeof i === 'object' ? i.id : i);
    const areAllSelected = itemIds.every(id => selectedIds.includes(id));
    
    if (areAllSelected) {
      setSelectedIds(prev => prev.filter(id => !itemIds.includes(id)));
    } else {
      setSelectedIds(prev => Array.from(new Set([...prev, ...itemIds])));
    }
  }, [selectedIds]);

  const clearSelection = useCallback(() => {
    setSelectedIds([]);
  }, []);

  // ─── 4. Specialized State ──────────────────────────────────────────────
  const [showInactive, setShowInactive] = useState(true);
  const [expandedId, setExpandedId] = useState(null);
  const [isTrayVisible, setIsTrayVisible] = useState(true);

  const handleTrayVisibilityChange = useCallback((visible) => {
    setIsTrayVisible(visible);
  }, []);

  const toggleExpand = useCallback((id) => {
    setExpandedId(prev => prev === id ? null : id);
  }, []);

  return {
    // View
    viewMode, 
    setViewMode,
    showInactive, 
    setShowInactive,
    expandedId, 
    setExpandedId, 
    toggleExpand,
    
    // Modals
    isAddModalOpen, 
    setIsAddModalOpen,
    editingItem, 
    setEditingItem,
    isViewOnly, 
    setIsViewOnly,
    isSaving, 
    setIsSaving,
    openAddModal, 
    openEditModal, 
    openViewModal, 
    closeModal,
    
    // Selection
    selectedIds, 
    setSelectedIds, 
    handleSelectIndividual, 
    handleSelectAll, 
    clearSelection,
    
    // Interactions
    isTrayVisible, 
    handleTrayVisibilityChange
  };
};
