// Runs after a loading indicator has had a chance to paint. Hidden tabs never fire
// requestAnimationFrame, so a timer is the fallback — otherwise the work would never start.
export function afterPaint(work: () => void) {
  let done = false;
  const run = () => {
    if (done) return;
    done = true;
    work();
  };
  requestAnimationFrame(() => setTimeout(run, 0));
  setTimeout(run, 50);
}
