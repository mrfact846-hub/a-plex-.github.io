// NeoChat AI - Chat UI Components

class ChatUI {
    constructor() {
        this.messagesContainer = document.getElementById('messages-container');
        this.welcomeScreen = document.getElementById('welcome-screen');
        this.currentTypingElement = null;

        // Artifacts Modal Elements
        this.artifactModal = document.getElementById('artifact-modal');
        this.artifactIframe = document.getElementById('artifact-iframe');
        this.closeArtifactBtn = document.getElementById('close-artifact-btn');

        this.initArtifacts();
    }

    initArtifacts() {
        if (this.closeArtifactBtn) {
            this.closeArtifactBtn.addEventListener('click', () => this.closeArtifact());
        }
        // Close on clicking outside
        if (this.artifactModal) {
            this.artifactModal.addEventListener('click', (e) => {
                if (e.target === this.artifactModal) this.closeArtifact();
            });
        }
        // Use Global Delegation for Preview Buttons (More Robust)
        this.messagesContainer.addEventListener('click', (e) => {
            const btn = e.target.closest('.artifact-preview-btn');
            if (btn) {
                const code = btn.dataset.code;
                if (code) {
                    this.openArtifact(decodeURIComponent(code));
                }
            }
        });
    }

    openArtifact(code) {
        if (!this.artifactModal || !this.artifactIframe) return;

        this.artifactModal.classList.remove('hidden');
        this.artifactModal.classList.add('flex');

        const doc = this.artifactIframe.contentWindow.document;
        doc.open();
        doc.write(code);
        doc.close();
    }

    closeArtifact() {
        if (this.artifactModal) {
            this.artifactModal.classList.add('hidden');
            this.artifactModal.classList.remove('flex');
            // Clear iframe
            this.artifactIframe.src = 'about:blank';
        }
    }

    hideWelcome() {
        if (this.welcomeScreen) this.welcomeScreen.style.display = 'none';
    }

    addUserMessage(content) {
        this.hideWelcome();
        const div = document.createElement('div');
        div.className = 'flex justify-end';
        div.innerHTML = `<div class="message-bubble message-user">${this.escapeHtml(content)}</div>`;
        this.messagesContainer.appendChild(div);
        this.scrollToBottom();
    }

    addAIMessage(content = '') {
        this.hideWelcome();
        const wrapper = document.createElement('div');
        wrapper.className = 'flex justify-start';

        const bubble = document.createElement('div');
        bubble.className = 'message-bubble message-ai';

        const contentDiv = document.createElement('div');
        contentDiv.className = 'message-content';

        bubble.appendChild(contentDiv);
        wrapper.appendChild(bubble);
        this.messagesContainer.appendChild(wrapper);

        this.currentTypingElement = contentDiv;
        this.scrollToBottom();
        return contentDiv;
    }

    addThinkingIndicator() {
        this.hideWelcome();
        const div = document.createElement('div');
        div.id = 'thinking-indicator';
        div.className = 'flex justify-start';
        div.innerHTML = `
            <div class="message-bubble message-ai thinking-indicator">
                <div class="thinking-dot"></div>
                <div class="thinking-dot"></div>
                <div class="thinking-dot"></div>
            </div>
        `;
        this.messagesContainer.appendChild(div);
        this.scrollToBottom();
    }

    removeThinkingIndicator() {
        const indicator = document.getElementById('thinking-indicator');
        if (indicator) indicator.remove();
    }

    updateAIMessage(element, content) {
        // Safeguard: Ensure content is always a string
        if (content && typeof content === 'object') {
            content = content.text || content.content || content.message || JSON.stringify(content);
        }
        if (typeof content !== 'string') {
            content = String(content || '');
        }

        // Check for thinking tags (DeepSeek/Qwen style)
        const hasThinkTag = content.includes('<think>');

        if (hasThinkTag) {
            let thought = '';
            let answer = '';

            if (content.indexOf('</think>') !== -1) {
                // Thinking complete
                const parts = content.split('</think>');
                thought = parts[0].replace('<think>', '');
                answer = parts[1];
            } else {
                // Still thinking
                thought = content.replace('<think>', '');
                answer = '';
            }

            let html = '';
            if (thought.trim()) {
                // Default to open if thinking or if answer is short/empty, otherwise user can toggle
                html += `
                    <details class="thinking-section mb-4" ${answer ? '' : 'open'}>
                        <summary class="cursor-pointer text-xs font-mono text-neo-cyan hover:text-neo-purple transition-colors mb-2 flex items-center gap-2 select-none">
                            <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"/>
                            </svg>
                            Thinking Process
                        </summary>
                        <div class="thinking-content text-sm text-gray-400 border-l-2 border-neo-purple/30 pl-3 py-2 font-mono bg-black/20 rounded-r">
                            ${this.renderMarkdown(thought)}
                        </div>
                    </details>
                `;
            }

            if (answer) {
                // Render answer with typewriter if new content
                html += `<div class="ai-answer">${this.renderMarkdown(answer)}</div>`;
            } else {
                // Show cursor if still thinking
                html += `<div class="ai-answer typing"></div>`;
            }

            element.innerHTML = html;
        } else {
            element.innerHTML = this.renderMarkdown(content);
        }

        Prism.highlightAllUnder(element);
        this.scrollToBottom();
    }

    appendSources(element, sourcesHTML) {
        element.insertAdjacentHTML('beforeend', sourcesHTML);
        this.scrollToBottom();
    }

    renderMarkdown(text) {
        // Safeguard: Ensure text is always a string
        if (text && typeof text === 'object') {
            text = text.text || text.content || text.message || JSON.stringify(text);
        }
        if (typeof text !== 'string') {
            text = String(text || '');
        }

        if (typeof marked !== 'undefined') {
            const renderer = new marked.Renderer();

            // Override code block rendering
            renderer.code = (code, language) => {
                const validLang = !!(language && Prism.languages[language]);
                const highlighted = validLang ? Prism.highlight(code, Prism.languages[language], language) : code;

                // If HTML/CSS, add Preview Button
                if (language === 'html' || language === 'css' || language === 'xml' || language === 'javascript') {
                    const encodedCode = encodeURIComponent(code);
                    return `
                        <div class="code-block-wrapper relative group my-4">
                            <div class="absolute top-2 right-2 flex gap-2 z-10">
                                <button class="artifact-preview-btn flex items-center gap-1 bg-neo-purple/20 hover:bg-neo-purple/40 text-neo-cyan text-xs px-2 py-1 rounded border border-neo-purple/30 transition-colors" data-code="${encodedCode}">
                                    <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"/></svg>
                                    Live Preview
                                </button>
                            </div>
                            <pre><code class="language-${language}">${highlighted}</code></pre>
                        </div>
                    `;
                }

                return `<pre><code class="language-${language}">${highlighted}</code></pre>`;
            };

            marked.setOptions({
                renderer: renderer,
                breaks: true,
                gfm: true
            });

            // Pre-process math
            const { text: protectedText, mathBlocks } = this.renderMath(text);

            // Render markdown
            const html = marked.parse(protectedText);

            // Post-process to restore math
            return this.restoreMath(html, mathBlocks);
        }
        return text.replace(/\n/g, '<br>');
    }

    renderMath(content) {
        if (typeof katex === 'undefined') return { text: content, mathBlocks: [] };

        // Protect math blocks from markdown processing
        const mathBlocks = [];
        const protectMath = (match) => {
            const id = `MATH_BLOCK_${mathBlocks.length}`;
            mathBlocks.push({ id, content: match });
            return id;
        };

        // Regex for block math $$...$$ and \[...\]
        let text = content.replace(/\$\$([\s\S]+?)\$\$/g, protectMath);
        text = text.replace(/\\\[([\s\S]+?)\\\]/g, protectMath);

        // Regex for inline math \(...\) - cautious to not match escaped logic
        text = text.replace(/\\\(([\s\S]+?)\\\)/g, protectMath);

        return { text, mathBlocks };
    }

    restoreMath(html, mathBlocks) {
        if (!mathBlocks || mathBlocks.length === 0) return html;

        mathBlocks.forEach(block => {
            let rendered = block.content;
            try {
                // Strip delimiters
                let displayMode = block.content.startsWith('$$') || block.content.startsWith('\\[');
                let math = block.content;

                if (math.startsWith('$$')) math = math.slice(2, -2);
                else if (math.startsWith('\\[')) math = math.slice(2, -2);
                else if (math.startsWith('\\(')) math = math.slice(2, -2);

                rendered = katex.renderToString(math, {
                    displayMode: displayMode,
                    throwOnError: false,
                    output: 'html'
                });
            } catch (e) {
                console.error('KaTeX rendering error:', e);
            }
            // Use replace with function to avoid special replacement patterns in the rendered string
            html = html.replace(block.id, () => rendered);
        });

        return html;
    }

    scrollToBottom() {
        this.messagesContainer.scrollTop = this.messagesContainer.scrollHeight;
    }

    escapeHtml(text) {
        if (typeof text === 'object') {
            try {
                text = JSON.stringify(text, null, 2);
            } catch (e) {
                text = '[Complex Object]';
            }
        }
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    clearMessages() {
        this.messagesContainer.innerHTML = '';
        if (this.welcomeScreen) {
            this.welcomeScreen.style.display = 'flex';
            this.messagesContainer.appendChild(this.welcomeScreen);
        }
    }
}

window.chatUI = new ChatUI();
