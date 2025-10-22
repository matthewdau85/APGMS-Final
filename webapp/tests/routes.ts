export const PRIMARY_ROUTE_CONFIG = [
  { path: '/', heading: 'Obligations', match: 'exact' as const },
  { path: '/paygw', heading: 'PAYGW' },
  { path: '/gst', heading: 'GST' },
  { path: '/compliance', heading: 'Compliance' },
  { path: '/security', heading: 'Security' },
] as const;

export const ACCESSIBILITY_ROUTES = [
  '/',
  '/paygw',
  '/gst',
  '/compliance',
  '/security',
  '/bank-lines',
] as const;
