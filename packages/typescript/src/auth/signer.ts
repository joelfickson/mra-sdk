import { createSign, createPrivateKey, type KeyObject } from 'node:crypto';

/**
 * Produces the value of the `x-signature` header for an outgoing request.
 *
 * The `terminal-activated-confirmation` endpoint requires this header. The exact
 * algorithm is not declared in the upstream OpenAPI spec; the default
 * implementation below assumes RSA-SHA256 over the raw request body bytes,
 * base64-encoded. Verify against an MRA sandbox before relying on it in
 * production. Custom Signer implementations are first-class - swap in HSM- or
 * KMS-backed signers as needed.
 */
export interface Signer {
  /**
   * @param body  Exact bytes of the JSON request body that will be sent.
   *              For requests with no body, this is an empty string.
   * @returns     The string value to set as the `x-signature` header.
   */
  sign(body: string): Promise<string>;
}

export interface RsaSignerOptions {
  /** PEM-encoded RSA private key, or a pre-built KeyObject. */
  privateKey: string | Buffer | KeyObject;
  /** Hash algorithm, default 'SHA256'. */
  algorithm?: 'SHA256' | 'SHA384' | 'SHA512';
  /** Output encoding, default 'base64'. */
  encoding?: 'base64' | 'base64url' | 'hex';
}

/**
 * Default Node Signer implementation. Browser consumers should implement
 * their own using SubtleCrypto.
 */
export class RsaSigner implements Signer {
  private readonly key: KeyObject;
  private readonly algorithm: 'SHA256' | 'SHA384' | 'SHA512';
  private readonly encoding: BufferEncoding;

  constructor(options: RsaSignerOptions) {
    this.key =
      options.privateKey instanceof Object && 'asymmetricKeyType' in options.privateKey
        ? (options.privateKey as KeyObject)
        : createPrivateKey(options.privateKey as string | Buffer);
    this.algorithm = options.algorithm ?? 'SHA256';
    this.encoding = (options.encoding ?? 'base64') as BufferEncoding;
  }

  async sign(body: string): Promise<string> {
    const signer = createSign(this.algorithm);
    signer.update(body, 'utf8');
    signer.end();
    return signer.sign(this.key).toString(this.encoding);
  }
}
