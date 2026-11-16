# Discord 팀 배분 봇

Discord 서버에서 `/팀배분`을 실행하고 `팀크기`로 3:3, 4:4, 5:5 중 하나를 선택하세요. 채널에 공개 Embed가 표시되고, 세션을 만든 개최자만 버튼과 메뉴를 조작할 수 있습니다. 각 실행에 고유 ID가 발급되므로 같은 서버 또는 서로 다른 서버에서 여러 세션을 동시에 사용할 수 있습니다.

1. **직접 추가**를 눌러 한 줄에 한 명씩 입력하거나 **내 음성 채널에서 추가**를 눌러 현재 음성 채널의 참가자를 가져옵니다. 두 방식으로 추가한 참가자를 함께 배분할 수 있습니다.
2. 삭제 및 이름 변경 메뉴에서 참가자를 선택합니다. 같은 이름을 가진 사람은 목록의 번호로 구분합니다. 음성 채널 수집은 버튼을 누른 시점 기준이며, 봇과 이미 같은 세션에 수집된 Discord 계정은 제외합니다.
3. 인원을 각각 6명, 8명, 10명으로 맞춰 **팀 배분**을 누릅니다. **다시 섞기**는 현재 명단을 Fisher–Yates 알고리즘으로 새로 섞습니다. 무작위 배분 특성상 같은 결과가 나올 수 있습니다.

참가자는 준비 중 최대 25명까지 등록할 수 있습니다. 세션과 참가자는 프로세스의 TypeScript `Map`에 저장되며, 재시작 또는 설정된 시간 동안 개최자 활동이 없으면 초기화됩니다. 기본 만료 시간은 60분입니다. 만료된 패널은 채널에 남으며, 조작 시 새 세션을 만들라는 안내를 표시합니다.

## Discord 앱 설정

[Discord Developer Portal](https://discord.com/developers/applications)에서 애플리케이션과 봇을 만듭니다. 애플리케이션 ID와 봇 토큰을 확보한 뒤, Guild Install에 `bot`과 `applications.commands` 범위를 설정하고 서버에 설치합니다. 봇에 사용할 텍스트 채널의 **채널 보기**, **메시지 보내기**, **링크 첨부(Embed Links)** 권한과 수집 대상 음성 채널의 **채널 보기** 권한을 부여하세요. 스레드에서 쓰려면 **스레드에서 메시지 보내기**도 필요합니다. Gateway Intent는 `Guilds`와 `GuildVoiceStates`를 사용합니다.

## Windows 개발

Node.js 22.12 이상과 npm을 준비하고 PowerShell에서 실행합니다.

```powershell
Copy-Item .env.example .env
npm.cmd ci
npm.cmd run build
npm.cmd run register
npm.cmd start
```

`.env`를 복사한 직후 `DISCORD_TOKEN`에 봇 토큰, `DISCORD_CLIENT_ID`에 애플리케이션 ID를 입력하세요. `DISCORD_GUILD_ID`를 설정하면 해당 테스트 서버에만 명령을 등록합니다. 여러 서버에서 쓰려면 이 값을 비운 상태에서 명령을 전역으로 등록하고 각 대상 서버에 봇을 설치하세요. `SESSION_TTL_MINUTES`에는 1~1440분을 설정할 수 있습니다.

## Oracle Cloud Ubuntu 배포

Ubuntu 인스턴스에 소스 파일을 복사하고 Node.js 22.12 이상과 npm을 시스템 전체에서 사용할 수 있도록 설치합니다. 아래 명령은 프로젝트 디렉터리에서 실행합니다. 봇은 Discord에 아웃바운드 연결을 열며, 전용 인바운드 포트가 필요하지 않습니다.

```bash
npm ci
npm run build
npm prune --omit=dev

sudo useradd --system --user-group --no-create-home --shell /usr/sbin/nologin discord-team-bot
sudo install -d -m 0755 /opt/discord-team-bot
sudo cp -a dist node_modules package.json /opt/discord-team-bot/
sudo install -m 0600 .env.example /etc/discord-team-bot.env
sudoedit /etc/discord-team-bot.env
```

환경 파일에 토큰과 애플리케이션 ID를 입력합니다. 처음 배포하거나 명령 정의를 바꾼 경우 아래 등록 명령을 한 번 실행합니다. 서비스 파일의 `ExecStart`는 `/usr/bin/node`를 사용합니다. Node.js 경로가 다른 경우 `command -v node`로 확인한 시스템 경로를 반영하세요.

```bash
sudo /usr/bin/node --env-file=/etc/discord-team-bot.env /opt/discord-team-bot/dist/register.js
sudo install -m 0644 deploy/discord-team-bot.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now discord-team-bot
sudo systemctl status discord-team-bot
sudo journalctl -u discord-team-bot -f
```

업데이트할 때는 빌드 및 프로덕션 의존성 준비 후 앱 파일을 갱신하고 `sudo systemctl restart discord-team-bot`을 실행합니다.

## 코드 구조

- `src/session-service.ts`는 메모리 저장소, 개최자 확인, 참가자 변경과 만료 처리를 담당합니다. 영속 저장소를 도입할 때는 이 계층을 확장하면 됩니다.
- `src/teams.ts`는 팀 크기와 Fisher–Yates 배분을 담당합니다.
- `src/command.ts`, `src/interactions.ts`, `src/panel.ts`는 슬래시 명령 정의, 상호작용 처리, Embed와 컴포넌트 생성을 담당합니다.
- `src/index.ts`와 `src/register.ts`는 봇 실행과 명령 등록의 진입점입니다.
