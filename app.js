// NeoChat AI - Main Application Controller

class NeoChatApp {
    constructor() {
        this.chatHistory = [];
        this.messages = [];
        this.currentChatId = null;
        this.isProcessing = false;

        this.elements = {
            chatInput: document.getElementById('chat-input'),
            sendBtn: document.getElementById('send-btn'),
            newChatBtn: document.getElementById('new-chat-btn'),
            deepResearchToggle: document.getElementById('deep-research-toggle'),
            thinkingLogsPanel: document.getElementById('thinking-logs-panel'),
            thinkingLogs: document.getElementById('thinking-logs'),
            chatHistoryList: document.getElementById('chat-history-list'),
            currentChatTitle: document.getElementById('current-chat-title'),
            truthMeter: document.getElementById('truth-meter-container'),
            fileBtn: document.getElementById('file-btn'),
            fileInput: document.getElementById('file-input'),
            modelSelector: document.getElementById('model-selector'),
            personaSelector: document.getElementById('persona-selector')
        };

        this.init();
    }

    async init() {
        // Load local history first
        this.loadChatHistory();

        // Load from cloud if user is logged in
        await this.loadCloudChats();

        this.bindEvents();
        this.createNewChat();
    }

    async loadCloudChats() {
        // Wait for auth state to settle
        const user = window.firebaseAuth?.currentUser;
        if (!user) {
            console.log('⏭️ Skipping cloud load - no user logged in yet');
            return;
        }

        try {
            const cloudChats = await window.loadChatsFromCloud();
            if (cloudChats && cloudChats.length > 0) {
                // Merge with local chats (cloud takes priority)
                const localIds = new Set(this.chatHistory.map(c => c.id));
                const newCloudChats = cloudChats.filter(c => !localIds.has(c.id));

                this.chatHistory = [...cloudChats, ...this.chatHistory.filter(c => !cloudChats.find(cc => cc.id === c.id))];
                this.saveChatHistory();
                this.renderChatHistory();

                console.log(`✅ Loaded ${cloudChats.length} chats from cloud`);
            }
        } catch (error) {
            console.error('Error loading cloud chats:', error);
        }
    }

    bindEvents() {
        // Send message
        this.elements.sendBtn.addEventListener('click', () => this.sendMessage());

        this.elements.chatInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                this.sendMessage();
            }
        });

        // Auto-resize textarea
        this.elements.chatInput.addEventListener('input', () => {
            this.elements.chatInput.style.height = 'auto';
            this.elements.chatInput.style.height = Math.min(this.elements.chatInput.scrollHeight, 200) + 'px';
        });

        // New chat
        this.elements.newChatBtn.addEventListener('click', () => this.createNewChat());

        // Persona Selector
        this.elements.personaSelector.addEventListener('change', (e) => {
            const personaKey = e.target.value;
            if (window.groqAPI.setPersona(personaKey)) {
                const persona = window.groqAPI.getPersonaConfig();
                this.addLog(`🎭 Switched to ${persona.emoji} ${persona.name} Mode`);
            }
        });

        // Deep research toggle
        this.elements.deepResearchToggle.addEventListener('click', (e) => {
            // If turning ON, intercept and show modal
            if (e.target.checked) {
                e.preventDefault(); // Stop toggle from switching immediately
                this.showDeepResearchModal();
            } else {
                // If turning OFF, intercept and show disable modal
                e.preventDefault();
                this.showDeepResearchDisableModal();
            }
        });

        // Deep Research Modal Buttons (Activate)
        document.getElementById('cancel-research-btn').addEventListener('click', () => {
            this.hideDeepResearchModal();
            this.elements.deepResearchToggle.checked = false;
        });

        document.getElementById('confirm-research-btn').addEventListener('click', () => {
            this.elements.deepResearchToggle.checked = true;
            this.toggleDeepResearch(true);
            this.hideDeepResearchModal();

            // Auto-switch to Llama 4 Scout (High TPM: 30k)
            const researchModelKey = 'llama-4-scout';
            if (window.groqAPI.setModel(researchModelKey)) {
                this.elements.modelSelector.value = researchModelKey;
                console.log('Switched to Llama 4 Scout for Deep Research');
            }
        });

        // Deep Research Disable Modal Buttons
        document.getElementById('cancel-disable-btn').addEventListener('click', () => {
            this.hideDeepResearchDisableModal();
            this.elements.deepResearchToggle.checked = true; // Keep it on
        });

        document.getElementById('confirm-disable-btn').addEventListener('click', () => {
            this.elements.deepResearchToggle.checked = false;
            this.toggleDeepResearch(false);
            this.createNewChat();
            this.hideDeepResearchDisableModal();
        });

        // Model selector
        this.elements.modelSelector.addEventListener('change', (e) => {
            const modelKey = e.target.value;
            window.groqAPI.setModel(modelKey);
            console.log(`Model switched to: ${window.groqAPI.getModelConfig().name}`);
        });

        // File upload
        this.elements.fileBtn.addEventListener('click', () => this.elements.fileInput.click());
        this.elements.fileInput.addEventListener('change', (e) => this.handleFileUpload(e));

        // Usage Policy
        document.getElementById('policy-btn').addEventListener('click', () => this.showPolicyModal());
        document.getElementById('close-policy-btn').addEventListener('click', () => this.hidePolicyModal());
        document.getElementById('policy-ok-btn').addEventListener('click', () => this.hidePolicyModal());

        // Image Upload Modal
        document.getElementById('confirm-image-btn').addEventListener('click', () => this.confirmImageUpload());
        document.getElementById('cancel-image-btn').addEventListener('click', () => this.cancelImageUpload());
    }

    async sendMessage() {
        const content = this.elements.chatInput.value.trim();
        if (!content || this.isProcessing) return;

        this.isProcessing = true;
        this.elements.sendBtn.disabled = true;
        this.elements.chatInput.value = '';
        this.elements.chatInput.style.height = 'auto';

        // Add user message (with image if attached)
        let userMessage;
        if (this.pendingImage) {
            // Multimodal message for Vision models
            userMessage = {
                role: 'user',
                content: [
                    { type: 'text', text: content },
                    {
                        type: 'image_url',
                        image_url: { url: this.pendingImage.data }
                    }
                ]
            };
            window.chatUI.addUserMessage(`${content}\n\n[📷 ${this.pendingImage.name}]`);
            this.pendingImage = null; // Clear after use
        } else {
            userMessage = { role: 'user', content };
            window.chatUI.addUserMessage(content);
        }
        this.messages.push(userMessage);

        // Show thinking
        window.chatUI.addThinkingIndicator();
        window.neoScene.setThinking(true);

        const isDeepResearch = this.elements.deepResearchToggle.checked;
        let searchContext = null;
        let sources = null;

        try {
            // Deep Research mode
            if (isDeepResearch) {
                this.addLog('Initiating deep research...', 'scanning');
                this.addLog('Scanning web sources...', 'scanning');

                const searchResult = await window.tavilyAPI.search(content);
                sources = searchResult.sources;
                searchContext = searchResult.context;

                this.addLog(`Found ${sources.length} relevant sources`, 'complete');
                this.addLog('[AI] Synthesizing 120B parameters...', 'synthesizing');
            }

            // Remove thinking indicator and add AI message
            window.chatUI.removeThinkingIndicator();
            const aiMessageEl = window.chatUI.addAIMessage();

            // Stream response
            this.addLog('Generating response...', 'synthesizing');

            const response = await window.groqAPI.chat(
                this.messages,
                (chunk, full) => window.chatUI.updateAIMessage(aiMessageEl, full),
                searchContext
            );

            // Calculate and show confidence
            const confidence = window.groqAPI.calculateConfidence(response, isDeepResearch);
            this.updateTruthMeter(confidence);

            // Add sources if deep research
            if (sources && sources.length > 0) {
                const sourcesHTML = window.tavilyAPI.formatSourcesHTML(sources);
                window.chatUI.appendSources(aiMessageEl, sourcesHTML);
            }

            this.messages.push({ role: 'assistant', content: response });
            this.addLog('Response complete', 'complete');

            // Update chat title
            if (this.messages.length === 2) {
                this.updateChatTitle(content);
            }

            this.saveChatHistory();

        } catch (error) {
            console.error('Error:', error);
            window.chatUI.removeThinkingIndicator();
            const errorEl = window.chatUI.addAIMessage();

            let errorMessage = `⚠️ **Error:** `;

            if (error instanceof Error) {
                errorMessage += error.message;
            } else if (typeof error === 'object') {
                try {
                    errorMessage += JSON.stringify(error);
                } catch {
                    errorMessage += String(error);
                }
            } else {
                errorMessage += String(error);
            }

            // Handle 503 Over Capacity specifically
            if (errorMessage.includes('503') || errorMessage.includes('over capacity')) {
                errorMessage = `
### ⚠️ Model Over Capacity

The current model (**${window.groqAPI.getModelConfig().name}**) is currently overloaded due to high demand.

**Recommended Action:**
Please switch to **⚡ GPT-OSS 20B** from the model selector above and try again. It is usually more stable.
`;
            } else if (errorMessage.includes('413')) {
                errorMessage = `⚠️ **Context Limit Exceeded:** The conversation is too long. Please start a 'New Chat' to continue.`;
            }

            window.chatUI.updateAIMessage(errorEl, errorMessage);
            this.addLog(`Error: ${errorMessage}`, 'error');
        }

        this.isProcessing = false;
        this.elements.sendBtn.disabled = false;
        window.neoScene.setThinking(false);
    }

    addLog(message, type = 'info') {
        let safeMessage = message;
        if (typeof message === 'object') {
            try {
                safeMessage = JSON.stringify(message, null, 2);
            } catch (e) {
                safeMessage = String(message);
            }
        }

        const log = document.createElement('div');
        log.className = `thinking-log-item ${type}`;
        log.innerHTML = `<span class="text-gray-500">${new Date().toLocaleTimeString()}</span> > ${safeMessage}`;
        this.elements.thinkingLogs.appendChild(log);
        this.elements.thinkingLogs.scrollTop = this.elements.thinkingLogs.scrollHeight;
    }

    clearLogs() {
        this.elements.thinkingLogs.innerHTML = '';
    }

    updateTruthMeter(score) {
        this.elements.truthMeter.classList.remove('hidden');

        const arc = document.getElementById('gauge-arc');
        const needle = document.getElementById('gauge-needle');
        const value = document.getElementById('confidence-value');

        // Arc length (126 is full arc)
        const arcLength = (score / 100) * 126;
        arc.style.strokeDasharray = `${arcLength}, 126`;

        // Needle rotation (-90 to 90 degrees)
        const rotation = -90 + (score / 100) * 180;
        needle.setAttribute('transform', `rotate(${rotation}, 50, 50)`);

        // Value
        value.textContent = `${score}%`;
    }

    createNewChat() {
        this.currentChatId = Date.now().toString();
        this.messages = [];
        window.chatUI.clearMessages();
        this.clearLogs();
        this.elements.truthMeter.classList.add('hidden');
        this.elements.currentChatTitle.textContent = 'New Conversation';
    }

    updateChatTitle(firstMessage) {
        const title = firstMessage.substring(0, 30) + (firstMessage.length > 30 ? '...' : '');
        this.elements.currentChatTitle.textContent = title;

        // Save to history
        const historyItem = {
            id: this.currentChatId,
            title,
            messages: this.messages,
            timestamp: Date.now(),
            createdAt: Date.now()
        };
        const index = this.chatHistory.findIndex(c => c.id === this.currentChatId);
        if (index >= 0) {
            this.chatHistory[index] = historyItem;
        } else {
            this.chatHistory.unshift(historyItem);
        }
        this.renderChatHistory();

        // Auto-save to cloud
        if (window.saveChatToCloud) {
            window.saveChatToCloud(this.currentChatId, historyItem);
        }
    }

    saveChatHistory() {
        const index = this.chatHistory.findIndex(c => c.id === this.currentChatId);
        if (index >= 0) {
            this.chatHistory[index].messages = this.messages;
        }
        localStorage.setItem('neochat_history', JSON.stringify(this.chatHistory));
    }

    loadChatHistory() {
        try {
            this.chatHistory = JSON.parse(localStorage.getItem('neochat_history')) || [];
        } catch { this.chatHistory = []; }
        this.renderChatHistory();
    }

    renderChatHistory() {
        this.elements.chatHistoryList.innerHTML = this.chatHistory.map(chat => `
            <div class="chat-history-item ${chat.id === this.currentChatId ? 'active' : ''}" data-id="${chat.id}">
                <svg class="w-4 h-4 text-gray-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z"/>
                </svg>
                <span class="title">${chat.title}</span>
                <button class="delete-btn p-1 hover:bg-white/10 rounded text-gray-500 hover:text-red-400" data-delete="${chat.id}">
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
                    </svg>
                </button>
            </div>
        `).join('');

        // Bind click events
        this.elements.chatHistoryList.querySelectorAll('.chat-history-item').forEach(item => {
            item.addEventListener('click', (e) => {
                if (!e.target.closest('.delete-btn')) {
                    this.loadChat(item.dataset.id);
                }
            });
        });

        this.elements.chatHistoryList.querySelectorAll('.delete-btn').forEach(btn => {
            btn.addEventListener('click', () => this.deleteChat(btn.dataset.delete));
        });
    }

    loadChat(id) {
        const chat = this.chatHistory.find(c => c.id === id);
        if (!chat) return;

        this.currentChatId = id;
        this.messages = chat.messages || [];
        this.elements.currentChatTitle.textContent = chat.title;

        window.chatUI.clearMessages();
        this.messages.forEach(msg => {
            if (msg.role === 'user') {
                window.chatUI.addUserMessage(msg.content);
            } else {
                const el = window.chatUI.addAIMessage();
                window.chatUI.updateAIMessage(el, msg.content);
            }
        });

        this.renderChatHistory();
    }

    deleteChat(id) {
        this.chatHistory = this.chatHistory.filter(c => c.id !== id);
        localStorage.setItem('neochat_history', JSON.stringify(this.chatHistory));
        if (id === this.currentChatId) this.createNewChat();
        this.renderChatHistory();

        // Delete from cloud
        if (window.deleteChatFromCloud) {
            window.deleteChatFromCloud(id);
        }
    }

    handleFileUpload(e) {
        const file = e.target.files[0];
        if (!file) return;

        const fileName = file.name;
        const fileType = file.type;
        const fileSize = (file.size / 1024).toFixed(1); // KB

        // Check file type
        if (fileType.startsWith('video/')) {
            // Videos are NOT supported
            alert(`⚠️ Video files are not supported.\n\nFile: ${fileName}\nSize: ${fileSize} KB\n\nPlease upload an image or text file instead.`);
            e.target.value = ''; // Reset input
            return;
        }

        if (fileType.startsWith('image/')) {
            // Images: Show confirmation modal
            const reader = new FileReader();
            reader.onload = (event) => {
                const base64Data = event.target.result;
                // Store temporarily for modal confirmation
                this.tempImage = {
                    name: fileName,
                    type: fileType,
                    data: base64Data
                };
                // Update modal filename and show it
                document.getElementById('image-filename').textContent = fileName;
                this.showImageUploadModal();
            };
            reader.readAsDataURL(file);
            e.target.value = ''; // Reset input
            return;
        }

        // Text files: Read as text
        const reader = new FileReader();
        reader.onload = (event) => {
            const content = event.target.result;
            // Limit content to prevent overwhelming the AI
            const truncated = content.length > 3000 ? content.substring(0, 3000) + '\n\n[... truncated ...]' : content;
            this.elements.chatInput.value = `📄 Analyze this file (${fileName}):\n\n\`\`\`\n${truncated}\n\`\`\``;
        };
        reader.onerror = () => {
            alert(`❌ Could not read file: ${fileName}`);
        };
        reader.readAsText(file);
    }
    toggleDeepResearch(enable) {
        if (enable) {
            this.elements.thinkingLogsPanel.classList.remove('hidden');
            this.elements.thinkingLogsPanel.classList.add('flex');
        } else {
            this.elements.thinkingLogsPanel.classList.add('hidden');
            this.elements.thinkingLogsPanel.classList.remove('flex');
        }
    }

    showDeepResearchModal() {
        const modal = document.getElementById('deep-research-modal');
        modal.classList.remove('hidden');
        modal.classList.add('flex');
    }

    hideDeepResearchModal() {
        const modal = document.getElementById('deep-research-modal');
        modal.classList.add('hidden');
        modal.classList.remove('flex');
    }

    showDeepResearchDisableModal() {
        const modal = document.getElementById('deep-research-disable-modal');
        modal.classList.remove('hidden');
        modal.classList.add('flex');
    }

    hideDeepResearchDisableModal() {
        const modal = document.getElementById('deep-research-disable-modal');
        modal.classList.add('hidden');
        modal.classList.remove('flex');
    }

    showPolicyModal() {
        const modal = document.getElementById('policy-modal');
        modal.classList.remove('hidden');
        modal.classList.add('flex');
    }

    hidePolicyModal() {
        const modal = document.getElementById('policy-modal');
        modal.classList.add('hidden');
        modal.classList.remove('flex');
    }

    showImageUploadModal() {
        const modal = document.getElementById('image-upload-modal');
        modal.classList.remove('hidden');
        modal.classList.add('flex');
    }

    hideImageUploadModal() {
        const modal = document.getElementById('image-upload-modal');
        modal.classList.add('hidden');
        modal.classList.remove('flex');
    }

    confirmImageUpload() {
        // Switch to Llama 4 Scout (Vision)
        window.groqAPI.setModel('llama-4-scout');
        this.elements.modelSelector.value = 'llama-4-scout';
        console.log('Switched to Llama 4 Scout for image analysis');

        // Move temp image to pending
        this.pendingImage = this.tempImage;
        this.tempImage = null;

        // Update chat input
        this.elements.chatInput.value = `[📷 Image attached: ${this.pendingImage.name}]\n\nDescribe or ask about this image:`;
        this.elements.chatInput.focus();

        this.hideImageUploadModal();
    }

    cancelImageUpload() {
        this.tempImage = null;
        this.hideImageUploadModal();
    }
}

// Helper for example prompts
function setExamplePrompt(text) {
    document.getElementById('chat-input').value = text;
    document.getElementById('chat-input').focus();
}

// Initialize app when DOM ready
document.addEventListener('DOMContentLoaded', () => {
    window.neoChatApp = new NeoChatApp();
});
