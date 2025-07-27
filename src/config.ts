// Configuration management module
import { showSetupInstructions, t } from "./i18n.ts";

export interface Config {
  discordToken: string;
  channelId: string;
  userId: string;
  debugMode: boolean;
  neverSleep: boolean;
  sessionId?: string;
  maxTurns: number;
  model: string;
}

export interface EnvConfig {
  // Discord
  DISCORD_BOT_TOKEN?: string;
  DISCORD_CLIENT_ID?: string;
  DISCORD_CHANNEL_ID?: string;
  // Anthropic
  ANTHROPIC_API_KEY?: string;
  // Legacy support
  CC_DISCORD_TOKEN?: string;
  CC_DISCORD_CHANNEL_ID?: string;
  CC_DISCORD_USER_ID?: string;
  CC_CLAUDE_API_KEY?: string;
  CC_ANTHROPIC_API_KEY?: string;
}

// Load configuration from environment variables
export function loadConfig(debugMode = false): Config | null {
  const env = Deno.env.toObject() as EnvConfig;

  // Support both new and legacy environment variable names
  const discordToken = env.DISCORD_BOT_TOKEN || env.CC_DISCORD_TOKEN;
  const channelId = env.DISCORD_CHANNEL_ID || env.CC_DISCORD_CHANNEL_ID;
  const clientId = env.DISCORD_CLIENT_ID;
  const userId = env.CC_DISCORD_USER_ID || clientId;
  const claudeApiKey = env.ANTHROPIC_API_KEY || env.CC_CLAUDE_API_KEY || env.CC_ANTHROPIC_API_KEY;

  // Check which variables are missing
  const missingVars: string[] = [];
  
  if (!discordToken) missingVars.push("DISCORD_BOT_TOKEN");
  if (!clientId && !env.CC_DISCORD_USER_ID) missingVars.push("DISCORD_CLIENT_ID");
  if (!channelId) missingVars.push("DISCORD_CHANNEL_ID");

  // Show setup instructions if any required variables are missing
  if (missingVars.length > 0) {
    showSetupInstructions(missingVars);
    return null;
  }

  // Warn if ANTHROPIC_API_KEY is set (Claude Code uses internal auth)
  if (claudeApiKey && !debugMode) {
    console.log("\n" + "⚠️ ".repeat(25));
    console.log(t("config.warnings.apiKeyNotNeeded"));
    console.log(t("config.warnings.apiKeyBillingRisk"));
    console.log(t("config.warnings.apiKeyIgnored"));
    console.log("⚠️ ".repeat(25) + "\n");
  }

  return {
    discordToken: discordToken!,
    channelId: channelId!,
    userId: userId!,
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

  return true;
}

// Default configuration
export const DEFAULT_CONFIG = {
  maxTurns: 300,
  model: "claude-opus-4-20250514",
  permissionMode: "bypassPermissions",
} as const;
