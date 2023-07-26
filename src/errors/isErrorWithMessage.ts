type ErrorWithMessage = {
  message: string;
};

// Type guard: https://stackoverflow.com/a/66519708/188740
export default (error: unknown): error is ErrorWithMessage =>
  (error as ErrorWithMessage).message !== undefined;
