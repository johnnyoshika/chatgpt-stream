import type { AxiosError } from 'axios';

// Type guard: https://stackoverflow.com/a/66519708/188740
export default (
  error: unknown,
): error is AxiosError<{ message?: string } | undefined, any> =>
  (error as AxiosError).isAxiosError !== undefined;
