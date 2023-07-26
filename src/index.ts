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

app.get('/', (_req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html>
      <head>
        <style>
          .chat {
              min-height: 140px;
              font-family: Arial, sans-serif;
              padding: 10px;
              border: 1px solid #ccc;
              line-height: 1.4;
          }
          
          .chat div:last-child::after {
              content: '';
              display: inline-block;
              background-color: #a4a4a4;
              width: 12px;
              height: 20px;
              animation: blink 1s infinite;
              margin-left: 4px;
              vertical-align: -3px; 
          }
          
          @keyframes blink {
              0%, 100% { opacity: 0; }
              50% { opacity: 1; }
          }
        </style>
      </head>
      <body>
      <button id="start-both">Stream both</button>
      <h3>OpenAI: <button data-service="openai" type="button">Stream</button></h3>
      <p>${query}</p>
      <div class="chat"><div id="openai"></div></div>
      <div style="height: 40px;"></div>
      <h3>Azure: <button data-service="azure" type="button">Stream</button></h3>
      <p>${query}</p>
      <div class="chat"><div id="azure"></div></div>
      <script>
        const connectToSteam = (service) => {
          document.getElementById(service).innerHTML = '';
          const eventSource = new EventSource('/' + service);

          // Messages sent from the server that do not have an event field are received as 'message' events: https://developer.mozilla.org/en-US/docs/Web/API/Server-sent_events/Using_server-sent_events#listening_for_message_events
          eventSource.addEventListener('message', event => {
            const data = JSON.parse(event.data);

            if (data.done) {
              console.log('Done');
              // Close the connection before server closes it, b/c as soon as server closes connection, our 'error' callback will be called
              eventSource.close();
              return;
            }

            if (data.error) {
              console.log('Error', data.error);
              eventSource.close();
              return;
            }

            console.log(data);
            document.getElementById(service).innerHTML += data.text;
          });

          eventSource.addEventListener('error', error => {
            // This error callback will be called whenever the server closes the connection.
            // If the stream is done, the client will have closed the connection already (see code above), so this 'error' callback won't be called.
            // If this error callback is called, then it means that there's been some sort of unexpected error (e.g. network disconnect) or the server closed the connection for some reason.
            console.error('EventSource error:', error);

            // We're going to close the connection on error, otherwise the client will try to reconnect with a new EventSource(): https://developer.mozilla.org/en-US/docs/Web/API/Server-sent_events/Using_server-sent_events#closing_event_streams
            eventSource.close();
          });
        }

        document.querySelectorAll('button[data-service]').forEach(button => {
          button.addEventListener('click', (e) => {
            connectToSteam(e.target.getAttribute('data-service'));
          });
        });

        document.querySelector('#start-both').addEventListener('click', () => {
          connectToSteam('openai');
          connectToSteam('azure');
        });
      </script>
      </body>
    </html>`);
});

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

app.get('/azure', async (req, res) => {
  console.log('/azure');

  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders(); // flush the headers to establish SSE with client

  try {
    // https://github.com/Azure/azure-sdk-for-js/blob/main/sdk/openai/openai/samples/v1-beta/typescript/src/listCompletions.ts
    const events = await azureOpenAI.listChatCompletions(
      'gpt-35-turbo',
      [
        {
          role: 'user',
          content: query,
        },
      ],
      { maxTokens: 1000 },
    );

    let body = '';

    for await (const event of events) {
      for (const choice of event.choices) {
        const content = choice.delta?.content;
        console.log(content);
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
    }

    console.log('body', body);

    console.log('Done, closing the connection');
    res.write(
      `data: ${JSON.stringify({
        done: true,
      })}\n\n`,
    );
    res.end();
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
