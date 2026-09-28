import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import { OAuthConsent } from './components/Auth/OAuthConsent';

window.addEventListener('unhandledrejection', (event) => {
  if (event.reason && event.reason.message && event.reason.message.toLowerCase().includes('refresh token')) {
    event.preventDefault();
  }
});


const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <BrowserRouter>
      {window.location.pathname === '/oauth/consent' ? <OAuthConsent /> : <App />}
    </BrowserRouter>
  </React.StrictMode>
);
