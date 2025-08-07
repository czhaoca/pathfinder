import React, { ReactElement } from 'react';
import { render, RenderOptions } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from 'react-query';
import { AuthProvider } from '@/contexts/AuthContext';
import { ThemeProvider } from '@/contexts/ThemeContext';

// Create a custom render function that includes providers
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
    },
  },
});

interface AllTheProvidersProps {
  children: React.ReactNode;
}

const AllTheProviders: React.FC<AllTheProvidersProps> = ({ children }) => {
  return (
    <BrowserRouter>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <ThemeProvider>
            {children}
          </ThemeProvider>
        </AuthProvider>
      </QueryClientProvider>
    </BrowserRouter>
  );
};

const customRender = (
  ui: ReactElement,
  options?: Omit<RenderOptions, 'wrapper'>
) => render(ui, { wrapper: AllTheProviders, ...options });

// Re-export everything
export * from '@testing-library/react';
export { customRender as render };

// Test data factories
export const createMockUser = (overrides = {}) => ({
  id: 'user-123',
  username: 'testuser',
  email: 'test@example.com',
  firstName: 'Test',
  lastName: 'User',
  role: 'user',
  createdAt: new Date().toISOString(),
  ...overrides,
});

export const createMockExperience = (overrides = {}) => ({
  id: 'exp-123',
  title: 'Software Engineer',
  company: 'Tech Corp',
  startDate: '2020-01-01',
  endDate: '2023-12-31',
  description: 'Developed web applications',
  skills: ['React', 'Node.js', 'TypeScript'],
  ...overrides,
});

export const createMockCareerPath = (overrides = {}) => ({
  id: 'path-123',
  title: 'Senior Software Engineer',
  description: 'Path to senior engineering role',
  requiredSkills: ['React', 'Node.js', 'System Design'],
  averageSalary: 150000,
  growthRate: 15,
  ...overrides,
});

export const createMockJob = (overrides = {}) => ({
  id: 'job-123',
  title: 'Full Stack Developer',
  company: 'StartupXYZ',
  location: 'Remote',
  salary: { min: 100000, max: 150000 },
  description: 'Build amazing products',
  postedDate: new Date().toISOString(),
  ...overrides,
});

export const createMockCourse = (overrides = {}) => ({
  id: 'course-123',
  title: 'Advanced React Patterns',
  provider: 'Tech Academy',
  duration: '8 weeks',
  difficulty: 'advanced',
  skills: ['React', 'TypeScript', 'Testing'],
  ...overrides,
});

// Mock API responses
export const mockApiResponse = (data: any, status = 200) => {
  return Promise.resolve({
    ok: status >= 200 && status < 300,
    status,
    json: async () => data,
    data,
  });
};

// Wait utilities
export const waitForAsync = () => new Promise(resolve => setTimeout(resolve, 0));

// Mock fetch
export const setupMockFetch = (responses: Map<string, any>) => {
  global.fetch = vi.fn((url: string) => {
    const response = responses.get(url);
    if (response) {
      return mockApiResponse(response);
    }
    return mockApiResponse({ error: 'Not found' }, 404);
  }) as any;
};