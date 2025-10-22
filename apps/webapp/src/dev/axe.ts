const ensureMounted = () =>
  new Promise<void>((resolve) => {
    if (document.readyState === 'complete') {
      requestAnimationFrame(() => resolve());
      return;
    }

    window.addEventListener(
      'load',
      () => {
        requestAnimationFrame(() => resolve());
      },
      { once: true },
    );
  });

const runAxe = async () => {
  const [{ default: axe }] = await Promise.all([
    import('axe-core'),
    ensureMounted(),
  ]);

  try {
    const { violations } = await axe.run(document);

    if (violations.length > 0) {
      console.warn('[axe] Accessibility violations detected', violations);
    }
  } catch (error) {
    console.warn('[axe] Unable to complete accessibility audit', error);
  }
};

if (import.meta.env.DEV) {
  void runAxe();
}
