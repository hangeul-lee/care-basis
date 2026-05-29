# 케어베이시스

영유아 루틴 기록과 공공기관·전문기관 기반 육아 정보 검색을 함께 제공하는 모바일 우선 웹앱입니다.

## 실행

```bash
node server/index.js
```

브라우저에서 `http://localhost:4173`을 엽니다. 기본 실행은 설치 없이 `data/app-data.json` 파일 저장소를 사용합니다.

## MySQL 사용

```bash
mysql -u root -p < database/schema.sql
npm install
DB_MODE=mysql DB_HOST=127.0.0.1 DB_USER=root DB_PASSWORD=비밀번호 DB_NAME=care_basis node server/index.js
```

`mysql2` 드라이버는 `package.json`에 선언되어 있습니다.

## 배포

Render + Aiven MySQL 배포 순서는 [DEPLOYMENT.md](DEPLOYMENT.md)에 정리했습니다.

## 주요 기능

- 아기 프로필 등록과 현재 월령 자동 계산
- 수유, 이유식, 낮잠, 밤잠, 기저귀, 목욕, 산책, 약 복용, 메모 기록
- 월령별 체크리스트와 완료 상태 저장
- 공식 출처 기반 정보 검색
- 관리자 문서 추가, 수정, 삭제
- 비공식 블로그, 카페, 커뮤니티 도메인 등록 차단

## 기본 공식 출처

- 질병관리청 예방접종도우미
- 국민건강보험공단 건강Law
- 임신육아종합포털 아이사랑
- 식품의약품안전처 식품안전나라
- 식품의약품안전처 어린이·사회복지급식관리지원센터
