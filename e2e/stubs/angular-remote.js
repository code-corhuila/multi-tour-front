// Stands for an Angular portal: same `mount(element, props)` contract.
export function mount(element, props) {
  element.innerHTML = '<p data-stub="angular">Stub Angular remote</p>';
  return () => {
    element.innerHTML = '';
  };
}
