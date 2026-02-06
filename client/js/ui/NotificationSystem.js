// NotificationSystem.js - Toast notifications for game events
// Shows non-intrusive messages when things happen

class NotificationSystem {
    constructor() {
        this.container = null;
        this.notifications = [];
        this.maxVisible = 5;
        
        // Notification types and their styles
        this.types = {
            info: { icon: 'ℹ️', bg: 'rgba(60, 60, 80, 0.9)', border: '#4a9eff' },
            success: { icon: '✨', bg: 'rgba(30, 70, 50, 0.9)', border: '#4ade80' },
            warning: { icon: '⚠️', bg: 'rgba(80, 60, 30, 0.9)', border: '#f59e0b' },
            quest: { icon: '📜', bg: 'rgba(60, 40, 70, 0.9)', border: '#a855f7' },
            continuity: { icon: '🌊', bg: 'rgba(50, 40, 60, 0.9)', border: '#c43a24' },
            knowledge: { icon: '💡', bg: 'rgba(50, 50, 40, 0.9)', border: '#fbbf24' },
            achievement: { icon: '🏆', bg: 'rgba(70, 50, 30, 0.9)', border: '#f59e0b' }
        };
        
        this.init();
    }
    
    init() {
        // Create container
        this.container = document.createElement('div');
        this.container.id = 'notification-container';
        this.container.style.cssText = `
            position: fixed;
            top: 70px;
            left: 20px;
            z-index: 2000;
            display: flex;
            flex-direction: column;
            gap: 8px;
            pointer-events: none;
            max-width: 300px;
        `;
        
        document.body.appendChild(this.container);
    }
    
    // Show a notification
    show(message, type = 'info', duration = 3000) {
        const config = this.types[type] || this.types.info;
        
        // Create notification element
        const notification = document.createElement('div');
        notification.className = 'game-notification';
        notification.style.cssText = `
            display: flex;
            align-items: flex-start;
            gap: 10px;
            padding: 12px 16px;
            background: ${config.bg};
            border-left: 3px solid ${config.border};
            border-radius: 6px;
            color: #fff;
            font-family: monospace;
            font-size: 13px;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
            transform: translateX(-120%);
            transition: transform 0.3s ease-out, opacity 0.3s ease;
            pointer-events: auto;
            cursor: pointer;
        `;
        
        // Icon
        const icon = document.createElement('span');
        icon.style.cssText = 'font-size: 16px; flex-shrink: 0;';
        icon.textContent = config.icon;
        notification.appendChild(icon);
        
        // Message
        const text = document.createElement('span');
        text.style.cssText = 'line-height: 1.4;';
        text.textContent = message;
        notification.appendChild(text);
        
        // Click to dismiss
        notification.addEventListener('click', () => {
            this.dismiss(notification);
        });
        
        // Add to container
        this.container.appendChild(notification);
        this.notifications.push(notification);
        
        // Remove old notifications if too many
        while (this.notifications.length > this.maxVisible) {
            this.dismiss(this.notifications[0]);
        }
        
        // Animate in
        requestAnimationFrame(() => {
            notification.style.transform = 'translateX(0)';
        });
        
        // Auto dismiss
        if (duration > 0) {
            setTimeout(() => {
                this.dismiss(notification);
            }, duration);
        }
        
        return notification;
    }
    
    // Dismiss a notification
    dismiss(notification) {
        if (!notification || !notification.parentNode) return;
        
        notification.style.transform = 'translateX(-120%)';
        notification.style.opacity = '0';
        
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
            const idx = this.notifications.indexOf(notification);
            if (idx >= 0) {
                this.notifications.splice(idx, 1);
            }
        }, 300);
    }
    
    // Clear all notifications
    clearAll() {
        for (const notification of [...this.notifications]) {
            this.dismiss(notification);
        }
    }
    
    // Convenience methods
    info(message, duration = 3000) {
        return this.show(message, 'info', duration);
    }
    
    success(message, duration = 3000) {
        return this.show(message, 'success', duration);
    }
    
    warning(message, duration = 4000) {
        return this.show(message, 'warning', duration);
    }
    
    quest(message, duration = 4000) {
        return this.show(message, 'quest', duration);
    }
    
    continuity(message, duration = 2500) {
        return this.show(message, 'continuity', duration);
    }
    
    knowledge(message, duration = 3500) {
        return this.show(message, 'knowledge', duration);
    }
    
    achievement(message, duration = 5000) {
        return this.show(message, 'achievement', duration);
    }
}

// Global instance
let gameNotifications = null;

// Initialize when DOM is ready
if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            gameNotifications = new NotificationSystem();
        });
    } else {
        gameNotifications = new NotificationSystem();
    }
}

// Export for use
if (typeof module !== 'undefined' && module.exports) {
    module.exports = NotificationSystem;
}
