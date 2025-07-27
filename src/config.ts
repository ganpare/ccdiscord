// Configuration management module

export interface Config {
  discordToken: string;
  channelId: string;
  userId: string;
  claudeApiKey?: string;
  debugMode: boolean;
  neverSleep: boolean;
  sessionId?: string;
  maxTurns: number;
  model: string;
}

export interface EnvConfig {
  CC_DISCORD_TOKEN?: string;
  CC_DISCORD_CHANNEL_ID?: string;
  CC_DISCORD_USER_ID?: string;
  CC_CLAUDE_API_KEY?: string;
  CC_ANTHROPIC_API_KEY?: string;
}

// Load configuration from environment variables
export function loadConfig(debugMode = false): Config | null {
  const env = Deno.env.toObject() as EnvConfig;

  const discordToken = env.CC_DISCORD_TOKEN;
  const channelId = env.CC_DISCORD_CHANNEL_ID;
  const userId = env.CC_DISCORD_USER_ID;
  const claudeApiKey = env.CC_CLAUDE_API_KEY || env.CC_ANTHROPIC_API_KEY;

  // Validate required fields
  if (!discordToken || !channelId || !userId) {
    console.error(
      "Error: Please set CC_DISCORD_TOKEN, CC_DISCORD_CHANNEL_ID, CC_DISCORD_USER_ID in environment variables"
    );
    return null;
  }

  // Claude API key is required unless in debug mode
  // if (!debugMode && !claudeApiKey) {
  //   console.error(
  //     "Error: Please set CC_CLAUDE_API_KEY or CC_ANTHROPIC_API_KEY in environment variables"
  //   );
  //   return null;
  // }

  return {
    discordToken,
    channelId,
    userId,
    claudeApiKey,
    debugMode,
    neverSleep: false, // Set from CLI options
    maxTurns: 300,
    model: "claude-opus-4-20250514",
  };
}

// Validate configuration
export function validateConfig(config: Config): boolean {
  if (!config.discordToken || !config.channelId || !config.userId) {
    return false;
  }

  if (!config.debugMode && !config.claudeApiKey) {
    return false;
  }

  return true;
}

// Default configuration
export const DEFAULT_CONFIG = {
  maxTurns: 300,
  model: "claude-opus-4-20250514",
  permissionMode: "bypassPermissions",
} as const;
