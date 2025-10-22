import assert from 'node:assert/strict';
import test from 'node:test';
import { renderToString } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import App from '../src/App';

function renderRoute(route: '/' | '/bank-lines') {
  return renderToString(
    <MemoryRouter initialEntries={[route]}>
      <App />
    </MemoryRouter>
  );
}

test('overview route exposes navigation landmarks', () => {
  const markup = renderRoute('/');

  assert.ok(markup.includes('aria-label="Primary"'), 'primary navigation should expose an aria label');
  assert.ok(markup.includes('Overview'), 'overview navigation link should render');
  assert.ok(markup.includes('Bank lines'), 'bank lines navigation link should render');
});

test('bank lines route renders themed toggle with accessible label', () => {
  const markup = renderRoute('/bank-lines');

  assert.ok(markup.includes('aria-label="Switch to'), 'theme toggle should expose a descriptive aria-label');
  assert.ok(markup.includes('app__theme-toggle'), 'theme toggle button should render in the header');
});

