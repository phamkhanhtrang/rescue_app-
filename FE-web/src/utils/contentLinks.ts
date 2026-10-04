export function contentParts(content: string = '') {
  const text = String(content)
    .replace(/<a\b[^>]*href\s*=\s*["'](https?:\/\/[^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi, (_: string, url: string, label: string) => `${label.replace(/<[^>]+>/g, '')} — ${url}`)
    .replace(/<br\s*\/?\s*>|<\/p>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&');
  return text.split(/(https?:\/\/[^\s<>"']+)/gi).filter(Boolean).flatMap(part => {
    if (!/^https?:\/\//i.test(part)) return [{ text: part, url: null }];
    const url = part.replace(/[.,;!?]+$/, '');
    try {
      const parsed = new URL(url);
      if (!['http:', 'https:'].includes(parsed.protocol)) return [{ text: part, url: null }];
      const tail = part.slice(url.length);
      return [{ text: url, url }, ...(tail ? [{ text: tail, url: null }] : [])];
    } catch {
      return [{ text: part, url: null }];
    }
  });
}
