import type { AuthedTransport } from '../auth/index.js';
import type { components } from '../generated/schema.js';
import { unwrap, type ApiEnvelope } from './_envelope.js';

type UnActivatedTerminal = components['schemas']['UnActivatedTerminal'];
type TerminalActivationResponse = components['schemas']['TerminalActivationResponse'];
type ActivatedTerminalConfirmation = components['schemas']['ActivatedTerminalConfirmation'];

export class OnboardingResource {
  constructor(private readonly auth: AuthedTransport) {}

  /**
   * Step 1 of activation. Anonymous - the terminal does not yet have a token.
   *
   * POST /api/v1/onboarding/activate-terminal
   */
  async activateTerminal(payload: UnActivatedTerminal): Promise<TerminalActivationResponse> {
    const path = '/api/v1/onboarding/activate-terminal';
    const env = await this.auth.request<ApiEnvelope<TerminalActivationResponse>>({
      method: 'POST',
      path,
      body: payload,
      anonymous: true,
    });
    return unwrap(env, { method: 'POST', path });
  }

  /**
   * Step 2 of activation. Requires an `x-signature` header (signed via the
   * Signer configured on the client).
   *
   * POST /api/v1/onboarding/terminal-activated-confirmation
   */
  async confirmActivation(payload: ActivatedTerminalConfirmation): Promise<boolean> {
    const path = '/api/v1/onboarding/terminal-activated-confirmation';
    const env = await this.auth.request<ApiEnvelope<boolean>>({
      method: 'POST',
      path,
      body: payload,
      sign: true,
      anonymous: true,
    });
    return unwrap(env, { method: 'POST', path });
  }
}
