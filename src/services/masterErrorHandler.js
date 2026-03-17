/**
 * Master Error Handler Service
 * Centralized error handling for all vertical components
 */
import { supabase } from './supabaseClient';

class MasterErrorHandler {
  constructor() {
    this.errors = [];
    this.maxErrors = 10;
  }

  // Handle database errors with classification
  handleDatabaseError(error, context = '') {
    const errorInfo = {
      type: 'database',
      context,
      message: error?.message || 'Unknown database error',
      code: error?.code,
      timestamp: new Date().toISOString(),
      severity: this.classifyError(error)
    };

    console.error('🚨 Master Error Handler - Database Error:', errorInfo);
    this.errors.push(errorInfo);
    this.trimErrors();
    this.notifyUser(errorInfo);
    return errorInfo;
  }

  // Handle component errors
  handleComponentError(error, component = '', context = '') {
    const errorInfo = {
      type: 'component',
      component,
      context,
      message: error?.message || 'Unknown component error',
      stack: error?.stack,
      timestamp: new Date().toISOString(),
      severity: 'medium'
    };

    console.error('🚨 Master Error Handler - Component Error:', errorInfo);
    this.errors.push(errorInfo);
    this.trimErrors();
    this.notifyUser(errorInfo);
    return errorInfo;
  }

  // Classify error severity
  classifyError(error) {
    if (error?.code === 'PGRST116') return 'critical'; // Missing table
    if (error?.code === 'PGRST301') return 'critical'; // Auth error
    if (error?.message?.includes('network')) return 'high';
    return 'medium';
  }

  // Notify user with appropriate message
  notifyUser(errorInfo) {
    const messages = {
      'critical': {
        title: 'Critical System Error',
        message: this.getCriticalMessage(errorInfo),
        duration: 0 // Don't auto-dismiss
      },
      'high': {
        title: 'System Error',
        message: errorInfo.message,
        duration: 15000
      },
      'medium': {
        title: 'Error',
        message: errorInfo.message,
        duration: 8000
      }
    };

    const notification = messages[errorInfo.severity];
    this.showNotification(notification);
  }

  // Get specific messages for critical errors
  getCriticalMessage(errorInfo) {
    if (errorInfo.code === 'PGRST116') {
      return 'Database table missing. Please run migration script: migration_create_hubs_table.sql';
    }
    if (errorInfo.code === 'PGRST301') {
      return 'Database authentication failed. Please check your Supabase configuration.';
    }
    return errorInfo.message;
  }

  // Show notification to user
  showNotification(notification) {
    console.log('🔔 Master Error Handler: Showing notification:', notification);
    
    // Create or update notification element
    let notificationEl = document.getElementById('master-error-notification');
    if (!notificationEl) {
      notificationEl = document.createElement('div');
      notificationEl.id = 'master-error-notification';
      notificationEl.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: rgba(255, 68, 68, 0.9);
        color: white;
        padding: 15px;
        border-radius: 8px;
        max-width: 400px;
        z-index: 9999;
        box-shadow: 0 4px 12px rgba(0,0,0,0.3);
        font-family: var(--font-main);
      `;
      document.body.appendChild(notificationEl);
      console.log('✅ Created notification element');
    }

    notificationEl.innerHTML = `
      <div style="display: flex; justify-content: space-between; align-items: center;">
        <strong>${notification.title}</strong>
        <button onclick="this.parentElement.parentElement.remove()" style="
          background: none; border: none; color: white; font-size: 18px; cursor: pointer;
        ">×</button>
      </div>
      <p style="margin: 10px 0; font-size: 14px;">${notification.message}</p>
    `;

    // Auto-dismiss if duration is set
    if (notification.duration > 0) {
      setTimeout(() => {
        if (notificationEl.parentElement) {
          notificationEl.remove();
        }
      }, notification.duration);
    }
  }

  // Test database connection
  async testDatabaseConnection() {
    console.log('🔍 Master Error Handler: Testing database connection...');
    try {
      const { data, error } = await supabase
        .from('hubs')
        .select('count')
        .limit(1);
      
      console.log('🔍 Database test result:', { data, error });
      
      if (error) {
        console.error('❌ Database connection failed:', error);
        this.handleDatabaseError(error, 'Connection Test');
        return { success: false, error };
      }
      
      console.log('✅ Database connection successful');
      return { success: true, data };
    } catch (err) {
      console.error('❌ Database connection exception:', err);
      this.handleDatabaseError(err, 'Connection Test');
      return { success: false, error: err };
    }
  }

  // Trim error history
  trimErrors() {
    if (this.errors.length > this.maxErrors) {
      this.errors = this.errors.slice(-this.maxErrors);
    }
  }

  // Get error history
  getErrorHistory() {
    return [...this.errors];
  }

  // Clear errors
  clearErrors() {
    this.errors = [];
    const notificationEl = document.getElementById('master-error-notification');
    if (notificationEl) {
      notificationEl.remove();
    }
  }
}

// Export singleton instance
export const masterErrorHandler = new MasterErrorHandler();
export default masterErrorHandler;
