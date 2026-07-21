const $ = (sel) => document.querySelector(sel);

const statusEl = $('#status');
const boardEl = $('#board');
const generateBtn = $('#generateBtn');
const exportBtn = $('#exportBtn');
const printBtn = $('#printBtn');

function showStatus(message, type = 'loading') {
  statusEl.className = `status ${type}`;
  statusEl.textContent = message;
  statusEl.classList.remove('hidden');
}
function hideStatus() { statusEl.classList.add('hidden'); }

// AI 보드 생성
async function generateBoard() {
  const excelData = $('#excelInput').value.trim();
  if (!excelData) {
    alert('엑셀 데이터를 붙여넣어 주세요.');
    return;
  }

  generateBtn.disabled = true;
  exportBtn.disabled = true;
  printBtn.disabled = true;
  showStatus('🤖 AI가 D-안전소통보드를 생성 중입니다... (약 10~20초 소요)', 'loading');

  try {
    const response = await fetch('/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ excelData })
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `서버 오류 (${response.status})`);
    }

    const data = await response.json();
    boardEl.innerHTML = data.html;
    showStatus('✅ 보드 생성 완료! 워드 다운로드 또는 인쇄가 가능합니다.', 'success');
    exportBtn.disabled = false;
    printBtn.disabled = false;
  } catch (err) {
    console.error(err);
    showStatus(`❌ 오류 발생: ${err.message}`, 'error');
  } finally {
    generateBtn.disabled = false;
  }
}

// 워드(.docx) 다운로드
function exportToWord() {
  const content = boardEl.innerHTML;
  const today = new Date().toISOString().slice(0, 10);

  const html = `
    <!DOCTYPE html>
    <html xmlns:o='urn:schemas-microsoft-com:office:office'
          xmlns:w='urn:schemas-microsoft-com:office:word'
          xmlns='http://www.w3.org/TR/REC-html40'>
    <head>
      <meta charset="utf-8">
      <title>D-안전소통보드</title>
      <!--[if gte mso 9]>
      <xml>
        <w:WordDocument>
          <w:View>Print</w:View>
          <w:Zoom>100</w:Zoom>
          <w:DoNotOptimizeForBrowser/>
        </w:WordDocument>
      </xml>
      <![endif]-->
      <style>
        @page { size: A4; margin: 1.5cm; }
        body { font-family: '맑은 고딕', 'Malgun Gothic', sans-serif; font-size: 11pt; }
        table { border-collapse: collapse; }
      </style>
    </head>
    <body>${content}</body>
    </html>`;

  const converted = htmlDocx.asBlob(html);
  saveAs(converted, `D-안전소통보드_${today}.docx`);
}

// 인쇄
function printBoard() {
  window.print();
}

// 이벤트 바인딩
generateBtn.addEventListener('click', generateBoard);
exportBtn.addEventListener('click', exportToWord);
printBtn.addEventListener('click', printBoard);
$('#clearBtn').addEventListener('click', () => {
  $('#excelInput').value = '';
  boardEl.innerHTML = '<p class="placeholder">엑셀 데이터를 붙여넣고 [AI로 보드 생성] 버튼을 눌러주세요.</p>';
  exportBtn.disabled = true;
  printBtn.disabled = true;
  hideStatus();
});
