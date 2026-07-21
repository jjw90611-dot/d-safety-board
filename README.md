# D-안전소통보드 자동 생성기

포스코퓨처엠 현장 관리자용 · D-1 안전회의 결과를 D-안전소통보드로 자동 변환

## 🛠️ 기술 스택
- Frontend: HTML + CSS + Vanilla JavaScript
- Backend: Cloudflare Pages Functions (서버리스)
- AI: Google Gemini 2.0 Flash (무료 티어)
- 배포: Cloudflare Pages + GitHub

## 🚀 배포 방법

### 1. Gemini API Key 발급 (무료)
- https://aistudio.google.com/apikey 접속 → "Create API key"
- 발급받은 키를 복사

### 2. GitHub 저장소 생성
```bash
git init
git add .
git commit -m "initial commit"
git remote add origin https://github.com/USER/d-safety-board.git
git push -u origin main
