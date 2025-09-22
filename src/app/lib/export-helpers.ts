"use client"

export const openPrintView = (elementId: string) => {
  const printElement = document.getElementById(elementId);
  if (printElement) {
    const tableHtml = printElement.outerHTML;
    
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(`
        <html>
          <head>
            <title>Stundenplan Druckansicht</title>
            <style>
              body { font-family: Arial, sans-serif; margin: 20px; }
              table { width: 100%; border-collapse: collapse; }
              th, td { border: 1px solid #ccc; padding: 12px; text-align: center; }
              th { background-color: #f2f2f2; }
              .footer { position: fixed; bottom: 10px; right: 10px; font-size: 10px; color: #aaa; }
              .teacher { font-size: 0.8em; margin-top: 4px; color: rgba(255,255,255,0.8); }
            </style>
          </head>
          <body>
            <h2>Wochenübersicht</h2>
            ${tableHtml}
            <div class="footer">Scoodol by @wolfikuproduction</div>
            <script>
              window.onload = function() {
                window.print();
                window.onafterprint = function() {
                  window.close();
                }
              }
            </script>
          </body>
        </html>
      `);
      printWindow.document.close();
    }
  }
};

export const downloadAsPng = async (elementId: string) => {
  const html2canvas = (await import('html2canvas')).default;
  const table = document.getElementById(elementId);
  if (table) {
    html2canvas(table, {
      scale: 2,
      useCORS: true,
      backgroundColor: '#ffffff',
    }).then((canvas: HTMLCanvasElement) => {
      const link = document.createElement('a');
      link.download = 'stundenplan.png';
      link.href = canvas.toDataURL('image/png');
      link.click();
    });
  }
};
