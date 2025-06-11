// index.js

// .env 파일에서 환경 변수를 로드합니다. 이 코드는 파일 최상단에 위치해야 합니다.
require('dotenv').config();

// Winston 로거 모듈을 불러옵니다.
const logger = require('./logger'); // <-- 이 줄을 추가합니다.
// 파일 시스템 모듈을 불러옵니다.
const fs = require('fs');
// 경로 모듈을 불러옵니다.
const path = require('path');

// discord.js 라이브러리에서 필요한 클래스들을 불러옵니다.
const { Client, IntentsBitField, Partials, EmbedBuilder, PermissionsBitField } = require('discord.js');

// Discord 클라이언트(봇)를 생성하고 봇이 어떤 이벤트(정보)를 받을지 '인텐트'를 설정합니다.
const client = new Client({
    intents: [
        IntentsBitField.Flags.Guilds,
        IntentsBitField.Flags.GuildMessages,
        IntentsBitField.Flags.GuildMessageReactions,
        IntentsBitField.Flags.MessageContent,
        IntentsBitField.Flags.GuildMembers,
        IntentsBitField.Flags.GuildPresences,
        IntentsBitField.Flags.GuildInvites, // 초대 정보 (입장 로그에 초대자 표시 시 필요)
    ],
    partials: [Partials.Message, Partials.Channel, Partials.Reaction, Partials.GuildMember],
});

// .env 파일에서 봇 토큰을 가져옵니다.
const TOKEN = process.env.DISCORD_BOT_TOKEN;
// 봇 명령어의 접두사 (예: !역할메시지)
const PREFIX = '!';

// 데이터 파일 경로 설정
const REACTION_ROLES_FILE = path.join(__dirname, 'reactionRoles.json');
const SETTINGS_FILE = path.join(__dirname, 'settings.json');
const INVITE_TRACKER_FILE = path.join(__dirname, 'inviteTracker.json');

// 전역 변수
let reactionRoles = {};
let settings = {};
let inviteTracker = {};


// 파일에서 반응 역할 정보를 로드하는 함수
function loadReactionRoles() {
    if (fs.existsSync(REACTION_ROLES_FILE)) {
        try {
            const data = fs.readFileSync(REACTION_ROLES_FILE, 'utf8');
            reactionRoles = JSON.parse(data);
            logger.info('[파일 로드] reactionRoles.json 로드 성공.');
        } catch (error) {
            logger.error('[오류] reactionRoles 정보 로드 중 오류:', error);
            reactionRoles = {};
        }
    } else {
        reactionRoles = {};
        logger.warn('[파일 로드] reactionRoles.json 파일이 없어 빈 객체로 초기화합니다.');
    }
}

// 파일에 반응 역할 정보를 저장하는 함수
function saveReactionRoles() {
    try {
        fs.writeFileSync(REACTION_ROLES_FILE, JSON.stringify(reactionRoles, null, 4), 'utf8');
        logger.info('[파일 저장] reactionRoles.json 저장 성공.');
    } catch (error) {
        logger.error('[오류] reactionRoles 정보 저장 중 오류:', error);
    }
}

// 파일에서 설정 정보를 로드하는 함수
function loadSettings() {
    if (fs.existsSync(SETTINGS_FILE)) {
        try {
            const data = fs.readFileSync(SETTINGS_FILE, 'utf8');
            settings = JSON.parse(data);
            logger.info('[파일 로드] settings.json 로드 성공.');
        } catch (error) {
            logger.error('[오류] settings 정보 로드 중 오류:', error);
            settings = {};
        }
    } else {
        settings = {};
        logger.warn('[파일 로드] settings.json 파일이 없어 빈 객체로 초기화합니다.');
    }
}

// 파일에 설정 정보를 저장하는 함수
function saveSettings() {
    try {
        fs.writeFileSync(SETTINGS_FILE, JSON.stringify(settings, null, 4), 'utf8');
        logger.info('[파일 저장] settings.json 저장 성공.');
    } catch (error) {
        logger.error('[오류] settings 정보 저장 중 오류:', error);
    }
}

// 파일에서 초대 추적 정보를 로드하는 함수
function loadInviteTracker() {
    if (fs.existsSync(INVITE_TRACKER_FILE)) {
        try {
            const data = fs.readFileSync(INVITE_TRACKER_FILE, 'utf8');
            inviteTracker = JSON.parse(data);
            logger.info('[파일 로드] inviteTracker.json 로드 성공.');
        } catch (error) {
            logger.error('[오류] inviteTracker 정보 로드 중 오류:', error);
            inviteTracker = {};
        }
    } else {
        inviteTracker = {};
        logger.warn('[파일 로드] inviteTracker.json 파일이 없어 빈 객체로 초기화합니다.');
    }
}

// 파일에 초대 추적 정보를 저장하는 함수
function saveInviteTracker() {
    try {
        fs.writeFileSync(INVITE_TRACKER_FILE, JSON.stringify(inviteTracker, null, 4), 'utf8');
        logger.info('[파일 저장] inviteTracker.json 저장 성공.');
    } catch (error) {
        logger.error('[오류] inviteTracker 정보 저장 중 오류:', error);
    }
}

// 봇이 잠시 동안 반응 제거 이벤트를 무시할 수 있도록 하는 플래그
client.ignoringReactionRemoves = new Set();

// 봇이 Discord에 성공적으로 로그인하고 준비되었을 때 실행되는 이벤트
client.on('ready', async () => {
    logger.info(`[봇 준비] Logged in as ${client.user.tag}!`);
    logger.info('[봇 준비] 봇이 성공적으로 준비되었습니다!');

    // 봇 시작 시 저장된 데이터 로드
    loadReactionRoles();
    loadSettings();
    loadInviteTracker();

    // 모든 길드의 초대 정보를 캐시 (입장 로그에 필요)
    for (const guild of client.guilds.cache.values()) {
        try {
            const invites = await guild.invites.fetch();
            inviteTracker[guild.id] = {};
            invites.forEach(invite => {
                inviteTracker[guild.id][invite.code] = {
                    uses: invite.uses,
                    inviterId: invite.inviter ? invite.inviter.id : null
                };
            });
            logger.info(`[초대 추적] ${guild.name} 서버의 초대 정보 캐시 성공.`);
            saveInviteTracker(); // 초기 캐시된 정보 저장
        } catch (error) {
            logger.error(`[오류] ${guild.name} 서버의 초대 정보를 가져오는 데 실패했습니다 (권한 부족?):`, error);
        }
    }
});

// 새로운 초대 생성 시 초대 추적 정보 업데이트
client.on('inviteCreate', invite => {
    if (!invite.guild) return;

    if (!inviteTracker[invite.guild.id]) {
        inviteTracker[invite.guild.id] = {};
    }
    inviteTracker[invite.guild.id][invite.code] = {
        uses: invite.uses,
        inviterId: invite.inviter ? invite.inviter.id : null
    };
    saveInviteTracker();
    logger.info(`[초대 추적] 새 초대 생성: ${invite.code} (서버: ${invite.guild.name})`);
});

// 초대 삭제 시 초대 추적 정보 업데이트
client.on('inviteDelete', invite => {
    if (!invite.guild || !inviteTracker[invite.guild.id]) return;

    if (inviteTracker[invite.guild.id][invite.code]) {
        delete inviteTracker[invite.guild.id][invite.code];
        saveInviteTracker();
        logger.info(`[초대 추적] 초대 삭제: ${invite.code} (서버: ${invite.guild.name})`);
    }
});

// 멤버가 서버에 입장했을 때 실행되는 이벤트
client.on('guildMemberAdd', async member => {
    const guild = member.guild;
    const guildSettings = settings[guild.id] || {}; // 설정이 없을 경우 빈 객체로 초기화

    // 환영 메시지 기능이 비활성화되어 있거나 로그 채널이 설정되지 않았으면 리턴
    if (!guildSettings.welcomeMessageEnabled || !guildSettings.logChannelId) {
        logger.warn(`[입장 로그] ${guild.name} 서버의 입장 로그 설정이 없거나 비활성화되어 있습니다.`);
        return;
    }

    const logChannel = guild.channels.cache.get(guildSettings.logChannelId);
    if (!logChannel || logChannel.type !== 0) {
        logger.warn(`[입장 로그] ${guild.name} 서버의 **로그 채널** (**${guildSettings.logChannelId}**)을 찾을 수 없거나 **텍스트 채널이 아닙니다**.`);
        return;
    }

    let inviterTag = '**알 수 없음**';
    let inviterMention = '**알 수 없음**';

    if (guildSettings.inviteTrackingEnabled) {
        try {
            const newInvites = await guild.invites.fetch();
            const oldInvites = inviteTracker[guild.id] || {};
            let foundInviter = null;

            for (const [code, newInvite] of newInvites) {
                const oldInvite = oldInvites[code];
                if (oldInvite && newInvite.uses > oldInvite.uses) {
                    foundInviter = newInvite.inviter;
                    break;
                }
            }

            // 초대 추적 정보 업데이트
            inviteTracker[guild.id] = {};
            newInvites.forEach(invite => {
                inviteTracker[guild.id][invite.code] = {
                    uses: invite.uses,
                    inviterId: invite.inviter ? invite.inviter.id : null
                };
            });
            saveInviteTracker();

            if (foundInviter) {
                // 유저네임(display name) 우선, 없으면 globalName, 그것도 없으면 tag 사용
                inviterTag = `**${foundInviter.username || foundInviter.globalName || foundInviter.tag}**`; 
                inviterMention = `**<@${foundInviter.id}>**`; 
            } else {
                inviterTag = '**초대자를 찾을 수 없음**';
                inviterMention = '**초대자를 찾을 수 없음**';
            }

        } catch (error) {
            logger.error('[오류] 초대 추적 중 오류:', error);
            inviterTag = '**초대 정보를 가져올 수 없음**';
            inviterMention = '**초대 정보를 가져올 수 없음**';
        }
    }

    const welcomeEmbed = new EmbedBuilder()
        .setColor(0xBF8EEF) // 푸터 색상을 연보라색 (bf8eef)으로 변경 요청 반영
        .setThumbnail(member.user.displayAvatarURL({ dynamic: true }))

    // '유저' 정보는 항상 필드로 추가 (가장 위로 이동)
    welcomeEmbed.addFields(
        { name: '**유저**', value: `**<@${member.user.id}>** (**${member.user.username || member.user.globalName || member.user.tag}**)`, inline: false } // @유저 (유저) 형식
    );

    // 1. '몇 번째 멤버' 기능 활성화 여부에 따른 타이틀 및 설명 설정
    if (guildSettings.memberCountInTitle) {
        welcomeEmbed.setTitle(`**${guild.memberCount}번째 멤버가 입장했어요**`);
        // 몇 번째 멤버일 경우, description은 비워둡니다 (유저 정보는 이미 필드로 들어갔음).
        welcomeEmbed.setDescription(null); 
    } else if (guildSettings.welcomeMessageContent) {
        // 커스텀 입장 멘트가 있을 경우 (몇 번째 멤버 기능 비활성화 시)
        const customWelcomeText = guildSettings.welcomeMessageContent
            .replace(/{user}/g, `**<@${member.user.id}>**`) // 볼드체 적용
            .replace(/{tag}/g, `**${member.user.tag}**`);   // 볼드체 적용
        
        // 커스텀 멘트일 때 제목은 기본으로, 멘트는 description에
        welcomeEmbed.setTitle(`**${customWelcomeText}**`); // customWelcomeText 전체를 볼드체
        welcomeEmbed.setDescription(null); 

    } else {
        // 기본 멘트 (초기 상태 또는 오류 시)
        welcomeEmbed.setTitle('**새로운 멤버가 입장했어요!**');
        // 기본 멘트일 경우 description 비움 (유저 정보는 필드로 들어갔음)
        welcomeEmbed.setDescription(null); 
    }

    // 서버에 입장한 시간과 계정 생성일 추가 (유저 정보 필드 뒤에 이어 붙임)
    welcomeEmbed.addFields(
        { 
            name: '**서버에 입장한 시간**', 
            value: `**<t:${Math.floor(member.joinedTimestamp / 1000)}:f>** (**<t:${Math.floor(member.joinedTimestamp / 1000)}:R>**)`, 
            inline: false
        },
        { 
            name: '**계정 생성일**', 
            value: `**<t:${Math.floor(member.user.createdTimestamp / 1000)}:f>** (**<t:${Math.floor(member.user.createdTimestamp / 1000)}:R>**)`, 
            inline: false
        }
    );

    // 초대자 기능 활성화 시에만 초대자 섹션 추가
    if (guildSettings.inviteTrackingEnabled) {
        welcomeEmbed.addFields(
            { name: '**초대자**', value: `${inviterMention} (${inviterTag})`, inline: false } // @유저 (유저) 형식
        );
    }

    try {
        await logChannel.send({ embeds: [welcomeEmbed] });
        logger.info(`[입장 로그] **${member.user.tag}** 님의 입장 메시지를 **${logChannel.name}** 에 전송했습니다.`);
    } catch (error) {
        logger.error(`[오류] 입장 메시지 전송 실패 (**채널**: ${logChannel.name}):`, error);
    }
});


// 새로운 메시지가 생성되었을 때 실행되는 이벤트
client.on('messageCreate', async message => {
    // 봇 자신이 보낸 메시지는 무시하여 무한 루프를 방지합니다.
    if (message.author.bot) return;

    // 서버(길드) 메시지가 아니면 무시
    if (!message.guild) {
        return message.reply('이 명령어는 서버(길드) 채널에서만 사용할 수 있습니다.');
    }

     // ===> !!! guild 변수 정의 추가 !!! <===
    const guild = message.guild; 
    // ===> !!! 여기까지 !!! <===

    // 메시지가 설정된 접두사로 시작하는지 확인합니다.
    const prefix = settings[guild.id]?.prefix || '!'; 
    if (!message.content.startsWith(PREFIX)) return;

    const guildId = message.guild.id;

    // 명령어와 인수를 분리 (큰따옴표 안의 공백도 하나의 인수로 처리)
    const args = message.content.slice(PREFIX.length).trim().match(/(?:[^\s"]+|"[^"]*")+/g) || [];
    const command = args.shift().toLowerCase();

    // ===> !!! hasAdminPermission 함수 정의 위치 변경 !!! <===
    // 모든 명령어 블록이 이 함수를 사용하기 전에 정의되어야 합니다.
    const hasAdminPermission = (member) => {
        return member.permissions.has(PermissionsBitField.Flags.Administrator);
    };
    // ===> !!! 여기까지 !!! <===

    // !역할메시지 명령어
    if (command === '역할메시지') {
        if (!message.member.permissions.has('Administrator')) {
            logger.warn(`[명령어] ${message.author.tag} (ID: ${message.author.id})이(가) 관리자 권한 없이 '!역할메시지' 사용 시도.`);
            return message.reply('이 명령어를 사용하려면 관리자 권한이 필요합니다.');
        }

        const parsedArgs = args.map(arg => arg.replace(/^"|"$/g, ''));
        const channelId = parsedArgs[0];
        const emojiInput = parsedArgs[1];
        const roleIdentifier = parsedArgs[2];

        if (parsedArgs.length < 3) {
            return message.reply(
                '❌ 사용법: `!역할메시지 <채널ID> <이모지> <역할ID 또는 역할이름 또는 @역할멘션>`\n' +
                '예시: `!역할메시지 #규칙 👍 123456789012345678`\n' +
                '예시: `!역할메시지 123456789012345678 🧡 구독자`\n' +
                '예시: `!역할메시지 #공지사항 ✅ @관리자`'
            );
        }

        try {
            const channel = await client.channels.fetch(channelId).catch(() => null);
            if (!channel || channel.type !== 0) {
                return message.reply('❌ 유효한 텍스트 채널 ID를 제공해주세요.');
            }

            let role = null;
            const roleMentionMatch = roleIdentifier.match(/^<@&(\d+)>$/);

            if (roleMentionMatch) {
                const mentionedRoleId = roleMentionMatch[1];
                role = message.guild.roles.cache.get(mentionedRoleId);
            } else {
                role = message.guild.roles.cache.get(roleIdentifier);
                if (!role) {
                    role = message.guild.roles.cache.find(r => r.name === roleIdentifier);
                }
            }
            
            if (!role) {
                return message.reply(`❌ 유효한 역할 ID, 역할 이름, 또는 @역할멘션 ('${roleIdentifier}')을 찾을 수 없습니다.`);
            }

            if (message.guild.members.me.roles.highest.position <= role.position) {
                logger.warn(`[명령어] 봇 역할(<span class="math-inline">\{message\.guild\.members\.me\.roles\.highest\.name\}\)이 '</span>{role.name}' 역할보다 낮거나 같아서 역할 부여 실패.`); // <--- 이 줄 추가
                return message.reply(`❌ 봇의 역할이 '${role.name}' 역할보다 낮거나 같아 해당 역할을 부여할 수 없습니다.\n` +
                                     `봇 역할의 순서를 '${role.name}' 역할보다 위로 옮겨주세요.`);
            }

            let reactionEmoji;
            const customEmojiMatch = emojiInput.match(/<a?:(\w+):(\d+)>/);
            if (customEmojiMatch) {
                reactionEmoji = customEmojiMatch[2];
            } else {
                reactionEmoji = emojiInput;
            }

            const roleEmbed = new EmbedBuilder()
                .setColor(0xBF8EEF) // 푸터 색상을 연보라색 (bf8eef)으로 변경 요청 반영 (기존 FFA7D1에서 변경)
                .setTitle('💜 꼭 읽어줘! 💜')
                .setDescription(
                    `❌ 시청자들 간에 과한 친목성 발언, 말다툼\n` +
                    `❌ 타 스트리머 언급\n` +
                    `❌ 도배, 욕설, 성희롱, 성드립 등 불쾌감을 주는 채팅\n` +
                    `❌ 정치, 종교, 인종 등 사회적이슈 언급\n` +
                    `❌ 광고 및 개인SNS 홍보\n\n` +
                    `(아래에 있는 반응 선택시 역할이 지급됩니다.)`
                )

            const sentMessage = await channel.send({ embeds: [roleEmbed] });
            await sentMessage.react(reactionEmoji);

            if (!reactionRoles[guildId]) {
                reactionRoles[guildId] = {};
            }
            if (!reactionRoles[guildId][sentMessage.id]) {
                reactionRoles[guildId][sentMessage.id] = [];
            }
            reactionRoles[guildId][sentMessage.id].push({
                emoji: reactionEmoji,
                roleId: role.id
            });
            saveReactionRoles();

            message.reply(`✅ 새로운 반응 역할 메시지가 <#${channel.id}> 채널에 성공적으로 생성되었습니다.`);
            logger.info(`[명령어] ${message.guild.name} 서버에 새 역할 메시지 생성: 채널 ${channelId}, 메시지 ${sentMessage.id}, 이모지 ${emojiInput}, 역할 ${role.id}`);

        } catch (error) {
            logger.error('[오류] 역할 메시지 설정 중 오류:', error);
            message.reply('❌ 역할 메시지를 설정하는 중 오류가 발생했습니다. ID와 권한을 확인해주세요.');
        }
    }

    // --- 여기에 !설정상태 명령어 코드 추가 ---
    // 아래 코드를 이전 답변에서 제공해 드린 !설정상태 명령어 코드로 완전히 대체하세요.
    // 즉, 아래 if (command === '설정상태') { ... } 블록 전체를 복사해서 붙여넣으세요.
    if (command === '설정상태') {
        if (!hasAdminPermission(message.member)) {
            return message.reply('**이 명령어를 사용하려면 관리자 권한이 필요합니다.**');
        }

        const guildSettings = settings[guild.id] || {};

        const welcomeMessageEnabledStatus = guildSettings.welcomeMessageEnabled ? '**활성화됨**' : '**비활성화됨**';
        const logChannelIdStatus = guildSettings.logChannelId ? `<#${guildSettings.logChannelId}> (**설정됨**)` : '**설정되지 않음**';
        const inviteTrackingEnabledStatus = guildSettings.inviteTrackingEnabled ? '**활성화됨**' : '**비활성화됨**';
        
        let welcomeMessageContentStatus;
        if (guildSettings.welcomeMessageContent && guildSettings.welcomeMessageContent !== '새로운 멤버가 입장했어요!') {
            welcomeMessageContentStatus = `**수정됨** (\`${guildSettings.welcomeMessageContent}\`)`;
        } else {
            welcomeMessageContentStatus = '**기본값**';
        }

        const memberCountInTitleStatus = guildSettings.memberCountInTitle ? '**활성화됨**' : '**비활성화됨**';

        const statusEmbed = new EmbedBuilder()
            .setColor(0xBF8EEF)
            .setTitle(`**${message.guild.name} 서버의 봇 설정 상태**`) // guild.name 대신 message.guild.name 사용
            .addFields(
                { name: '**입장 로그 활성화**', value: welcomeMessageEnabledStatus, inline: true },
                { name: '**로그 채널**', value: logChannelIdStatus, inline: false },
                { name: '\u200B', value: '\u200B', inline: true },
                { name: '**초대자 기능 활성화**', value: inviteTrackingEnabledStatus, inline: false },
                { name: '**입장 멘트**', value: welcomeMessageContentStatus, inline: false },
                { name: '\u200B', value: '\u200B', inline: false },
                { name: '**\'몇 번째 멤버\' 기능**', value: memberCountInTitleStatus, inline: false }
            )

        await message.channel.send({ embeds: [statusEmbed] });
        logger.info(`[설정 상태] ${message.author.tag} 님이 ${message.guild.name} 서버의 설정 상태를 확인했습니다.`); // guild.name 대신 message.guild.name 사용
    }

    // 이 아래에 다른 기존 명령어 처리 if 문들이 있을 수 있습니다.
    // ...

    // !입장로그 활성화/비활성화
    else if (command === '입장로그') {
        if (!message.member.permissions.has('Administrator')) {
            return message.reply('이 명령어를 사용하려면 관리자 권한이 필요합니다.');
        }

        const parsedArgs = args.map(arg => arg.replace(/^"|"$/g, ''));
        if (parsedArgs.length < 1) {
            return message.reply('❌ 사용법: `!입장로그 <활성화/비활성화>`');
        }

        const action = parsedArgs[0].toLowerCase();
        if (action === '활성화' || action === 'on') {
            if (!settings[guildId]) settings[guildId] = {};
            settings[guildId].welcomeMessageEnabled = true;
            saveSettings();
            message.reply('✅ 입장로그가 활성화되었습니다. 이제부터 새 멤버가 입장하면 로그 채널에 메시지를 보냅니다.');
        } else if (action === '비활성화' || action === 'off') {
            if (!settings[guildId]) settings[guildId] = {};
            settings[guildId].welcomeMessageEnabled = false;
            saveSettings();
            message.reply('✅ 입장로그가 비활성화되었습니다.');
        } else {
            return message.reply('❌ 유효한 옵션이 아닙니다. `활성화` 또는 `비활성화`를 사용해주세요.');
        }
    }
    // !입장로그수정 <새 멘트> 명령어
    else if (command === '입장로그수정') {
        if (!message.member.permissions.has('Administrator')) {
            return message.reply('이 명령어를 사용하려면 관리자 권한이 필요합니다.');
        }

        const newContent = args.join(' ').trim();
        if (newContent.length === 0) {
            return message.reply('❌ 사용법: `!입장로그수정 <새로운 입장 멘트 또는 몇번째>`\n' +
                                 '`{user}`는 멤버 멘션, `{tag}`는 멤버 태그로 대체됩니다.\n' +
                                 '`몇번째`를 입력하면 몇 번째 멤버 기능이 활성화됩니다.');
        }

        if (!settings[guildId]) settings[guildId] = {};
        
        if (newContent.toLowerCase() === '몇번째') {
            settings[guildId].memberCountInTitle = true;
            settings[guildId].welcomeMessageContent = null;
            message.reply('✅ 입장로그 제목이 `N번째 멤버가 입장했어요`로 표시됩니다.');
        } else {
            settings[guildId].memberCountInTitle = false;
            settings[guildId].welcomeMessageContent = newContent;
            message.reply(`✅ 입장로그가 다음과 같이 수정되었습니다:\n\`\`\`${newContent}\`\`\`\n`);
        }
        saveSettings();
    }
    // !초대자기능 활성화/비활성화
    else if (command === '초대자기능') {
        if (!message.member.permissions.has('Administrator')) {
            return message.reply('이 명령어를 사용하려면 관리자 권한이 필요합니다.');
        }

        const parsedArgs = args.map(arg => arg.replace(/^"|"$/g, ''));
        if (parsedArgs.length < 1) {
            return message.reply('❌ 사용법: `!초대자기능 <활성화/비활성화>`');
        }

        const action = parsedArgs[0].toLowerCase();
        if (action === '활성화' || action === 'on') {
            if (!settings[guildId]) settings[guildId] = {};
            settings[guildId].inviteTrackingEnabled = true;
            saveSettings();
            message.reply('✅ 초대자 추적 기능이 활성화되었습니다. 이제부터 멤버 입장 시 초대자 정보가 표시됩니다.');

            try {
                const invites = await message.guild.invites.fetch();
                inviteTracker[guildId] = {};
                invites.forEach(invite => {
                    inviteTracker[guildId][invite.code] = {
                        uses: invite.uses,
                        inviterId: invite.inviter ? invite.inviter.id : null
                    };
                });
                saveInviteTracker();
                message.channel.send('🌐 기존 서버 초대 정보가 성공적으로 갱신되었습니다.');
            } catch (error) {
                logger.error('[오류] 초대자 추적 활성화 시 초대 정보 갱신 실패:', error);
                message.reply('❌ 초대자 추적 기능 활성화 시 초대 정보 갱신에 실패했습니다. 봇에게 `초대 보기` 권한이 있는지 확인해주세요.');
            }

        } else if (action === '비활성화' || action === 'off') {
            if (!settings[guildId]) settings[guildId] = {};
            settings[guildId].inviteTrackingEnabled = false;
            saveSettings();
            message.reply('✅ 초대자 추적 기능이 비활성화되었습니다. 입장 로그에 초대자 정보가 표시되지 않습니다.');
        } else {
            return message.reply('❌ 유효한 옵션이 아닙니다. `활성화` 또는 `비활성화`를 사용해주세요.');
        }
    }
    // !입장로그채널 설정
    else if (command === '입장로그채널') {
        if (!message.member.permissions.has('Administrator')) {
            return message.reply('이 명령어를 사용하려면 관리자 권한이 필요합니다.');
        }

        const parsedArgs = args.map(arg => arg.replace(/<#|>/g, ''));
        if (parsedArgs.length < 1 || !parsedArgs[0]) {
             return message.reply('❌ 사용법: `!입장로그채널 <채널ID 또는 #채널멘션>`');
        }

        const channelId = parsedArgs[0];
        const channel = await client.channels.fetch(channelId).catch(() => null);

        if (!channel || channel.type !== 0) {
            return message.reply('❌ 유효한 텍스트 채널을 지정해주세요.');
        }

        if (!settings[guildId]) settings[guildId] = {};
        settings[guildId].logChannelId = channel.id;
        saveSettings();
        message.reply(`✅ 입장로그 채널이 <#${channel.id}> (으)로 설정되었습니다.`);
    }
    // !help 명령어
     else if (command === 'help' || command === '도움말') { // else if 로 시작하는 부분
        const helpEmbed = new EmbedBuilder()
            .setColor(0xBF8EEF) // 푸터 색상을 연보라색 (bf8eef)으로 변경 요청 반영
            .setTitle('**봇 명령어 도움말**') // 볼드체 추가
            .setDescription('**안녕하세요! 저는 갈래의 보금자리 지킴이 입니다**') // 볼드체 추가
            .addFields(
                {
                    name: '**💜 반응 역할 명령어**', // 볼드체 추가
                    value: '`!역할메시지 <채널ID> <이모지> <역할ID 또는 역할이름 또는 @역할멘션>`\n' +
                           '  └ **새로운 임베드 메시지를 생성하고, 지정된 이모지에 반응하면 역할을 부여합니다.**\n' + // 볼드체 추가
                           '  └ **예:** `!역할메시지 #규칙 👍 123456789012345678`\n' + // 볼드체 추가
                           '  └ **예:** `!역할메시지 123456789012345678 🧡 구독자`\n' + // 볼드체 추가
                           '  └ **예:** `!역할메시지 #공지사항 ✅ @관리자`' // 볼드체 추가
                },
                {
                    name: '**📝 입장 로그/멘트 명령어**', // 볼드체 추가
                    value: '`!입장로그 <활성화/비활성화>`\n' +
                           '  └ **새 멤버 입장 시 입장 멘트를 보낼지 설정합니다. (로그 기능 전체 활성화/비활성화)**\n' + // 볼드체 추가
                           '`!입장로그수정 <새로운 멘트 또는 몇번째>`\n' +
                           '  └ **새 멤버 입장 시 보낼 멘트를 설정합니다.**\n' + // 볼드체 추가
                           '  └ `"{user}"`**는 멤버 멘션,** `"{tag}"`**는 멤버 태그로 대체됩니다.**\n' + // 볼드체 추가
                           '  └ `몇번째`**를 입력하면 `N번째 멤버가 입장했어요` 형태로 표시됩니다.**\n' + // 볼드체 추가
                           '`!초대자기능 <활성화/비활성화>`\n' +
                           '  └ **새 멤버 입장 시 초대자 정보를 표시할지 설정합니다.**\n' + // 볼드체 추가
                           '  └ **봇에게 `초대 보기` 권한이 필요합니다.**\n' + // 볼드체 추가
                           '`!입장로그채널 <채널ID 또는 #채널멘션>`\n' +
                           '  └ **입장로그가 전송될 채널을 설정합니다.**' // 볼드체 추가
                },
                {
                    name: '**📊 봇 설정 상태 확인**', // 새로운 필드 이름 (볼드체 추가)
                    value: '`!설정상태`\n' +
                           '  └ **현재 서버의 봇 설정 상태(입장로그, 초대자 기능, 입장 멘트 등)를 확인합니다.**', // 볼드체 추가
                    inline: false // 단독 줄로 표시
                },
                {
                    name: '**ℹ️ 기타**', // 볼드체 추가
                    value: '`!help` **또는** `!도움말`\n  └ **이 도움말을 표시합니다.**'
//                            ^ `!도움말` 부분을 백틱으로 감싸주세요.
                }
            );

        message.channel.send({ embeds: [helpEmbed] });
    }
    else {
        logger.info(`[메시지 감지] 알 수 없는 명령어: ${command}`);
    }
});

// 사용자가 메시지에 반응을 추가했을 때 실행되는 이벤트
client.on('messageReactionAdd', async (reaction, user) => {
    if (user.bot) return;

    if (reaction.partial) {
        try {
            await reaction.fetch();
        } catch (error) {
            logger.error('[오류] 반응 부분 로드 중 오류:', error);
            return;
        }
    }

    const { message, emoji } = reaction;
    const guildId = message.guild.id;

    const guildReactionRoles = reactionRoles[guildId];

    if (guildReactionRoles && guildReactionRoles[message.id]) {
        const reactionRoleEntries = guildReactionRoles[message.id];

        for (const entry of reactionRoleEntries) {
            let isMatch = false;
            if (emoji.id) {
                isMatch = entry.emoji === emoji.id;
            } else {
                isMatch = entry.emoji === emoji.name;
            }

            if (isMatch) {
                const guild = message.guild;
                let member;
                try {
                    member = await guild.members.fetch(user.id);
                } catch (error) {
                    logger.error('[오류] 멤버 정보 가져오기 실패:', error);
                    return;
                }

                const role = guild.roles.cache.get(entry.roleId);

                if (!role) {
                    logger.info(`[반응 추가 감지] 설정된 역할 (${entry.roleId})을 찾을 수 없습니다.`);
                    return;
                }

                if (!member.roles.cache.has(role.id)) {
                    try {
                        await member.roles.add(role);
                        logger.info(`[반응 추가 감지] ${member.user.tag} 에게 '${role.name}' 역할 부여 성공!`);
                    } catch (error) {
                        logger.error(`[오류] ${member.user.tag} 에게 '${role.name}' 역할 부여 중 오류:`, error);
                    }
                } else {
                    logger.info(`[반응 추가 감지] ${member.user.tag} 은(는) 이미 '${role.name}' 역할을 가지고 있습니다.`);
                }

                try {
                    const uniqueId = message.id + user.id + emoji.name + (emoji.id || '');
                    client.ignoringReactionRemoves.add(uniqueId);
                    await reaction.users.remove(user.id);
                    setTimeout(() => {
                        client.ignoringReactionRemoves.delete(uniqueId);
                    }, 1000);
                } catch (error) {
                    logger.error(`[오류] ${member.user.tag} 의 반응 제거 중 오류:`, error);
                }
            }
        }
    }
});


// 사용자가 메시지 반응을 제거했을 때 실행되는 이벤트
client.on('messageReactionRemove', async (reaction, user) => {
    const uniqueId = reaction.message.id + user.id + reaction.emoji.name + (reaction.emoji.id || '');
    if (client.ignoringReactionRemoves.has(uniqueId)) {
        logger.info(`[반응 제거 감지] 봇에 의해 제거된 반응(${uniqueId})이므로 역할 제거를 건너뜁니다.`);
        return;
    }

    if (user.bot) return;

    if (reaction.partial) {
        try {
            await reaction.fetch();
        } catch (error) {
            logger.error('[오류] 반응 부분 로드 중 오류:', error);
            return;
        }
    }

    const { message, emoji } = reaction;
    const guildId = message.guild.id;

    const guildReactionRoles = reactionRoles[guildId];

    if (guildReactionRoles && guildReactionRoles[message.id]) {
        const reactionRoleEntries = guildReactionRoles[message.id];

        for (const entry of reactionRoleEntries) {
            let isMatch = false;
            if (emoji.id) {
                isMatch = entry.emoji === emoji.id;
            } else {
                isMatch = entry.emoji === emoji.name;
            }

            if (isMatch) {
                const guild = message.guild;
                let member;
                try {
                    member = await guild.members.fetch(user.id);
                } catch (error) {
                    logger.error('[오류] 멤버 정보 가져오기 실패:', error);
                    return;
                }

                const role = guild.roles.cache.get(entry.roleId);

                if (!role) {
                    logger.info(`[반응 제거 감지] 설정된 역할 (${entry.roleId})을 찾을 수 없습니다.`);
                    return;
                }

                if (member.roles.cache.has(role.id)) {
                    try {
                        await member.roles.remove(role);
                        logger.info(`[반응 제거 감지] ${member.user.tag} 에게 '${role.name}' 역할 제거 성공!`);
                    } catch (error) {
                        logger.error(`[오류] ${member.user.name} 에게 '${role.name}' 역할 제거 중 오류:`, error);
                    }
                } else {
                     logger.info(`[반응 제거 감지] ${member.user.tag} 은(는) 이미 '${role.name}' 역할을 가지고 있지 않습니다.`);
                }
            }
        }
    }
});

// 봇이 준비되었을 때 실행될 이벤트 (로그인 이후 한 번만 실행)
client.once('ready', async () => {
    logger.info(`[봇 준비] Logged in as ${client.user.tag}!`);

    loadAllData(); // 봇 시작 시 모든 데이터 로드

    // 각 서버의 초대 정보를 캐시 (봇이 시작될 때 한 번)
    for (const guild of client.guilds.cache.values()) {
        // 봇이 '서버 관리' 권한이 있는지 확인
        if (guild.members.me.permissions.has(PermissionsBitField.Flags.ManageGuild)) {
            try {
                const invites = await guild.invites.fetch();
                inviteTracker[guild.id] = invites.map(invite => ({ code: invite.code, uses: invite.uses }));
                logger.info(`[초대 추적] ${guild.name} 서버의 초대 정보 로드 완료.`);
            } catch (error) {
                logger.error(`[오류] ${guild.name} 서버의 초대 정보 로드 중 오류: %s`, error.message);
            }
        } else {
            logger.warn(`[초대 추적] ${guild.name} 서버에서 '서버 관리' 권한이 없어 초대 정보를 로드할 수 없습니다.`);
        }
    }
    saveInviteTracker(); // 초기 로드 후 저장
});

// 봇을 Discord API에 로그인시킵니다.
logger.info('[로그인 시도] 봇 토큰으로 로그인 시도 중...');
client.login(TOKEN).catch(error => {
    logger.error('[오류] 봇 로그인 실패:', error);
});

// 봇을 Discord API에 로그인시킵니다.
logger.info('[로그인 시도] 봇 토큰으로 로그인 시도 중...');
client.login(TOKEN).catch(error => {
    logger.error('[오류] 봇 로그인 실패:', error);
    logger.error('토큰이 유효한지, .env 파일에 DISCORD_BOT_TOKEN이 올바르게 설정되었는지, 인터넷 연결이 되어있는지 확인해주세요.');
});