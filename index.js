// index.js

// .env 파일에서 환경 변수를 로드합니다. 이 코드는 파일 최상단에 위치해야 합니다.
require('dotenv').config();

// 파일 시스템 모듈을 불러옵니다. (JSON 파일 저장/로드에 사용)
const fs = require('fs');
const path = require('path'); // 파일 경로를 다루기 위해 추가

// discord.js 라이브러리에서 필요한 클래스들을 불러옵니다.
const { Client, IntentsBitField, Partials, EmbedBuilder, Collection } = require('discord.js'); 

// Discord 클라이언트(봇)를 생성하고 봇이 어떤 이벤트(정보)를 받을지 '인텐트'를 설정합니다.
// 봇이 제대로 작동하기 위해 필요한 모든 인텐트들입니다.
const client = new Client({
    intents: [
        IntentsBitField.Flags.Guilds,               // 서버(길드) 관련 정보 (서버 목록, 채널, 역할 등)
        IntentsBitField.Flags.GuildMessages,        // 서버 내 메시지 이벤트 (메시지 생성, 업데이트, 삭제 등)
        IntentsBitField.Flags.GuildMessageReactions,// 서버 내 메시지 반응 이벤트 (반응 추가, 제거)
        IntentsBitField.Flags.MessageContent,       // 봇이 메시지 내용을 읽을 수 있도록 허용 (명령어 처리 시 필수)
        IntentsBitField.Flags.GuildMembers,         // 길드 멤버 정보 (새로운 멤버 입장, 역할 부여 등에 필요)
        IntentsBitField.Flags.GuildPresences,       // 유저 상태 (선택 사항, 필요 시 활성화)
        IntentsBitField.Flags.GuildInvites,         // 초대 정보 (초대자 감지에 필수)
    ],
    // 부분적인 이벤트 처리: 봇이 시작되기 전의 메시지나 멤버 관련 이벤트도 처리할 수 있게 합니다.
    partials: [Partials.Message, Partials.Channel, Partials.Reaction, Partials.GuildMember], 
});

// .env 파일에서 봇 토큰을 가져옵니다.
const TOKEN = process.env.DISCORD_BOT_TOKEN; 
// 봇 명령어의 접두사 (예: !역할메시지, !입장멘트)
const PREFIX = '!'; 

// 초대 정보를 저장할 Collection (서버 ID를 키로, 해당 서버의 초대 목록을 값으로 가집니다.)
client.invites = new Collection();

// -------------------------------------------------------------------------
// ★★★ JSON 파일 설정 및 관련 함수 (reactionRoles 및 settings) ★★★
// -------------------------------------------------------------------------

// reactionRoles 정보를 저장할 JSON 파일 경로
const REACTION_ROLES_FILE = path.join(__dirname, 'reactionRoles.json');
// 봇의 일반 설정을 저장할 JSON 파일 경로 (예: 입장 로그 채널 ID)
const SETTINGS_FILE = path.join(__dirname, 'settings.json');

// reactionRoles 객체 (봇 시작 시 파일에서 로드됨)
// 구조: { "guildId": { "messageId": [{ emoji: "emojiId/name", roleId: "roleId" }] } }
let reactionRoles = {}; 
// 봇의 설정 객체 (봇 시작 시 파일에서 로드됨)
// 구조: { "guildId": { welcomeLogChannelId: null, welcomeMessageTemplate: "...", inviterFeatureEnabled: true } }
let botSettings = {};

// 기본 서버 설정 템플릿
const defaultGuildSettings = {
    welcomeLogChannelId: null, 
    welcomeMessageTemplate: '🎉 {user} 님! {server} 에 오신 것을 환영합니다! {inviter}',
    inviterFeatureEnabled: true 
};

// 파일에서 reactionRoles 정보를 로드하는 함수
function loadReactionRoles() {
    if (fs.existsSync(REACTION_ROLES_FILE)) {
        try {
            const data = fs.readFileSync(REACTION_ROLES_FILE, 'utf8');
            reactionRoles = JSON.parse(data);
            console.log('[설정 로드] reactionRoles 정보를 파일에서 성공적으로 로드했습니다.');
        } catch (error) {
            console.error('[오류] reactionRoles 정보 로드 중 오류:', error);
            reactionRoles = {}; // 오류 발생 시 빈 객체로 초기화
        }
    } else {
        console.log('[설정 로드] reactionRoles.json 파일이 존재하지 않습니다. 새 파일이 생성됩니다.');
    }
}

// reactionRoles 정보를 파일에 저장하는 함수
function saveReactionRoles() {
    try {
        fs.writeFileSync(REACTION_ROLES_FILE, JSON.stringify(reactionRoles, null, 2), 'utf8');
        console.log('[설정 저장] reactionRoles 정보가 파일에 성공적으로 저장되었습니다.');
    } catch (error) {
        console.error('[오류] reactionRoles 정보 저장 중 오류:', error);
    }
}

// 파일에서 botSettings 정보를 로드하는 함수
function loadBotSettings() {
    if (fs.existsSync(SETTINGS_FILE)) {
        try {
            const data = fs.readFileSync(SETTINGS_FILE, 'utf8');
            const loadedSettings = JSON.parse(data);
            // 로드된 설정과 기본 설정 템플릿을 병합하여 새로운 필드가 추가되어도 호환성 유지
            for (const guildId in loadedSettings) {
                botSettings[guildId] = { ...defaultGuildSettings, ...loadedSettings[guildId] };
            }
            console.log('[설정 로드] 봇 설정을 파일에서 성공적으로 로드했습니다.');
        } catch (error) {
            console.error('[오류] 봇 설정 로드 중 오류:', error);
            botSettings = {}; // 오류 발생 시 빈 객체로 초기화
        }
    } else {
        console.log('[설정 로드] settings.json 파일이 존재하지 않습니다. 새 파일이 생성됩니다.');
    }
}

// botSettings 정보를 파일에 저장하는 함수
function saveBotSettings() {
    try {
        fs.writeFileSync(SETTINGS_FILE, JSON.stringify(botSettings, null, 2), 'utf8');
        console.log('[설정 저장] 봇 설정이 파일에 성공적으로 저장되었습니다.');
    } catch (error) {
        console.error('[오류] 봇 설정 저장 중 오류:', error);
    }
}

// 특정 서버의 설정을 가져오는 헬퍼 함수
function getGuildSettings(guildId) {
    if (!botSettings[guildId]) {
        // 해당 서버의 설정이 없으면 기본 설정으로 초기화
        botSettings[guildId] = { ...defaultGuildSettings };
        saveBotSettings(); // 새로운 서버 설정을 파일에 저장
        console.log(`[설정] 새로운 서버 ${guildId} 에 대한 기본 설정이 생성되었습니다.`);
    }
    return botSettings[guildId];
}

// 특정 서버의 반응 역할 정보를 가져오는 헬퍼 함수
function getGuildReactionRoles(guildId) {
    if (!reactionRoles[guildId]) {
        reactionRoles[guildId] = {}; // 해당 서버의 반응 역할이 없으면 빈 객체로 초기화
        saveReactionRoles();
        console.log(`[설정] 새로운 서버 ${guildId} 에 대한 빈 반응 역할 설정이 생성되었습니다.`);
    }
    return reactionRoles[guildId];
}

// -------------------------------------------------------------------------
// 봇 준비 이벤트 (ready)
// 봇이 Discord에 성공적으로 로그인하고 준비되었을 때 실행되는 이벤트
// -------------------------------------------------------------------------
client.on('ready', async () => {
    console.log(`[봇 준비] Logged in as ${client.user.tag}!`); 
    console.log('[봇 준비] 봇이 성공적으로 준비되었습니다!');

    // 봇 시작 시 reactionRoles 정보 로드
    loadReactionRoles(); 
    // 봇 시작 시 일반 설정 정보 로드
    loadBotSettings();

    // 봇이 시작될 때 모든 서버의 초대 정보를 캐싱합니다.
    console.log('[봇 준비] 서버 초대 정보를 캐싱하는 중...');
    for (const guild of client.guilds.cache.values()) {
        try {
            const fetchedInvites = await guild.invites.fetch();
            client.invites.set(guild.id, fetchedInvites);
            console.log(`[봇 준비] ${guild.name} 서버의 초대 정보 캐싱 완료.`);
        } catch (error) {
            console.error(`[오류] ${guild.name} 서버의 초대 정보를 가져오는 데 실패했습니다 (권한 부족?):`, error.message);
        }
    }
    console.log('[봇 준비] 모든 서버 초대 정보 캐싱 완료.');
});

// -------------------------------------------------------------------------
// 초대 이벤트 (inviteCreate, inviteDelete)
// 초대 링크가 생성되거나 삭제될 때마다 초대 정보를 업데이트합니다.
// -------------------------------------------------------------------------
client.on('inviteCreate', async invite => {
    if (!invite.guild) return; // 길드가 없는 초대는 무시
    console.log(`[초대 감지] 새로운 초대 생성: ${invite.code} in ${invite.guild.name}`);
    try {
        client.invites.set(invite.guild.id, await invite.guild.invites.fetch());
    } catch (error) {
        console.error(`[오류] 초대 생성 시 초대 정보 업데이트 실패 for ${invite.guild.name}:`, error.message);
    }
});

client.on('inviteDelete', async invite => {
    if (!invite.guild) return; // 길드가 없는 초대는 무시
    console.log(`[초대 감지] 초대 삭제됨: ${invite.code} in ${invite.guild.name}`);
    try {
        client.invites.set(invite.guild.id, await invite.guild.invites.fetch());
    } catch (error) {
        console.error(`[오류] 초대 삭제 시 초대 정보 업데이트 실패 for ${invite.guild.name}:`, error.message);
    }
});

// -------------------------------------------------------------------------
// 길드 멤버 추가 이벤트 (guildMemberAdd)
// 새로운 멤버가 서버에 입장했을 때 실행되는 이벤트 (입장 로그)
// -------------------------------------------------------------------------
client.on('guildMemberAdd', async member => {
    console.log(`[입장 감지] 새로운 멤버가 입장했습니다: ${member.user.tag} (${member.id})`);

    const guildId = member.guild.id;
    const guildSettings = getGuildSettings(guildId); // 해당 서버의 설정 가져오기

    const logChannelId = guildSettings.welcomeLogChannelId; // 서버별 설정에서 채널 ID 가져오기
    if (!logChannelId) {
        console.warn(`[입장 감지] ${member.guild.name} 서버의 입장 로그 채널이 설정되지 않았습니다. !입장로그채널 명령어로 설정해주세요.`);
        return;
    }

    const logChannel = await client.channels.fetch(logChannelId).catch(error => {
        console.error(`[오류] 입장 로그 채널 ID ${logChannelId} 를 가져오는 데 실패했습니다:`, error.message);
        return null;
    });

    if (!logChannel || logChannel.type !== 0) { // type 0은 텍스트 채널을 의미합니다.
        console.error(`[오류] ${member.guild.name} 서버의 입장 로그 채널을 찾을 수 없거나 텍스트 채널이 아닙니다. 설정된 ID를 확인하세요.`);
        return;
    }

    try {
        // 서버 입장 시간과 계정 생성 시간 포맷팅
        const joinDate = member.joinedAt ? new Date(member.joinedAt).toLocaleString('ko-KR', { 
            year: 'numeric', month: 'long', day: 'numeric', 
            hour: '2-digit', minute: '2-digit', 
            timeZone: 'Asia/Seoul' 
        }) : '알 수 없음';
        const creationDate = member.user.createdAt ? new Date(member.user.createdAt).toLocaleString('ko-KR', { 
            year: 'numeric', month: 'long', day: 'numeric', 
            hour: '2-digit', minute: '2-digit', 
            timeZone: 'Asia/Seoul' 
        }) : '알 수 없음';
        const guildMemberCount = member.guild.memberCount;

        let inviterInfo = '알 수 없음';
        let inviterMessagePart = '';

        if (guildSettings.inviterFeatureEnabled) { // 서버별 초대자 기능 활성화 여부 확인
            const cachedInvites = client.invites.get(member.guild.id);
            if (cachedInvites) { // 캐시된 초대 정보가 있는 경우에만 처리
                const newInvites = await member.guild.invites.fetch();
                
                // 사용된 초대 코드를 찾습니다. (이전과 비교하여 사용 횟수가 1 증가한 초대)
                const usedInvite = newInvites.find(
                    invite => cachedInvites.has(invite.code) && cachedInvites.get(invite.code).uses < invite.uses
                );
                
                if (usedInvite && usedInvite.inviter) {
                    inviterInfo = usedInvite.inviter.tag;
                    inviterMessagePart = `${usedInvite.inviter.tag}님이 초대했어요.`;
                } else {
                    // 어떤 초대로 들어왔는지 명확하지 않을 때
                    inviterMessagePart = '초대자를 알 수 없어요.'; 
                }
                
                // 초대 정보 업데이트 (다음 입장 감지를 위해 최신 상태 유지)
                client.invites.set(member.guild.id, newInvites);
            } else {
                console.warn(`[입장 감지] ${member.guild.name} 서버의 캐시된 초대 정보가 없습니다. 초대자 정보를 가져올 수 없습니다. 봇 재시작을 고려하세요.`);
                inviterMessagePart = '초대자 정보를 가져올 수 없어요.';
            }
        }

        // 사용자 정의 입장 멘트 적용 (서버별 템플릿 사용)
        // {user}, {server}, {inviter} 플레이스홀더를 실제 값으로 대체
        let finalWelcomeMessage = guildSettings.welcomeMessageTemplate 
            .replace('{user}', member.user)
            .replace('{server}', member.guild.name)
            .replace('{inviter}', guildSettings.inviterFeatureEnabled ? inviterMessagePart : ''); 

        // 임베드 메시지 구성 (제공된 예시 사진과 유사하게 구성)
        const welcomeEmbed = new EmbedBuilder()
            .setColor(0x3498DB) // 파란색 계열
            .setAuthor({
                name: `${member.guild.name}`, // 서버 이름
                iconURL: member.guild.iconURL({ dynamic: true }) // 서버 아이콘
            })
            .setTitle(`🎉 ${guildMemberCount}번째 멤버가 입장했어요`) // N번째 멤버
            .setThumbnail(member.user.displayAvatarURL({ dynamic: true, size: 256 })) // 멤버 아바타
            .setDescription(finalWelcomeMessage) // 사용자 정의 입장 멘트를 임베드의 설명으로 사용
            .addFields(
                { name: '유저', value: `${member.user} (${member.user.tag})`, inline: false }, // @멘션과 태그
                { name: '서버에 입장한 시간', value: `${joinDate}`, inline: false },
                { name: '계정 생성일', value: `${creationDate}`, inline: false },
                // 초대자 기능이 활성화된 경우에만 초대자 필드를 추가
                ...(guildSettings.inviterFeatureEnabled && inviterInfo !== '알 수 없음' ? [{ name: '초대자', value: inviterInfo, inline: false }] : []),
            )
            .setTimestamp() // 현재 시간 스탬프 (입장 시간)
            .setFooter({ text: `${member.guild.name}`, iconURL: member.guild.iconURL({ dynamic: true }) });

        console.log(`[입장 감지] 입장 로그를 ${logChannel.name} 에 전송 시도...`);
        await logChannel.send({ embeds: [welcomeEmbed] });
        console.log(`[입장 감지] ${member.user.tag} 의 입장 로그가 성공적으로 전송되었습니다.`);

    } catch (error) {
        console.error(`[오류] ${member.user.tag} 의 입장 로그 전송 중 오류 발생:`, error.message);
    }
});


// -------------------------------------------------------------------------
// 메시지 생성 이벤트 (messageCreate)
// 사용자가 메시지를 보냈을 때 실행되는 이벤트 (명령어 처리)
// -------------------------------------------------------------------------
client.on('messageCreate', async message => {
    // 봇 자신이 보낸 메시지 또는 접두사로 시작하지 않는 메시지는 무시합니다.
    if (!message.content.startsWith(PREFIX) || message.author.bot) return;
    // DM 채널에서는 길드 관련 명령어를 실행할 수 없습니다.
    if (!message.guild) {
        return message.reply('이 명령어는 서버(길드) 채널에서만 사용할 수 있습니다.');
    }

    const guildId = message.guild.id; // 현재 메시지가 온 서버 ID
    const guildSettings = getGuildSettings(guildId); // 현재 서버의 설정 가져오기
    const guildReactionRoles = getGuildReactionRoles(guildId); // 현재 서버의 반응 역할 정보 가져오기

    // 메시지 내용을 접두사를 제외하고 공백으로 분리하여 명령어와 인수를 추출합니다.
    const args = message.content.slice(PREFIX.length).trim().split(/\s+/);
    const command = args.shift().toLowerCase(); // 첫 번째 단어를 명령어로 사용

    // '역할메시지' 명령어
    if (command === '역할메시지') {
        // 관리자 권한 확인
        if (!message.member.permissions.has('Administrator')) {
            return message.reply('이 명령어를 사용하려면 관리자 권한이 필요합니다.');
        }

        const channelId = args[0];
        const messageId = args[1];
        const emojiInput = args[2]; // 사용자가 입력한 이모지 문자열
        const roleId = args[3];

        if (!channelId || !messageId || !emojiInput || !roleId) {
            return message.reply('사용법: `!역할메시지 <채널ID> <메시지ID> <이모지> <역할ID>`');
        }

        try {
            const channel = await client.channels.fetch(channelId);
            if (!channel || channel.type !== 0) { // 0은 TextChannel
                return message.reply('유효한 채널 ID를 제공해주세요.');
            }

            const targetMessage = await channel.messages.fetch(messageId);
            if (!targetMessage) {
                return message.reply('유효한 메시지 ID를 제공해주세요.');
            }

            // 이모지 유니코드 또는 Discord 커스텀 이모지 ID로 변환
            let reactionEmoji;
            const customEmojiMatch = emojiInput.match(/<a?:(\w+):(\d+)>/); // <a:name:id> 또는 <:name:id>
            if (customEmojiMatch) {
                reactionEmoji = customEmojiMatch[2]; // 커스텀 이모지 ID
            } else {
                reactionEmoji = emojiInput; // 유니코드 이모지
            }

            // 이미 해당 메시지에 설정된 같은 이모지가 있는지 확인
            if (guildReactionRoles[messageId] && guildReactionRoles[messageId].some(rr => rr.emoji === reactionEmoji)) {
                return message.reply('해당 메시지에 이미 동일한 이모지로 반응 역할이 설정되어 있습니다.');
            }

            await targetMessage.react(reactionEmoji);
            
            // 해당 메시지 ID에 대한 배열이 없으면 새로 생성
            if (!guildReactionRoles[messageId]) {
                guildReactionRoles[messageId] = [];
            }
            // 현재 서버의 reactionRoles에 새로운 정보 추가
            guildReactionRoles[messageId].push({
                emoji: reactionEmoji, 
                roleId: roleId
            });

            // 정보가 변경되었으므로 파일에 저장
            saveReactionRoles(); 

            message.reply('반응 역할 메시지가 성공적으로 설정되었습니다.');
            console.log(`[명령어] ${message.guild.name} 서버에 역할 메시지 설정: 채널 ${channelId}, 메시지 ${messageId}, 이모지 ${emojiInput}, 역할 ${roleId}`);

        } catch (error) {
            console.error('[오류] 역할 메시지 설정 중 오류:', error);
            message.reply('역할 메시지를 설정하는 중 오류가 발생했습니다. ID와 권한을 확인해주세요.');
        }
    } 
    // '입장멘트' 명령어
    else if (command === '입장멘트') {
        // 관리자 권한 확인
        if (!message.member.permissions.has('Administrator')) {
            return message.reply('이 명령어를 사용하려면 관리자 권한이 필요합니다.');
        }

        const newTemplate = args.join(' ');
        if (!newTemplate) {
            return message.reply(
                `현재 입장 멘트: \`\`\`${guildSettings.welcomeMessageTemplate}\`\`\`\n` +
                `새로운 입장 멘트를 입력해주세요. 사용 가능한 플레이스홀더: \`{user}\`, \`{server}\`, \`{inviter}\`\n` +
                `예시: \`${PREFIX}입장멘트 🎉 {user}님, {server}에 오신 걸 환영해요! {inviter}\``
            );
        }
        guildSettings.welcomeMessageTemplate = newTemplate; // 현재 서버의 설정 업데이트
        saveBotSettings(); // 설정 저장
        message.reply(`입장 멘트가 성공적으로 다음으로 변경되었습니다: \`\`\`${newTemplate}\`\`\``);
        console.log(`[명령어] ${message.guild.name} 서버의 입장 멘트가 변경되었습니다.`);
    } 
    // '초대자기능' 명령어
    else if (command === '초대자기능') {
        // 관리자 권한 확인
        if (!message.member.permissions.has('Administrator')) {
            return message.reply('이 명령어를 사용하려면 관리자 권한이 필요합니다.');
        }
        
        guildSettings.inviterFeatureEnabled = !guildSettings.inviterFeatureEnabled; // 현재 서버의 상태 토글
        saveBotSettings(); // 설정 저장
        message.reply(`초대자 기능이 ${guildSettings.inviterFeatureEnabled ? '활성화' : '비활성화'} 되었습니다.`);
        console.log(`[명령어] ${message.guild.name} 서버의 초대자 기능이 ${guildSettings.inviterFeatureEnabled ? '활성화' : '비활성화'} 되었습니다.`);
    }
    // '입장로그채널' 명령어
    else if (command === '입장로그채널') {
        // 관리자 권한 확인
        if (!message.member.permissions.has('Administrator')) {
            return message.reply('이 명령어를 사용하려면 관리자 권한이 필요합니다.');
        }

        // 첫 번째 인수로 채널 멘션 또는 ID를 받음
        const channelInput = args[0]; 
        if (!channelInput) {
            // 현재 설정된 채널이 있다면 보여줌
            const currentChannelId = guildSettings.welcomeLogChannelId;
            let currentChannelInfo = '설정되지 않았습니다.';
            if (currentChannelId) {
                const fetchedChannel = client.channels.cache.get(currentChannelId);
                currentChannelInfo = fetchedChannel ? `<#${currentChannelId}> (${fetchedChannel.name})` : `알 수 없는 채널 ID: ${currentChannelId}`;
            }
            return message.reply(
                `현재 입장 로그 채널: ${currentChannelInfo}\n` +
                `입장 로그를 보낼 채널을 설정해주세요. 채널을 멘션(@채널명)하거나 ID를 입력하세요.\n` +
                `사용법: \`${PREFIX}입장로그채널 <#채널멘션 또는 채널ID>\``
            );
        }

        // 채널 멘션에서 ID 추출 또는 직접 입력된 ID 사용
        const channelIdMatch = channelInput.match(/^<#(\d+)>$/);
        const newChannelId = channelIdMatch ? channelIdMatch[1] : channelInput;

        try {
            const targetChannel = await client.channels.fetch(newChannelId);
            if (!targetChannel || targetChannel.type !== 0) { // 0은 TextChannel
                return message.reply('유효한 텍스트 채널을 멘션하거나 ID를 제공해주세요.');
            }

            guildSettings.welcomeLogChannelId = targetChannel.id; // 현재 서버의 설정 업데이트
            saveBotSettings(); // 설정 저장

            message.reply(`입장 로그가 이제 <#${targetChannel.id}> 채널로 전송됩니다.`);
            console.log(`[명령어] ${message.guild.name} 서버의 입장 로그 채널이 ${targetChannel.name} (${targetChannel.id}) 으로 설정되었습니다.`);

        } catch (error) {
            console.error('[오류] 입장 로그 채널 설정 중 오류:', error);
            message.reply('입장 로그 채널을 설정하는 중 오류가 발생했습니다. 권한 및 채널 ID를 확인해주세요.');
        }
    }
    // 'help' 명령어
    else if (command === 'help') {
        const helpEmbed = new EmbedBuilder()
            .setColor(0x0099FF) // 파란색
            .setTitle('봇 명령어 도움말')
            .setDescription(`사용 가능한 명령어 목록입니다. 접두사는 \`${PREFIX}\` 입니다.`)
            .addFields(
                { 
                    name: `${PREFIX}help`, 
                    value: '이 도움말 메시지를 표시합니다.', 
                    inline: false 
                },
                { 
                    name: `${PREFIX}역할메시지 <채널ID> <메시지ID> <이모지> <역할ID>`, 
                    value: '특정 메시지에 반응 역할을 설정합니다. 한 메시지에 여러 이모지-역할 쌍 설정 가능. (관리자 전용)', 
                    inline: false 
                },
                { 
                    name: `${PREFIX}입장멘트 [새로운 멘트]`, 
                    value: '새로운 멤버가 입장했을 때 표시될 멘트를 설정합니다.\n' +
                           '플레이스홀더: `{user}`, `{server}`, `{inviter}`\n' +
                           '인자 없이 사용 시 현재 멘트를 표시합니다. (관리자 전용)', 
                    inline: false 
                },
                { 
                    name: `${PREFIX}초대자기능`, 
                    value: '새로운 멤버 입장 시 초대자 감지 기능을 활성화/비활성화합니다. (관리자 전용)', 
                    inline: false 
                },
                { 
                    name: `${PREFIX}입장로그채널 <#채널멘션 또는 채널ID>`, 
                    value: '새로운 멤버 입장 로그를 보낼 채널을 설정합니다.\n' +
                           '인자 없이 사용 시 현재 설정된 채널을 표시합니다. (관리자 전용)', 
                    inline: false 
                }
            )
            .setTimestamp()
            .setFooter({ text: `${client.user.tag}`, iconURL: client.user.displayAvatarURL() });

        message.reply({ embeds: [helpEmbed] });
    }
});


// -------------------------------------------------------------------------
// 메시지 반응 추가 이벤트 (messageReactionAdd)
// 사용자가 메시지에 반응을 추가했을 때 실행되는 이벤트 (역할 부여)
// -------------------------------------------------------------------------
client.on('messageReactionAdd', async (reaction, user) => {
    // 봇 자신이 추가한 반응이거나 DM 채널인 경우 무시
    if (user.bot || !reaction.message.guild) return;

    const guildId = reaction.message.guild.id;
    const guildReactionRoles = getGuildReactionRoles(guildId); // 현재 서버의 반응 역할 정보 가져오기

    const reactionRolesForMessage = guildReactionRoles[reaction.message.id];

    if (!reactionRolesForMessage) {
        // 해당 메시지에 설정된 반응 역할이 없으면 처리할 필요 없음
        return;
    }

    // 반응 이모지 비교를 위한 값
    let reactedEmojiIdentifier;
    if (reaction.emoji.id) { // 커스텀 이모지인 경우 ID 사용
        reactedEmojiIdentifier = reaction.emoji.id;
    } else { // 유니코드 이모지인 경우 이름 사용
        reactedEmojiIdentifier = reaction.emoji.name;
    }

    // 설정된 반응 역할 중 현재 반응과 일치하는 것을 찾습니다.
    const matchedRoleInfo = reactionRolesForMessage.find(
        rr => rr.emoji === reactedEmojiIdentifier
    );

    if (matchedRoleInfo) {
        console.log(`[반응 감지] 반응 추가 감지! 서버: ${reaction.message.guild.name}, 메시지: ${reaction.message.id}, 이모지: ${reaction.emoji.name}, 유저: ${user.tag}`);

        const guild = reaction.message.guild;
        let member;
        try {
            member = await guild.members.fetch(user.id);
            console.log(`[반응 추가 감지] 멤버 정보 가져오기 성공: ${member.user.tag}`);
        } catch (error) {
            console.error('[오류] 멤버 정보 가져오기 실패:', error);
            return;
        }

        const role = guild.roles.cache.get(matchedRoleInfo.roleId);

        if (!role) {
            console.log(`[반응 추가 감지] 설정된 역할 (${matchedRoleInfo.roleId})을 찾을 수 없습니다.`);
            return;
        }
        console.log(`[반응 추가 감지] 대상 역할: ${role.name} (${role.id})`);

        if (!member.roles.cache.has(role.id)) {
            console.log(`[반응 추가 감지] ${member.user.tag} 에게 '${role.name}' 역할 부여 시도...`);
            try {
                await member.roles.add(role);
                console.log(`[반응 추가 감지] ${member.user.tag} 에게 '${role.name}' 역할 부여 성공!`);
            } catch (error) {
                console.error(`[오류] ${member.user.tag} 에게 '${role.name}' 역할 부여 중 오류:`, error);
            }
        } else {
             console.log(`[반응 추가 감지] ${member.user.tag} 은(는) 이미 '${role.name}' 역할을 가지고 있습니다.`);
        }
    }
});


// -------------------------------------------------------------------------
// 메시지 반응 제거 이벤트 (messageReactionRemove)
// 사용자가 메시지에서 반응을 제거했을 때 실행되는 이벤트 (역할 회수)
// -------------------------------------------------------------------------
client.on('messageReactionRemove', async (reaction, user) => {
    // 봇 자신이 제거한 반응이거나 DM 채널인 경우 무시
    if (user.bot || !reaction.message.guild) return;

    const guildId = reaction.message.guild.id;
    const guildReactionRoles = getGuildReactionRoles(guildId); // 현재 서버의 반응 역할 정보 가져오기

    const reactionRolesForMessage = guildReactionRoles[reaction.message.id];

    if (!reactionRolesForMessage) {
        // 해당 메시지에 설정된 반응 역할이 없으면 처리할 필요 없음
        return;
    }

    // 반응 이모지 비교를 위한 값
    let reactedEmojiIdentifier;
    if (reaction.emoji.id) { // 커스텀 이모지인 경우 ID 사용
        reactedEmojiIdentifier = reaction.emoji.id;
    } else { // 유니코드 이모지인 경우 이름 사용
        reactedEmojiIdentifier = reaction.emoji.name;
    }

    // 설정된 반응 역할 중 현재 반응과 일치하는 것을 찾습니다.
    const matchedRoleInfo = reactionRolesForMessage.find(
        rr => rr.emoji === reactedEmojiIdentifier
    );

    if (matchedRoleInfo) {
        console.log(`[반응 제거 감지] 반응 제거 감지! 서버: ${reaction.message.guild.name}, 메시지: ${reaction.message.id}, 이모지: ${reaction.emoji.name}, 유저: ${user.tag}`);

        const guild = reaction.message.guild;
        let member;
        try {
            member = await guild.members.fetch(user.id);
            console.log(`[반응 제거 감지] 멤버 정보 가져오기 성공: ${member.user.tag}`);
        } catch (error) {
            console.error('[오류] 멤버 정보 가져오기 실패:', error);
            return;
        }

        const role = guild.roles.cache.get(matchedRoleInfo.roleId);

        if (!role) {
            console.log(`[반응 제거 감지] 설정된 역할 (${matchedRoleInfo.roleId})을 찾을 수 없습니다.`);
            return;
        }
        console.log(`[반응 제거 감지] 대상 역할: ${role.name} (${role.id})`);

        if (member.roles.cache.has(role.id)) {
            console.log(`[반응 제거 감지] ${member.user.tag} 에게 '${role.name}' 역할 제거 시도...`);
            try {
                await member.roles.remove(role);
                console.log(`[반응 제거 감지] ${member.user.tag} 에게 '${role.name}' 역할 제거 성공!`);
            } catch (error) {
                console.error(`[오류] ${member.user.name} 에게 '${role.name}' 역할 제거 중 오류:`, error);
            }
        } else {
             console.log(`[반응 제거 감지] ${member.user.tag} 은(는) 이미 '${role.name}' 역할을 가지고 있지 않습니다.`);
        }
    }
});


// -------------------------------------------------------------------------
// 봇 로그인
// -------------------------------------------------------------------------
client.login(TOKEN);