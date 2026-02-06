// Dialog system for NPC interactions and text input
class DialogSystem {
    constructor() {
        this.container = null;
        this.textElement = null;
        this.hintElement = null;
        this.inputElement = null;
        this.lines = [];
        this.index = 0;
        this.visible = false;
        this.inputMode = false;
        this.inputCallback = null;
        this.inputPrompt = '';
    }

    ensureUI() {
        if (this.container) return;

        const container = document.createElement('div');
        container.id = 'dialog-box';
        container.style.cssText = `
            position: fixed;
            left: 50%;
            bottom: 20px;
            transform: translateX(-50%);
            width: 70%;
            max-width: 640px;
            background: rgba(0, 0, 0, 0.85);
            border: 3px solid #fff;
            border-radius: 8px;
            padding: 14px 18px;
            color: #fff;
            font-family: monospace;
            font-size: 14px;
            z-index: 3000;
            display: none;
        `;

        const text = document.createElement('div');
        text.style.marginBottom = '8px';
        text.style.lineHeight = '1.5';
        container.appendChild(text);

        // Input field (hidden by default)
        const inputContainer = document.createElement('div');
        inputContainer.style.cssText = 'display: none; margin: 10px 0;';
        
        const input = document.createElement('input');
        input.type = 'text';
        input.maxLength = 140;
        input.placeholder = 'Write your message...';
        input.style.cssText = `
            width: 100%;
            padding: 10px;
            font-family: monospace;
            font-size: 14px;
            border: 2px solid #fbbf24;
            border-radius: 4px;
            background: rgba(255,255,255,0.95);
            color: #000;
            box-sizing: border-box;
        `;
        
        // Prevent game from capturing keystrokes
        input.addEventListener('keydown', (e) => {
            e.stopPropagation();
            if (e.key === 'Enter' && input.value.trim()) {
                this.submitInput(input.value.trim());
            } else if (e.key === 'Escape') {
                this.cancelInput();
            }
        });
        input.addEventListener('keyup', (e) => e.stopPropagation());
        input.addEventListener('keypress', (e) => e.stopPropagation());
        
        inputContainer.appendChild(input);
        container.appendChild(inputContainer);

        const hint = document.createElement('div');
        hint.style.fontSize = '12px';
        hint.style.color = '#fbbf24';
        hint.textContent = 'Press SPACE to continue';
        container.appendChild(hint);

        // Make dialog tappable to advance (for mobile)
        container.addEventListener('click', (e) => {
            // Don't advance if clicking on input
            if (e.target === input) return;
            if (this.inputMode) return;
            this.advance();
        });
        container.style.cursor = 'pointer';

        document.body.appendChild(container);

        this.container = container;
        this.textElement = text;
        this.inputContainer = inputContainer;
        this.inputElement = input;
        this.hintElement = hint;
    }

    isOpen() {
        return this.visible;
    }

    // Show regular dialog lines (optional callback when dialog ends)
    show(lines, onComplete = null) {
        this.ensureUI();
        this.lines = Array.isArray(lines) ? lines : [lines];
        this.index = 0;
        this.visible = true;
        this.inputMode = false;
        this.onCompleteCallback = onComplete; // Store callback for when dialog ends
        this.inputContainer.style.display = 'none';
        this.updateText();
        this.container.style.display = 'block';
        
        // Hide touch controls on mobile (tap dialog to advance)
        if (window.touchControls) {
            window.touchControls.hide();
        }
    }

    // Show input prompt for writing messages
    showInput(prompt, callback) {
        this.ensureUI();
        this.inputPrompt = prompt;
        this.inputCallback = callback;
        this.inputMode = true;
        this.visible = true;
        
        this.textElement.textContent = prompt;
        this.inputContainer.style.display = 'block';
        this.inputElement.value = '';
        this.hintElement.textContent = 'Press ENTER to submit, ESC to cancel';
        this.container.style.display = 'block';
        
        // Hide touch controls on mobile
        if (window.touchControls) {
            window.touchControls.hide();
        }
        
        // Focus the input
        setTimeout(() => this.inputElement.focus(), 50);
    }

    submitInput(text) {
        if (this.inputCallback) {
            this.inputCallback(text);
        }
        this.hide();
    }

    cancelInput() {
        this.inputCallback = null;
        this.hide();
    }

    updateText() {
        if (!this.textElement) return;
        const line = this.lines[this.index] || '';
        this.textElement.innerHTML = line.replace(/\n/g, '<br>');
        if (this.hintElement && !this.inputMode) {
            const isMobile = 'ontouchstart' in window;
            const closeText = isMobile ? 'Tap to close' : 'Press SPACE to close';
            const continueText = isMobile ? 'Tap to continue' : 'Press SPACE to continue';
            this.hintElement.textContent = this.index >= this.lines.length - 1
                ? closeText
                : continueText;
        }
    }

    advance() {
        if (!this.visible) return false;
        if (this.inputMode) return false; // Don't advance in input mode
        
        if (this.index < this.lines.length - 1) {
            this.index += 1;
            this.updateText();
            return true;
        }
        this.hide();
        return false;
    }

    hide() {
        if (!this.container) return;
        this.container.style.display = 'none';
        this.visible = false;
        this.inputMode = false;
        this.inputCallback = null;
        if (this.inputContainer) {
            this.inputContainer.style.display = 'none';
        }
        
        // Show touch controls again on mobile
        if (window.touchControls) {
            window.touchControls.show();
        }
        
        // Call completion callback if set
        if (this.onCompleteCallback) {
            const callback = this.onCompleteCallback;
            this.onCompleteCallback = null; // Clear before calling to prevent loops
            callback();
        }
    }
}
