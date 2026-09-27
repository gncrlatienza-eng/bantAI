import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import PublicApp from './PublicApp';
import '../../styles.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <PublicApp />
    </BrowserRouter>
  </React.StrictMode>,
);
