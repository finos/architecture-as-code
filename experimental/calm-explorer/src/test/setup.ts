import '@testing-library/jest-dom';
import { expect, afterEach, vi } from 'vitest';
import { cleanup } from '@testing-library/react';

// Cleanup after each test
afterEach(() => {
  cleanup();
});

// Note: crypto mocking would go here if needed for token encryption tests
// For now, we'll test pure functions that don't rely on Web Crypto API
