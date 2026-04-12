/**
 * Svelte action that stretches text to fill its container in all directions.
 *
 * The element must have position absolute and explicit width/height (set via
 * inline style). The action measures the natural text size, then applies
 * `transform: scale(scaleX, scaleY)` to stretch it edge-to-edge.
 *
 * Usage: `<div use:stretchText>{text}</div>`
 */
export function stretchText(node: HTMLElement): { destroy(): void } {
  function measure(): void {
    // Step 1: Clear transform to get the TRUE layout size (not the visually scaled size)
    const savedTransform = node.style.transform;
    node.style.transform = 'none';

    // Step 2: Measure container's layout size (the percentage-defined dimensions)
    const containerRect = node.getBoundingClientRect();
    const containerW = containerRect.width;
    const containerH = containerRect.height;

    if (containerW === 0 || containerH === 0) {
      node.style.transform = savedTransform;
      return;
    }

    // Step 3: Set width/height to auto to measure natural text size
    const savedWidth = node.style.width;
    const savedHeight = node.style.height;

    node.style.width = 'auto';
    node.style.height = 'auto';
    node.style.whiteSpace = 'nowrap';

    // Step 4: Measure natural text size
    const naturalRect = node.getBoundingClientRect();
    const naturalW = naturalRect.width;
    const naturalH = naturalRect.height;

    // Step 5: Restore original inline styles
    node.style.width = savedWidth;
    node.style.height = savedHeight;

    if (naturalW === 0 || naturalH === 0) {
      node.style.transform = savedTransform;
      return;
    }

    // Step 6: Scale to fit container — cap X so short names don't stretch uncomfortably.
    // The Y scale sets the maximum comfortable X: text should never be wider relative
    // to its height than ~1.8× the natural aspect ratio would suggest.
    const rawScaleX = containerW / naturalW;
    const scaleY = containerH / naturalH;
    const maxScaleX = scaleY * 1.8;
    const scaleX = Math.min(rawScaleX, maxScaleX);

    node.style.transformOrigin = 'center center';
    node.style.transform = `scale(${scaleX}, ${scaleY})`;
  }

  // Defer initial measurement to ensure layout is computed
  let rafId = requestAnimationFrame(measure);

  // Re-measure when container resizes
  const resizeObserver = new ResizeObserver(() => {
    cancelAnimationFrame(rafId);
    rafId = requestAnimationFrame(measure);
  });
  resizeObserver.observe(node);

  // Re-measure when text content changes
  const mutationObserver = new MutationObserver(() => {
    cancelAnimationFrame(rafId);
    rafId = requestAnimationFrame(measure);
  });
  mutationObserver.observe(node, {
    childList: true,
    characterData: true,
    subtree: true,
  });

  return {
    destroy(): void {
      cancelAnimationFrame(rafId);
      resizeObserver.disconnect();
      mutationObserver.disconnect();
    },
  };
}
