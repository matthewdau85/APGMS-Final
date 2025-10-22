import assert from 'node:assert/strict';
import test from 'node:test';
import { renderToString } from 'react-dom/server';
import BankLinesPage from '../src/pages/BankLines';

const markup = renderToString(<BankLinesPage />);

test('bank lines table renders all required columns with caption', () => {
  assert.ok(markup.includes('<caption'), 'table should include a caption for screen readers');
  const headerCount = (markup.match(/<th scope="col">/g) ?? []).length;
  assert.equal(headerCount, 6, 'expected six column headers for the bank lines table');
});

test('status badges render descriptive hints', () => {
  const hintCount = (markup.match(/status-badge__hint/g) ?? []).length;
  assert.equal(hintCount, 3, 'each bank line should include a descriptive status hint');
});

