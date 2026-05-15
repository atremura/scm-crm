import '@testing-library/jest-dom/vitest';
import { afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';

// Cleanup React Testing Library DOM after each test to prevent
// state leaking between tests.
afterEach(() => {
  cleanup();
});
