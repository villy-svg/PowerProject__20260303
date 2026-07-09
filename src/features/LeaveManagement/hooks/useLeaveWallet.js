import { useState, useEffect, useCallback } from 'react';
import { leaveService } from '../services/leaveService';

export const useLeaveWallet = (userId, managerId = null, fetchAll = false) => {
  const [balance, setBalance] = useState(0);
  const [ledger, setLedger] = useState([]);
  const [requests, setRequests] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchWalletData = useCallback(async () => {
    // If we're not fetching all and there's no userId, don't fetch
    if (!fetchAll && !userId) return;
    
    setIsLoading(true);
    setError(null);
    try {
      const [walletBalance, ledgerData, requestsData] = await Promise.all([
        fetchAll ? 0 : leaveService.getWalletBalance(userId),
        leaveService.getWalletLedger(userId, fetchAll),
        leaveService.getLeaveRequests(userId, fetchAll)
      ]);
      
      setBalance(walletBalance);
      setLedger(ledgerData || []);
      setRequests(requestsData || []);
    } catch (err) {
      console.error('Error fetching leave wallet data:', err);
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  }, [userId, fetchAll]);

  useEffect(() => {
    fetchWalletData();
  }, [fetchWalletData]);

  const submitRequest = async (requestData) => {
    try {
      const newReq = await leaveService.submitLeaveRequest({
        ...requestData,
        employee_id: userId,
        // Forward the manager for approval routing — null if not available
        manager_id: managerId || null
      });
      // Optimistic update
      setRequests(prev => [newReq, ...prev]);
      return { success: true, data: newReq };
    } catch (err) {
      console.error('Submit request failed:', err);
      return { success: false, error: err.message };
    }
  };

  return {
    balance,
    ledger,
    requests,
    isLoading,
    error,
    refresh: fetchWalletData,
    submitRequest
  };
};
