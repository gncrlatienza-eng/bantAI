import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import './styles.css';

// Ensure the local dev session defaults to the temporary admin account so pages load directly
if (
  import.meta.env.DEV &&
  import.meta.env.MODE !== 'test' &&
  typeof localStorage !== 'undefined' &&
  localStorage.getItem('bantai_dev_admin') !== 'false'
) {
  localStorage.setItem('bantai_dev_admin', 'true');
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>,
);
