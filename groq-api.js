// NeoChat AI - Groq API Integration with Model Selector

class GroqAPI {
    constructor() {
        this.apiKey = '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';
        this.baseUrl = 'https://api.groq.com/openai/v1';
        this.systemPrompt = `You are NeoChat AI, created by the NeoChat Team. You are NOT a model from Meta, OpenAI, or Google. If asked who made you, always answer "NeoChat Team". Be helpful, accurate, and use markdown.`;

        // Condensed Usage Policy for System Prompt
        const safetyPolicy = `\n\nUSAGE POLICY: You strictly adhere to safety guidelines. Refuse to generate content involving: threats, intimidation, self-harm, sexual violence, illegal acts, weapons development, privacy violations, facial recognition, CSAM, grooming, fraud, or high-stakes automated decisions (medical/legal) without review. If a user request violates these, politely refuse.`;

        // Available models with their configs
        this.models = {
            'gpt-oss-safeguard-20b': {
                id: 'openai/gpt-oss-safeguard-20b',
                name: 'GPT-OSS 20B',
                description: 'Safe (Strict 8k TPM)',
                temperature: 1,
                max_tokens: 1600, // Safe limit for completeness
                top_p: 1,
                reasoning_effort: 'medium',
                vision: false
            },
            'kimi-k2': {
                id: 'moonshotai/kimi-k2-instruct-0905',
                name: 'Kimi K2',
                description: 'Advanced Reasoning',
                temperature: 0.6,
                max_tokens: 2048,
                top_p: 1,
                reasoning_effort: null,
                vision: false
            },
            'llama-4-scout': {
                id: 'meta-llama/llama-4-scout-17b-16e-instruct',
                name: 'Llama 4 Scout',
                description: 'Vision & Images',
                temperature: 1,
                max_tokens: 1024,
                top_p: 1,
                reasoning_effort: null,
                vision: true
            },
            'qwen3-32b': {
                id: 'qwen/qwen3-32b',
                name: 'Qwen3 32B',
                description: 'Deep Thinking (Concise)',
                temperature: 0.6,
                max_tokens: 2048,
                top_p: 0.95,
                reasoning_effort: 'default',
                vision: false
            },
            'llama-3.3-70b-versatile': {
                id: 'llama-3.3-70b-versatile',
                name: 'Llama 3.3 70B',
                description: 'Deep Research Specialist',
                temperature: 1,
                max_tokens: 3000,
                top_p: 1,
                reasoning_effort: null,
                vision: false
            },

        };

        // AI Personas with custom system prompts
        this.personas = {
            'default': {
                id: 'default',
                name: 'Default',
                emoji: '🧠',
                description: 'General helpful assistant',
                systemPrompt: `You are NeoChat AI, created by the NeoChat Team. If asked about your origin, state you are from NeoChat. Be helpful, accurate, and use markdown. For research mode, cite sources as [1], [2].` + safetyPolicy
            },
            'coder': {
                id: 'coder',
                name: 'Coder',
                emoji: '👨‍💻',
                description: 'Code-focused solutions',
                systemPrompt: `You are NeoChat AI (Coder Mode), created by the NeoChat Team. You are an expert software engineer. Provide clean, well-commented code with explanations. Use markdown code blocks. Prefer practical solutions over theoretical discussions. Always include usage examples.` + safetyPolicy
            },
            'creative-writer': {
                id: 'creative-writer',
                name: 'Creative Writer',
                emoji: '✍️',
                description: 'Stories & poems',
                systemPrompt: `You are NeoChat AI (Creative Mode), created by the NeoChat Team. You are a talented creative writer. Write engaging stories, poems, and creative content. Use vivid descriptions, emotional depth, and literary techniques. Adapt your style to the user's request.` + safetyPolicy
            },
            'health-advisor': {
                id: 'health-advisor',
                name: 'Health Advisor',
                emoji: '💊',
                description: 'Wellness tips',
                systemPrompt: `You are NeoChat AI (Health Mode), created by the NeoChat Team. You are a knowledgeable health advisor. Provide general wellness tips and information. IMPORTANT: Always include a disclaimer that users should consult healthcare professionals for medical advice. Never diagnose or prescribe treatments.` + safetyPolicy
            }
        };

        this.currentModel = 'gpt-oss-safeguard-20b';
        this.currentPersona = 'default';
    }

    // Persona Methods
    setPersona(personaKey) {
        if (this.personas[personaKey]) {
            this.currentPersona = personaKey;
            return true;
        }
        return false;
    }

    getPersonaConfig() {
        return this.personas[this.currentPersona];
    }

    getAvailablePersonas() {
        return Object.entries(this.personas).map(([key, config]) => ({
            key,
            ...config
        }));
    }

    // Model Methods

    setModel(modelKey) {
        if (this.models[modelKey]) {
            this.currentModel = modelKey;
            return true;
        }
        return false;
    }

    getModelConfig() {
        return this.models[this.currentModel];
    }

    getAvailableModels() {
        return Object.entries(this.models).map(([key, config]) => ({
            key,
            ...config
        }));
    }

    // Helper to estimate and truncate messages to fit TPM limits
    prepareMessages(messages, modelId) {
        // Define safe input char limits
        // Kimi K2: 10k TPM - 2048 Output = ~8000 Input Tokens
        // Safe Input Budget: ~6000 Tokens (~20-25k chars total)

        let charLimit = 15000; // Default safe limit for others

        if (modelId === 'qwen/qwen3-32b') {
            charLimit = 4000;
        } else if (modelId === 'meta-llama/llama-4-scout-17b-16e-instruct') {
            charLimit = 6000;
        } else if (modelId === 'openai/gpt-oss-safeguard-20b') {
            charLimit = 3500; // Extremely strict to prevent 429
        } else if (modelId === 'moonshotai/kimi-k2-instruct-0905') {
            charLimit = 20000; // Much higher limit for Kimi
        } else if (modelId === 'llama-3.3-70b-versatile') {
            charLimit = 4000;
        }

        let currentChars = 0;
        const truncated = [];

        // Always keep system prompt (it's added later)
        const reversed = [...messages].reverse();

        for (const msg of reversed) {
            // Count text content length
            let contentLen = 0;
            if (typeof msg.content === 'string') {
                contentLen = msg.content.length;
            } else if (Array.isArray(msg.content)) {
                // Handle multimodal content count
                msg.content.forEach(part => {
                    if (part.type === 'text') contentLen += part.text.length;
                    if (part.type === 'image_url') contentLen += 1000; // Rough estimate
                });
            }

            if (currentChars + contentLen > charLimit) {
                if (truncated.length > 0) break;
            }

            truncated.unshift(msg);
            currentChars += contentLen;
        }

        return truncated;
    }

    // Helper to truncate search context
    truncateContext(context, modelId) {
        if (!context) return null;

        let charLimit = 20000;

        // Split Qwen's budget: 4000 messages + 4000 context = 8000 chars total
        if (modelId === 'qwen/qwen3-32b') {
            charLimit = 4000;
        } else if (modelId === 'openai/gpt-oss-safeguard-20b') {
            charLimit = 3000; // Minimal context
        } else if (modelId === 'moonshotai/kimi-k2-instruct-0905') {
            charLimit = 25000; // Extended context for Kimi
        } else if (modelId === 'meta-llama/llama-4-scout-17b-16e-instruct') {
            charLimit = 30000; // High context for Llama 4
        } else if (modelId === 'llama-3.3-70b-versatile') {
            charLimit = 8000;
        }

        if (context.length <= charLimit) return context;

        console.warn(`Truncating context from ${context.length} to ${charLimit} chars for ${modelId}`);
        return context.substring(0, charLimit) + "\n...[Truncated]";
    }

    async chat(messages, onChunk, context = null) {
        const config = this.getModelConfig();
        let activeModelId = config.id;
        let activeConfig = config;

        if (context) {
            console.log('Deep Research active: Switching to Llama 4 Scout');
            activeModelId = 'meta-llama/llama-4-scout-17b-16e-instruct';
            activeConfig = this.models['llama-4-scout'];
        }

        let currentSystemPrompt = this.getPersonaConfig().systemPrompt;
        if (activeModelId === 'qwen/qwen3-32b') {
            currentSystemPrompt += " IMPORTANT: Be concise. Keep your thinking process brief and your answer direct to allow full completion within token limits.";
        }

        // Truncate context if strictly needed
        const safeContext = this.truncateContext(context, activeModelId);

        const systemMessage = {
            role: 'system',
            content: safeContext
                ? `${currentSystemPrompt}\n\nSources:\n${safeContext}\nCite with [1], [2] etc.`
                : currentSystemPrompt
        };

        // Use prepared messages
        const safeMessages = this.prepareMessages(messages, activeModelId);
        const allMessages = [systemMessage, ...safeMessages];

        // Build request body based on model config
        const requestBody = {
            model: activeModelId,
            messages: allMessages,
            stream: true,
            temperature: activeConfig.temperature,
            max_completion_tokens: activeConfig.max_tokens,
            top_p: activeConfig.top_p
        };

        // Only add reasoning_effort if supported
        if (activeConfig.reasoning_effort) {
            requestBody.reasoning_effort = activeConfig.reasoning_effort;
        }

        try {
            const response = await fetch(`${this.baseUrl}/chat/completions`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.apiKey}`
                },
                body: JSON.stringify(requestBody)
            });

            if (!response.ok) {
                const error = await response.text();
                throw new Error(`API Error: ${response.status} - ${error}`);
            }

            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let fullResponse = '';

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                const chunk = decoder.decode(value);
                const lines = chunk.split('\n');

                for (const line of lines) {
                    if (line.startsWith('data: ')) {
                        const data = line.slice(6);
                        if (data === '[DONE]') continue;

                        try {
                            const parsed = JSON.parse(data);
                            let content = parsed.choices?.[0]?.delta?.content;

                            // Handle cases where content is an object (some models return { text: '...' })
                            if (content && typeof content === 'object') {
                                content = content.text || content.content || JSON.stringify(content);
                            }

                            if (content) {
                                fullResponse += content;
                                onChunk(content, fullResponse);
                            }
                        } catch (e) { }
                    }
                }
            }

            return fullResponse;

        } catch (error) {
            console.error('Groq API Error:', error);
            throw error;
        }
    }

    calculateConfidence(response, hasContext) {
        let score = 70;
        if (hasContext) score += 15;

        const hedges = ['might', 'maybe', 'perhaps', 'possibly', 'could be', 'not sure'];
        hedges.forEach(h => { if (response.toLowerCase().includes(h)) score -= 3; });

        score += Math.min((response.match(/\[\d+\]/g) || []).length * 2, 10);
        if (response.includes('```')) score += 3;
        if (response.includes('##')) score += 2;

        return Math.max(0, Math.min(100, Math.round(score)));
    }
}

window.groqAPI = new GroqAPI();
