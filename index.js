// index.js

// .env 파일에서 환경 변수를 로드합니다. 이 코드는 파일 최상단에 위치해야 합니다.
require('dotenv').config();

// discord.js 라이브러리에서 필요한 클래스들을 불러옵니다.
const { Client, IntentsBitField, Partials, EmbedBuilder } = require('discord.js'); 

// Discord 클라이언트(봇)를 생성하고 봇이 어떤 이벤트(정보)를 받을지 '인텐트'를 설정합니다.
// 반응 역할 봇을 위해 필요한 인텐트들입니다.
const client = new Client({
    intents: [
        IntentsBitField.Flags.Guilds, // 서버(길드) 관련 정보 (서버 목록, 채널, 역할 등)
        IntentsBitField.Flags.GuildMessages, // 서버 내 메시지 이벤트 (메시지 생성, 업데이트, 삭제 등)
        IntentsBitField.Flags.GuildMessageReactions, // 서버 내 메시지 반응 이벤트 (반응 추가, 제거)
        IntentsBitField.Flags.MessageContent, // 봇이 메시지 내용을 읽을 수 있도록 허용 (명령어 처리 시 필수)
        // 특권 인텐트: Discord 개발자 포털에서 활성화되었는지 확인하세요.
        IntentsBitField.Flags.GuildMembers, // 길드 멤버 정보 (member.roles.add 등에 필요)
        IntentsBitField.Flags.GuildPresences, // 유저 상태 (선택 사항, 필요 시 활성화)
    ],
    // 부분적인 이벤트 처리: 봇이 시작되기 전의 메시지에 대한 반응도 처리할 수 있게 합니다.
    partials: [Partials.Message, Partials.Channel, Partials.Reaction], 
});

// .env 파일에서 봇 토큰을 가져옵니다.
const TOKEN = process.env.DISCORD_BOT_TOKEN; 
// 봇 명령어의 접두사 (예: !역할메시지)
const PREFIX = '!'; 

// 봇이 잠시 동안 반응 제거 이벤트를 무시할 수 있도록 하는 플래그 (메모리 저장)
// 봇이 재시작되면 초기화되므로, 정확성을 위해 봇 재시작 시 반응 메시지를 새로 생성하는 것이 좋습니다.
client.ignoringReactionRemoves = new Set(); // Set을 사용하여 메시지 ID + 유저 ID + 이모지이름 조합을 저장

// 봇이 Discord에 성공적으로 로그인하고 준비되었을 때 실행되는 이벤트
client.on('ready', () => {
    console.log(`[봇 준비] Logged in as ${client.user.tag}!`); 
    console.log('[봇 준비] 봇이 성공적으로 준비되었습니다!');
});

// 새로운 메시지가 생성되었을 때 실행되는 이벤트
client.on('messageCreate', async message => {
    // 봇 자신이 보낸 메시지는 무시하여 무한 루프를 방지합니다.
    if (message.author.bot) {
        return;
    }

    // 메시지가 설정된 접두사로 시작하는지 확인합니다.
    if (message.content.startsWith(PREFIX)) {
        console.log(`[메시지 감지] 명령어 접두사 '${PREFIX}'로 시작합니다.`);
        const args = message.content.slice(PREFIX.length).trim().split(/ +/);
        const command = args.shift().toLowerCase(); 
        console.log(`[메시지 감지] 명령어: '${command}', 인수: [${args.join(', ')}]`);

        // '역할메시지' 명령어 처리
        if (command === '역할메시지') {
            console.log('[명령어 처리] "역할메시지" 명령어가 감지되었습니다.');
            // 명령어 사용법: !역할메시지 <채널ID> <역할이름> <이모지> [상단이미지URL]

            if (args.length < 3) {
                console.log('[명령어 처리] 필수 인수가 부족합니다.');
                return message.reply('❌ 사용법: `!역할메시지 <채널ID> <역할이름> <이모지> [상단이미지URL]`');
            }

            const channelId = args[0];   
            const roleName = args[1];    
            const emoji = args[2];       
            const imageUrl = args[3] || null; // 선택적 이미지 URL

            console.log(`[명령어 처리] 채널ID: ${channelId}, 역할이름: ${roleName}, 이모지: ${emoji}, 이미지URL: ${imageUrl}`);

            const targetChannel = await client.channels.fetch(channelId).catch(error => {
                console.error(`[오류] 채널 ID ${channelId} 를 가져오는 데 실패했습니다:`, error);
                message.reply('❌ 채널을 찾을 수 없거나 접근 권한이 없습니다.');
                return null;
            });
            if (!targetChannel || targetChannel.type !== 0) {
                console.log('[명령어 처리] 유효하지 않거나 텍스트 채널이 아닙니다.');
                return message.reply('❌ 유효한 텍스트 채널 ID를 제공해주세요.');
            }
            console.log(`[명령어 처리] 대상 채널: ${targetChannel.name} (${targetChannel.id})`);

            const guild = message.guild; 
            const role = guild.roles.cache.find(r => r.name === roleName);

            if (!role) {
                console.log(`[명령어 처리] 역할을 찾을 수 없습니다: '${roleName}'`);
                return message.reply(`❌ '${roleName}' 역할을 찾을 수 없습니다. 정확한 역할 이름을 확인해주세요.`);
            }
            console.log(`[명령어 처리] 대상 역할: ${role.name} (${role.id})`);

            try {
                // --- 임베드 생성 ---
                const reactionEmbed = new EmbedBuilder()
                    .setColor(0xFFA7D1) // 임베드 색상 (핑크색 계열)
                    .setTitle('💜 꼭 읽어줘! 💜') 
                    .setDescription(
                        `❌ 시청자들 간에 과한 친목성 발언, 말다툼
                        ❌ 타 스트리머 언급
                        ❌ 도배, 욕설, 성희롱, 성드립 등 불쾌감을 주는 채팅
                        ❌ 정치, 종교, 인종 등 사회적이슈 언급
                        ❌ 광고 및 개인SNS 홍보

                        (아래에 있는 반응 선택시 역할이 지급됩니다.)`
                    );

                if (imageUrl) {
                    reactionEmbed.setImage(imageUrl); 
                    console.log(`[명령어 처리] 임베드에 이미지 URL 추가: ${imageUrl}`);
                }

                console.log('[명령어 처리] 임베드 메시지 전송 시도...');
                const sentMessage = await targetChannel.send({ embeds: [reactionEmbed] }); 
                console.log(`[명령어 처리] 임베드 메시지 전송 성공! 메시지 ID: ${sentMessage.id}`);

                console.log(`[명령어 처리] 메시지에 이모지 '${emoji}' 반응 추가 시도...`);
                await sentMessage.react(emoji); 
                console.log('[명령어 처리] 이모지 반응 추가 성공!');

                // --- 중요: 반응 역할 정보 저장 (임시 저장 - 봇 재시작 시 초기화됨) ---
                client.reactionRoles = client.reactionRoles || {}; 
                client.reactionRoles[sentMessage.id] = { 
                    channelId: channelId,
                    emoji: emoji,
                    roleId: role.id
                };
                console.log(`[명령어 처리] 반응 역할 정보 저장 완료: ${JSON.stringify(client.reactionRoles[sentMessage.id])}`);

                message.reply(`✅ 반응 역할 메시지가 ${targetChannel} 에 성공적으로 전송되었습니다!`);
            } catch (error) {
                console.error('[오류] 메시지 전송 또는 반응 추가 중 오류 발생:', error);
                message.reply('❌ 메시지 전송 또는 반응 추가 중 오류가 발생했습니다. 봇의 권한을 확인해주세요. (콘솔 확인)');
            }
        } else {
            console.log(`[메시지 감지] 알 수 없는 명령어: ${command}`);
        }
    }
});

// 사용자가 메시지에 반응을 추가했을 때 실행되는 이벤트
client.on('messageReactionAdd', async (reaction, user) => {
    console.log(`[반응 추가 감지] 이모지: ${reaction.emoji.name}, 사용자: ${user.tag}, 메시지 ID: ${reaction.message.id}`);

    // 봇 자신이 추가한 반응은 무시합니다.
    if (user.bot) {
        console.log('[반응 추가 감지] 봇의 반응이므로 무시합니다.');
        return;
    }

    // 반응 데이터가 불완전하게 캐시된 경우 (봇 시작 전의 메시지 등) 데이터를 가져옵니다.
    if (reaction.partial) {
        console.log('[반응 추가 감지] 부분적인 반응 데이터, 전체 데이터 가져오는 중...');
        try {
            await reaction.fetch();
            console.log('[반응 추가 감지] 부분 반응 데이터 가져오기 성공.');
        } catch (error) {
            console.error('[오류] 반응 부분 로드 중 오류:', error);
            return;
        }
    }

    const { message, emoji } = reaction; 

    // 이 메시지가 우리가 설정한 반응 역할 메시지인지 확인합니다.
    if (client.reactionRoles && client.reactionRoles[message.id]) {
        console.log('[반응 추가 감지] 저장된 반응 역할 메시지입니다.');
        const reactionRoleInfo = client.reactionRoles[message.id];
        console.log(`[반응 추가 감지] 저장된 정보: ${JSON.stringify(reactionRoleInfo)}`);

        // 사용자가 반응한 이모지가 우리가 설정한 이모지와 일치하는지 확인합니다.
        const isCustomEmojiMatch = emoji.id && reactionRoleInfo.emoji === `<:${emoji.name}:${emoji.id}>`;
        const isStandardEmojiMatch = reactionRoleInfo.emoji === emoji.name;

        console.log(`[반응 추가 감지] 반응 이모지: ${emoji.name}, 설정된 이모지: ${reactionRoleInfo.emoji}`);
        console.log(`[반응 추가 감지] 커스텀 이모지 일치: ${isCustomEmojiMatch}, 표준 이모지 일치: ${isStandardEmojiMatch}`);

        if (isStandardEmojiMatch || isCustomEmojiMatch) {
            console.log('[반응 추가 감지] 이모지가 일치합니다.');
            const guild = message.guild; 

            let member;
            try {
                member = await guild.members.fetch(user.id); 
                console.log(`[반응 추가 감지] 멤버 정보 가져오기 성공: ${member.user.tag}`);
            } catch (error) {
                console.error('[오류] 멤버 정보 가져오기 실패:', error);
                return; 
            }

            const role = guild.roles.cache.get(reactionRoleInfo.roleId); 

            if (!role) {
                console.log(`[반응 추가 감지] 설정된 역할 (${reactionRoleInfo.roleId})을 찾을 수 없습니다.`);
                return; 
            }
            console.log(`[반응 추가 감지] 대상 역할: ${role.name} (${role.id})`);


            // 역할이 존재하고, 사용자가 아직 해당 역할을 가지고 있지 않다면 역할을 부여합니다.
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

            // --- 기능: 반응 숫자를 0으로 유지 (역할 부여 여부와 상관없이) ---
            console.log(`[반응 추가 감지] ${member.user.tag} 의 반응 제거 시도...`);
            try {
                // 이모지 제거 이벤트를 발생시키기 전에 잠시 무시 플래그 설정
                // 메시지ID + 유저ID + 이모지이름 조합으로 고유하게 식별
                const uniqueId = message.id + user.id + emoji.name; 
                client.ignoringReactionRemoves.add(uniqueId); 
                await reaction.users.remove(user.id);
                console.log(`[반응 추가 감지] ${member.user.tag} 의 반응(${emoji.name})을 성공적으로 제거했습니다.`);
                // 잠시 후 플래그 제거 (Discord API 지연을 고려하여 충분한 시간 설정)
                setTimeout(() => {
                    client.ignoringReactionRemoves.delete(uniqueId);
                    console.log(`[반응 추가 감지] 무시 플래그 제거: ${uniqueId}`);
                }, 1000); // 1초 후 플래그 제거 (필요시 조절)

            } catch (error) {
                console.error(`[오류] ${member.user.tag} 의 반응 제거 중 오류:`, error);
            }
        } else {
            console.log('[반응 추가 감지] 이모지가 일치하지 않습니다.');
        }
    } else {
        console.log('[반응 추가 감지] 저장된 반응 역할 메시지가 아닙니다.');
    }
});

// 사용자가 메시지 반응을 제거했을 때 실행되는 이벤트
client.on('messageReactionRemove', async (reaction, user) => {
    console.log(`[반응 제거 감지] 이모지: ${reaction.emoji.name}, 사용자: ${user.tag}, 메시지 ID: ${reaction.message.id}`);

    // 봇 자신이 제거한 반응으로 인해 발생한 이벤트인 경우 무시
    const uniqueId = reaction.message.id + user.id + reaction.emoji.name;
    if (client.ignoringReactionRemoves.has(uniqueId)) {
        console.log(`[반응 제거 감지] 봇에 의해 제거된 반응(${uniqueId})이므로 역할 제거를 건너뜁니다.`);
        return;
    }

    // 만약 봇이 직접 제거한 것이 아닌, 사용자가 직접 제거한 반응인데 user.bot이 true라면 오류 (이런 경우는 없어야 함)
    if (user.bot) { 
        console.log('[반응 제거 감지] (예외) 봇이 제거한 것으로 판단되어 역할을 건너뜁니다. (이는 플래그로 잡혀야 합니다.)');
        return;
    }

    // 이 아래부터는 봇이 아닌 '다른 사용자'가 직접 반응을 제거했을 때만 실행됩니다.

    // 반응 데이터가 불완전하게 캐시된 경우 데이터를 가져옵니다.
    if (reaction.partial) {
        console.log('[반응 제거 감지] 부분적인 반응 데이터, 전체 데이터 가져오는 중...');
        try {
            await reaction.fetch();
            console.log('[반응 제거 감지] 부분 반응 데이터 가져오기 성공.');
        } catch (error) {
            console.error('[오류] 반응 부분 로드 중 오류:', error);
            return;
        }
    }

    const { message, emoji } = reaction;

    // 이 메시지가 우리가 설정한 반응 역할 메시지인지 확인합니다.
    if (client.reactionRoles && client.reactionRoles[message.id]) {
        console.log('[반응 제거 감지] 저장된 반응 역할 메시지입니다.');
        const reactionRoleInfo = client.reactionRoles[message.id];
        console.log(`[반응 제거 감지] 저장된 정보: ${JSON.stringify(reactionRoleInfo)}`);

        // 사용자가 제거한 이모지가 우리가 설정한 이모지와 일치하는지 확인합니다.
        const isCustomEmojiMatch = emoji.id && reactionRoleInfo.emoji === `<:${emoji.name}:${emoji.id}>`;
        const isStandardEmojiMatch = reactionRoleInfo.emoji === emoji.name;

        console.log(`[반응 제거 감지] 제거된 이모지: ${emoji.name}, 설정된 이모지: ${reactionRoleInfo.emoji}`);
        console.log(`[반응 제거 감지] 커스텀 이모지 일치: ${isCustomEmojiMatch}, 표준 이모지 일치: ${isStandardEmojiMatch}`);

        if (isStandardEmojiMatch || isCustomEmojiMatch) {
            console.log('[반응 제거 감지] 이모지가 일치합니다.');
            const guild = message.guild;

            let member;
            try {
                member = await guild.members.fetch(user.id);
                console.log(`[반응 제거 감지] 멤버 정보 가져오기 성공: ${member.user.tag}`);
            } catch (error) {
                console.error('[오류] 멤버 정보 가져오기 실패:', error);
                return;
            }

            const role = guild.roles.cache.get(reactionRoleInfo.roleId);

            if (!role) {
                console.log(`[반응 제거 감지] 설정된 역할 (${reactionRoleInfo.roleId})을 찾을 수 없습니다.`);
                return;
            }
            console.log(`[반응 제거 감지] 대상 역할: ${role.name} (${role.id})`);

            // 역할이 존재하고, 사용자가 해당 역할을 가지고 있다면 역할을 제거합니다.
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
        } else {
            console.log('[반응 제거 감지] 이모지가 일치하지 않습니다.');
        }
    } else {
        console.log('[반응 제거 감지] 저장된 반응 역할 메시지가 아닙니다.');
    }
});

// 봇을 Discord API에 로그인시킵니다.
console.log('[로그인 시도] 봇 토큰으로 로그인 시도 중...');
client.login(TOKEN).catch(error => {
    console.error('[오류] 봇 로그인 실패:', error);
    console.error('토큰이 유효한지, 인터넷 연결이 되어있는지 확인해주세요.');
});