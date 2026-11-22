make.fun 바운티 best-stealth-game-20261121-1759에 출품할 스텔스 게임을 만들어줘. 상금 $50 상위 10명, 참가비 없음, 마감 오늘(11/22) 14:59 KST. 시간이 촉박하니 플레이 가능한 완성품 + 좋은 스크린샷을 최우선으로 해줘.

킷: ~/workspace/makefun/best-stealth-game-20261121-1759/best-stealth-game-20261121-1759-kit/ (kit.json, RULES.txt, starter/, cli/makefun.mjs). RULES.txt와 kit.json을 먼저 읽고, ~/workspace/custom-skills/makefun-playbook/SKILL.md와 ~/workspace/makefun/오답노트.md도 빌드 전에 읽어줘.

게임 컨셉(오리지널): 탑다운 스텔스 "Moss & Shadow" — 달빛 신사 정원을 누비는 여우 정령. 돌등롱 수호자들이 금빛 시야 콘을 들고 순찰하고, 대나무 숲에 숨고, 신성한 구슬 3개를 모아 도리이 문 출구에 도달한다. 3개 레벨, 난이도 상승. 조작: WASD/방향키 이동, Shift 살금살금, 클릭으로 조약돌 던져 주의 끌기. 경비 상태: 순찰 → 의심 → 추격. HUD, 시작/승리/패배 화면, WebAudio 효과음. 게임 내 모든 텍스트는 영어.

기술: 바닐라 JS + Canvas, 정적 파일만, 네트워크 요청 없음. main.ts(Node 22)를 루트에, vendor/makefun-game.ts는 킷에서 그대로 복사, game/에 index.html 포함 정적 파일, screenshots/에 실제 렌더 3~4장. GitHub 레포는 ryukiheun/best-stealth-game-20261121-1759로 만들고, MIT 라이선스(SPDX 표기), repo About 설정까지.

심사 방식: AI 심판이 스크린샷 쌍 + 소스 개요를 비교해서 뽑은 횟수로 순위 결정. 스크린샷 한 장만 봐도 시야 콘, 엄폐물, 출구, 플레이어가 바로 보이게 만들고, 화면을 깔끔하고 읽기 좋게 다듬어줘.

작업 규칙: 킷은 이걸로 새로 받은 거라 재사용 금지. 초안 나오면 bundle --dry-run, 다듬기 전에 kit check, 제출 전에는 presubmit 게이트(~/workspace/makefun/bin/presubmit.sh)와 egm-review를 돌리고 결과를 보고해줘. 제출은 ~/workspace/makefun/bin/submit-v2.mjs로 하고, register는 절대 다시 실행하지 마.