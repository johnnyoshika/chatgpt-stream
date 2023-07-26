type OpenAIError = {
  response: {
    data: {
      error: {
        message: string;
      };
    };
  };
};

// Type guard: https://stackoverflow.com/a/66519708/188740
export default (error: unknown): error is OpenAIError =>
  (error as OpenAIError).response?.data?.error?.message !== undefined;
