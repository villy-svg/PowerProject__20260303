import { useState, useEffect, useCallback } from 'react';
import { leaveService } from '../services/leaveService';

export const useLeaveWallet = (userId, managerId = null, fetchAll = false) => {
  const [balance, setBalance] = useState({ PL: 0, SL: 0, CL: 0, COMP_OFF: 0 });
  const [ledger, setLedger] = useState([]);
  const [requests, setRequests] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [page, setPage] = useState(1);
  const [ledgerCount, setLedgerCount] = useState(0);
  const [requestsCount, setRequestsCount] = useState(0);
  const pageSize = 50;

  const fetchWalletData = useCallback(async () => {
    // If we're not fetching all and there's no userId, don't fetch
    if (!fetchAll && !userId) return;
    
    setIsLoading(true);
    setError(null);
    try {
      const [walletBalance, ledgerRes, requestsRes] = await Promise.all([
        fetchAll ? { PL: 0, SL: 0, CL: 0, COMP_OFF: 0 } : leaveService.getWalletBalance(userId),
        leaveService.getWalletLedger(userId, fetchAll, page, pageSize),
        leaveService.getLeaveRequests(userId, fetchAll, page, pageSize)
      ]);
      
      setBalance(walletBalance);
      setLedger(ledgerRes.data || []);
      setLedgerCount(ledgerRes.count || 0);
      setRequests(requestsRes.data || []);
      setRequestsCount(requestsRes.count || 0);
    } catch (err) {
      console.error('Error fetching leave wallet data:', err);
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  }, [userId, fetchAll, page]);

  useEffect(() => {
    fetchWalletData();
  }, [fetchWalletData]);

  const submitRequest = async (requestData) => {
    try {
      const newReqs = await leaveService.submitLeaveRequest(requestData, requestData.requested_by, requestData.leaveType);
      // Optimistic update - since it returns an array of multiple days, we can concatenate
      setRequests(prev => [...(newReqs || []), ...prev]);
      return { success: true, data: newReqs };
    } catch (err) {
      console.error('Submit request failed:', err);
      return { success: false, error: err.message };
    }
  };

  return {
    balance,
    ledger,
    ledgerCount,
    requests,
    requestsCount,
    page,
    setPage,
    pageSize,
    isLoading,
    error,
    refresh: fetchWalletData,
    submitRequest
  };
};
