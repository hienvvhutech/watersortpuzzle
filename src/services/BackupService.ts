/**
 * Service to manage manual backups (export/import) of player profile save states.
 * Uses a pure-JS Base64 implementation to prevent crashes in native React Native environments.
 * Includes versioning and checksum verification to prevent corrupted or edited states.
 */

const CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

function pureB64Encode(str: string): string {
  let result = '';
  let i = 0;
  while (i < str.length) {
    const c1 = str.charCodeAt(i++) || 0;
    const c2 = str.charCodeAt(i++) || 0;
    const c3 = str.charCodeAt(i++) || 0;
    
    const byte1 = c1 >> 2;
    const byte2 = ((c1 & 3) << 4) | (c2 >> 4);
    const byte3 = ((c2 & 15) << 2) | (c3 >> 6);
    const byte4 = c3 & 63;
    
    const p3 = i - 1 > str.length ? '=' : CHARS.charAt(byte3);
    const p4 = i > str.length ? '=' : CHARS.charAt(byte4);
    
    result += CHARS.charAt(byte1) + CHARS.charAt(byte2) + p3 + p4;
  }
  return result;
}

function pureB64Decode(str: string): string {
  let result = '';
  let i = 0;
  const cleanStr = str.replace(/=/g, '');
  while (i < cleanStr.length) {
    const c1 = CHARS.indexOf(cleanStr.charAt(i++) || '');
    const c2 = CHARS.indexOf(cleanStr.charAt(i++) || '');
    const c3 = i - 1 < cleanStr.length ? CHARS.indexOf(cleanStr.charAt(i++) || '') : -1;
    const c4 = i < cleanStr.length ? CHARS.indexOf(cleanStr.charAt(i++) || '') : -1;
    
    const byte1 = (c1 << 2) | (c2 >> 4);
    result += String.fromCharCode(byte1);
    
    if (c3 !== -1) {
      const byte2 = ((c2 & 15) << 4) | (c3 >> 2);
      result += String.fromCharCode(byte2);
    }
    if (c4 !== -1) {
      const byte3 = ((c3 & 3) << 6) | c4;
      result += String.fromCharCode(byte3);
    }
  }
  return result;
}

function utf8ToBytes(str: string): string {
  return unescape(encodeURIComponent(str));
}

function bytesToUtf8(str: string): string {
  return decodeURIComponent(escape(str));
}

export const BackupService = {
  VERSION: 2,
  HEADER: 'WSP_SAVE_',

  /**
   * Generates a simple checksum for a given string to detect tampering.
   */
  calculateChecksum(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash |= 0; // Convert to 32bit integer
    }
    return Math.abs(hash).toString(16);
  },

  /**
   * Exports the store state as a secure, copyable backup string.
   */
  exportBackup(storeState: any): string {
    const payload = {
      version: this.VERSION,
      timestamp: Date.now(),
      data: storeState,
    };
    const payloadStr = JSON.stringify(payload);
    const checksum = this.calculateChecksum(payloadStr);
    
    const finalPayload = {
      ...payload,
      checksum,
    };
    
    const finalStr = JSON.stringify(finalPayload);
    const bytes = utf8ToBytes(finalStr);
    const base64 = pureB64Encode(bytes);
    return `${this.HEADER}${base64}`;
  },

  /**
   * Imports and validates a backup string, returning the clean store state.
   */
  importBackup(backupStr: string): any {
    const cleanStr = backupStr.trim();
    if (!cleanStr.startsWith(this.HEADER)) {
      throw new Error('invalid_header');
    }

    const base64 = cleanStr.substring(this.HEADER.length);
    let bytes = '';
    try {
      bytes = pureB64Decode(base64);
    } catch (e) {
      throw new Error('invalid_encoding');
    }

    let decodedStr = '';
    try {
      decodedStr = bytesToUtf8(bytes);
    } catch (e) {
      throw new Error('invalid_utf8');
    }

    let payload: any = null;
    try {
      payload = JSON.parse(decodedStr);
    } catch (e) {
      throw new Error('invalid_json');
    }

    // Check version
    if (!payload.version || typeof payload.version !== 'number') {
      throw new Error('missing_version');
    }
    if (payload.version > this.VERSION) {
      throw new Error('unsupported_future_version');
    }

    // Verify Checksum
    const { checksum, ...originalPayload } = payload;
    const computedChecksum = this.calculateChecksum(JSON.stringify(originalPayload));
    if (checksum !== computedChecksum) {
      throw new Error('checksum_mismatch');
    }

    return payload.data;
  },
};
