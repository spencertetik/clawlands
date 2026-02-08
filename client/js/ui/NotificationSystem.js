// NotificationSystem.js - Compact pixel-style toast notifications
// Matches the red terminal theme, small and unobtrusive

class NotificationSystem {
    constructor() {
        this.container = null;
        this.notifications = [];
        this.maxVisible = 3;
        
        // Notification types — small colored pip + text
        this.types = {
            info:        { pip: '#4a9eff' },
            success:     { pip: '#4ade80' },
            warning:     { pip: '#f59e0b' },
            quest:       { pip: '#a855f7' },
            continuity:  { pip: '#c43a24' },
            knowledge:   { pip: '#fbbf24' },
            achievement: { pip: '#f59e0b' }
        };
        
        this.init();
    }
    
    init() {
        this.container = document.createElement('div');
        this.container.id = 'notification-container';
        this.container.style.cssText = `
            position: fixed;
            top: 70px;
            left: 50%;
            transform: translateX(-50%);
            z-index: 2000;
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: 4px;
            pointer-events: none;
            max-width: 90vw;
        `;
        
        document.body.appendChild(this.container);
    }
    
    // Show a notification
    show(message, type = 'info', duration = 2500) {
        const config = this.types[type] || this.types.info;
        
        const notification = document.createElement('div');
        notification.className = 'game-notification';
        notification.style.cssText = `
            display: inline-flex;
            align-items: center;
            gap: 6px;
            padding: 4px 10px;
            background: rgba(13, 8, 6, 0.88);
            border: 1px solid rgba(196, 58, 36, 0.5);
            border-radius: 3px;
            color: #e8d5cc;
            font-family: monospace;
            font-size: 11px;
            line-height: 1.2;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
            max-width: 280px;
            opacity: 0;
            transform: translateY(-8px);
            transition: opacity 0.2s ease, transform 0.2s ease;
            pointer-events: auto;
            cursor: pointer;
            text-shadow: 0 1px 1px rgba(0,0,0,0.6);
        `;
        
        // Color pip
        const pip = document.createElement('span');
        pip.style.cssText = `
            width: 6px;
            height: 6px;
            border-radius: 50%;
            background: ${config.pip};
            flex-shrink: 0;
            box-shadow: 0 0 4px ${config.pip}44;
        `;
        notification.appendChild(pip);
        
        // Message text — truncate long messages
        const text = document.createElement('span');
        const truncated = message.length > 40 ? message.slice(0, 38) + '..' : message;
        text.textContent = truncated;
        notification.appendChild(text);
        
        // Click to dismiss
        notification.addEventListener('click', () => {
            this.dismiss(notification);
        });
        
        this.container.appendChild(notification);
        this.notifications.push(notification);
        
        // Remove oldest if too many
        while (this.notifications.length > this.maxVisible) {
            this.dismiss(this.notifications[0]);
        }
        
        // Animate in
        requestAnimationFrame(() => {
            notification.style.opacity = '1';
            notification.style.transform = 'translateY(0)';
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
        
        notification.style.opacity = '0';
        notification.style.transform = 'translateY(-8px)';
        
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
            const idx = this.notifications.indexOf(notification);
            if (idx >= 0) {
                this.notifications.splice(idx, 1);
            }
        }, 200);
    }
    
    // Clear all notifications
    clearAll() {
        for (const notification of [...this.notifications]) {
            this.dismiss(notification);
        }
    }
    
    // Convenience methods
    info(message, duration = 2500) {
        return this.show(message, 'info', duration);
    }
    
    success(message, duration = 2500) {
        return this.show(message, 'success', duration);
    }
    
    warning(message, duration = 3000) {
        return this.show(message, 'warning', duration);
    }
    
    quest(message, duration = 3000) {
        return this.show(message, 'quest', duration);
    }
    
    continuity(message, duration = 2000) {
        return this.show(message, 'continuity', duration);
    }
    
    knowledge(message, duration = 3000) {
        return this.show(message, 'knowledge', duration);
    }
    
    achievement(message, duration = 4000) {
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
