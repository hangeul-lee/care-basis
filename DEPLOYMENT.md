# Render + Aiven 배포 순서

이 앱은 Render에 Node 웹앱으로 올리고, Aiven for MySQL을 데이터베이스로 쓰는 구성을 기준으로 준비되어 있습니다.

## 1. 배포 전에 확인할 것

- GitHub 저장소가 필요합니다. Render는 GitHub 저장소를 연결해 배포합니다.
- 공개 웹앱이므로 `APP_PIN`을 반드시 설정합니다. PIN을 모르면 아기 프로필, 루틴, 관리자 API에 접근할 수 없습니다.
- 로컬 파일 저장소(`data/app-data.json`)는 배포에서 쓰지 않습니다. Render의 무료 인스턴스 파일은 영구 저장소로 쓰면 안 되므로 MySQL을 사용합니다.

## 2. Aiven MySQL 만들기

1. Aiven에 가입합니다.
2. Aiven for MySQL 서비스를 만듭니다.
3. 서비스가 Running 상태가 되면 Connection information에서 아래 값을 확인합니다.
   - Host
   - Port
   - User
   - Password
   - Database 이름
4. CA certificate를 다운로드합니다.
5. CA certificate를 base64로 변환합니다.

macOS:

```bash
base64 -i ca.pem | pbcopy
```

Linux:

```bash
base64 -w 0 ca.pem
```

이 값은 Render 환경변수 `DB_SSL_CA_B64`에 넣습니다.

## 3. Render에 배포하기

1. 이 폴더를 GitHub 저장소로 push합니다.
2. Render Dashboard에서 `New > Web Service`를 선택합니다.
3. GitHub 저장소를 연결합니다.
4. 직접 설정한다면 다음 값을 사용합니다.
   - Runtime: Node
   - Build Command: `npm install`
   - Start Command: `node server/index.js`
   - Health Check Path: `/api/health`
5. `render.yaml`을 사용하는 Blueprint 배포도 가능합니다.

## 4. Render 환경변수

Render 서비스의 Environment에 아래 값을 설정합니다.

```text
NODE_ENV=production
DB_MODE=mysql
DB_AUTO_MIGRATE=true
DB_HOST=Aiven Host
DB_PORT=Aiven Port
DB_USER=Aiven User
DB_PASSWORD=Aiven Password
DB_NAME=Aiven Database
DB_SSL=true
DB_SSL_REJECT_UNAUTHORIZED=true
DB_SSL_CA_B64=base64로 변환한 CA certificate
APP_PIN=가족이 사용할 PIN
AUTH_SECRET=충분히 긴 랜덤 문자열
```

`AUTH_SECRET`은 아래처럼 만들 수 있습니다.

```bash
openssl rand -base64 32
```

## 5. 첫 배포 후 확인

1. Render의 deploy log에 오류가 없는지 확인합니다.
2. `https://서비스명.onrender.com/api/health`가 `{"ok":true,"mode":"mysql"}`을 반환하는지 확인합니다.
3. 웹앱에 접속해서 가족 PIN 화면이 뜨는지 확인합니다.
4. PIN 입력 후 아기 프로필을 하나 등록합니다.
5. 빠른 기록을 하나 저장하고 새로고침 후 유지되는지 확인합니다.
6. 검색 탭에서 공식 출처 문서가 보이는지 확인합니다.
7. 뉴스 탭에서 공식 뉴스가 보이는지 확인합니다.

## 6. 문제 해결

- DB 연결 실패: Aiven Host, Port, User, Password, Database 값을 다시 확인합니다.
- SSL 오류: `DB_SSL_CA_B64`가 정확한지 확인합니다. 임시 확인용으로만 `DB_SSL_REJECT_UNAUTHORIZED=false`를 쓸 수 있지만, 공개 운영에서는 권장하지 않습니다.
- 테이블 없음 오류: `DB_AUTO_MIGRATE=true`인지 확인합니다.
- PIN이 계속 틀림: Render 환경변수 `APP_PIN` 값과 실제 입력값을 다시 확인한 뒤 서비스 redeploy를 누릅니다.
- 무료 Render 인스턴스는 비활성 상태에서 잠들 수 있어 첫 접속이 느릴 수 있습니다.
