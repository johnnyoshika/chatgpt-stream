import 'dotenv/config';
import express from 'express';
import { Configuration, OpenAIApi } from 'openai';
import { AzureKeyCredential, OpenAIClient } from '@azure/openai';
import { replaceAll } from 'replaceAll';
import type { Readable } from 'stream';
import errorMessage from './errors/errorMessage';

const openai = new OpenAIApi(
  new Configuration({
    apiKey: process.env.OPENAI_API_KEY,
  }),
);

const azureOpenAI = new OpenAIClient(
  process.env.AZURE_OPENAI_ENDPOINT!,
  new AzureKeyCredential(process.env.AZURE_OPENAI_KEY!),
);

const query = 'Why is the sky blue?';

const app = express();

app.get('/openai', async (_req, res) => {
  console.log('/openai');

  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders(); // flush the headers to establish SSE with client

  try {
    const stream = (
      await openai.createChatCompletion(
        {
          model: 'gpt-4',
          messages: [
            {
              role: 'user',
              content: query,
            },
          ],
          temperature: 0.4,
          stream: true,
        },
        { responseType: 'stream' },
      )
    ).data as unknown as Readable;

    let body = '';

    stream.on('data', chunk => {
      const lines = chunk
        .toString()
        .split('\n')
        .filter((line: string) => line.trim() !== '');

      console.log('lines', lines.length);
      for (const line of lines) {
        console.log(line);
        const message = line.replace(/^data: /, '');
        if (message === '[DONE]') {
          console.log('body', body);
          console.log('Done', 'closing the connection');
          res.write(
            `data: ${JSON.stringify({
              done: true,
            })}\n\n`,
          );
          return;
        }
        const parsed = JSON.parse(message);
        const content = parsed.choices[0]?.delta?.content;
        if (!content) continue;

        body += content;

        // res.write() flushes the headers along with its first chunk
        // More info on res.write() and res.flushHeaders() used above: https://stackoverflow.com/a/68900039/188740
        res.write(
          `data: ${JSON.stringify({
            // Do the \n replacement here, b/c if \n is at the end of the chunk, it'll be considered a chunk separator by the browser
            text: replaceAll(content, '\n', '<br>'),
          })}\n\n`, // Each notification is sent as a block of text terminated by a pair of newlines: https://developer.mozilla.org/en-US/docs/Web/API/Server-sent_events/Using_server-sent_events#sending_events_from_the_server
        );
      }
    });

    stream.on('end', () => {
      console.log('on end', 'closing the connection');
      res.end();
    });

    stream.on('error', error => {
      console.error('on error', error);
      res.write(
        `data: ${JSON.stringify({
          error: errorMessage(error),
        })}\n\n`,
      );
      res.end();
    });
  } catch (error) {
    console.error('on exception', error);
    res.write(
      `data: ${JSON.stringify({
        error: errorMessage(error),
      })}\n\n`,
    );
    res.end();
  }
});

const PORT = process.env.PORT || 8000;

app.listen(PORT, () => {
  console.log(`Server is running at http://localhost:${PORT}`);
});
