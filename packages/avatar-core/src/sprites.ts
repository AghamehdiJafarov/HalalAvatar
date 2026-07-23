// Shared sprite-sheet parsing. Used by the video worker (Node) and the browser
// renderer alike, so both flat-mode pipelines inline identical symbol markup.
export function extractSymbols(spritesSvg: string): Record<string, string> {
  const map: Record<string, string> = {};
  const re = /<symbol id="([^"]+)"[^>]*>([\s\S]*?)<\/symbol>/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(spritesSvg)) !== null) map[m[1]!] = m[2]!.trim();
  return map;
}
