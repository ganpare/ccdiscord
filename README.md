# ccdiscord

Discord Claude Code Bot Interface.

NOTE: It's for my personal use. Claude Code and bot has strong permissions. Take care.

## Install and Setup

```bash
$ git clone <this> cd && cd ccdiscord
$ deno install -Afg ccdiscord.ts

# TODO: not published yet
$ deno install -Afg jsr:@mizchi/ccdiscord.ts
```

## 1. Create Discord Bot

1. Go to [Discord Developer Portal](https://discord.com/developers/applications)
2. Create a new application
3. Create a bot in the Bot section and obtain the token
4. Set required permissions:
   - Send Messages
   - Create Public Threads
   - Read Message History
5. Enable privileged gateway intents in Bot section:
   - Message Content Intent

```bash
# Set env vars .env or ~/.profile
CC_DISCORD_TOKEN=your-discord-bot-token
CC_DISCORD_CHANNEL_ID=your-channel-id
CC_DISCORD_USER_ID=your-user-id
```

## Run

Set env

```
CC_DISCORD_TOKEN=your-discord-bot-token
CC_DISCORD_CHANNEL_ID=your-channel-id
CC_DISCORD_USER_ID=your-user-id
```

Run on your working repo

```bash
$ ccdiscord
# Start server and Create thread in your channel
```

## TODO

English

## LICENSE

MIT
