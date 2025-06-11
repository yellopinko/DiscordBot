// web_server.js
const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const fs = require('fs');
const path = require('path');
const Tail = require('tail').Tail; // 'tail' 라이브러리

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

// Winston 로거에서 설정된 로그 파일 경로와 동일하게 맞춰야 합니다.
// logger.js에서 'logs' 폴더 안에 'discord-bot-YYYY-MM-DD.log' 형식으로 저장되도록 설정했습니다.
const LOG_DIR = path.join(__dirname, 'logs'); // logger.js에서 지정한 로그 폴더
const LOG_FILE_PREFIX = 'discord-bot-'; // logger.js에서 설정한 파일명 접두사

// 가장 최근에 생성된 로그 파일을 동적으로 찾는 함수
function getLatestLogFile() {
    if (!fs.existsSync(LOG_DIR)) {
        console.error("로그 디렉토리 'logs/'를 찾을 수 없습니다.");
        return null;
    }
    const files = fs.readdirSync(LOG_DIR);
    const logFiles = files.filter(file =>
        file.startsWith(LOG_FILE_PREFIX) &&
        file.endsWith('.log') &&
        !file.endsWith('.log.gz') // 압축된 로그 파일은 제외
    );
    // 파일명을 역순으로 정렬하여 가장 최근 날짜의 파일을 찾습니다.
    logFiles.sort((a, b) => {
        const dateA = new Date(a.replace(LOG_FILE_PREFIX, '').replace('.log', ''));
        const dateB = new Date(b.replace(LOG_FILE_PREFIX, '').replace('.log', ''));
        return dateB.getTime() - dateA.getTime();
    });
    return logFiles.length > 0 ? path.join(LOG_DIR, logFiles[0]) : null;
}

// EJS 템플릿 엔진 설정
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// 정적 파일 (CSS, JS 등)을 제공할 'public' 폴더 설정 (필요시)
// app.use(express.static(path.join(__dirname, 'public')));

// 로그 페이지 라우트
app.get('/logs', (req, res) => {
  const latestLogFilePath = getLatestLogFile();

  if (!latestLogFilePath || !fs.existsSync(latestLogFilePath)) {
    logger.warn(`[웹 서버] 로그 파일을 찾을 수 없습니다: ${latestLogFilePath || '경로 없음'}. 봇이 실행되어 로그를 생성했는지 확인해주세요.`);
    return res.status(404).send("로그 파일을 찾을 수 없습니다. 봇이 로그를 생성했는지 확인해주세요.");
  }

  // 초기 페이지 로드 시, 기존 로그 파일의 마지막 200줄 정도를 읽어옵니다.
  fs.readFile(latestLogFilePath, 'utf8', (err, data) => {
    if (err) {
      logger.error("[웹 서버] 로그 파일을 읽는 중 오류 발생:", err);
      return res.status(500).send("로그 파일을 읽을 수 없습니다.");
    }
    const logs = data.split('\n').filter(line => line.trim() !== '');
    const recentLogs = logs.slice(-200); // 최근 200줄만 가져옴 (조정 가능)
    res.render('logs', { logs: recentLogs.reverse() }); // 최신 로그가 위에 오도록 역순 정렬
  });
});

// Socket.IO 연결 처리
io.on('connection', (socket) => {
  console.log('웹 클라이언트가 로그 페이지에 연결되었습니다.');

  const latestLogFilePath = getLatestLogFile();
  if (!latestLogFilePath || !fs.existsSync(latestLogFilePath)) {
      logger.warn("[웹 서버] 웹 소켓 연결 시 로그 파일을 찾을 수 없습니다. 봇이 로그를 생성했는지 확인해주세요.");
      socket.emit('logError', '로그 파일을 찾을 수 없습니다.');
      return;
  }

  let tailInstance;
  try {
    // tail 라이브러리를 사용하여 로그 파일의 변경 사항을 실시간으로 감지
    tailInstance = new Tail(latestLogFilePath, { follow: true, fromBeginning: false }); // 새로 추가되는 라인만 감지
    tailInstance.on('line', (line) => {
      if (line.trim() !== '') { // 빈 줄은 무시
        socket.emit('newLog', line); // 새로운 로그 라인을 연결된 클라이언트에게 전송
      }
    });

    tailInstance.on('error', (error) => {
      logger.error('Tail 오류 발생:', error);
      socket.emit('logError', '로그 파일 감지 중 오류 발생: ' + error.message);
    });

  } catch (e) {
    logger.error("[웹 서버] 파일 tail 설정 중 오류 발생:", e);
    socket.emit('logError', '로그 감시 설정 중 오류 발생: ' + e.message);
  }

  socket.on('disconnect', () => {
    console.log('웹 클라이언트 연결 해제');
    if (tailInstance) {
      tailInstance.unwatch(); // 클라이언트 연결 해제 시 파일 감시 중단
    }
  });
});

const WEB_PORT = process.env.WEB_PORT || 3000; // 환경 변수 또는 기본 3000 포트 사용
server.listen(WEB_PORT, () => {
  console.log(`로그 웹 서버가 http://localhost:${WEB_PORT}/logs 에서 실행 중입니다.`);
});