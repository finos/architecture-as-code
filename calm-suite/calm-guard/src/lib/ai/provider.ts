import { createProviderRegistry } from 'ai';
import { google } from '@ai-sdk/google';
import { anthropic } from '@ai-sdk/anthropic';
import { openai } from '@ai-sdk/openai';
import { xai } from '@ai-sdk/xai';
import type { AgentConfig } from '@/lib/agents/types';

/**
 * NOTE: AI SDK 5.x deprecates generateObject in favor of generateText with `output` property.
 * We're using generateObject for now (still works, simpler API) - migration can happen later.
 */

/**
 * Build provider registry lazily at runtime — NOT at module initialization.
 * This ensures process.env is fully resolved (Turbopack, .env loading, etc.)
 * before we check for API keys.
 */
let _providers: Record<string, any> | null = null;
let _registry: ReturnType<typeof createProviderRegistry> | null = null;

function getProviders(): Record<string, any> {
  if (!_providers) {
    _providers = {};
    if (process.env.GOOGLE_GENERATIVE_AI_API_KEY) {
      _providers.google = google;
    }
    if (process.env.ANTHROPIC_API_KEY) {
      _providers.anthropic = anthropic;
    }
    if (process.env.OPENAI_API_KEY) {
      _providers.openai = openai;
    }
    if (process.env.XAI_API_KEY) {
      _providers.xai = xai;
    }
  }
  return _providers;
}

/**
 * Multi-provider registry (lazy)
 * Resolves model strings like "google:gemini-2.5-flash" to actual provider models
 */
function getRegistry() {
  if (!_registry) {
    _registry = createProviderRegistry(getProviders());
  }
  return _registry;
}

/** Backwards-compatible export for any code referencing `registry` directly */
export const registry = new Proxy({} as ReturnType<typeof createProviderRegistry>, {
  get(_target, prop, receiver) {
    return Reflect.get(getRegistry(), prop, receiver);
  },
});

/**
 * Validate that at least one LLM provider is configured.
 * Called at runtime — not at module initialization.
 */
function assertProviderConfigured(): void {
  if (Object.keys(getProviders()).length === 0) {
    throw new Error(
      'No LLM provider API keys configured. Set at least one of: GOOGLE_GENERATIVE_AI_API_KEY, ANTHROPIC_API_KEY, OPENAI_API_KEY, XAI_API_KEY'
    );
  }
}

/**
 * Get default model with fallback chain
 * Priority: Google Gemini → Anthropic Claude → OpenAI GPT-4o → xAI Grok
 */
export function getDefaultModel() {
  assertProviderConfigured();

  if (process.env.GOOGLE_GENERATIVE_AI_API_KEY) {
    return registry.languageModel('google:gemini-2.5-flash');
  }

  if (process.env.ANTHROPIC_API_KEY) {
    return registry.languageModel('anthropic:claude-sonnet-4-20250514');
  }

  if (process.env.OPENAI_API_KEY) {
    return registry.languageModel('openai:gpt-4o');
  }

  if (process.env.XAI_API_KEY) {
    return registry.languageModel('xai:grok-2-1212');
  }

  // This should never happen due to the earlier validation check
  throw new Error('No LLM provider available');
}

/**
 * Resolve model from agent config
 * @param config - Agent configuration with provider and model spec
 * @returns Language model instance from registry
 */
export function getModelForAgent(config: AgentConfig) {
  assertProviderConfigured();
  const modelString = `${config.spec.model.provider}:${config.spec.model.model}` as `${string}:${string}`;
  return registry.languageModel(modelString);
}
