// @vitest-environment jsdom
// SPDX-FileCopyrightText: 2024 CalmStudio contributors - see NOTICE file
//
// SPDX-License-Identifier: Apache-2.0

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { CalmDiagram } from './index.js';
import { InteractiveDiagram, clampScale } from './InteractiveDiagram.js';
import type { CalmDiagramBundle } from './types.js';

const renderELKDiagram = vi.hoisted(() => vi.fn());
vi.mock('@finos/calm-diagram', () => ({ renderELKDiagram }));

const NODE_SVG =
  '<svg width="300" height="150"><g class="calm-node" data-node-id="api" data-description="Trade API"><rect/></g>' +
  '<g class="calm-node" data-node-id="db" data-description=""><rect/></g><rect class="background"/></svg>';

const bundle: CalmDiagramBundle = {
  architecture: { nodes: [], relationships: [] },
  svg: { light: '<svg><text>LIGHT</text></svg>', dark: '<svg><text>DARK</text></svg>' },
  size: { width: 300, height: 150 },
};

function viewport(): HTMLElement {
  return screen.getByTestId('calm-diagram-viewport');
}

beforeEach(() => {
  renderELKDiagram.mockReset();
  renderELKDiagram.mockImplementation(async (_arch: unknown, options: { theme: string }) => `<svg><text>CLIENT ${options.theme}</text></svg>`);
  document.documentElement.removeAttribute('data-theme');
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('clampScale', () => {
  it('keeps the scale between 0.1 and 5', () => {
    expect(clampScale(0.01)).toBe(0.1);
    expect(clampScale(2)).toBe(2);
    expect(clampScale(9)).toBe(5);
  });
});

describe('InteractiveDiagram', () => {
  it('zooms in and out with the wheel', () => {
    render(<InteractiveDiagram svg={NODE_SVG} height={150} />);
    const host = screen.getByRole('application');

    fireEvent.wheel(host, { deltaY: -100 });
    expect(viewport().style.transform).toContain('scale(1.1)');

    fireEvent.wheel(host, { deltaY: 100 });
    fireEvent.wheel(host, { deltaY: 100 });
    expect(viewport().style.transform).toContain('scale(0.9)');
  });

  it('stops the page from scrolling while the wheel zooms', () => {
    render(<InteractiveDiagram svg={NODE_SVG} height={150} />);
    const event = new WheelEvent('wheel', { deltaY: -100, cancelable: true });
    act(() => {
      screen.getByRole('application').dispatchEvent(event);
    });
    expect(event.defaultPrevented).toBe(true);
  });

  it('pans while the pointer drags, and stops when it is released', () => {
    render(<InteractiveDiagram svg={NODE_SVG} height={150} />);
    const host = screen.getByRole('application');

    fireEvent.pointerDown(host, { clientX: 10, clientY: 10 });
    expect(viewport().style.cursor).toBe('grabbing');
    fireEvent.pointerMove(host, { clientX: 40, clientY: 30 });
    expect(viewport().style.transform).toContain('translate(30px, 20px)');

    fireEvent.pointerUp(host);
    fireEvent.pointerMove(host, { clientX: 100, clientY: 100 });
    expect(viewport().style.transform).toContain('translate(30px, 20px)');
    expect(viewport().style.cursor).toBe('grab');
  });

  it('pans and zooms with the keyboard', () => {
    render(<InteractiveDiagram svg={NODE_SVG} height={150} />);
    const host = screen.getByRole('application');

    fireEvent.keyDown(host, { key: 'ArrowRight' });
    fireEvent.keyDown(host, { key: 'ArrowDown' });
    expect(viewport().style.transform).toContain('translate(-20px, -20px)');

    fireEvent.keyDown(host, { key: 'ArrowLeft' });
    fireEvent.keyDown(host, { key: 'ArrowUp' });
    fireEvent.keyDown(host, { key: '+' });
    fireEvent.keyDown(host, { key: '=' });
    fireEvent.keyDown(host, { key: '-' });
    expect(viewport().style.transform).toBe('translate(0px, 0px) scale(1.1)');
  });

  it('ignores other keys', () => {
    render(<InteractiveDiagram svg={NODE_SVG} height={150} />);
    fireEvent.keyDown(screen.getByRole('application'), { key: 'a' });
    expect(viewport().style.transform).toBe('translate(0px, 0px) scale(1)');
  });

  it('shows the description of a clicked node, and hides it on a second click', () => {
    const { container } = render(<InteractiveDiagram svg={NODE_SVG} height={150} />);
    const node = container.querySelector('[data-node-id="api"] rect') as Element;

    fireEvent.click(node, { clientX: 50, clientY: 60 });
    expect(screen.getByRole('tooltip').textContent).toBe('api: Trade API');

    fireEvent.click(node, { clientX: 50, clientY: 60 });
    expect(screen.queryByRole('tooltip')).toBeNull();
  });

  it('shows the tooltip when pointer capture makes the host the click target', () => {
    const { container } = render(<InteractiveDiagram svg={NODE_SVG} height={150} />);
    const host = screen.getByRole('application');
    const node = container.querySelector('[data-node-id="api"] rect') as Element;

    fireEvent.pointerDown(node, { clientX: 50, clientY: 60 });
    fireEvent.pointerUp(host, { clientX: 51, clientY: 61 });
    fireEvent.click(host, { clientX: 51, clientY: 61 });
    expect(screen.getByRole('tooltip').textContent).toBe('api: Trade API');
  });

  it('does not show a tooltip after a drag that starts on a node', () => {
    const { container } = render(<InteractiveDiagram svg={NODE_SVG} height={150} />);
    const host = screen.getByRole('application');
    const node = container.querySelector('[data-node-id="api"] rect') as Element;

    fireEvent.pointerDown(node, { clientX: 50, clientY: 60 });
    fireEvent.pointerMove(host, { clientX: 90, clientY: 60 });
    fireEvent.pointerUp(host, { clientX: 90, clientY: 60 });
    fireEvent.click(host, { clientX: 90, clientY: 60 });
    expect(screen.queryByRole('tooltip')).toBeNull();
  });

  it('hides the tooltip on Escape, on a node with no description, and on the background', () => {
    const { container } = render(<InteractiveDiagram svg={NODE_SVG} height={150} />);
    const host = screen.getByRole('application');
    const api = container.querySelector('[data-node-id="api"] rect') as Element;

    fireEvent.click(api);
    fireEvent.keyDown(host, { key: 'Escape' });
    expect(screen.queryByRole('tooltip')).toBeNull();

    fireEvent.click(api);
    fireEvent.click(container.querySelector('[data-node-id="db"] rect') as Element);
    expect(screen.queryByRole('tooltip')).toBeNull();

    fireEvent.click(api);
    fireEvent.click(container.querySelector('.background') as Element);
    expect(screen.queryByRole('tooltip')).toBeNull();
  });
});

describe('CalmDiagram in the browser', () => {
  it('makes the pre-rendered SVG interactive without rendering it again', async () => {
    render(<CalmDiagram __bundle={bundle} />);
    expect(await screen.findByRole('application')).toBeTruthy();
    expect(viewport().innerHTML).toContain('LIGHT');
    expect(renderELKDiagram).not.toHaveBeenCalled();
  });

  it('follows the site theme', async () => {
    render(<CalmDiagram __bundle={bundle} />);
    await screen.findByRole('application');

    act(() => document.documentElement.setAttribute('data-theme', 'dark'));
    await waitFor(() => expect(viewport().innerHTML).toContain('DARK'));
  });

  it('uses the theme prop over the site theme', async () => {
    document.documentElement.setAttribute('data-theme', 'dark');
    render(<CalmDiagram __bundle={bundle} theme="light" />);
    await screen.findByRole('application');
    expect(viewport().innerHTML).toContain('LIGHT');
  });

  it('keeps the static SVG when interactive is false', () => {
    const { container } = render(<CalmDiagram __bundle={bundle} interactive={false} />);
    expect(screen.queryByRole('application')).toBeNull();
    expect(container.querySelector('.calm-diagram-static-light')).not.toBeNull();
  });

  it('renders inline data in the browser', async () => {
    const data = { nodes: [], relationships: [] };
    render(<CalmDiagram data={data} />);
    await waitFor(() => expect(viewport().innerHTML).toContain('CLIENT light'));
    expect(renderELKDiagram).toHaveBeenCalledWith(data, { theme: 'light' });
    expect(screen.getByRole('application').style.height).toBe('480px');
  });

  it('renders the pre-rendered architecture again for a flow or edge containers', async () => {
    render(<CalmDiagram __bundle={bundle} flow="flow-1" containers="edges" />);
    await waitFor(() => expect(viewport().innerHTML).toContain('CLIENT light'));
    expect(renderELKDiagram).toHaveBeenCalledWith(bundle.architecture, {
      theme: 'light',
      flow: 'flow-1',
      containers: 'edges',
    });
    expect(screen.getByRole('application').style.height).toBe('150px');
  });

  it('fetches and renders a remote src without credentials', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ nodes: [] }) });
    vi.stubGlobal('fetch', fetchMock);

    render(<CalmDiagram src="https://example.com/a.calm.json" />);
    await waitFor(() => expect(viewport().innerHTML).toContain('CLIENT light'));
    expect(fetchMock).toHaveBeenCalledWith('https://example.com/a.calm.json', { credentials: 'omit' });
  });

  it('shows an error when a remote src cannot be loaded', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 404, statusText: 'Not Found' }));

    const { container } = render(<CalmDiagram src="https://example.com/missing.calm.json" />);
    await waitFor(() => expect(container.querySelector('.calm-diagram-error')?.textContent).toContain('404 Not Found'));
  });

  it('keeps the static SVG when a client render fails', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    renderELKDiagram.mockRejectedValue(new Error('no such flow'));

    const { container } = render(<CalmDiagram __bundle={bundle} flow="missing" />);
    await waitFor(() => expect(renderELKDiagram).toHaveBeenCalled());
    await waitFor(() => expect(console.error).toHaveBeenCalled());
    expect(container.querySelector('.calm-diagram-static-light')).not.toBeNull();
    expect(container.querySelector('.calm-diagram-error')).toBeNull();
  });
});
