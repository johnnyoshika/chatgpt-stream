import isAxiosError from './isAxiosError';
import isAzureOpenAIError from './isAzureOpenAIError';
import isErrorWithCode from './isErrorWithCode';
import isErrorWithMessage from './isErrorWithMessage';
import isOpenAIError from './isOpenAIError';

export default (error: unknown): string => {
  if (isAxiosError(error) && error.response?.data?.message)
    return error.response.data.message;

  if (isOpenAIError(error)) return error.response.data.error.message;

  if (isAzureOpenAIError(error)) {
    if (error.error.code === 'content_filter')
      return "Whoops, something strange was said in the dialogue. It's time for a pause while our chatbot undergoes repairs.";
    else return error.error.message;
  }

  if (isErrorWithMessage(error)) return error.message;

  if (isErrorWithCode(error)) return error.code;

  if (typeof error === 'string') return error;

  return 'Unknown error';
};
