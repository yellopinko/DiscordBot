// logger.js

const winston = require('winston');
const path = require('path');

// 사용자 정의 로그 포맷
const logFormat = winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.printf(info => {
        // Discord로 보낼 메시지는 색상 코드를 포함하지 않도록 처리
        return `${info.timestamp} [${info.level.toUpperCase()}] ${info.message}`;
    })
);

// --- Discord 채널로 로그를 보내는 사용자 정의 트랜스포트 ---
class DiscordTransport extends winston.Transport {
    constructor(options) {
        super(options);
        this.client = options.client; // Discord 클라이언트 객체
        this.channelId = options.channelId; // 로그를 보낼 채널 ID
        this.levelColors = { // Discord 임베드 메시지에 사용할 색상 (16진수)
            error: 0xFF0000,   // 빨강
            warn: 0xFFA500,    // 주황
            info: 0x00FF00,    // 초록
            verbose: 0x800080, // 보라
            debug: 0x0000FF,   // 파랑
            silly: 0xADD8E6    // 연하늘
        };
    }

    log(info, callback) {
        // 비동기적으로 로그 전송 (로깅이 봇의 다른 작업에 영향을 주지 않도록)
        setImmediate(() => {
            this.emit('logged', info);
        });

        // 봇이 로그인되어 있고 채널 ID가 유효한지 확인
        if (this.client && this.client.isReady() && this.channelId) {
            const channel = this.client.channels.cache.get(this.channelId);
            if (channel && channel.isTextBased()) {
                const embed = {
                    color: this.levelColors[info.level.toLowerCase()] || 0x808080, // 기본 회색
                    title: `[${info.level.toUpperCase()}]`,
                    description: `\`\`\`${info.timestamp}\n${info.message}\`\`\``, // 코드 블록으로 가독성 향상
                    timestamp: new Date()
                };
                channel.send({ embeds: [embed] }).catch(err => {
                    // Discord 전송 오류는 콘솔에만 출력 (무한 로깅 방지)
                    console.error('Error sending log to Discord channel:', err);
                });
            }
        }
        callback();
    }
}
// --- Discord 트랜스포트 끝 ---

const logger = winston.createLogger({
    level: 'info', // 최소 'info' 레벨 이상의 로그를 처리
    format: logFormat, // 위에서 정의한 사용자 정의 포맷 적용
    transports: [
        // 콘솔로 로그 출력 (터미널에서 확인용)
        new winston.transports.Console({
            format: winston.format.combine(
                winston.format.colorize(), // 콘솔에 색상 적용
                logFormat
            )
        }),
        // 파일에 로그 저장 (logs 폴더 안에 저장되도록 변경)
        new winston.transports.File({
            filename: path.join(__dirname, 'logs', 'bot.log'), // logs/bot.log
            level: 'info' // 'info' 레벨 이상 로그 저장
        }),
        // 에러 로그만 별도의 파일에 저장
        new winston.transports.File({
            filename: path.join(__dirname, 'logs', 'error.log'), // logs/error.log
            level: 'error' // 'error' 레벨 로그만 저장
        })
        // DiscordTransport는 아래 addDiscordTransport 함수를 통해 동적으로 추가됩니다.
    ]
});

// 외부에서 Discord 클라이언트와 채널 ID를 받아 DiscordTransport를 추가하는 함수
logger.addDiscordTransport = (clientInstance, channelId) => {
    // 이미 DiscordTransport가 추가되어 있지 않다면 추가
    if (!logger.transports.some(t => t instanceof DiscordTransport)) {
        logger.add(new DiscordTransport({ client: clientInstance, channelId: channelId, level: 'info' })); // Discord로 'info' 레벨 이상 로그 전송
        logger.info(`[로거 설정] Discord 로깅이 채널 ID ${channelId} 에 추가되었습니다.`);
    }
};

module.exports = logger;