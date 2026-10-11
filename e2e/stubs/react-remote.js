// Stands for the React portal: same `mount(element, props)` contract, no React build needed.
export function mount(element, props) {
  element.innerHTML = '<p data-stub="react">Stub React remote</p>';
  return () => {
    element.innerHTML = '';
  };
}
