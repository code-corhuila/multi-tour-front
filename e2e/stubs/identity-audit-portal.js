// Stands for the identity portal: a button that opens a session through the props the container gives it.
export function mount(element, props) {
  element.innerHTML = '<p>Stub sign-in</p><button type="button">Sign in</button>';
  const button = element.querySelector('button');
  const signIn = () => props.session.open({ accessToken: 'stub.stub.stub', expiresIn: 900 });
  button.addEventListener('click', signIn);
  return () => {
    button.removeEventListener('click', signIn);
    element.innerHTML = '';
  };
}