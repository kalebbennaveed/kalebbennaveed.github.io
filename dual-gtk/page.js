const figureDialog = document.querySelector('#figure-dialog');
const enlargedFigure = document.querySelector('#enlarged-figure');
const figureCaption = document.querySelector('#figure-caption');
if (figureDialog && typeof figureDialog.showModal === 'function') {
  document.querySelectorAll('[data-figure]').forEach(link => {
    link.addEventListener('click', event => {
      event.preventDefault();
      enlargedFigure.src = link.href;
      enlargedFigure.alt = link.querySelector('img').alt;
      figureCaption.textContent = link.dataset.caption;
      figureDialog.showModal();
      document.body.classList.add('figure-open');
    });
  });
  document.querySelector('#close-figure').addEventListener('click', () => figureDialog.close());
  figureDialog.addEventListener('click', event => {
    if (event.target === figureDialog) {
      const box = figureDialog.getBoundingClientRect();
      if (event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom) figureDialog.close();
    }
  });
  figureDialog.addEventListener('close', () => document.body.classList.remove('figure-open'));
}
const copyCitation = document.querySelector('#copy-citation');
copyCitation?.addEventListener('click', async () => {
  const status = document.querySelector('#copy-status');
  try {
    await navigator.clipboard.writeText(document.querySelector('#bibtex').textContent);
    status.textContent = 'BibTeX copied.';
  } catch {
    status.textContent = 'Select the citation text to copy it.';
  }
});
