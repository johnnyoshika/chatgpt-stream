type AzureOpenAIError = {
  error: {
    code: string; // "content_filter"
    message: string;
    param?: string; // e.g. "prompt"
    status?: number; // e.g. 400
    type?: string | null; // Only seen null so far
  };
};

// Type guard: https://stackoverflow.com/a/66519708/188740
export default (error: unknown): error is AzureOpenAIError =>
  (error as AzureOpenAIError).error?.code !== undefined &&
  (error as AzureOpenAIError).error?.message !== undefined;
