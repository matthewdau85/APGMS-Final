import assert from 'node:assert/strict';
import test from 'node:test';
import { renderToString } from 'react-dom/server';
import HomePage from '../src/pages/Home';

const markup = renderToString(<HomePage />);

test('home page lists the three key portfolio metrics', () => {
  const metricCount = (markup.match(/metric-card__header/g) ?? []).length;
  assert.equal(metricCount, 3, 'expected exactly three metric cards');
});

test('home page activity section exposes labelled list items', () => {
  assert.ok(markup.includes('activity__list'), 'activity list container should render');
  const activityItems = (markup.match(/activity__item/g) ?? []).length;
  assert.equal(activityItems, 3, 'expected three workflow activity items');
});

