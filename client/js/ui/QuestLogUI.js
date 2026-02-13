// QuestLogUI.js - HTML overlay quest log panel
// Toggle with Q key, styled with red terminal theme
// Shows active and completed quests with objectives and progress

class QuestLogUI {
    constructor(questSystem, questManager) {
        this.questSystem = questSystem;
        this.questManager = questManager;
        this.visible = false;
        this.currentTab = 'active'; // 'active' or 'completed'
        this.overlay = null;
        this.panel = null;
        this.tabsContainer = null;
        this.questList = null;
        this.questElements = [];
        
        this.buildUI();
        this.setupKeyBindings();
        
        // Listen for quest updates to refresh
        if (this.questSystem) {
            this.questSystem.addListener(() => this.refresh());
        }
    }
    
    buildUI() {
        // Inject CSS animation
        if (!document.getElementById('quest-log-ui-styles')) {
            const style = document.createElement('style');
            style.id = 'quest-log-ui-styles';
            style.textContent = `
                @keyframes questLogFadeIn {
                    from { opacity: 0; }
                    to { opacity: 1; }
                }
                @keyframes questLogFadeOut {
                    from { opacity: 1; }
                    to { opacity: 0; }
                }
                @keyframes questLogPanelIn {
                    from { opacity: 0; transform: scale(0.92) translateY(12px); }
                    to { opacity: 1; transform: scale(1) translateY(0); }
                }
                @keyframes questLogPanelOut {
                    from { opacity: 1; transform: scale(1) translateY(0); }
                    to { opacity: 0; transform: scale(0.92) translateY(12px); }
                }
            `;
            document.head.appendChild(style);
        }
        
        // Full-screen overlay — mounted inside game container for integration
        this.overlay = document.createElement('div');
        this.overlay.id = 'quest-log-overlay';
        this.overlay.style.cssText = `
            position: absolute;
            inset: 0;
            background: rgba(0, 0, 0, 0.55);
            z-index: 4000;
            display: none;
            justify-content: center;
            align-items: center;
        `;
        this.overlay.addEventListener('click', (e) => {
            if (e.target === this.overlay) this.hide();
        });
        
        // Main panel — scaled to fit inside game screen
        this.panel = document.createElement('div');
        this.panel.id = 'quest-log-panel';
        this.panel.style.cssText = `
            width: 90%;
            max-width: 520px;
            max-height: 85%;
            background: rgba(13, 8, 6, 0.95);
            border: 2px solid #c43a24;
            border-radius: 8px;
            padding: 12px;
            font-family: 'Courier New', monospace;
            color: #e8d5cc;
            box-shadow: 0 0 30px rgba(196, 58, 36, 0.3), inset 0 0 60px rgba(13, 8, 6, 0.5);
            user-select: none;
            display: flex;
            flex-direction: column;
            overflow: hidden;
        `;
        
        // Header row: title + close hint
        const header = document.createElement('div');
        header.style.cssText = `
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 12px;
        `;
        
        // Title with scroll emoji
        const title = document.createElement('div');
        title.style.cssText = `
            font-size: 16px;
            font-weight: bold;
            color: #c43a24;
            letter-spacing: 2px;
            text-transform: uppercase;
            text-shadow: 0 0 8px rgba(196, 58, 36, 0.4);
        `;
        title.textContent = 'QUEST LOG';
        header.appendChild(title);
        
        // Close hint (top right)
        const closeHint = document.createElement('div');
        closeHint.style.cssText = `
            font-size: 10px;
            color: #8a7068;
            letter-spacing: 0.5px;
        `;
        closeHint.textContent = 'Press Q or ESC to close';
        header.appendChild(closeHint);
        
        this.panel.appendChild(header);
        
        // Tabs container
        this.tabsContainer = document.createElement('div');
        this.tabsContainer.style.cssText = `
            display: flex;
            gap: 8px;
            margin-bottom: 12px;
        `;
        
        // Active tab
        const activeTab = this.createTab('active', 'Active Quests');
        this.tabsContainer.appendChild(activeTab);
        
        // Completed tab
        const completedTab = this.createTab('completed', 'Completed');
        this.tabsContainer.appendChild(completedTab);
        
        this.panel.appendChild(this.tabsContainer);
        
        // Quest list container - scrollable
        this.questList = document.createElement('div');
        this.questList.style.cssText = `
            flex: 1;
            overflow-y: auto;
            max-height: 400px;
            padding-right: 8px;
        `;
        
        // Scrollbar styling
        const scrollStyle = document.createElement('style');
        scrollStyle.textContent = `
            #quest-log-overlay .quest-list::-webkit-scrollbar {
                width: 8px;
            }
            #quest-log-overlay .quest-list::-webkit-scrollbar-track {
                background: rgba(138, 112, 104, 0.1);
                border-radius: 4px;
            }
            #quest-log-overlay .quest-list::-webkit-scrollbar-thumb {
                background: rgba(196, 58, 36, 0.3);
                border-radius: 4px;
            }
            #quest-log-overlay .quest-list::-webkit-scrollbar-thumb:hover {
                background: rgba(196, 58, 36, 0.5);
            }
        `;
        this.questList.className = 'quest-list';
        document.head.appendChild(scrollStyle);
        
        this.panel.appendChild(this.questList);
        
        this.overlay.appendChild(this.panel);
        // Mount inside game container so it's part of the game screen
        const gameContainer = document.getElementById('game-container') || document.body;
        gameContainer.appendChild(this.overlay);
    }
    
    createTab(tabId, label) {
        const tab = document.createElement('div');
        tab.dataset.tab = tabId;
        tab.style.cssText = `
            padding: 6px 12px;
            border: 2px solid rgba(196, 58, 36, 0.3);
            border-radius: 4px;
            cursor: pointer;
            transition: all 0.2s;
            font-size: 12px;
            text-transform: uppercase;
            letter-spacing: 1px;
        `;
        tab.textContent = label;
        
        // Set initial state
        if (tabId === this.currentTab) {
            tab.style.background = 'rgba(196, 58, 36, 0.2)';
            tab.style.borderColor = '#c43a24';
            tab.style.color = '#c43a24';
        } else {
            tab.style.background = 'rgba(138, 112, 104, 0.1)';
            tab.style.borderColor = 'rgba(138, 112, 104, 0.3)';
            tab.style.color = '#8a7068';
        }
        
        tab.addEventListener('click', () => this.switchTab(tabId));
        tab.addEventListener('mouseenter', () => {
            if (tabId !== this.currentTab) {
                tab.style.borderColor = 'rgba(196, 58, 36, 0.5)';
                tab.style.background = 'rgba(196, 58, 36, 0.1)';
            }
        });
        tab.addEventListener('mouseleave', () => {
            if (tabId !== this.currentTab) {
                tab.style.borderColor = 'rgba(138, 112, 104, 0.3)';
                tab.style.background = 'rgba(138, 112, 104, 0.1)';
            }
        });
        
        return tab;
    }
    
    switchTab(tabId) {
        this.currentTab = tabId;
        
        // Update tab visuals
        const tabs = this.tabsContainer.querySelectorAll('[data-tab]');
        tabs.forEach(tab => {
            const isActive = tab.dataset.tab === tabId;
            if (isActive) {
                tab.style.background = 'rgba(196, 58, 36, 0.2)';
                tab.style.borderColor = '#c43a24';
                tab.style.color = '#c43a24';
            } else {
                tab.style.background = 'rgba(138, 112, 104, 0.1)';
                tab.style.borderColor = 'rgba(138, 112, 104, 0.3)';
                tab.style.color = '#8a7068';
            }
        });
        
        this.refresh();
    }
    
    setupKeyBindings() {
        window.addEventListener('keydown', (e) => {
            // Don't capture if typing in an input
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
            
            const key = e.key.toLowerCase();
            
            if (key === 'l') {
                // Don't toggle if dialog is open
                const dialogBox = document.getElementById('dialog-box');
                const dialogOpen = dialogBox && dialogBox.style.display !== 'none' && dialogBox.style.display !== '';
                if (dialogOpen) return;
                
                e.preventDefault();
                this.toggle();
            }
            
            if (key === 'escape' && this.visible) {
                e.preventDefault();
                this.hide();
            }
        });
    }
    
    toggle() {
        if (this.visible) {
            this.hide();
        } else {
            this.show();
        }
    }
    
    show() {
        if (this.visible) return;
        this.visible = true;
        this.overlay.style.display = 'flex';
        if (window.game && window.game.sfx) window.game.sfx.play('menu_open');
        
        // Fade in animation
        this.overlay.style.animation = 'questLogFadeIn 0.2s ease-out forwards';
        this.panel.style.animation = 'questLogPanelIn 0.25s ease-out forwards';
        
        this.refresh();
    }
    
    hide() {
        if (!this.visible) return;
        this.visible = false;
        if (window.game && window.game.sfx) window.game.sfx.play('menu_close');
        
        // Fade out animation
        this.overlay.style.animation = 'questLogFadeOut 0.2s ease-in forwards';
        this.panel.style.animation = 'questLogPanelOut 0.2s ease-in forwards';
        
        setTimeout(() => {
            if (!this.visible) {
                this.overlay.style.display = 'none';
            }
        }, 220);
    }
    
    isOpen() {
        return this.visible;
    }
    
    // Refresh quest list content
    refresh() {
        if (!this.questList) return;
        
        this.questList.innerHTML = '';
        
        if (this.currentTab === 'active') {
            this.renderActiveQuests();
        } else {
            this.renderCompletedQuests();
        }
    }
    
    renderActiveQuests() {
        const activeQuests = [];
        
        // Get quests from QuestSystem (story quests)
        if (this.questSystem) {
            for (const [questId, quest] of Object.entries(this.questSystem.activeQuests)) {
                const questDef = this.questSystem.questDefs[questId];
                if (questDef) {
                    activeQuests.push({
                        id: questId,
                        name: questDef.name,
                        giver: questDef.giver,
                        description: questDef.description,
                        objectives: quest.objectives,
                        rewards: questDef.rewards,
                        type: 'story'
                    });
                }
            }
        }
        
        // Get quests from QuestManager (fetch quests) - active ones
        if (this.questManager) {
            for (const [questId, quest] of Object.entries(this.questManager.allQuests)) {
                const state = this.questManager.getState(questId);
                if (state === 'active') {
                    activeQuests.push({
                        id: questId,
                        name: quest.title || quest.description,
                        giver: quest.npcName,
                        description: quest.description,
                        objectives: this.createFetchObjectives(quest),
                        rewards: quest.rewards,
                        type: 'fetch'
                    });
                }
            }
        }
        
        if (activeQuests.length === 0) {
            this.questList.innerHTML = `
                <div style="text-align: center; color: #8a7068; font-style: italic; margin-top: 40px;">
                    No active quests
                    <br><br>
                    Talk to NPCs to start new quests!
                </div>
            `;
            return;
        }
        
        activeQuests.forEach(quest => {
            this.questList.appendChild(this.createQuestElement(quest));
        });
    }
    
    renderCompletedQuests() {
        const completedQuests = [];
        
        // Get completed story quests from QuestSystem
        if (this.questSystem) {
            for (const questId of this.questSystem.completedQuests) {
                const questDef = this.questSystem.questDefs[questId];
                if (questDef) {
                    completedQuests.push({
                        id: questId,
                        name: questDef.name,
                        giver: questDef.giver,
                        description: questDef.description,
                        rewards: questDef.rewards,
                        type: 'story'
                    });
                }
            }
        }
        
        // Get completed fetch quests from QuestManager
        if (this.questManager) {
            for (const [questId, quest] of Object.entries(this.questManager.allQuests)) {
                const state = this.questManager.getState(questId);
                if (state === 'complete') {
                    completedQuests.push({
                        id: questId,
                        name: quest.title || quest.description,
                        giver: quest.npcName,
                        description: quest.description,
                        rewards: quest.rewards,
                        type: 'fetch'
                    });
                }
            }
        }
        
        if (completedQuests.length === 0) {
            this.questList.innerHTML = `
                <div style="text-align: center; color: #8a7068; font-style: italic; margin-top: 40px;">
                    No completed quests yet
                    <br><br>
                    Complete some quests and they'll appear here!
                </div>
            `;
            return;
        }
        
        completedQuests.forEach(quest => {
            this.questList.appendChild(this.createQuestElement(quest, true));
        });
    }
    
    createFetchObjectives(fetchQuest) {
        // Convert fetch quest requirements into objective format
        const objectives = [];
        
        if (fetchQuest.requires) {
            fetchQuest.requires.forEach(req => {
                const itemDef = typeof ItemData !== 'undefined' ? ItemData[req.itemId] : null;
                const itemName = itemDef ? itemDef.name : req.itemId;
                
                objectives.push({
                    type: 'collect',
                    target: req.itemId,
                    count: req.qty,
                    current: req.qty, // Assume complete since it's fetch quest
                    description: `Collect ${req.qty} ${itemName}`
                });
            });
        }
        
        return objectives;
    }
    
    createQuestElement(quest, isCompleted = false) {
        const questElement = document.createElement('div');
        questElement.style.cssText = `
            margin-bottom: 16px;
            padding: 12px;
            border: 1px solid rgba(138, 112, 104, 0.3);
            border-radius: 6px;
            background: rgba(138, 112, 104, 0.05);
            transition: border-color 0.2s;
        `;
        
        if (isCompleted) {
            questElement.style.opacity = '0.7';
        }
        
        // Quest header: name + giver
        const header = document.createElement('div');
        header.style.cssText = `
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            margin-bottom: 8px;
        `;
        
        const nameDiv = document.createElement('div');
        nameDiv.style.cssText = `
            font-weight: bold;
            font-size: 14px;
            color: ${isCompleted ? '#4ade80' : '#c43a24'};
            margin-bottom: 2px;
        `;
        nameDiv.textContent = quest.name;
        
        const giverDiv = document.createElement('div');
        giverDiv.style.cssText = `
            font-size: 11px;
            color: #8a7068;
            font-style: italic;
        `;
        giverDiv.textContent = `— ${quest.giver}`;
        
        header.appendChild(nameDiv);
        header.appendChild(giverDiv);
        questElement.appendChild(header);
        
        // Quest description
        const descDiv = document.createElement('div');
        descDiv.style.cssText = `
            font-size: 12px;
            color: #e8d5cc;
            margin-bottom: 10px;
            line-height: 1.4;
        `;
        descDiv.textContent = quest.description;
        questElement.appendChild(descDiv);
        
        // Objectives (only for active quests)
        if (!isCompleted && quest.objectives && quest.objectives.length > 0) {
            const objectivesDiv = document.createElement('div');
            objectivesDiv.style.cssText = `
                margin-bottom: 8px;
            `;
            
            quest.objectives.forEach(obj => {
                const objDiv = document.createElement('div');
                objDiv.style.cssText = `
                    font-size: 11px;
                    color: #e8d5cc;
                    margin-bottom: 4px;
                    display: flex;
                    align-items: center;
                `;
                
                const checkbox = obj.current >= obj.count ? '☑' : '☐';
                const checkboxColor = obj.current >= obj.count ? '#4ade80' : '#8a7068';
                
                objDiv.innerHTML = `
                    <span style="color: ${checkboxColor}; margin-right: 6px; font-size: 12px;">${checkbox}</span>
                    <span>${obj.description} ${obj.current >= obj.count ? '' : `(${obj.current}/${obj.count})`}</span>
                `;
                
                objectivesDiv.appendChild(objDiv);
            });
            
            questElement.appendChild(objectivesDiv);
        }
        
        // Rewards
        if (quest.rewards) {
            const rewardsDiv = document.createElement('div');
            rewardsDiv.style.cssText = `
                font-size: 11px;
                color: #8a7068;
                border-top: 1px solid rgba(138, 112, 104, 0.2);
                padding-top: 6px;
                margin-top: 6px;
            `;
            
            const rewardText = this.formatRewards(quest.rewards, quest.type);
            rewardsDiv.innerHTML = `<strong>Rewards:</strong> ${rewardText}`;
            
            questElement.appendChild(rewardsDiv);
        }
        
        return questElement;
    }
    
    formatRewards(rewards, questType) {
        const rewardParts = [];
        
        if (questType === 'story') {
            // Story quest rewards from QuestSystem
            if (rewards.continuity) {
                rewardParts.push(`${rewards.continuity} Continuity`);
            }
            if (rewards.items) {
                rewards.items.forEach(itemId => {
                    const itemDef = typeof ItemData !== 'undefined' ? ItemData[itemId] : null;
                    const itemName = itemDef ? itemDef.name : itemId;
                    rewardParts.push(itemName);
                });
            }
            if (rewards.faction) {
                rewardParts.push(`${rewards.faction} reputation`);
            }
            if (rewards.unlocks) {
                rewardParts.push(`unlocks new content`);
            }
        } else {
            // Fetch quest rewards from QuestManager
            if (Array.isArray(rewards)) {
                rewards.forEach(reward => {
                    const itemDef = typeof ItemData !== 'undefined' ? ItemData[reward.itemId] : null;
                    const itemName = itemDef ? itemDef.name : reward.itemId;
                    const qty = reward.qty > 1 ? ` x${reward.qty}` : '';
                    rewardParts.push(`${itemName}${qty}`);
                });
            }
        }
        
        return rewardParts.length > 0 ? rewardParts.join(', ') : 'Unknown rewards';
    }
}

// Export
window.QuestLogUI = QuestLogUI;
if (typeof module !== 'undefined' && module.exports) {
    module.exports = QuestLogUI;
}