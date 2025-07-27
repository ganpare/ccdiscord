# CC Discord Bot

A Discord bot that integrates Claude Code into Discord channels, enabling AI-powered assistance and automation.

## Features

- **Discord Integration**: Seamlessly connect Claude Code to your Discord server
- **Thread Management**: Automatically creates threads for organized conversations
- **Multi-language Support**: Available in English and Japanese
- **Never Sleep Mode**: Automatically executes tasks when idle
- **Debug Mode**: Test functionality without making API calls
- **Session Management**: Resume previous conversations

## Prerequisites

- [Deno](https://deno.land/) 1.40 or later
- Discord Bot Token
- Claude API Key (for production mode)

## Installation

1. Clone the repository:
```bash
git clone https://github.com/yourusername/ccdiscord.git
cd ccdiscord
```

2. Install globally (optional):
```bash
deno install -Afg ccdiscord.ts
```

## Setup

### 1. Create Discord Bot

1. Go to [Discord Developer Portal](https://discord.com/developers/applications)
2. Create a new application
3. Create a bot in the Bot section and obtain the token
4. Set required permissions:
   - Send Messages
   - Create Public Threads
   - Read Message History
5. Enable privileged gateway intents in Bot section:
   - Message Content Intent

### 2. Set Environment Variables

```bash
# Discord configuration
export CC_DISCORD_TOKEN="your-discord-bot-token"
export CC_DISCORD_CHANNEL_ID="your-channel-id"
export CC_DISCORD_USER_ID="your-user-id"

# Claude API (for production mode)
export ANTHROPIC_API_KEY="your-claude-api-key"
```

Or create a `.env` file in the project directory.

## Usage

### Basic Usage

Start the bot:
```bash
deno run -A --env ccdiscord.ts
```

Or if installed globally:
```bash
ccdiscord
```

### Command Line Options

```
Options:
  -c, --continue        Continue from the last session
  -r, --resume <id>     Resume a specific session by ID
  --list-sessions       List all resumable sessions
  -s, --select          Select a session interactively
  --never-sleep         Enable Never Sleep mode (auto-execute tasks)
  -d, --debug           Enable debug mode (use DebugActor instead of ClaudeCode)
  -h, --help            Show help message
  -l, --locale <lang>   Set language (ja/en)
```

### Examples

Start in debug mode (no API calls):
```bash
ccdiscord --debug
```

Continue from last session:
```bash
ccdiscord --continue
```

Start with Japanese language:
```bash
ccdiscord --locale ja
```

Enable Never Sleep mode:
```bash
ccdiscord --never-sleep
```

## Discord Commands

Once the bot is running, you can use these commands in the Discord thread:

- `!reset` or `!clear` - Reset the conversation
- `!stop` - Stop running tasks
- `!exit` - Shut down the bot
- `!<command>` - Execute shell commands
- Regular messages - Ask Claude for assistance

## Architecture

The bot uses an Actor-based architecture:

- **UserActor**: Handles user input and routing
- **ClaudeCodeActor**: Communicates with Claude API
- **DebugActor**: Provides mock responses for testing
- **AutoResponderActor**: Manages Never Sleep mode
- **DiscordAdapter**: Manages Discord connection
- **MessageBus**: Routes messages between actors

## Development

### Running Tests

```bash
deno test --allow-all
```

### Project Structure

```
ccdiscord/
├── src/
│   ├── actors/          # Actor implementations
│   ├── adapter/         # External service adapters
│   ├── tests/           # Test files
│   ├── cli.ts           # CLI option handling
│   ├── config.ts        # Configuration management
│   ├── i18n.ts          # Internationalization
│   ├── main.ts          # Entry point
│   ├── message-bus.ts   # Message routing
│   └── types.ts         # Type definitions
├── ccdiscord.ts         # Main executable
├── README.md            # This file
└── README-ja.md         # Japanese documentation
```

## Configuration

The bot can be configured through environment variables:

- `CC_DISCORD_TOKEN`: Discord bot token (required)
- `CC_DISCORD_CHANNEL_ID`: Discord channel ID (required)
- `CC_DISCORD_USER_ID`: Discord user ID (required)
- `ANTHROPIC_API_KEY`: Claude API key (required for production mode)
- `LANG`: System locale for automatic language detection

## Security Notice

This bot has strong permissions and executes commands. Use with caution and only in trusted environments.

## License

MIT License

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request