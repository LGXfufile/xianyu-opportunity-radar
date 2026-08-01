import React from 'react';
import { createRoot } from 'react-dom/client';
import { Analytics } from '@vercel/analytics/react';
import { RadarApp } from '../../src/RadarApp';
import '../../src/styles.css';

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <RadarApp />
    <Analytics />
  </React.StrictMode>,
);
