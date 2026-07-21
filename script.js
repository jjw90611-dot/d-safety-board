/* ==========================================================================
   D-안전소통보드 자동 생성기 (Pure JavaScript, No API)
   엑셀 컬럼 순서 (0-based index):
   0: 일자     1: NO.    2: 고위험    3: 운전부서(부서)   4: 운전부서(공장)
   5: 작업지시부서   6: 작업장소   7: 작업명   8: 인원(명)   9: 작업시간
   10: 협력사(계약사)  11: 하도사(수행사)  12: 작업담당자  13: 협력/용역사담당자
   14: 잠재위험   15: 조치사항
   16: 안전Monitor - 가동설비(가동상태)
   17: 안전Monitor - 가동설비(실장결재 수리)
   18: 안전Monitor - 가동설비(현장소장결재 점검)
   19~23: 高위험 - 화재/폭발/질식/누출/기타
   24: 高위험 - 실장 결재여부
   25: 부식개소 출입
   26: 부식개소 - 부장 결재여부
   27: 안전Monitor요원 소속
   28: 안전Monitor요원 이름
   29: CCTV 유무
   ========================================================================== */

const $ = (sel) => document.querySelector(sel);
const CIRCLED = ['①','②','③','④','⑤','⑥','⑦','⑧','⑨','⑩','⑪','⑫','⑬','⑭','⑮'];

/* 자주 틀리는 안전용어 오탈자 사전 (필요 시 계속 추가) */
const TYPO_DICT = {
  '근골격제': '근골격계',
  '넘아짐': '넘어짐',
  '넘어짐위험': '넘어짐 위험',
  '떨어짐위험': '떨어짐 위험',
  '맞음위험': '맞음 위험',
  '끼임위험': '끼임 위험',
  '부딪힘위험': '부딪힘 위험',
  '신호체게': '신호체계',
  '슬링밸트': '슬링벨트',
  '이온음료': '이온음료',
};

/* 오탈자 자동 교정 */
function fixTypos(text) {
  if (!text) return '';
  let result = text;
  for (const [wrong, correct] of Object.entries(TYPO_DICT)) {
    result = result.split(wrong).join(correct);
  }
  return result;
}

/* HTML 이스케이프 */
function escapeHtml(str) {
  if (str == null) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/* 일자 문자열에서 월(1~12) 추출: "7/22", "2024-07-22", "2024.07.22" 대응 */
function extractMonth(dateStr) {
  if (!dateStr) return null;
  const s = String(dateStr).trim();
  // "7/22" or "07/22"
  let m = s.match(/^(\d{1,2})\s*\/\s*\d{1,2}/);
  if (m) return parseInt(m[1], 10);
  // "2024-07-22" or "2024.07.22" or "2024/07/22"
  m = s.match(/\d{4}[-./]\s*(\d{1,2})[-./]/);
  if (m) return parseInt(m[1], 10);
  // "7월 22일"
  m = s.match(/(\d{1,2})\s*월/);
  if (m) return parseInt(m[1], 10);
  return null;
}

/* 계절 특별위험 행 생성 */
function getSeasonalRiskRow(month) {
  if (month == null) return '';
  if ([12, 1, 2].includes(month)) {
    return `    <tr>
      <td style="padding: 8px;"><b>🚨 [계절 특별위험]</b></td>
      <td style="padding: 8px;">동절기 한파로 인한 <b>한랭질환</b> 및 결빙구간 <b>넘어짐</b> 위험</td>
      <td style="padding: 8px;">방한장구 착용, 작업 전 스트레칭 실시, 결빙구간 라바콘 설치/모래/염화칼슘 살포</td>
    </tr>\n`;
  }
  if ([6, 7, 8].includes(month)) {
    return `    <tr>
      <td style="padding: 8px;"><b>🚨 [계절 특별위험]</b></td>
      <td style="padding: 8px;">하절기 폭염으로 인한 <b>온열질환</b> 위험</td>
      <td style="padding: 8px;">충분한 수분 섭취, 휴식시간 준수, 그늘막 제공, 아이스박스(얼음/생수/이온음료) 비치</td>
    </tr>\n`;
  }
  return '';
}

/* 작업명 파싱: "1. xxx\n2. yyy\n3. zzz" → ["xxx", "yyy", "zzz"] */
function parseNumberedList(text) {
  if (!text) return [];
  const lines = String(text).split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  const items = [];
  for (const line of lines) {
    // "1. xxx" / "1) xxx" / "①xxx" 등 시작 번호 제거
    const cleaned = line.replace(/^\s*(\d+[\.\)]|[①-⑮])\s*/, '').trim();
    if (cleaned) items.push(cleaned);
  }
  return items;
}

/* 잠재위험/조치사항 파싱: "1. xxx\n1-1. yyy\n2. zzz" 등 → 순서를 유지한 배열
   각 항목의 '메인 번호'(1, 2, 3...)로 그룹핑하여 { mainNo: 1, texts: [...] } */
function parseRiskList(text) {
  if (!text) return [];
  const lines = String(text).split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  const groups = {}; // { 1: [...], 2: [...], ... }
  const extras = []; // 번호 없는 라인(예: "* 혹서기 ...")

  for (const line of lines) {
    // "1. xxx", "1-1. xxx", "1-1) xxx" 형태
    const m = line.match(/^\s*(\d+)(?:-\d+)?\s*[\.\)]\s*(.*)$/);
    if (m) {
      const mainNo = parseInt(m[1], 10);
      const content = m[2].trim();
      if (!groups[mainNo]) groups[mainNo] = [];
      groups[mainNo].push(content);
    } else {
      // 번호가 없거나 "* ..." 로 시작하는 부가 설명
      extras.push(line.replace(/^\*\s*/, '').trim());
    }
  }

  const sortedKeys = Object.keys(groups).map(Number).sort((a, b) => a - b);
  const result = sortedKeys.map(k => ({
    mainNo: k,
    text: groups[k].join('<br>')
  }));

  return { grouped: result, extras };
}

/* 서명란 행 생성 */
function generateSignRows(count) {
  const n = Math.max(1, Math.min(30, count || 8)); // 안전 범위 1~30
  let rows = '';
  for (let i = 1; i <= n; i++) {
    rows += `    <tr style="height: 65px;"><td align="center" style="vertical-align: middle;">${i}</td><td style="vertical-align: middle;">&nbsp;</td><td style="vertical-align: middle;">&nbsp;</td><td align="center" style="vertical-align: middle;">(서명)</td><td style="vertical-align: middle;">&nbsp;</td></tr>\n`;
  }
  return rows;
}

/* CCTV 변환 */
function convertCctv(val) {
  if (!val) return '미가동(X)';
  const v = String(val).trim().toUpperCase();
  if (v === 'O' || v === '0' || v === '가동' || v === '가동중') return '가동 중(O)';
  return '미가동(X)';
}

/* 엑셀 붙여넣기 데이터 파싱 (탭 구분, 셀 내 줄바꿈은 큰따옴표로 감쌈) */
function parseTsvRow(text) {
  // Excel에서 복사 시 셀 내 개행이 있는 셀은 "..." 로 감싸짐
  const cells = [];
  let current = '';
  let inQuote = false;
  let i = 0;
  while (i < text.length) {
    const ch = text[i];
    if (inQuote) {
      if (ch === '"') {
        if (text[i + 1] === '"') { current += '"'; i += 2; continue; } // 이스케이프된 ""
        inQuote = false; i++; continue;
      }
      current += ch; i++;
    } else {
      if (ch === '"') { inQuote = true; i++; continue; }
      if (ch === '\t') { cells.push(current); current = ''; i++; continue; }
      if (ch === '\r') { i++; continue; }
      if (ch === '\n') { cells.push(current); current = ''; i++; continue; } // 행 종료로도 볼 수 있으나 단일 행 가정
      current += ch; i++;
    }
  }
  cells.push(current);
  return cells;
}

/* 메인 변환 함수 */
function generateBoardHtml(rawInput) {
  const cells = parseTsvRow(rawInput.trim());

  // 컬럼 매핑 (예제 데이터 기준 0-based)
  const 일자 = (cells[0] || '').trim();
  const 공장 = (cells[4] || '').trim();
  const 작업장소 = (cells[6] || '').trim();
  const 작업명Raw = (cells[7] || '').trim();
  const 인원 = parseInt((cells[8] || '').replace(/[^\d]/g, ''), 10) || 8;
  const 작업시간 = (cells[9] || '').trim();
  const 협력사 = (cells[10] || '').trim();
  const 하도사 = (cells[11] || '').trim();
  const 작업담당자 = (cells[12] || '').trim();
  const 용역사담당자 = (cells[13] || '').trim();
  const 잠재위험Raw = (cells[14] || '').trim();
  const 조치사항Raw = (cells[15] || '').trim();
  const 안전모니터소속 = (cells[27] || '').trim();
  const 안전모니터이름 = (cells[28] || '').trim();
  const cctv = (cells[29] || '').trim();

  // 조합
  const 작업장소합침 = [공장, 작업장소].filter(Boolean).join(' / ');
  const 용역사표시 = 하도사 && 하도사 !== '없음' ? `${협력사} / ${하도사}` : 협력사;
  const 안전모니터표시 = 안전모니터소속 && 안전모니터이름 
    ? `${안전모니터소속} ${안전모니터이름}` 
    : (안전모니터이름 || '-');
  const cctv표시 = convertCctv(cctv);
  const month = extractMonth(일자);

  // 작업명/위험/조치 파싱
  const 작업목록 = parseNumberedList(작업명Raw);
  const 위험파싱 = parseRiskList(잠재위험Raw);
  const 조치파싱 = parseRiskList(조치사항Raw);

  // 작업내용 - 위험 - 조치를 메인번호 기준으로 매칭
  const maxCount = Math.max(작업목록.length, 위험파싱.grouped.length, 조치파싱.grouped.length);
  let 위험조치Rows = '';
  for (let i = 0; i < maxCount; i++) {
    const 작업내용 = 작업목록[i] ? fixTypos(작업목록[i]) : '&nbsp;';
    const 위험 = 위험파싱.grouped[i] ? fixTypos(위험파싱.grouped[i].text) : '&nbsp;';
    const 조치 = 조치파싱.grouped[i] ? fixTypos(조치파싱.grouped[i].text) : '&nbsp;';
    const num = CIRCLED[i] || `(${i + 1})`;
    위험조치Rows += `    <tr>
      <td style="padding: 8px;"><b>${num} ${escapeHtml(작업내용)}</b></td>
      <td style="padding: 8px;">${위험}</td>
      <td style="padding: 8px;">${조치}</td>
    </tr>\n`;
  }

  // 부가 설명(* 혹서기 등) → 별도 행으로 추가하거나 계절 위험으로 대체
  // 여기서는 계절 자동 판단이 우선이므로 extras는 무시하되, 계절 위험 행 추가
  위험조치Rows += getSeasonalRiskRow(month);

  // 서명란
  const 서명Rows = generateSignRows(인원);

  // 최종 HTML
  return `
<h2 style="text-align: center; border: 2px solid #333; background-color: #f4f4f4; padding: 15px; margin-bottom: 20px; font-family: '맑은 고딕', 'Malgun Gothic', sans-serif;">📋 [ D-안전소통보드 및 종사자 의견 청취서 ]</h2>

<div style="font-family: '맑은 고딕', 'Malgun Gothic', sans-serif; font-weight: bold; font-size: 1.1em; margin-bottom: 10px;">1. 작업 기본 정보</div>

<table style="width: 100%; border-collapse: collapse; font-family: '맑은 고딕', 'Malgun Gothic', sans-serif;" border="1">
  <thead>
    <tr style="background-color: #f9f9f9;">
      <th style="padding: 8px; text-align: center; white-space: nowrap;">일자</th>
      <th style="padding: 8px; text-align: center; white-space: nowrap;">작업시간</th>
      <th style="padding: 8px; text-align: center;">작업장소</th>
      <th style="padding: 8px; text-align: center;">작업명</th>
      <th style="padding: 8px; text-align: center; white-space: nowrap;">작업인원</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td style="padding: 8px; text-align: center; white-space: nowrap;">${escapeHtml(일자)}</td>
      <td style="padding: 8px; text-align: center; white-space: nowrap;">${escapeHtml(작업시간)}</td>
      <td style="padding: 8px; text-align: center;">${escapeHtml(작업장소합침)}</td>
      <td style="padding: 8px; text-align: center;">${escapeHtml(작업목록.join(' / ') || 작업명Raw)}</td>
      <td style="padding: 8px; text-align: center; white-space: nowrap;">${인원}명</td>
    </tr>
  </tbody>
</table>

<table style="width: 100%; border-collapse: collapse; margin-top: 10px; font-family: '맑은 고딕', 'Malgun Gothic', sans-serif;" border="1">
  <thead>
    <tr style="background-color: #f9f9f9;">
      <th style="padding: 8px; text-align: center; white-space: nowrap;">작업담당자</th>
      <th style="padding: 8px; text-align: center; white-space: nowrap;">용역사(수행사)</th>
      <th style="padding: 8px; text-align: center; white-space: nowrap;">용역사 담당자</th>
      <th style="padding: 8px; text-align: center; white-space: nowrap;">안전Monitor요원</th>
      <th style="padding: 8px; text-align: center; white-space: nowrap;">CCTV 가동</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td style="padding: 8px; text-align: center; white-space: nowrap;">${escapeHtml(작업담당자)}</td>
      <td style="padding: 8px; text-align: center; white-space: nowrap;">${escapeHtml(용역사표시)}</td>
      <td style="padding: 8px; text-align: center; white-space: nowrap;">${escapeHtml(용역사담당자)}</td>
      <td style="padding: 8px; text-align: center; white-space: nowrap;">${escapeHtml(안전모니터표시)}</td>
      <td style="padding: 8px; text-align: center; white-space: nowrap;">${cctv표시}</td>
    </tr>
  </tbody>
</table>

<br>

<div style="font-family: '맑은 고딕', 'Malgun Gothic', sans-serif; font-weight: bold; font-size: 1.1em; margin-bottom: 5px;">2. 주요 작업순서별 잠재위험 및 안전 조치사항 (TBM 리딩용)</div>
<div style="font-family: '맑은 고딕', 'Malgun Gothic', sans-serif; font-style: italic; margin-bottom: 10px;">※ 관리감독자는 아래 사항을 작업자들에게 전파하고 지적확인을 실시해 주십시오.</div>

<table style="width: 100%; border-collapse: collapse; font-family: '맑은 고딕', 'Malgun Gothic', sans-serif;" border="1">
  <thead>
    <tr style="background-color: #f9f9f9;">
      <th width="25%" style="padding: 8px; text-align: center;">작업 내용</th>
      <th width="35%" style="padding: 8px; text-align: center;">⚠️ 잠재위험</th>
      <th width="40%" style="padding: 8px; text-align: center;">🛡️ 안전 조치사항</th>
    </tr>
  </thead>
  <tbody>
${위험조치Rows}  </tbody>
</table>

<br>

<div style="font-family: '맑은 고딕', 'Malgun Gothic', sans-serif; font-weight: bold; font-size: 1.1em; margin-bottom: 5px;">3. 🗣️ 참석자 서명 및 종사자 의견 청취 (작업자 작성란)</div>
<div style="font-family: '맑은 고딕', 'Malgun Gothic', sans-serif; font-style: italic; margin-bottom: 10px;">※ D-안전소통보드 확인 서명과 작업 중 예상되는 위험요인, 개선 건의사항 및 안전다짐을 자유롭게 적어주세요.<br>※ 즉시 개선하고 위험성평가에 반영하겠습니다.</div>

<table style="width: 100%; border-collapse: collapse; font-family: '맑은 고딕', 'Malgun Gothic', sans-serif;" border="1">
  <thead>
    <tr style="height: 50px; background-color: #f9f9f9;">
      <th width="5%" align="center" style="vertical-align: middle; white-space: nowrap;">No.</th>
      <th width="15%" align="center" style="vertical-align: middle; white-space: nowrap;">&nbsp;&nbsp;&nbsp;소&nbsp;속&nbsp;&nbsp;&nbsp;</th>
      <th width="15%" align="center" style="vertical-align: middle; white-space: nowrap;">&nbsp;&nbsp;&nbsp;성&nbsp;명&nbsp;&nbsp;&nbsp;</th>
      <th width="15%" align="center" style="vertical-align: middle; white-space: nowrap;">&nbsp;&nbsp;&nbsp;서&nbsp;명&nbsp;&nbsp;&nbsp;</th>
      <th width="50%" align="center" style="vertical-align: middle;">종사자 의견<br>(위험요인, 개선 건의사항 및 안전다짐)</th>
    </tr>
  </thead>
  <tbody>
${서명Rows}  </tbody>
</table>

<br>

<div style="font-family: '맑은 고딕', 'Malgun Gothic', sans-serif; font-weight: bold; font-size: 1.1em; margin-bottom: 10px;">4. 현장 조치 결과 및 확인 (현장소장 작성란)</div>

<table style="width: 100%; border-collapse: collapse; font-family: '맑은 고딕', 'Malgun Gothic', sans-serif;" border="1">
  <tbody>
    <tr style="background-color: #f9f9f9;">
      <th style="padding: 10px; text-align: center;">종사자 의견에 대한 현장 조치 결과 (즉시 개선사항 기재)</th>
      <th width="20%" style="padding: 10px; text-align: center;">용역사 현장소장 확인</th>
    </tr>
    <tr>
      <td style="height: 100px; padding: 10px;">&nbsp;</td>
      <td style="text-align: center; vertical-align: middle;">(서명)</td>
    </tr>
    <tr style="background-color: #f9f9f9;">
      <th style="padding: 10px; text-align: center;">종사자 의견에 대한 현장 조치 결과 (즉시 개선사항 기재)</th>
      <th width="20%" style="padding: 10px; text-align: center;">현장소장 확인</th>
    </tr>
    <tr>
      <td style="height: 100px; padding: 10px;">&nbsp;</td>
      <td style="text-align: center; vertical-align: middle;">(서명)</td>
    </tr>
  </tbody>
</table>
`;
}

/* ============== 이벤트 핸들러 ============== */
const statusEl = $('#status');
const boardEl = $('#board');

function showStatus(msg, type = 'success') {
  statusEl.className = `status ${type}`;
  statusEl.textContent = msg;
  statusEl.classList.remove('hidden');
}
function hideStatus() { statusEl.classList.add('hidden'); }

$('#generateBtn').addEventListener('click', () => {
  const raw = $('#excelInput').value;
  if (!raw.trim()) {
    alert('엑셀 데이터를 붙여넣어 주세요.');
    return;
  }
  try {
    const html = generateBoardHtml(raw);
    boardEl.innerHTML = html;
    showStatus('✅ 보드 생성 완료! 워드 다운로드 또는 인쇄가 가능합니다.', 'success');
    $('#exportBtn').disabled = false;
    $('#printBtn').disabled = false;
  } catch (err) {
    console.error(err);
    showStatus(`❌ 오류: ${err.message}`,
