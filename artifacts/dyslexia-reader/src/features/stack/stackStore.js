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

export function deleteSnippet(index) {
  snippets.splice(index, 1);
}

export function replaceSnippet(index, image, ocrText) {
  snippets[index] = { image, ocrText };
}
