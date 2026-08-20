import { act, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Dialog } from '@/shared/ui/Dialog';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement;
let root: Root;
let trigger: HTMLButtonElement;

const renderDialog = (open: boolean, onClose: () => void, children: ReactNode, options?: {
  title?: string;
  description?: string;
  ariaLabel?: string;
}) => {
  act(() => {
    root.render(
      <Dialog open={open} onClose={onClose} {...options}>
        {children}
      </Dialog>,
    );
  });
};

const dispatchKey = (key: string, shiftKey = false) => {
  const event = new KeyboardEvent('keydown', { bubbles: true, cancelable: true, key, shiftKey });
  act(() => window.dispatchEvent(event));
  return event;
};

describe('Dialog accessibility', () => {
  beforeEach(() => {
    trigger = document.createElement('button');
    trigger.textContent = 'Open dialog';
    document.body.appendChild(trigger);
    trigger.focus();

    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    trigger.remove();
  });

  it('exposes a uniquely labelled modal dialog', () => {
    renderDialog(true, vi.fn(), <p>Dialog content</p>, {
      title: 'Create client',
      description: 'Add a client to the workspace.',
    });

    const dialog = container.querySelector<HTMLElement>('[role="dialog"]');
    const heading = container.querySelector('h2');
    const description = container.querySelector('p');

    expect(dialog).not.toBeNull();
    expect(dialog?.getAttribute('aria-modal')).toBe('true');
    expect(dialog?.getAttribute('aria-labelledby')).toBe(heading?.id);
    expect(dialog?.getAttribute('aria-describedby')).toBe(description?.id);
  });

  it('traps focus, closes with Escape, and restores focus to its trigger', () => {
    const onClose = vi.fn();
    renderDialog(true, onClose, <button type="button">Continue</button>, { title: 'Confirm action' });

    const buttons = Array.from(container.querySelectorAll<HTMLButtonElement>('button'));
    const closeButton = buttons[0];
    const continueButton = buttons[1];
    if (!closeButton || !continueButton) throw new Error('Dialog controls were not rendered.');

    expect(document.activeElement).toBe(closeButton);

    const reverseTab = dispatchKey('Tab', true);
    expect(reverseTab.defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(continueButton);

    const forwardTab = dispatchKey('Tab');
    expect(forwardTab.defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(closeButton);

    dispatchKey('Escape');
    expect(onClose).toHaveBeenCalledOnce();

    renderDialog(false, onClose, <button type="button">Continue</button>, { title: 'Confirm action' });
    expect(document.activeElement).toBe(trigger);
  });

  it('keeps focus on the dialog when it has no focusable descendants', () => {
    renderDialog(true, vi.fn(), <p>Read-only status</p>, { ariaLabel: 'Status' });

    const dialog = container.querySelector<HTMLElement>('[role="dialog"]');
    if (!dialog) throw new Error('Dialog was not rendered.');

    expect(dialog.getAttribute('aria-label')).toBe('Status');
    expect(document.activeElement).toBe(dialog);

    const tab = dispatchKey('Tab');
    expect(tab.defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(dialog);
  });
});
