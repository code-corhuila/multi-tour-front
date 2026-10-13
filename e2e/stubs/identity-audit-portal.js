// Stands for the identity portal: a button that opens a session through the props the container gives it.
// In the general scope (/ingresar) it signs in "for acme" the way the real portal does: the identifier typed in
// the login goes to `session.open`, then `navigate` moves inside the app without a reload.
export function mount(element, props) {
  const general = props.scope === 'general';
  const announce = typeof props.onVisualIdentityChange === 'function';
  element.innerHTML = `<p>Stub sign-in</p><button type="button">${general ? 'Sign in for acme' : 'Sign in'}</button>${announce ? '<button type="button" data-colors>Save colors</button>' : ''}`;
  const button = element.querySelector('button');
  const colors = element.querySelector('[data-colors]');
  const save = () => props.onVisualIdentityChange({ primaryColor: '#112233', secondaryColor: '#445566' });
  colors?.addEventListener('click', save);
  const answer = { accessToken: 'stub.stub.stub', expiresIn: 900 };
  const signIn = () => {
    if (general) {
      props.session.open(answer, 'acme');
      props.navigate('/t/acme/areas/stub-react');
    } else {
      props.session.open(answer);
    }
  };
  button.addEventListener('click', signIn);
  return () => {
    button.removeEventListener('click', signIn);
    colors?.removeEventListener('click', save);
    element.innerHTML = '';
  };
}