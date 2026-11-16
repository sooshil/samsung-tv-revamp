// Minimal DOM helper: el('div.card.focused', {style}, children)
export function el<T extends HTMLElement = HTMLElement>(
  spec: string,
  attrs?: Record<string, string> | null,
  children?: (Node | string | null)[],
): T {
  const [tag, ...classes] = spec.split('.');
  const node = document.createElement(tag || 'div') as T;
  if (classes.length) node.className = classes.join(' ');
  if (attrs) Object.keys(attrs).forEach((k) => node.setAttribute(k, attrs[k]));
  if (children) children.forEach((c) => { if (c !== null) node.appendChild(typeof c === 'string' ? document.createTextNode(c) : c); });
  return node;
}
