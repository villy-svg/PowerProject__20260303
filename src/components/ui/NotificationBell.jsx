import React, { useState, useRef, useEffect } from 'react';
import { usePushNotifications } from '../../hooks/usePushNotifications';
import { IconBell, IconCheck } from './Icons';
import './NotificationBell.css';

const NotificationBell = ({ user }) => {
  const { notifications, unreadCount, markAsRead, markAllAsRead } = usePushNotifications({ user });
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleNotificationClick = async (notification) => {
    if (!notification.is_read) {
      await markAsRead(notification.id);
    }
    // In the future, we could deep-link here based on notification.entity_id
    // For now, just keep it simple and close the dropdown
    setIsOpen(false);
  };

  const timeAgo = (dateString) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    
    const diffDays = Math.floor(diffHours / 24);
    if (diffDays < 7) return `${diffDays}d ago`;
    
    return date.toLocaleDateString();
  };

  return (
    <div className="notification-bell-container" ref={dropdownRef}>
      <button 
        className={`bell-button ${isOpen ? 'active' : ''}`}
        onClick={() => setIsOpen(!isOpen)}
        aria-label="Notifications"
      >
        <IconBell size={20} />
        {unreadCount > 0 && (
          <span className="bell-badge">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="notification-dropdown">
          <div className="notification-header">
            <h3>Notifications</h3>
            {unreadCount > 0 && (
              <button className="mark-all-btn" onClick={markAllAsRead}>
                Mark all read
              </button>
            )}
          </div>
          
          <ul className="notification-list">
            {notifications.length === 0 ? (
              <li className="notification-empty">No notifications yet</li>
            ) : (
              notifications.map((notif) => (
                <li 
                  key={notif.id} 
                  className={`notification-item ${!notif.is_read ? 'unread' : ''}`}
                  onClick={() => handleNotificationClick(notif)}
                >
                  <p className="notification-title">{notif.title}</p>
                  <p className="notification-body">{notif.body}</p>
                  <span className="notification-time">{timeAgo(notif.created_at)}</span>
                </li>
              ))
            )}
          </ul>
        </div>
      )}
    </div>
  );
};

export default NotificationBell;
