# HOW HIGH IS A BARRIER?

손가락 간격으로 턱 높이를 조절하는 웹캠 인터랙티브 작품.

## 실행

GitHub Pages에서 Enable camera를 누르고 카메라 접근을 허용합니다. 엄지와 검지를 벌리면 높아지고, 모으면 낮아집니다. 기본 높이는 0cm입니다. 5cm 초과 시 검정·라임 배색과 BARRIER 상태로 전환됩니다.

카메라 영상은 기기에서 처리합니다. MediaPipe 로딩에는 인터넷 연결이 필요합니다. 5cm는 이 작품의 실험적 기준이며 실제 휠체어 안전 기준이 아닙니다.

## 로컬 미리보기

```sh
python3 -m http.server 8765
```

http://localhost:8765 에 접속합니다.

## 수정

- index.html: 구성과 문구
- style.css: 색상과 레이아웃
- app.js: 카메라와 화면 그리기
- physics.js: 높이 매핑 및 바퀴 움직임
- hand-worker.js: MediaPipe 손 인식

GitHub Pages: Settings → Pages → Deploy from a branch → main → /(root).
