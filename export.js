// NeoChat AI - PDF Export

class ExportHandler {
    constructor() {
        this.exportBtn = document.getElementById('export-btn');
        this.exportBtn?.addEventListener('click', () => this.exportToPDF());
    }

    async exportToPDF() {
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF();

        const messages = document.querySelectorAll('.message-bubble');
        if (messages.length === 0) {
            alert('No messages to export');
            return;
        }

        // Title
        doc.setFontSize(24);
        doc.setTextColor(139, 92, 246);
        doc.text('NeoChat AI Research Report', 20, 20);

        // Date
        doc.setFontSize(10);
        doc.setTextColor(128);
        doc.text(`Generated: ${new Date().toLocaleString()}`, 20, 30);

        // Separator
        doc.setDrawColor(139, 92, 246);
        doc.line(20, 35, 190, 35);

        // Messages
        let y = 45;
        doc.setTextColor(30);

        messages.forEach(msg => {
            const isUser = msg.classList.contains('message-user');
            const text = msg.innerText;

            if (y > 270) {
                doc.addPage();
                y = 20;
            }

            doc.setFontSize(8);
            doc.setTextColor(128);
            doc.text(isUser ? 'USER:' : 'AI:', 20, y);
            y += 5;

            doc.setFontSize(10);
            doc.setTextColor(30);
            const lines = doc.splitTextToSize(text, 170);
            doc.text(lines, 20, y);
            y += lines.length * 5 + 10;
        });

        // Watermark
        doc.setFontSize(8);
        doc.setTextColor(200);
        doc.text('NeoChat AI - Powered by GPT-OSS-120B + Tavily', 105, 290, { align: 'center' });

        doc.save('neochat-research.pdf');
    }
}

window.exportHandler = new ExportHandler();
