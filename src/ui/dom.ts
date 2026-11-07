type Child = Node | string | number | null | undefined | false;

interface Props {
  class?: string;
  text?: string;
  style?: string;
  dataset?: Record<string, string>;
  disabled?: boolean;
  ariaLabel?: string;
  onClick?: (e: MouseEvent) => void;
}

/** 작은 DOM 헬퍼. 메뉴 화면 몇 개라 프레임워크 없이 간다 */
export function h<K extends keyof HTMLElementTagNameMap>(tag: K, props: Props | null = null, ...children: Child[]): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  if (props) {
    if (props.class) el.className = props.class;
    if (props.text !== undefined) el.textContent = props.text;
    if (props.style) el.setAttribute('style', props.style);
    if (props.dataset) for (const [k, v] of Object.entries(props.dataset)) el.dataset[k] = v;
    if (props.disabled !== undefined && el instanceof HTMLButtonElement) el.disabled = props.disabled;
    if (props.ariaLabel) el.setAttribute('aria-label', props.ariaLabel);
    const onClick = props.onClick;
    if (onClick) el.addEventListener('click', (e) => onClick(e as MouseEvent));
  }
  for (const c of children) {
    if (c === null || c === undefined || c === false) continue;
    el.append(typeof c === 'number' ? String(c) : c);
  }
  return el;
}

/** #ui 아래 오버레이 한 장만 띄운다 */
export class Overlay {
  private current: HTMLElement | null = null;

  constructor(private readonly root: HTMLElement) {}

  show(el: HTMLElement): void {
    this.clear();
    this.current = el;
    this.root.append(el);
  }

  clear(): void {
    this.current?.remove();
    this.current = null;
  }

  get element(): HTMLElement | null {
    return this.current;
  }

  get open(): boolean {
    return this.current !== null;
  }
}
