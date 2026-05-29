const snippets = [];

export function addSnippet(image, ocrText) {
  snippets.push({ image, ocrText });
}

export function getSnippets() {
  return snippets;
}

export function clearSnippets() {
  snippets.length = 0;
}
