// logger.js
const winston = require('winston');
const { combine, timestamp, printf, colorize } = winston.format;

// 로그 포맷 정의: [YYYY-MM-DD HH:mm:ss] LEVEL: Message
const logFormat = printf(({ level, message, timestamp }) => {
  return `[${timestamp}] ${level.toUpperCase()}: ${message}`;
});

const logger = winston.createLogger({
  level: 'info', // 기본 로그 레벨 (info, warn, error, debug 등)
  format: combine(
    timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }), // 타임스탬프 형식 지정
    logFormat // 위에서 정의한 로그 포맷 적용
  ),
  transports: [
    // 콘솔 출력 (개발 편의성)
    new winston.transports.Console({
      format: combine(
        colorize(), // 콘솔 출력에 색상 적용
        logFormat
      ),
      level: 'debug' // 콘솔에는 debug 레벨 이상 모두 출력
    }),
    // 파일 출력 (bot.log 파일에 info 레벨 이상 모든 로그 저장)
    // 이 파일이 웹 서버에서 읽을 로그 파일이 됩니다.
    new winston.transports.File({ filename: 'bot.log', level: 'info' }),
    // 에러 로그만 별도의 파일에 저장 (선택 사항)
    new winston.transports.File({ filename: 'error.log', level: 'error' }),
  ],
});

module.exports = logger; // 다른 파일에서 사용할 수 있도록 내보냅니다.