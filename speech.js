// NeoChat AI - Speech Recognition using Groq Whisper API

class SpeechHandler {
    constructor() {
        this.apiKey = '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';
        this.isRecording = false;
        this.mediaRecorder = null;
        this.audioChunks = [];

        this.voiceBtn = document.getElementById('voice-btn');
        this.voiceOverlay = document.getElementById('voice-overlay');
        this.stopVoiceBtn = document.getElementById('stop-voice-btn');

        this.init();
    }

    init() {
        this.voiceBtn?.addEventListener('click', () => this.toggleRecording());
        this.stopVoiceBtn?.addEventListener('click', () => this.stopRecording());
    }

    async toggleRecording() {
        if (this.isRecording) {
            this.stopRecording();
        } else {
            this.startRecording();
        }
    }

    async startRecording() {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

            this.mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
            this.audioChunks = [];

            this.mediaRecorder.ondataavailable = (e) => {
                if (e.data.size > 0) {
                    this.audioChunks.push(e.data);
                }
            };

            this.mediaRecorder.onstop = () => {
                stream.getTracks().forEach(track => track.stop());
                this.transcribeAudio();
            };

            this.mediaRecorder.start();
            this.isRecording = true;
            this.showOverlay();

        } catch (error) {
            console.error('Microphone error:', error);
            alert('Could not access microphone. Please allow microphone access.');
        }
    }

    stopRecording() {
        if (this.mediaRecorder && this.isRecording) {
            this.mediaRecorder.stop();
            this.isRecording = false;
        }
        this.hideOverlay();
    }

    async transcribeAudio() {
        if (this.audioChunks.length === 0) return;

        // Show processing state
        const chatInput = document.getElementById('chat-input');
        chatInput.value = 'Transcribing...';
        chatInput.disabled = true;

        try {
            // Create audio blob
            const audioBlob = new Blob(this.audioChunks, { type: 'audio/webm' });

            // Create form data for Groq API
            const formData = new FormData();
            formData.append('file', audioBlob, 'recording.webm');
            formData.append('model', 'whisper-large-v3'); // Switched to V3 for better multilingual accuracy
            formData.append('prompt', 'Conversation in Bengali (বাংলা) or English. Precise transcription.'); // Guide the model
            formData.append('temperature', '0');
            formData.append('response_format', 'json');

            // Send to Groq Whisper API
            const response = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.apiKey}`
                },
                body: formData
            });

            if (!response.ok) {
                const error = await response.text();
                throw new Error(`Transcription failed: ${error}`);
            }

            const result = await response.json();
            chatInput.value = result.text || '';
            chatInput.focus();

        } catch (error) {
            console.error('Transcription error:', error);
            chatInput.value = '';
            alert('Transcription failed. Please try again.');
        } finally {
            chatInput.disabled = false;
            this.audioChunks = [];
        }
    }

    showOverlay() {
        this.voiceOverlay.classList.remove('hidden');
        this.voiceOverlay.classList.add('flex');
        this.voiceBtn.classList.add('voice-recording');
    }

    hideOverlay() {
        this.voiceOverlay.classList.add('hidden');
        this.voiceOverlay.classList.remove('flex');
        this.voiceBtn.classList.remove('voice-recording');
    }
}

window.speechHandler = new SpeechHandler();
