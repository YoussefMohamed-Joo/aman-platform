import sanitizeHtml from 'sanitize-html';

const SANITIZE_OPTIONS: sanitizeHtml.IOptions = {
  allowedTags: [],
  allowedAttributes: {},
  allowedSchemes: [],
  disallowedTagsMode: 'discard',
  allowedSchemesByTag: {},
  allowProtocolRelative: false
};

export function sanitize(str: unknown): string {
  if (typeof str !== 'string') return '';
  return sanitizeHtml(str.trim(), SANITIZE_OPTIONS).replace(/[<>"'&]/g, '');
}

export function sanitizeObj<T extends Record<string, any>>(obj: T): T {
  if (!obj || typeof obj !== 'object') return obj;
  const sanitized: any = Array.isArray(obj) ? [] : {};
  for (const [key, value] of Object.entries(obj)) {
    if (typeof value === 'string') {
      sanitized[key] = sanitize(value);
    } else if (typeof value === 'object' && value !== null) {
      sanitized[key] = sanitizeObj(value);
    } else {
      sanitized[key] = value;
    }
  }
  return sanitized;
}
