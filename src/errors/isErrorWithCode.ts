type ErrorWithCode = {
  code: string;
};

// Type guard: https://stackoverflow.com/a/66519708/188740
export default (error: unknown): error is ErrorWithCode =>
  (error as ErrorWithCode).code !== undefined;
